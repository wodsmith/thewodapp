"use server"

import "server-only"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { eq } from "drizzle-orm"
import { createServerAction, ZSAError } from "zsa"
import { getDB } from "@/db"
import { userTable } from "@/db/schema"
import { verifyEmailSchema } from "@/schemas/verify-email.schema"
import { getVerificationTokenKey } from "@/utils/auth-utils"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

export const verifyEmailAction = createServerAction()
	.input(verifyEmailSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const { env } = getCloudflareContext()

			if (!env?.NEXT_INC_CACHE_KV) {
				throw new Error("Can't connect to KV store")
			}

			const verificationTokenStr = await env.NEXT_INC_CACHE_KV.get(
				getVerificationTokenKey(input.token),
			)

			if (!env?.NEXT_INC_CACHE_KV) {
				throw new Error("Can't connect to KV store")
			}

			if (!verificationTokenStr) {
				throw new ZSAError(
					"NOT_FOUND",
					"Verification token not found or expired",
				)
			}

			const verificationToken = JSON.parse(verificationTokenStr) as {
				userId: string
				expiresAt: string
			}

			// Check if token is expired (although KV should have auto-deleted it)
			if (new Date() > new Date(verificationToken.expiresAt)) {
				throw new ZSAError(
					"NOT_FOUND",
					"Verification token not found or expired",
				)
			}

			const db = getDB()

			// Find user
			const user = await db.query.userTable.findFirst({
				where: eq(userTable.id, verificationToken.userId),
			})

			if (!user) {
				throw new ZSAError("NOT_FOUND", "User not found")
			}

			try {
				// Update user's email verification status
				await db
					.update(userTable)
					.set({ emailVerified: new Date() })
					.where(eq(userTable.id, verificationToken.userId))

				// Update all sessions of the user to reflect the new email verification status
				await updateAllSessionsOfUser(verificationToken.userId)

				// Delete the used token
				await env.NEXT_INC_CACHE_KV.delete(getVerificationTokenKey(input.token))

				// Add a small delay to ensure all updates are processed
				await new Promise((resolve) => setTimeout(resolve, 500))

				return { success: true }
			} catch (error) {
				console.error(error)

				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"An unexpected error occurred",
				)
			}
		}, RATE_LIMITS.EMAIL)
	})
