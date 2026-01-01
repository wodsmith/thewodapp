/**
 * Google SSO Server Functions for TanStack Start
 * Handles Google OAuth flow initiation and callback processing
 */

import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { generateCodeVerifier, generateState, decodeIdToken } from "arctic"
import type { OAuth2Tokens } from "arctic"
import { eq } from "drizzle-orm"
import ms from "ms"
import { z } from "zod"
import { REDIRECT_AFTER_SIGN_IN } from "@/constants"
import { getDb } from "@/db"
import { teamMembershipTable, teamTable, userTable } from "@/db/schema"
import { getGoogleSSOClient, isGoogleSSOEnabled } from "@/lib/sso/google-sso"
import { googleSSOCallbackSchema } from "@/schemas/google-sso-callback.schema"
import {
	canSignUp,
	createAndStoreSession,
	getSessionFromCookie,
} from "@/utils/auth"
import { getIP } from "@/utils/get-IP"
import isProd from "@/utils/is-prod"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

// Cookie names for OAuth state management
const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state"
const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME = "google_oauth_code_verifier"

// Cookie options for OAuth cookies
const OAUTH_COOKIE_MAX_AGE_SECONDS = Math.floor(ms("10 minutes") / 1000)

/**
 * Google ID token claims structure
 */
interface GoogleSSOClaims {
	/** Issuer - e.g. https://accounts.google.com */
	iss: string
	/** Authorized party */
	azp: string
	/** Audience */
	aud: string
	/** Subject - Google account ID */
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
 * Initiate Google SSO flow
 * Sets state and code verifier cookies, returns redirect URL
 */
export const initiateGoogleSSOFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return withRateLimit(async () => {
			// Check if Google SSO is enabled
			if (!isGoogleSSOEnabled()) {
				console.error("Google SSO is not enabled")
				throw redirect({ to: "/" })
			}

			// Check if user is already authenticated
			const session = await getSessionFromCookie()
			if (session) {
				throw redirect({ to: REDIRECT_AFTER_SIGN_IN })
			}

			// Generate OAuth state and code verifier
			const state = generateState()
			const codeVerifier = generateCodeVerifier()

			// Get Google OAuth client and create authorization URL
			const google = getGoogleSSOClient()
			const authUrl = google.createAuthorizationURL(state, codeVerifier, [
				"openid",
				"profile",
				"email",
			])

			// Set OAuth cookies
			setCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
				path: "/",
				httpOnly: true,
				secure: isProd,
				maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
				sameSite: "lax",
			})

			setCookie(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, {
				path: "/",
				httpOnly: true,
				secure: isProd,
				maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
				sameSite: "lax",
			})

			// Redirect to Google authorization page
			throw redirect({ href: authUrl.toString() })
		}, RATE_LIMITS.GOOGLE_SSO_REQUEST)
	},
)

/**
 * Handle Google SSO callback
 * Validates state, exchanges code for tokens, creates/updates user, creates session
 */
export const handleGoogleSSOCallbackFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => {
		// Validate code and state from URL params
		const parsed = z
			.object({
				code: z.string().optional(),
				state: z.string().optional(),
			})
			.parse(data)
		return parsed
	})
	.handler(async ({ data }) => {
		return withRateLimit(async () => {
			// Check if Google SSO is enabled
			if (!isGoogleSSOEnabled()) {
				return { error: "Google SSO is not enabled" }
			}

			// Get code and state from input
			const code = data.code
			const state = data.state

			if (!code || !state) {
				return { error: "Missing authorization code or state" }
			}

			// Validate against schema
			const parseResult = googleSSOCallbackSchema.safeParse({ code, state })
			if (!parseResult.success) {
				return { error: "Invalid callback parameters" }
			}

			// Get cookies for validation
			const cookieState = getCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME)
			const cookieCodeVerifier = getCookie(
				GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
			)

			if (!cookieState || !cookieCodeVerifier) {
				return { error: "Missing required cookies. Please try again." }
			}

			// Validate state matches
			if (state !== cookieState) {
				return { error: "Invalid state parameter" }
			}

			// Exchange authorization code for tokens
			let tokens: OAuth2Tokens
			try {
				const google = getGoogleSSOClient()
				tokens = await google.validateAuthorizationCode(
					code,
					cookieCodeVerifier,
				)
			} catch (error) {
				console.error(
					"Google OAuth callback: Error validating authorization code",
					error,
				)
				return { error: "Invalid authorization code" }
			}

			// Decode ID token to get user info
			const claims = decodeIdToken(tokens.idToken()) as GoogleSSOClaims

			const googleAccountId = claims.sub
			const avatarUrl = claims.picture
			const email = claims.email

			// Check if email is disposable
			try {
				await canSignUp({ email })
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Email validation failed"
				return { error: message }
			}

			const db = getDb()

			try {
				// First check if user exists with this Google account ID
				const existingUserWithGoogle = await db.query.userTable.findFirst({
					where: eq(userTable.googleAccountId, googleAccountId),
				})

				if (existingUserWithGoogle?.id) {
					await createAndStoreSession(existingUserWithGoogle.id, "google-oauth")
					throw redirect({ to: REDIRECT_AFTER_SIGN_IN })
				}

				// Then check if user exists with this email
				const existingUserWithEmail = await db.query.userTable.findFirst({
					where: eq(userTable.email, email),
				})

				if (existingUserWithEmail?.id) {
					// User exists but hasn't linked Google - link their account
					const [updatedUser] = await db
						.update(userTable)
						.set({
							googleAccountId,
							avatar: existingUserWithEmail.avatar || avatarUrl,
							emailVerified: existingUserWithEmail.emailVerified || new Date(),
						})
						.where(eq(userTable.id, existingUserWithEmail.id))
						.returning()

					if (!updatedUser) {
						return { error: "Failed to update user" }
					}

					await createAndStoreSession(updatedUser.id, "google-oauth")
					throw redirect({ to: REDIRECT_AFTER_SIGN_IN })
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
						emailVerified: new Date(),
						signUpIpAddress: await getIP(),
					})
					.returning()

				if (!user) {
					return { error: "Failed to create user" }
				}

				// Create a personal team for the new Google SSO user
				try {
					const personalTeamName = `${user.firstName || "Personal"}'s Team (personal)`
					const personalTeamSlug = `${
						user.firstName?.toLowerCase() || "personal"
					}-${user.id.slice(-6)}`

					const personalTeamResult = await db
						.insert(teamTable)
						.values({
							name: personalTeamName,
							slug: personalTeamSlug,
							description:
								"Personal team for individual programming track subscriptions",
							isPersonalTeam: 1,
							personalTeamOwnerId: user.id,
						})
						.returning()

					const personalTeam = personalTeamResult[0]

					if (personalTeam) {
						// Add the user as a member of their personal team
						await db.insert(teamMembershipTable).values({
							teamId: personalTeam.id,
							userId: user.id,
							roleId: "owner",
							isSystemRole: 1,
							joinedAt: new Date(),
							isActive: 1,
						})
					}
				} catch (error) {
					console.error(
						"Failed to create personal team for Google SSO user:",
						user.id,
						error,
					)
					// Continue with login even if team creation fails
				}

				await createAndStoreSession(user.id, "google-oauth")
				throw redirect({ to: REDIRECT_AFTER_SIGN_IN })
			} catch (error) {
				// Re-throw redirects
				if (error && typeof error === "object" && "to" in error) {
					throw error
				}

				console.error("Google SSO callback error:", error)
				return { error: "An unexpected error occurred" }
			}
		}, RATE_LIMITS.GOOGLE_SSO_CALLBACK)
	})

/**
 * Check if Google SSO is available
 */
export const isGoogleSSOEnabledFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return { enabled: isGoogleSSOEnabled() }
	},
)
