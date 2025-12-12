"use server"

import { decodeIdToken, type OAuth2Tokens } from "arctic"
import { eq } from "drizzle-orm"
import { deleteCookie, getCookie } from "vinxi/http"
import {
	GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
	GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "~/constants"
import { getDb } from "~/db/index.server"
import { userTable } from "~/db/schema.server"
import { getGoogleSSOClient } from "~/lib/sso/google-sso"
import { canSignUp, createAndStoreSession } from "~/utils/auth.server"
import { getIP } from "~/utils/get-IP.server"

interface GoogleSSOResponse {
	/** Issuer - Example: https://accounts.google.com */
	iss: string
	/** Authorized party - Google Client ID */
	azp: string
	/** Audience - Google Client ID */
	aud: string
	/** Subject - Google User ID */
	sub: string
	email: string
	email_verified: boolean
	/** Access token hash */
	at_hash: string
	name: string
	picture: string
	given_name: string
	family_name: string
	iat: number
	exp: number
}

/**
 * Handle Google OAuth callback.
 * Exchanges the authorization code for tokens, verifies the ID token,
 * and creates or links a user account.
 *
 * @param code - Authorization code from Google
 * @param state - State parameter from Google callback
 * @returns Success or error response
 */
export async function handleGoogleOAuthCallback(code: string, state: string) {
	try {
		// Get stored state and code verifier from cookies
		const cookieState = getCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME)
		const cookieCodeVerifier = getCookie(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)

		// Validate state parameter
		if (!cookieState || !cookieCodeVerifier) {
			return { success: false, error: "Missing OAuth cookies" }
		}

		if (state !== cookieState) {
			return { success: false, error: "Invalid state parameter" }
		}

		// Exchange code for tokens
		let tokens: OAuth2Tokens
		try {
			const google = getGoogleSSOClient()
			tokens = await google.validateAuthorizationCode(code, cookieCodeVerifier)
		} catch (error) {
			console.error("Google OAuth: Error validating authorization code", error)
			return { success: false, error: "Invalid authorization code" }
		}

		// Decode and validate ID token
		const claims = decodeIdToken(tokens.idToken()) as GoogleSSOResponse

		const googleAccountId = claims.sub
		const avatarUrl = claims.picture
		const email = claims.email
		const firstName = claims.given_name || claims.name || null
		const lastName = claims.family_name || null

		// Verify email is not disposable
		try {
			await canSignUp({ email })
		} catch (error) {
			console.error("Google OAuth: Disposable email check failed", error)
			return {
				success: false,
				error: "This email address is not allowed for signup",
			}
		}

		const db = getDb()

		try {
			// Check if user exists with this Google account ID
			const existingUserWithGoogle = await db.query.userTable.findFirst({
				where: eq(userTable.googleAccountId, googleAccountId),
			})

			if (existingUserWithGoogle?.id) {
				await createAndStoreSession(existingUserWithGoogle.id, "google-oauth")

				// Clear OAuth cookies
				deleteCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME)
				deleteCookie(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)

				return { success: true }
			}

			// Check if user exists with this email
			const existingUserWithEmail = await db.query.userTable.findFirst({
				where: eq(userTable.email, email),
			})

			if (existingUserWithEmail?.id) {
				// Link Google account to existing user
				await db
					.update(userTable)
					.set({
						googleAccountId,
						avatar: existingUserWithEmail.avatar || avatarUrl,
						emailVerified: existingUserWithEmail.emailVerified || new Date(),
					})
					.where(eq(userTable.id, existingUserWithEmail.id))

				await createAndStoreSession(existingUserWithEmail.id, "google-oauth")

				// Clear OAuth cookies
				deleteCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME)
				deleteCookie(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)

				return { success: true }
			}

			// Create new user account
			const [newUser] = await db
				.insert(userTable)
				.values({
					googleAccountId,
					firstName,
					lastName,
					avatar: avatarUrl,
					email,
					emailVerified: new Date(),
					signUpIpAddress: await getIP(),
				})
				.returning()

			if (!newUser) {
				console.error("Google OAuth: Failed to create user")
				return { success: false, error: "Failed to create user account" }
			}

			// Create personal team for new user
			try {
				const { createPersonalTeamForUser } = await import(
					"~/server/user.server"
				)
				await createPersonalTeamForUser(newUser)
			} catch (error) {
				console.error(
					"Google OAuth: Failed to create personal team for user:",
					newUser.id,
					error,
				)
				// Continue with login even if team creation fails
			}

			await createAndStoreSession(newUser.id, "google-oauth")

			// Clear OAuth cookies
			deleteCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME)
			deleteCookie(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)

			return { success: true }
		} catch (error) {
			console.error("Google OAuth callback error:", error)
			return {
				success: false,
				error: "An unexpected error occurred during sign in",
			}
		}
	} catch (error) {
		console.error("Google OAuth: Unexpected error", error)
		return {
			success: false,
			error: "An unexpected error occurred",
		}
	}
}
