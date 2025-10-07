"use server"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { init } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"
import { createServerAction, ZSAError } from "@repo/zsa"
import { PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS } from "@/constants"
import { getDd } from "@/db"
import { userTable } from "@/db/schema"
import { isTurnstileEnabled } from "@/flags"
import { forgotPasswordSchema } from "@/schemas/forgot-password.schema"
import { getResetTokenKey } from "@/utils/auth-utils"
import { sendPasswordResetEmail } from "@/utils/email"
import { validateTurnstileToken } from "@/utils/validate-captcha"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

const createId = init({
	length: 32,
})

export const forgotPasswordAction = createServerAction()
	.input(forgotPasswordSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			if ((await isTurnstileEnabled()) && input.captchaToken) {
				const success = await validateTurnstileToken(input.captchaToken)

				if (!success) {
					throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha")
				}
			}

			const db = getDd()
			const { env } = getCloudflareContext()

			try {
				// Find user by email
				const user = await db.query.userTable.findFirst({
					where: eq(userTable.email, input.email.toLowerCase()),
				})

				// Even if user is not found, return success to prevent email enumeration
				if (!user) {
					return { success: true }
				}

				// Generate reset token
				const token = createId()
				const expiresAt = new Date(
					Date.now() + PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS * 1000,
				)

				if (!env?.NEXT_INC_CACHE_KV) {
					throw new Error("Can't connect to KV store")
				}

				// Save reset token in KV with expiration
				await env.NEXT_INC_CACHE_KV.put(
					getResetTokenKey(token),
					JSON.stringify({
						userId: user.id,
						expiresAt: expiresAt.toISOString(),
					}),
					{
						expirationTtl: Math.floor(
							(expiresAt.getTime() - Date.now()) / 1000,
						),
					},
				)

				// Send reset email
				if (user?.email) {
					await sendPasswordResetEmail({
						email: user.email,
						resetToken: token,
						username: user.firstName ?? user.email,
					})
				}

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
		}, RATE_LIMITS.FORGOT_PASSWORD)
	})
