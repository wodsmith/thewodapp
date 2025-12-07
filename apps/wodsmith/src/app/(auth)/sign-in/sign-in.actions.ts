"use server"

import { eq } from "drizzle-orm"
import { createServerAction, ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import { logError } from "@/lib/logging/posthog-otel-logger"
import { signInSchema } from "@/schemas/signin.schema"
import { createAndStoreSession } from "@/utils/auth"
import { verifyPassword } from "@/utils/password-hasher"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

export const signInAction = createServerAction()
	.input(signInSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const db = getDb()

			try {
				// Find user by email
				const user = await db.query.userTable.findFirst({
					where: eq(userTable.email, input.email),
				})

				if (!user) {
					throw new ZSAError("NOT_AUTHORIZED", "Invalid email or password")
				}

				// Check if user has only Google SSO
				if (!user.passwordHash && user.googleAccountId) {
					throw new ZSAError(
						"FORBIDDEN",
						"Please sign in with your Google account instead.",
					)
				}

				if (!user.passwordHash) {
					throw new ZSAError("NOT_AUTHORIZED", "Invalid email or password")
				}

				// Verify password
				const isValid = await verifyPassword({
					storedHash: user.passwordHash,
					passwordAttempt: input.password,
				})

				if (!isValid) {
					throw new ZSAError("NOT_AUTHORIZED", "Invalid email or password")
				}

			// Create session
			await createAndStoreSession(user.id, "password")

			return { success: true, userId: user.id }
			} catch (error) {
				logError({
					message: "[signInAction] Sign-in failed",
					error,
					// Note: Not logging email to avoid PII in logs
				})

				if (error instanceof ZSAError) {
					throw error
				}

				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"An unexpected error occurred",
				)
			}
		}, RATE_LIMITS.SIGN_IN)
	})
