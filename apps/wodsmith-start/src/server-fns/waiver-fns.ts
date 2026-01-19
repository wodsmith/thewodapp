/**
 * Waiver Server Functions for TanStack Start
 * Handles waiver CRUD operations and signing for competition registration
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { eq, and, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { waiversTable, waiverSignaturesTable } from "@/db/schemas/waivers"
import type { Waiver, WaiverSignature } from "@/db/schemas/waivers"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { autochunk } from "@/utils/batch-query"

// Re-export types for consumers
export type { Waiver, WaiverSignature }

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionWaiversInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getWaiverInputSchema = z.object({
	waiverId: z.string().min(1, "Waiver ID is required"),
})

const getWaiverSignaturesForRegistrationInputSchema = z.object({
	registrationId: z.string().min(1, "Registration ID is required"),
})

const createWaiverInputSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
	title: z.string().min(1, "Title is required").max(255, "Title is too long"),
	content: z
		.string()
		.min(1, "Content is required")
		.max(50000, "Content is too long"),
	required: z.boolean().default(true),
})

const updateWaiverInputSchema = z.object({
	waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
	title: z
		.string()
		.min(1, "Title is required")
		.max(255, "Title is too long")
		.optional(),
	content: z
		.string()
		.min(1, "Content is required")
		.max(50000, "Content is too long")
		.optional(),
	required: z.boolean().optional(),
})

const deleteWaiverInputSchema = z.object({
	waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
})

const reorderWaiversInputSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
	waivers: z
		.array(
			z.object({
				id: z.string().startsWith("waiv_", "Invalid waiver ID"),
				position: z.number().int().min(0),
			}),
		)
		.min(1, "At least one waiver is required"),
})

const signWaiverInputSchema = z.object({
	waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
	registrationId: z
		.string()
		.startsWith("creg_", "Invalid registration ID")
		.optional(),
	ipAddress: z.string().max(45).optional(), // IPv6 max length
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate that a competition belongs to the given team (organizing team)
 * Throws an error if the competition doesn't exist or doesn't belong to the team
 */
async function validateCompetitionOwnership(
	competitionId: string,
	teamId: string,
): Promise<void> {
	const db = getDb()

	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	if (!competition) {
		throw new Error("Competition not found")
	}

	if (competition.organizingTeamId !== teamId) {
		throw new Error("Competition does not belong to this team")
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all waivers for a competition, ordered by position
 */
export const getCompetitionWaiversFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionWaiversInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<{ waivers: Waiver[] }> => {
		const db = getDb()

		const waivers = await db.query.waiversTable.findMany({
			where: eq(waiversTable.competitionId, data.competitionId),
			orderBy: (table, { asc }) => [asc(table.position)],
		})

		return { waivers }
	})

/**
 * Get a single waiver by ID
 */
export const getWaiverFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getWaiverInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ waiver: Waiver | null }> => {
		const db = getDb()

		const waiver = await db.query.waiversTable.findFirst({
			where: eq(waiversTable.id, data.waiverId),
		})

		return { waiver: waiver ?? null }
	})

/**
 * Get all waiver signatures for a registration
 * Used to check if an athlete has signed all required waivers
 */
export const getWaiverSignaturesForRegistrationFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getWaiverSignaturesForRegistrationInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<{ signatures: WaiverSignature[] }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Authentication required")
		}

		const db = getDb()

		const signatures = await db.query.waiverSignaturesTable.findMany({
			where: eq(waiverSignaturesTable.registrationId, data.registrationId),
			with: {
				waiver: true,
			},
		})

		return { signatures }
	})

/**
 * Get all waiver signatures for a user in a specific competition
 * Used to check if a user (captain or teammate) has signed all required waivers
 */
export const getWaiverSignaturesForUserFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				userId: z.string().min(1),
				competitionId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }): Promise<{ signatures: WaiverSignature[] }> => {
		const db = getDb()

		// Get all waivers for the competition
		const waivers = await db.query.waiversTable.findMany({
			where: eq(waiversTable.competitionId, data.competitionId),
		})

		const waiverIds = waivers.map((w) => w.id)

		if (waiverIds.length === 0) {
			return { signatures: [] }
		}

		// Get signatures for this user for any of those waivers
		// Use autochunk to handle potential large arrays (D1 has 100 param limit)
		const signatures = await autochunk(
			{ items: waiverIds, otherParametersCount: 1 }, // 1 for userId param
			async (chunk) =>
				db.query.waiverSignaturesTable.findMany({
					where: and(
						eq(waiverSignaturesTable.userId, data.userId),
						inArray(waiverSignaturesTable.waiverId, chunk),
					),
					with: {
						waiver: true,
					},
				}),
		)

		return { signatures }
	})

/**
 * Get all waiver signatures for a competition (organizer view)
 * Returns signatures grouped by waiverId and userId for easy lookup
 * Requires MANAGE_PROGRAMMING permission
 */
export const getCompetitionWaiverSignaturesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: z.string().min(1),
				teamId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			signatures: Array<{
				id: string
				waiverId: string
				userId: string
				signedAt: Date
			}>
		}> => {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Authentication required")
			}

			// Check permission
			const hasAccess = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
			if (!hasAccess) {
				throw new Error("Permission denied")
			}

			// Validate competition belongs to team
			await validateCompetitionOwnership(data.competitionId, data.teamId)

			const db = getDb()

			// Get all waivers for this competition
			const waivers = await db.query.waiversTable.findMany({
				where: eq(waiversTable.competitionId, data.competitionId),
			})

			if (waivers.length === 0) {
				return { signatures: [] }
			}

			const waiverIds = waivers.map((w) => w.id)

			// Get all signatures for these waivers
			const signatures = await autochunk(
				{ items: waiverIds, otherParametersCount: 0 },
				async (chunk) =>
					db.query.waiverSignaturesTable.findMany({
						columns: {
							id: true,
							waiverId: true,
							userId: true,
							signedAt: true,
						},
						where: inArray(waiverSignaturesTable.waiverId, chunk),
					}),
			)

			return { signatures }
		},
	)

/**
 * Create a new waiver for a competition
 * Requires MANAGE_PROGRAMMING permission (competition management)
 */
export const createWaiverFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createWaiverInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ success: true; waiver: Waiver }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Authentication required")
		}

		// Check permission to manage competitions
		const hasAccess = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		if (!hasAccess) {
			throw new Error("No permission to manage competitions")
		}

		// Validate competition belongs to team
		await validateCompetitionOwnership(data.competitionId, data.teamId)

		const db = getDb()

		// Get current max position
		const existingWaivers = await db.query.waiversTable.findMany({
			where: eq(waiversTable.competitionId, data.competitionId),
			orderBy: (table, { desc }) => [desc(table.position)],
		})

		const maxPosition =
			existingWaivers.length > 0 ? (existingWaivers[0]?.position ?? -1) : -1

		// Insert waiver
		const result = await db
			.insert(waiversTable)
			.values({
				competitionId: data.competitionId,
				title: data.title,
				content: data.content,
				required: data.required,
				position: maxPosition + 1,
			})
			.returning()

		const [waiver] = Array.isArray(result) ? result : []
		if (!waiver) {
			throw new Error("Failed to create waiver")
		}

		return { success: true, waiver }
	})

/**
 * Update an existing waiver
 * Requires MANAGE_PROGRAMMING permission
 */
