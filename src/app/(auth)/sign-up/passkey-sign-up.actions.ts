"use server"

import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants"
import { getDB } from "@/db"
import { userTable } from "@/db/schema"
import { isTurnstileEnabled } from "@/flags"
import { passkeyEmailSchema } from "@/schemas/passkey.schema"
import { createPersonalTeamForUser } from "@/server/user"
import {
	canSignUp,
	createSession,
	generateSessionToken,
	setSessionTokenCookie,
} from "@/utils/auth"
import { getVerificationTokenKey } from "@/utils/auth-utils"
import { sendVerificationEmail } from "@/utils/email"
import { getIP } from "@/utils/get-IP"
import { validateTurnstileToken } from "@/utils/validate-captcha"
import {
	generatePasskeyRegistrationOptions,
	verifyPasskeyRegistration,
} from "@/utils/webauthn"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createId } from "@paralleldrive/cuid2"
import type {
	PublicKeyCredentialCreationOptionsJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/types"
import { eq } from "drizzle-orm"
import ms from "ms"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import { ZSAError, createServerAction } from "zsa"

const PASSKEY_CHALLENGE_COOKIE_NAME = "passkey_challenge"
const PASSKEY_USER_ID_COOKIE_NAME = "passkey_user_id"

export const startPasskeyRegistrationAction = createServerAction()
	.input(passkeyEmailSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			if ((await isTurnstileEnabled()) && input.captchaToken) {
				const success = await validateTurnstileToken(input.captchaToken)

				if (!success) {
					throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha")
				}
			}

			const db = getDB()

			// Check if email is disposable
			await canSignUp({ email: input.email })

			const existingUser = await db.query.userTable.findFirst({
				where: eq(userTable.email, input.email),
			})

			if (existingUser) {
				throw new ZSAError(
					"CONFLICT",
					"An account with this email already exists",
				)
			}

			const ipAddress = await getIP()

			const [user] = await db
				.insert(userTable)
				.values({
					email: input.email,
					firstName: input.firstName,
					lastName: input.lastName,
					signUpIpAddress: ipAddress,
				})
				.returning()

			if (!user) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user")
			}

			// Create a personal team for the user
			await createPersonalTeamForUser(user)

			// Generate passkey registration options
			const options = await generatePasskeyRegistrationOptions(
				user.id,
				input.email,
			)

			const cookieStore = await cookies()

			// Store the challenge in a cookie for verification
			cookieStore.set(PASSKEY_CHALLENGE_COOKIE_NAME, options.challenge, {
				httpOnly: true,
				secure: true,
				sameSite: "strict",
				path: "/",
				maxAge: Math.floor(ms("10 minutes") / 1000),
			})

			// Store the user ID in a cookie for verification
			cookieStore.set(PASSKEY_USER_ID_COOKIE_NAME, user.id, {
				httpOnly: true,
				secure: true,
				sameSite: "strict",
				path: "/",
				maxAge: Math.floor(ms("10 minutes") / 1000),
			})

			// Convert options to the expected type
			const optionsJSON: PublicKeyCredentialCreationOptionsJSON = {
				rp: options.rp,
				user: options.user,
				challenge: options.challenge,
				pubKeyCredParams: options.pubKeyCredParams,
				timeout: options.timeout,
				excludeCredentials: options.excludeCredentials,
				authenticatorSelection: options.authenticatorSelection,
				attestation: options.attestation,
				extensions: options.extensions,
			}

			return { optionsJSON }
		}, RATE_LIMITS.SIGN_UP)
	})

const completePasskeyRegistrationSchema = z.object({
	response: z.custom<RegistrationResponseJSON>(
		(val): val is RegistrationResponseJSON => {
			return (
				typeof val === "object" && val !== null && "id" in val && "rawId" in val
			)
		},
		"Invalid registration response",
	),
})

export const completePasskeyRegistrationAction = createServerAction()
	.input(completePasskeyRegistrationSchema)
	.handler(async ({ input }) => {
		const cookieStore = await cookies()
		const challenge = cookieStore.get(PASSKEY_CHALLENGE_COOKIE_NAME)?.value
		const userId = cookieStore.get(PASSKEY_USER_ID_COOKIE_NAME)?.value

		if (!challenge || !userId) {
			throw new ZSAError("PRECONDITION_FAILED", "Invalid registration session")
		}

		try {
			// Verify the registration
			await verifyPasskeyRegistration({
				userId,
				response: input.response,
				challenge,
				userAgent: (await headers()).get("user-agent"),
				ipAddress: await getIP(),
			})

			// Get user details for email verification
			const db = getDB()
			const user = await db.query.userTable.findFirst({
				where: eq(userTable.id, userId),
			})

			if (!user || !user.email) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", "User not found")
			}

			// Generate verification token
			const { env } = getCloudflareContext()
			const verificationToken = createId()
			const expiresAt = new Date(
				Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000,
			)

			if (!env?.NEXT_INC_CACHE_KV) {
				throw new Error("Can't connect to KV store")
			}

			// Save verification token in KV with expiration
			await env.NEXT_INC_CACHE_KV.put(
				getVerificationTokenKey(verificationToken),
				JSON.stringify({
					userId: user.id,
					expiresAt: expiresAt.toISOString(),
				}),
				{
					expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
				},
			)

			// Send verification email
			await sendVerificationEmail({
				email: user.email,
				verificationToken,
				username: user.firstName || user.email,
			})

			// Create a session
			const sessionToken = generateSessionToken()
			const session = await createSession({
				token: sessionToken,
				userId,
				authenticationType: "passkey",
				passkeyCredentialId: input.response.id,
			})

			// Set the session cookie
			await setSessionTokenCookie({
				token: sessionToken,
				userId,
				expiresAt: new Date(session.expiresAt),
			})

			// Clean up cookies
			cookieStore.delete(PASSKEY_CHALLENGE_COOKIE_NAME)
			cookieStore.delete(PASSKEY_USER_ID_COOKIE_NAME)

			return { success: true }
		} catch (error) {
			console.error("Failed to register passkey:", error)
			throw new ZSAError("PRECONDITION_FAILED", "Failed to register passkey")
		}
	})
