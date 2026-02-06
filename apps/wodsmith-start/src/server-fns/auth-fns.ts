/**
 * Authentication Server Functions for TanStack Start
 * Handles sign-in, sign-up, password reset, email verification, and other auth-related server functions
 *
 * This file uses top-level imports for server-only modules.
 * See: .claude/skills/tanstack-start-server-only/SKILL.md
 *
 * OBSERVABILITY:
 * - All auth operations are logged with request context
 * - User IDs and created entity IDs are tracked
 * - Failures are logged with appropriate error details (no sensitive data)
 */

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
import { teamMembershipTable, teamTable, userTable } from "@/db/schema"
import {
	addRequestContextAttribute,
	logEntityCreated,
	logEntityUpdated,
	logError,
	logInfo,
	logWarning,
	updateRequestContext,
} from "@/lib/logging"
import {
	resetPasswordSchema,
	signInSchema,
	signUpSchema,
	type VerifyEmailInput,
	verifyEmailSchema,
} from "@/schemas/auth.schema"
import {
	canSignUp,
	createAndStoreSession,
	getSessionFromCookie,
} from "@/utils/auth"
import { getResetTokenKey, getVerificationTokenKey } from "@/utils/auth-utils"
import { sendPasswordResetEmail, sendVerificationEmail } from "@/utils/email"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { hashPassword, verifyPassword } from "@/utils/password-hasher"
import { validateTurnstileToken } from "@/utils/validate-captcha"

// Re-export schemas and types for backwards compatibility
// But consumers should prefer importing from @/schemas/auth.schema
export {
	type ForgotPasswordInput,
	type ResetPasswordInput,
	resetPasswordSchema,
	type SignInInput,
	type SignUpInput,
	signInSchema,
	signUpSchema,
	type VerifyEmailInput,
	verifyEmailSchema,
} from "@/schemas/auth.schema"

// Create a CUID2 generator with 32 character length for tokens
const createToken = init({
	length: 32,
})

const forgotPasswordInputSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	captchaToken: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Sign in with email and password
 */
export const signInFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => signInSchema.parse(data))
	.handler(async ({ data }) => {
		logInfo({
			message: "[Auth] Sign-in attempt",
			attributes: { email: data.email.toLowerCase() },
		})

		const db = getDb()

		// Find user by email (case-insensitive, like forgotPasswordFn)
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email.toLowerCase()),
		})

		if (!user) {
			logWarning({
				message: "[Auth] Sign-in failed - user not found",
				attributes: { email: data.email.toLowerCase() },
			})
			throw new Error("Invalid email or password")
		}

		// Check if user has only Google SSO
		if (!user.passwordHash && user.googleAccountId) {
			logWarning({
				message: "[Auth] Sign-in failed - Google SSO account",
				attributes: { userId: user.id },
			})
			throw new Error("Please sign in with your Google account instead.")
		}

		if (!user.passwordHash) {
			logWarning({
				message: "[Auth] Sign-in failed - no password hash",
				attributes: { userId: user.id },
			})
			throw new Error("Invalid email or password")
		}

		// Verify password
		const isValid = await verifyPassword({
			storedHash: user.passwordHash,
			passwordAttempt: data.password,
		})

		if (!isValid) {
			logWarning({
				message: "[Auth] Sign-in failed - invalid password",
				attributes: { userId: user.id },
			})
			throw new Error("Invalid email or password")
		}

		// Create session and set cookie
		await createAndStoreSession(user.id, "password")

		// Update request context with user info for downstream logs
		updateRequestContext({ userId: user.id })

		logInfo({
			message: "[Auth] Sign-in successful",
			attributes: { userId: user.id },
		})

		return { success: true, userId: user.id }
	})

/**
 * Sign up with email and password
 */
