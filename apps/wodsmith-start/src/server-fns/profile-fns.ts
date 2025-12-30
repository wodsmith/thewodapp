/**
 * Profile Server Functions for TanStack Start
 * Functions for getting and updating user profile
 */

import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"

// ============================================================================
// Input Schemas
// ============================================================================

const updateUserProfileInputSchema = z.object({
	firstName: z
		.string()
		.min(2, "First name must be at least 2 characters")
		.max(255, "First name is too long"),
	lastName: z
		.string()
		.min(2, "Last name must be at least 2 characters")
		.max(255, "Last name is too long"),
	avatar: z
		.string()
		.url("Invalid avatar URL")
		.max(600, "URL is too long")
		.optional()
		.or(z.literal("")),
})

export type UpdateUserProfileInput = z.infer<
	typeof updateUserProfileInputSchema
>

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the current user's profile
 */
export const getUserProfileFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getSessionFromCookie()

		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const db = getDb()

		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.userId),
			columns: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				avatar: true,
				createdAt: true,
				updatedAt: true,
			},
		})

		if (!user) {
			throw new Error("User not found")
		}

		return {
			success: true,
			data: user,
		}
	},
)

/**
 * Update the current user's profile
 */
export const updateUserProfileFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateUserProfileInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()

		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const db = getDb()

		// Build update object, only including avatar if provided and not empty
		const updateData: {
			firstName: string
			lastName: string
			avatar?: string | null
			updatedAt: Date
		} = {
			firstName: data.firstName,
			lastName: data.lastName,
			updatedAt: new Date(),
		}

		// Handle avatar: if empty string, set to null; if provided, use the value
		if (data.avatar !== undefined) {
			updateData.avatar = data.avatar === "" ? null : data.avatar
		}

		await db
			.update(userTable)
			.set(updateData)
			.where(eq(userTable.id, session.userId))

		// Update all sessions to reflect the new profile data
		await updateAllSessionsOfUser(session.userId)

		return {
			success: true,
		}
	})
