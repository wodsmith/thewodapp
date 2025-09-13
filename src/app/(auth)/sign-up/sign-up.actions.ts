"use server"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { eq } from "drizzle-orm"
import { createServerAction, ZSAError } from "zsa"
import { getDd } from "@/db"
import { userTable } from "@/db/schema"
import { isTurnstileEnabled } from "@/flags"
import { signUpSchema } from "@/schemas/signup.schema"
import { createPersonalTeamForUser } from "@/server/user"
import {
	canSignUp,
	createSession,
	generateSessionToken,
	setSessionTokenCookie,
} from "@/utils/auth"
import { getIP } from "@/utils/get-IP"
import { hashPassword } from "@/utils/password-hasher"
import { validateTurnstileToken } from "@/utils/validate-captcha"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

export const signUpAction = createServerAction()
	.input(signUpSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const db = getDd()
			const { env } = getCloudflareContext()

			if ((await isTurnstileEnabled()) && input.captchaToken) {
				const success = await validateTurnstileToken(input.captchaToken)

				if (!success) {
					throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha")
				}
			}

			// Check if email is disposable
			await canSignUp({ email: input.email })

			// Check if email is already taken
			const existingUser = await db.query.userTable.findFirst({
				where: eq(userTable.email, input.email),
			})

			if (existingUser) {
				throw new ZSAError("CONFLICT", "Email already taken")
			}

			// Hash the password
			const hashedPassword = await hashPassword({ password: input.password })

			// Create the user with auto-verified email
			const [user] = await db
				.insert(userTable)
				.values({
					email: input.email,
					firstName: input.firstName,
					lastName: input.lastName,
					passwordHash: hashedPassword,
					signUpIpAddress: await getIP(),
					emailVerified: new Date(), // Auto-verify email on signup
				})
				.returning()

			if (!user || !user.email) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user")
			}

			// Create a personal team for the user
			try {
				await createPersonalTeamForUser(user)
			} catch (error) {
				console.error(
					"Failed to create personal team for user:",
					user.id,
					error,
				)
				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"Failed to set up user account. Please try again.",
				)
			}

			try {
				// Create a session
				const sessionToken = generateSessionToken()
				const session = await createSession({
					token: sessionToken,
					userId: user.id,
					authenticationType: "password",
				})

				// Set the session cookie
				await setSessionTokenCookie({
					token: sessionToken,
					userId: user.id,
					expiresAt: new Date(session.expiresAt),
				})

				// Skip email verification since we auto-verify on signup
				// No need to generate verification token or send email
			} catch (error) {
				console.error(error)

				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"Failed to create session after signup",
				)
			}

			return { success: true }
		}, RATE_LIMITS.SIGN_UP)
	})