export const signUpFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => signUpSchema.parse(data))
	.handler(async ({ data }) => {
		logInfo({
			message: "[Auth] Sign-up attempt",
			attributes: { email: data.email },
		})

		const db = getDb()

		// Validate CAPTCHA token if provided
		if (data.captchaToken) {
			const isValidCaptcha = await validateTurnstileToken(data.captchaToken)
			if (!isValidCaptcha) {
				logWarning({
					message: "[Auth] Sign-up failed - CAPTCHA verification failed",
					attributes: { email: data.email },
				})
				throw new Error("CAPTCHA verification failed. Please try again.")
			}
		}

		// Check if email is disposable
		await canSignUp({ email: data.email })

		// Check if email is already taken
		const existingUser = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email),
		})

		if (existingUser) {
			logWarning({
				message: "[Auth] Sign-up failed - email already taken",
				attributes: { email: data.email },
			})
			throw new Error("Email already taken")
		}

		// Hash the password
		const hashedPassword = await hashPassword({ password: data.password })

		// Create the user with auto-verified email
		const [user] = await db
			.insert(userTable)
			.values({
				email: data.email,
				firstName: data.firstName,
				lastName: data.lastName,
				passwordHash: hashedPassword,
				emailVerified: new Date(), // Auto-verify email on signup
			})
			.returning()

		if (!user || !user.email) {
			logError({
				message: "[Auth] Sign-up failed - user creation failed",
				attributes: { email: data.email },
			})
			throw new Error("Failed to create user")
		}

		// Update request context with new user ID
		updateRequestContext({ userId: user.id })
		addRequestContextAttribute("createdUserId", user.id)

		logEntityCreated({
			entity: "user",
			id: user.id,
			attributes: { email: user.email },
		})

		// Create a personal team for the user (inline logic)
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

		if (!personalTeam) {
			logError({
				message: "[Auth] Sign-up failed - personal team creation failed",
				attributes: { userId: user.id },
			})
			throw new Error("Failed to create personal team")
		}

		logEntityCreated({
			entity: "team",
			id: personalTeam.id,
			parentEntity: "user",
			parentId: user.id,
			attributes: { isPersonalTeam: true },
		})

		// Add the user as a member of their personal team
		await db.insert(teamMembershipTable).values({
			teamId: personalTeam.id,
			userId: user.id,
			roleId: "owner", // System role for team owner
			isSystemRole: 1,
			joinedAt: new Date(),
			isActive: 1,
		})

		// Create session and set cookie
		await createAndStoreSession(user.id, "password")

		logInfo({
			message: "[Auth] Sign-up successful",
			attributes: {
				userId: user.id,
				personalTeamId: personalTeam.id,
			},
		})

		return { success: true, userId: user.id }
	})

/**
 * Get current session (for checking if user is already authenticated)
 * Returns the session data if user is authenticated, null otherwise.
 */
export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return await getSessionFromCookie()
	},
)

/**
 * Validate reset token exists and is not expired
 */
export const validateResetTokenFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ token: z.string() }).parse(data),
	)
	.handler(async ({ data }) => {
		const tokenData = await env.KV_SESSION.get(getResetTokenKey(data.token))

		if (!tokenData) {
			return { valid: false, error: "Invalid or expired reset token" }
		}

		try {
			const parsed = JSON.parse(tokenData) as {
				userId: string
				expiresAt: string
			}

			// Check if token is expired
			if (new Date() > new Date(parsed.expiresAt)) {
				return { valid: false, error: "Reset token has expired" }
			}

			return { valid: true }
		} catch {
			return { valid: false, error: "Invalid token format" }
		}
	})

/**
 * Reset password with token
 */
export const resetPasswordFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => resetPasswordSchema.parse(data))
	.handler(async ({ data }) => {
		logInfo({ message: "[Auth] Password reset attempt" })

		const db = getDb()

		// Find valid reset token
		const resetTokenStr = await env.KV_SESSION.get(getResetTokenKey(data.token))

		if (!resetTokenStr) {
			logWarning({ message: "[Auth] Password reset failed - invalid token" })
			throw new Error("Invalid or expired reset token")
		}

		const resetToken = JSON.parse(resetTokenStr) as {
			userId: string
			expiresAt: string
		}

		// Update context with user ID from token
		updateRequestContext({ userId: resetToken.userId })

		// Check if token is expired (although KV should have auto-deleted it)
		if (new Date() > new Date(resetToken.expiresAt)) {
			logWarning({
				message: "[Auth] Password reset failed - token expired",
				attributes: { userId: resetToken.userId },
			})
			throw new Error("Reset token has expired")
		}

		// Find user
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, resetToken.userId),
		})

		if (!user) {
			logError({
				message: "[Auth] Password reset failed - user not found",
				attributes: { userId: resetToken.userId },
			})
			throw new Error("User not found")
		}

		// Hash new password and update
		const passwordHash = await hashPassword({ password: data.password })
		await db
			.update(userTable)
			.set({ passwordHash })
			.where(eq(userTable.id, resetToken.userId))

		// Delete the used token
		await env.KV_SESSION.delete(getResetTokenKey(data.token))

		logEntityUpdated({
			entity: "user",
			id: user.id,
			fields: ["passwordHash"],
		})

		logInfo({
			message: "[Auth] Password reset successful",
			attributes: { userId: user.id },
		})

		return { success: true }
	})

/**
 * Verify email with token
 */
