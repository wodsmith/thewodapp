/**
 * Authentication Server Functions for TanStack Start
 * Handles password reset, email verification, and other auth-related server functions
 */
import "server-only"

import { env } from "cloudflare:workers"
import { init } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
	EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS,
	PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS,
} from "@/constants"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"
import { getResetTokenKey, getVerificationTokenKey } from "@/utils/auth-utils"
import { sendPasswordResetEmail, sendVerificationEmail } from "@/utils/email"

// Create a CUID2 generator with 32 character length for tokens
const createToken = init({
	length: 32,
})

// Input validation schema for forgot password
const forgotPasswordInputSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>

/**
 * Request a password reset email.
 * Always returns success to prevent email enumeration attacks.
 */
export const forgotPasswordFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => forgotPasswordInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		try {
			// Find user by email (case-insensitive)
			const user = await db.query.userTable.findFirst({
				where: eq(userTable.email, data.email.toLowerCase()),
			})

			// Even if user is not found, return success to prevent email enumeration
			if (!user) {
				return { success: true }
			}

			// Generate reset token
			const token = createToken()
			const expiresAt = new Date(
				Date.now() + PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS * 1000,
			)

			// Verify KV is available
			if (!env?.KV_SESSION) {
				console.error("[ForgotPassword] KV_SESSION binding not available")
				throw new Error("Service temporarily unavailable")
			}

			// Save reset token in KV with expiration
			await env.KV_SESSION.put(
				getResetTokenKey(token),
				JSON.stringify({
					userId: user.id,
					expiresAt: expiresAt.toISOString(),
				}),
				{
					expirationTtl: PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS,
				},
			)

			// Send reset email
			if (user.email) {
				await sendPasswordResetEmail({
					email: user.email,
					resetToken: token,
					username: user.firstName ?? user.email,
				})
			}

			return { success: true }
		} catch (error) {
			console.error("[ForgotPassword] Error:", error)

			// Still return success to prevent information leakage
			// The error is logged for debugging purposes
			return { success: true }
		}
	})

/**
 * Resend email verification.
 * Requires an authenticated session with an unverified email.
 */
export const resendVerificationFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await getSessionFromCookie()

		if (!session?.user?.email) {
			throw new Error("Not authenticated")
		}

		if (session.user.emailVerified) {
			throw new Error("Email is already verified")
		}

		// Verify KV is available
		if (!env?.KV_SESSION) {
			console.error("[ResendVerification] KV_SESSION binding not available")
			throw new Error("Service temporarily unavailable")
		}

		try {
			// Generate verification token
			const verificationToken = createToken()
			const expiresAt = new Date(
				Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000,
			)

			// Save verification token in KV with expiration
			await env.KV_SESSION.put(
				getVerificationTokenKey(verificationToken),
				JSON.stringify({
					userId: session.user.id,
					expiresAt: expiresAt.toISOString(),
				}),
				{
					expirationTtl: EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS,
				},
			)

			// Send verification email
			await sendVerificationEmail({
				email: session.user.email,
				verificationToken,
				username: session.user.firstName || session.user.email,
			})

			return { success: true }
		} catch (error) {
			console.error("[ResendVerification] Error:", error)
			throw new Error("Failed to send verification email. Please try again.")
		}
	},
)
