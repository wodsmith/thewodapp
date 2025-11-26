"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { createServerAction, ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import {
	athleteProfileExtendedSchema,
	athleteProfileSchema,
	userSettingsSchema,
} from "@/schemas/settings.schema"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

export const updateUserProfileAction = createServerAction()
	.input(userSettingsSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			const db = getDb()

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Unauthorized")
			}

			try {
				await db
					.update(userTable)
					.set({
						...input,
					})
					.where(eq(userTable.id, session.user.id))

				await updateAllSessionsOfUser(session.user.id)

				revalidatePath("/settings")
				return { success: true }
			} catch (error) {
				console.error(error)
				throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update profile")
			}
		}, RATE_LIMITS.SETTINGS)
	})

export const updateAthleteProfileAction = createServerAction()
	.input(athleteProfileSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const session = await getSessionFromCookie()
			const db = getDb()

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Unauthorized")
			}

			try {
				await db
					.update(userTable)
					.set({
						gender: input.gender,
						dateOfBirth: input.dateOfBirth,
					})
					.where(eq(userTable.id, session.user.id))

				await updateAllSessionsOfUser(session.user.id)

				revalidatePath("/compete/profile")
				return { success: true }
			} catch (error) {
				console.error(error)
				throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update athlete profile")
			}
		}, RATE_LIMITS.SETTINGS)
	})

export const updateAthleteExtendedProfileAction = createServerAction()
	.input(athleteProfileExtendedSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			const session = await getSessionFromCookie()
			const db = getDb()

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Unauthorized")
			}

			try {
				// Stringify the athleteProfile JSON
				const athleteProfileJson = JSON.stringify(input)

				await db
					.update(userTable)
					.set({
						athleteProfile: athleteProfileJson,
					})
					.where(eq(userTable.id, session.user.id))

				await updateAllSessionsOfUser(session.user.id)

				revalidatePath("/compete/athlete")
				return { success: true }
			} catch (error) {
				console.error(error)
				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"Failed to update athlete profile",
				)
			}
		}, RATE_LIMITS.SETTINGS)
	})