export const verifyEmailFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: unknown): VerifyEmailInput => verifyEmailSchema.parse(data),
	)
	.handler(async ({ data }) => {
		logInfo({ message: "[Auth] Email verification attempt" })

		const kv = env.KV_SESSION

		if (!kv) {
			logError({ message: "[Auth] Email verification failed - KV unavailable" })
			throw new Error("Can't connect to KV store")
		}

		const verificationTokenStr = await kv.get(
			getVerificationTokenKey(data.token),
		)

		if (!verificationTokenStr) {
			logWarning({
				message: "[Auth] Email verification failed - invalid token",
			})
			throw new Error("Verification token not found or expired")
		}

		const verificationToken = JSON.parse(verificationTokenStr) as {
			userId: string
			expiresAt: string
		}

		// Update context with user ID from token
		updateRequestContext({ userId: verificationToken.userId })

		// Check if token is expired (although KV should have auto-deleted it)
		if (new Date() > new Date(verificationToken.expiresAt)) {
			logWarning({
				message: "[Auth] Email verification failed - token expired",
				attributes: { userId: verificationToken.userId },
			})
			throw new Error("Verification token not found or expired")
		}

		const db = getDb()

		// Find user
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, verificationToken.userId),
		})

		if (!user) {
			logError({
				message: "[Auth] Email verification failed - user not found",
				attributes: { userId: verificationToken.userId },
			})
			throw new Error("User not found")
		}

		try {
			// Update user's email verification status
			await db
				.update(userTable)
				.set({ emailVerified: new Date() })
				.where(eq(userTable.id, verificationToken.userId))

			logEntityUpdated({
				entity: "user",
				id: user.id,
				fields: ["emailVerified"],
			})

			// Update all sessions of the user to reflect the new email verification status
			await updateAllSessionsOfUser(verificationToken.userId)

			// Delete the used token
			await kv.delete(getVerificationTokenKey(data.token))

			// Add a small delay to ensure all updates are processed
			await new Promise((resolve) => setTimeout(resolve, 500))

			logInfo({
				message: "[Auth] Email verification successful",
				attributes: { userId: user.id },
			})

			return { success: true }
		} catch (error) {
			logError({
				message: "[Auth] Email verification failed - unexpected error",
				error,
				attributes: { userId: user.id },
			})
			throw new Error("An unexpected error occurred")
		}
	})

/**
 * Request a password reset email.
 * Always returns success to prevent email enumeration attacks.
 */
export const forgotPasswordFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => forgotPasswordInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Note: We log the attempt but not the email to avoid leaking info about valid emails
		logInfo({ message: "[Auth] Password reset request received" })

		const db = getDb()

		// Validate CAPTCHA token if provided
		if (data.captchaToken) {
			const isValidCaptcha = await validateTurnstileToken(data.captchaToken)
			if (!isValidCaptcha) {
				logWarning({
					message: "[Auth] Password reset - CAPTCHA verification failed",
				})
				throw new Error("CAPTCHA verification failed. Please try again.")
			}
		}

		try {
			// Find user by email (case-insensitive)
			const user = await db.query.userTable.findFirst({
				where: eq(userTable.email, data.email.toLowerCase()),
			})

			// Even if user is not found, return success to prevent email enumeration
			if (!user) {
				logInfo({
					message: "[Auth] Password reset - user not found (returning success)",
				})
				return { success: true }
			}

			// Update context with user ID
			updateRequestContext({ userId: user.id })

			// Generate reset token
			const token = createToken()
			const expiresAt = new Date(
				Date.now() + PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS * 1000,
			)

			// Verify KV is available
			if (!env?.KV_SESSION) {
				logError({
					message: "[Auth] Password reset failed - KV_SESSION unavailable",
				})
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

			logInfo({
				message: "[Auth] Password reset email sent",
				attributes: { userId: user.id },
			})

			return { success: true }
		} catch (error) {
			logError({
				message: "[Auth] Password reset failed - unexpected error",
				error,
			})

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
			logWarning({
				message: "[Auth] Resend verification failed - not authenticated",
			})
			throw new Error("Not authenticated")
		}

		// Update context with user ID
		updateRequestContext({ userId: session.user.id })

		logInfo({
			message: "[Auth] Resend verification requested",
			attributes: { userId: session.user.id },
		})

		if (session.user.emailVerified) {
			logWarning({
				message: "[Auth] Resend verification failed - already verified",
				attributes: { userId: session.user.id },
			})
			throw new Error("Email is already verified")
		}

		// Verify KV is available
		if (!env?.KV_SESSION) {
			logError({
				message: "[Auth] Resend verification failed - KV_SESSION unavailable",
				attributes: { userId: session.user.id },
			})
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

			logInfo({
				message: "[Auth] Verification email sent",
				attributes: { userId: session.user.id },
			})

			return { success: true }
		} catch (error) {
			logError({
				message: "[Auth] Resend verification failed - unexpected error",
				error,
				attributes: { userId: session.user.id },
			})
			throw new Error("Failed to send verification email. Please try again.")
		}
	},
)
