"use server"

import { eq } from "drizzle-orm"
import { createServerAction, ZSAError } from "@repo/zsa"
import { revalidatePath } from "next/cache"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { waiverSignaturesTable, waiversTable } from "@/db/schemas/waivers"
import {
	createWaiverSchema,
	deleteWaiverSchema,
	getWaiverSignaturesForRegistrationSchema,
	reorderWaiversSchema,
	signWaiverSchema,
	updateWaiverSchema,
} from "@/schemas/waivers"
import {
	getWaiverSignaturesForRegistration,
	validateCompetitionOwnership,
} from "@/server/waivers"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"

/**
 * Create a new waiver for a competition
 * Requires MANAGE_PROGRAMMING permission (competition management)
 */
export const createWaiverAction = createServerAction()
	.input(createWaiverSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check permission to manage competitions
			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			// Validate competition belongs to team
			await validateCompetitionOwnership(input.competitionId, input.teamId)

			const db = getDb()

			// Get current max position
			const existingWaivers = await db.query.waiversTable.findMany({
				where: (table, { eq }) => eq(table.competitionId, input.competitionId),
				orderBy: (table, { desc }) => [desc(table.position)],
			})

			const maxPosition =
				existingWaivers.length > 0 ? (existingWaivers[0]?.position ?? -1) : -1

			// Insert waiver
			const result = await db
				.insert(waiversTable)
				.values({
					competitionId: input.competitionId,
					title: input.title,
					content: input.content,
					required: input.required,
					position: maxPosition + 1,
				})
				.returning()

			const [waiver] = Array.isArray(result) ? result : []
			if (!waiver) {
				throw new Error("Failed to create waiver")
			}

			// Revalidate competition waivers page
			revalidatePath(`/compete/organizer/${input.competitionId}/waivers`)

			return { success: true, data: waiver }
		} catch (error) {
			console.error("Failed to create waiver:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to create waiver"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Update an existing waiver
 * Requires MANAGE_PROGRAMMING permission
 */
export const updateWaiverAction = createServerAction()
	.input(updateWaiverSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check permission
			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			// Validate competition belongs to team
			await validateCompetitionOwnership(input.competitionId, input.teamId)

			const db = getDb()

			// Build update data
			const updateData: Partial<typeof waiversTable.$inferInsert> = {
				updatedAt: new Date(),
			}

			if (input.title !== undefined) updateData.title = input.title
			if (input.content !== undefined) updateData.content = input.content
			if (input.required !== undefined) updateData.required = input.required

			// Update waiver
			const result = await db
				.update(waiversTable)
				.set(updateData)
				.where(eq(waiversTable.id, input.waiverId))
				.returning()

			const [waiver] = Array.isArray(result) ? result : []
			if (!waiver) {
				throw new Error("Failed to update waiver")
			}

			// Revalidate
			revalidatePath(`/compete/organizer/${input.competitionId}/waivers`)

			return { success: true, data: waiver }
		} catch (error) {
			console.error("Failed to update waiver:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to update waiver"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Delete a waiver
 * Requires MANAGE_PROGRAMMING permission
 * Cascade deletes signatures via DB constraint
 */
export const deleteWaiverAction = createServerAction()
	.input(deleteWaiverSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check permission
			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			// Validate competition belongs to team
			await validateCompetitionOwnership(input.competitionId, input.teamId)

			const db = getDb()

			// Delete waiver (signatures cascade via DB constraint)
			await db.delete(waiversTable).where(eq(waiversTable.id, input.waiverId))

			// Revalidate
			revalidatePath(`/compete/organizer/${input.competitionId}/waivers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to delete waiver:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to delete waiver"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Reorder waivers (drag and drop)
 * Requires MANAGE_PROGRAMMING permission
 */
export const reorderWaiversAction = createServerAction()
	.input(reorderWaiversSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check permission
			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			// Validate competition belongs to team
			await validateCompetitionOwnership(input.competitionId, input.teamId)

			const db = getDb()

			// Update positions for each waiver
			for (const waiver of input.waivers) {
				await db
					.update(waiversTable)
					.set({ position: waiver.position, updatedAt: new Date() })
					.where(eq(waiversTable.id, waiver.id))
			}

			// Revalidate
			revalidatePath(`/compete/organizer/${input.competitionId}/waivers`)

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder waivers:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to reorder waivers")
		}
	})

/**
 * Sign a waiver
 * Anyone can sign (athlete during registration or teammate during invite acceptance)
 */
export const signWaiverAction = createServerAction()
	.input(signWaiverSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const db = getDb()

			// Check if user already signed this waiver
			const existingSignature = await db.query.waiverSignaturesTable.findFirst({
				where: (table, { and, eq }) =>
					and(
						eq(table.waiverId, input.waiverId),
						eq(table.userId, session.userId),
					),
			})

			if (existingSignature) {
				// Already signed, return success
				return { success: true, data: existingSignature }
			}

			// Create signature
			const result = await db
				.insert(waiverSignaturesTable)
				.values({
					waiverId: input.waiverId,
					userId: session.userId,
					registrationId: input.registrationId,
					ipAddress: input.ipAddress,
					signedAt: new Date(),
				})
				.returning()

			const [signature] = Array.isArray(result) ? result : []
			if (!signature) {
				throw new Error("Failed to create signature")
			}

			return { success: true, data: signature }
		} catch (error) {
			console.error("Failed to sign waiver:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to sign waiver"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Get waiver signatures for a registration
 * Used to check if all required waivers have been signed
 */
export const getWaiverSignaturesForRegistrationAction = createServerAction()
	.input(getWaiverSignaturesForRegistrationSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const signatures = await getWaiverSignaturesForRegistration(
				input.registrationId,
			)

			return { success: true, data: signatures }
		} catch (error) {
			console.error("Failed to get waiver signatures:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get waiver signatures",
			)
		}
	})