export const updateWaiverFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateWaiverInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ success: true; waiver: Waiver }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Authentication required")
		}

		// Check permission
		const hasAccess = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		if (!hasAccess) {
			throw new Error("No permission to manage competitions")
		}

		// Validate competition belongs to team
		await validateCompetitionOwnership(data.competitionId, data.teamId)

		const db = getDb()

		// Validate waiver belongs to the specified competition
		const existingWaiver = await db.query.waiversTable.findFirst({
			where: and(
				eq(waiversTable.id, data.waiverId),
				eq(waiversTable.competitionId, data.competitionId),
			),
		})

		if (!existingWaiver) {
			throw new Error("Waiver not found or does not belong to this competition")
		}

		// Build update data
		const updateData: Partial<typeof waiversTable.$inferInsert> = {
			updatedAt: new Date(),
		}

		if (data.title !== undefined) updateData.title = data.title
		if (data.content !== undefined) updateData.content = data.content
		if (data.required !== undefined) updateData.required = data.required

		// Update waiver with compound where clause
		const result = await db
			.update(waiversTable)
			.set(updateData)
			.where(
				and(
					eq(waiversTable.id, data.waiverId),
					eq(waiversTable.competitionId, data.competitionId),
				),
			)
			.returning()

		const [waiver] = Array.isArray(result) ? result : []
		if (!waiver) {
			throw new Error("Failed to update waiver")
		}

		return { success: true, waiver }
	})

/**
 * Delete a waiver
 * Requires MANAGE_PROGRAMMING permission
 * Cascade deletes signatures via DB constraint
 */
export const deleteWaiverFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteWaiverInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ success: true }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Authentication required")
		}

		// Check permission
		const hasAccess = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		if (!hasAccess) {
			throw new Error("No permission to manage competitions")
		}

		// Validate competition belongs to team
		await validateCompetitionOwnership(data.competitionId, data.teamId)

		const db = getDb()

		// Delete waiver with compound where clause (waiverId AND competitionId)
		// This ensures we only delete waivers that belong to the specified competition
		await db
			.delete(waiversTable)
			.where(
				and(
					eq(waiversTable.id, data.waiverId),
					eq(waiversTable.competitionId, data.competitionId),
				),
			)

		return { success: true }
	})

/**
 * Reorder waivers (drag and drop)
 * Requires MANAGE_PROGRAMMING permission
 */
export const reorderWaiversFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => reorderWaiversInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ success: true }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Authentication required")
		}

		// Check permission
		const hasAccess = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		if (!hasAccess) {
			throw new Error("No permission to manage competitions")
		}

		// Validate competition belongs to team
		await validateCompetitionOwnership(data.competitionId, data.teamId)

		const db = getDb()

		// Update positions for each waiver with compound where clause
		// This ensures we only update waivers that belong to the specified competition
		for (const waiver of data.waivers) {
			await db
				.update(waiversTable)
				.set({ position: waiver.position, updatedAt: new Date() })
				.where(
					and(
						eq(waiversTable.id, waiver.id),
						eq(waiversTable.competitionId, data.competitionId),
					),
				)
		}

		return { success: true }
	})

/**
 * Sign a waiver
 * Anyone can sign (athlete during registration or teammate during invite acceptance)
 */
export const signWaiverFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => signWaiverInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{ success: true; signature: WaiverSignature }> => {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Authentication required")
			}

			const db = getDb()

			// Check if user already signed this waiver
			const existingSignature = await db.query.waiverSignaturesTable.findFirst({
				where: and(
					eq(waiverSignaturesTable.waiverId, data.waiverId),
					eq(waiverSignaturesTable.userId, session.userId),
				),
			})

			if (existingSignature) {
				// Already signed, return success
				return { success: true, signature: existingSignature }
			}

			// Create signature
			const result = await db
				.insert(waiverSignaturesTable)
				.values({
					waiverId: data.waiverId,
					userId: session.userId,
					registrationId: data.registrationId,
					ipAddress: data.ipAddress,
					signedAt: new Date(),
				})
				.returning()

			const [signature] = Array.isArray(result) ? result : []
			if (!signature) {
				throw new Error("Failed to create signature")
			}

			return { success: true, signature }
		},
	)
