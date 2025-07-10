"use server"

import { decodeIdToken, type OAuth2Tokens } from "arctic"
import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { createServerAction, ZSAError } from "zsa"
import {
	GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
	GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "@/constants"
import { getDd } from "@/db"
import { userTable } from "@/db/schema"
import { isGoogleSSOEnabled } from "@/flags"
import { getGoogleSSOClient } from "@/lib/sso/google-sso"
import { googleSSOCallbackSchema } from "@/schemas/google-sso-callback.schema"
import { canSignUp, createAndStoreSession } from "@/utils/auth"
import { getIP } from "@/utils/get-IP"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

type GoogleSSOResponse = {
	/**
	 * Issuer
	 * Example: https://accounts.google.com
	 */
	iss: string
	/**
	 * Authorized party
	 * Example: 111111111111-x403h5fq3e4ts2qa022tcgdpm9lqhvj5.apps.googleusercontent.com
	 */
	azp: string
	/**
	 * Audience
	 * Example: 111111111111-x403h5fq3e4ts2qa022tcgdpm9lqhvj5.apps.googleusercontent.com
	 */
	aud: string
	/**
	 * Subject
	 * Example: 111111111111111111111
	 */
	sub: string
	email: string
	email_verified: boolean
	/**
	 * Access token hash
	 * Example: HhYIlZToOmC0QB1-N_SzE
	 */
	at_hash: string
	name: string
	picture: string
	given_name: string
	family_name: string
	iat: number
	exp: number
}

export const googleSSOCallbackAction = createServerAction()
	.input(googleSSOCallbackSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			if (!(await isGoogleSSOEnabled())) {
				throw new ZSAError("FORBIDDEN", "Google SSO is not enabled")
			}

			const cookieStore = await cookies()
			const cookieState =
				cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value ?? null
			const cookieCodeVerifier =
				cookieStore.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)?.value ?? null

			if (!cookieState || !cookieCodeVerifier) {
				throw new ZSAError("NOT_AUTHORIZED", "Missing required cookies")
			}

			if (input.state !== cookieState) {
				throw new ZSAError("NOT_AUTHORIZED", "Invalid state parameter")
			}

			let tokens: OAuth2Tokens
			try {
				const google = getGoogleSSOClient()
				tokens = await google.validateAuthorizationCode(
					input.code,
					cookieCodeVerifier,
				)
			} catch (error) {
				console.error(
					"Google OAuth callback: Error validating authorization code",
					error,
				)
				throw new ZSAError("NOT_AUTHORIZED", "Invalid authorization code")
			}

			const claims = decodeIdToken(tokens.idToken()) as GoogleSSOResponse

			const googleAccountId = claims.sub
			const avatarUrl = claims.picture
			const email = claims.email

			// Check if email is disposable
			await canSignUp({ email })

			const db = getDd()

			try {
				// First check if user exists with this Google account ID
				const existingUserWithGoogle = await db.query.userTable.findFirst({
					where: eq(userTable.googleAccountId, googleAccountId),
				})

				if (existingUserWithGoogle?.id) {
					await createAndStoreSession(existingUserWithGoogle.id, "google-oauth")
					return { success: true }
				}

				// Then check if user exists with this email
				const existingUserWithEmail = await db.query.userTable.findFirst({
					where: eq(userTable.email, email),
				})

				if (existingUserWithEmail?.id) {
					// User exists but hasn't linked Google - let's link their account
					const [updatedUser] = await db
						.update(userTable)
						.set({
							googleAccountId,
							avatar: existingUserWithEmail.avatar || avatarUrl,
							emailVerified:
								existingUserWithEmail.emailVerified ||
								(claims?.email_verified ? new Date() : null),
						})
						.where(eq(userTable.id, existingUserWithEmail.id))
						.returning()

					await createAndStoreSession(updatedUser.id, "google-oauth")
					return { success: true }
				}

				// No existing user found - create a new one
				const [user] = await db
					.insert(userTable)
					.values({
						googleAccountId,
						firstName: claims.given_name || claims.name || null,
						lastName: claims.family_name || null,
						avatar: avatarUrl,
						email,
						emailVerified: claims?.email_verified ? new Date() : null,
						signUpIpAddress: await getIP(),
					})
					.returning()

				// TODO: If the user is not verified, send a verification email

				await createAndStoreSession(user.id, "google-oauth")
				return { success: true }
			} catch (error) {
				console.error(error)

				if (error instanceof ZSAError) {
					throw error
				}

				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"An unexpected error occurred",
				)
			}
		}, RATE_LIMITS.GOOGLE_SSO_CALLBACK)
	})
