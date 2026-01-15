/**
 * Competition Server Logic
 * Server-side business logic for competition and competition group CRUD operations
 * This file contains the actual implementation logic that server functions call
 *
 * This file uses top-level imports for server-only modules.
 */

import { createId } from "@paralleldrive/cuid2"
import { and, count, eq, or } from "drizzle-orm"
import { getDb } from "@/db"
import {
	type Competition,
	type CompetitionGroup,
	competitionGroupsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { teamTable } from "@/db/schemas/teams"
import { generateSlug } from "@/utils/slugify"

/* -------------------------------------------------------------------------- */
/*                          Competition Group Functions                       */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition group (series)
 */
export async function createCompetitionGroup(params: {
	organizingTeamId: string
	name: string
	slug: string
	description?: string
}): Promise<{ groupId: string }> {
	const db = getDb()

	// Validate slug uniqueness per organizing team
	const existing = await db
		.select()
		.from(competitionGroupsTable)
		.where(
			and(
				eq(competitionGroupsTable.organizingTeamId, params.organizingTeamId),
				eq(competitionGroupsTable.slug, params.slug),
			),
		)
		.limit(1)

	if (existing[0]) {
		throw new Error(
			"A series with this slug already exists. Please choose a different slug.",
		)
	}

	// Insert competition group record
	const result = await db
		.insert(competitionGroupsTable)
		.values({
			id: `cgrp_${createId()}`,
			organizingTeamId: params.organizingTeamId,
			name: params.name,
			slug: params.slug,
			description: params.description,
		})
		.returning()

	const [group] = Array.isArray(result) ? result : []
	if (!group) {
		throw new Error("Failed to create competition series")
	}

	return { groupId: group.id }
}

/**
 * Get a single competition group by ID
 */
export async function getCompetitionGroup(
	groupId: string,
): Promise<CompetitionGroup | null> {
	const db = getDb()

	const group = await db
		.select()
		.from(competitionGroupsTable)
		.where(eq(competitionGroupsTable.id, groupId))
		.limit(1)

	return group[0] ?? null
}

/**
 * Update a competition group
 */
export async function updateCompetitionGroup(
	groupId: string,
	data: {
		name?: string
		slug?: string
		description?: string | null
	},
): Promise<CompetitionGroup> {
	const db = getDb()

	// Get the group to verify it exists and get organizingTeamId
	const existingGroup = await getCompetitionGroup(groupId)
	if (!existingGroup) {
		throw new Error("Competition series not found")
	}

	// If slug is being changed, validate uniqueness
	if (data.slug && data.slug !== existingGroup.slug) {
		const conflicting = await db
			.select()
			.from(competitionGroupsTable)
			.where(
				and(
					eq(
						competitionGroupsTable.organizingTeamId,
						existingGroup.organizingTeamId,
					),
					eq(competitionGroupsTable.slug, data.slug),
				),
			)
			.limit(1)

		if (conflicting[0]) {
			throw new Error(
				"A series with this slug already exists. Please choose a different slug.",
			)
		}
	}

	const updateData: Partial<typeof competitionGroupsTable.$inferInsert> = {
		updatedAt: new Date(),
	}

	if (data.name !== undefined) updateData.name = data.name
	if (data.slug !== undefined) updateData.slug = data.slug
	if (data.description !== undefined) updateData.description = data.description

	const result = await db
		.update(competitionGroupsTable)
		.set(updateData)
		.where(eq(competitionGroupsTable.id, groupId))
		.returning()

	const [group] = Array.isArray(result) ? result : []
	if (!group) {
		throw new Error("Failed to update competition series")
	}

	return group
}

/**
 * Delete a competition group
 */
export async function deleteCompetitionGroup(
	groupId: string,
): Promise<{ success: boolean }> {
	const db = getDb()

	// Check if group has competitions
	const competitionsInGroup = await db
		.select({ count: count() })
		.from(competitionsTable)
		.where(eq(competitionsTable.groupId, groupId))

	const competitionCount = competitionsInGroup[0]?.count ?? 0
	if (competitionCount > 0) {
		throw new Error(
			`Cannot delete series that contains ${competitionCount} competition(s). Please remove or reassign competitions first.`,
		)
	}

	await db
		.delete(competitionGroupsTable)
		.where(eq(competitionGroupsTable.id, groupId))

	return { success: true }
}

/* -------------------------------------------------------------------------- */
/*                            Competition Functions                           */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition
 * Creates the competition and auto-generates a competition_event team
 */
export async function createCompetition(params: {
	organizingTeamId: string
	name: string
	slug: string
	startDate: Date
	endDate: Date
	description?: string
	registrationOpensAt?: Date
	registrationClosesAt?: Date
	groupId?: string
	settings?: string
}): Promise<{ competitionId: string; competitionTeamId: string }> {
	const db = getDb()

	// Validate slug uniqueness (globally unique for public URLs)
	const existingCompetition = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.slug, params.slug))
		.limit(1)

	if (existingCompetition[0]) {
		throw new Error(
			"A competition with this slug already exists. Please choose a different slug.",
		)
	}

	// Validate group exists if provided
	if (params.groupId) {
		const group = await getCompetitionGroup(params.groupId)
		if (!group) {
			throw new Error("Competition series not found")
		}
		// Validate group belongs to organizing team
		if (group.organizingTeamId !== params.organizingTeamId) {
			throw new Error(
				"Competition series does not belong to the organizing team",
			)
		}
	}

	// Step 1: Create competition_event team for athlete management
	// Generate unique slug for competition team (internal, not public-facing)
	let teamSlug = generateSlug(`${params.name}-event`)
	let teamSlugIsUnique = false
	let attempts = 0

	while (!teamSlugIsUnique && attempts < 5) {
		const existingTeam = await db
			.select()
			.from(teamTable)
			.where(eq(teamTable.slug, teamSlug))
			.limit(1)

		if (!existingTeam[0]) {
			teamSlugIsUnique = true
		} else {
			// Add random suffix to make slug unique
			teamSlug = `${generateSlug(`${params.name}-event`)}-${createId().substring(0, 4)}`
			attempts++
		}
	}

	if (!teamSlugIsUnique) {
		throw new Error("Could not generate unique slug for competition team")
	}

	// Insert competition_event team
	const newTeam = await db
		.insert(teamTable)
		.values({
			name: `${params.name} (Event)`,
			slug: teamSlug,
			type: "competition_event",
			parentOrganizationId: params.organizingTeamId,
			description: `Competition event team for ${params.name}`,
			creditBalance: 0,
		})
		.returning()

	const competitionTeam = Array.isArray(newTeam) ? newTeam[0] : undefined
	if (!competitionTeam || !competitionTeam.id) {
		throw new Error("Failed to create competition event team")
	}

	const competitionTeamId = competitionTeam.id

	// Step 2: Insert competition record
	let competition: typeof competitionsTable.$inferSelect | undefined
	try {
		const result = await db
			.insert(competitionsTable)
			.values({
				id: `comp_${createId()}`,
				organizingTeamId: params.organizingTeamId,
				competitionTeamId,
				groupId: params.groupId,
				name: params.name,
				slug: params.slug,
				description: params.description,
				startDate: params.startDate,
				endDate: params.endDate,
				registrationOpensAt: params.registrationOpensAt,
				registrationClosesAt: params.registrationClosesAt,
				settings: params.settings,
			})
			.returning()

		const [inserted] = Array.isArray(result) ? result : []
		if (!inserted) {
			throw new Error("Competition insert returned no result")
		}
		competition = inserted
	} catch (competitionError) {
		// Compensating cleanup: delete the competition team created in Step 1
		try {
			await db.delete(teamTable).where(eq(teamTable.id, competitionTeamId))
		} catch (cleanupError) {
			// Log cleanup error but still throw original error
			console.error("Failed to clean up competition team:", cleanupError)
		}

		throw new Error(
			`Failed to create competition: ${competitionError instanceof Error ? competitionError.message : String(competitionError)}`,
		)
	}

	if (!competition) {
		throw new Error(
			"Competition not defined after insert - this should not happen",
		)
	}

	return {
		competitionId: competition.id,
		competitionTeamId,
	}
}

/**
 * Get a single competition by ID or slug
 */
export async function getCompetition(
	idOrSlug: string,
): Promise<Competition | null> {
	const db = getDb()

	const competition = await db
		.select()
		.from(competitionsTable)
		.where(
			or(
				eq(competitionsTable.id, idOrSlug),
				eq(competitionsTable.slug, idOrSlug),
			),
		)
		.limit(1)

	return competition[0] ?? null
}

/**
 * Update an existing competition
 */
export async function updateCompetition(
	competitionId: string,
	updates: Partial<{
		name: string
		slug: string
		description: string | null
		startDate: Date
		endDate: Date
		registrationOpensAt: Date | null
		registrationClosesAt: Date | null
		groupId: string | null
		settings: string | null
		visibility: "public" | "private"
		status: "draft" | "published"
		profileImageUrl: string | null
		bannerImageUrl: string | null
	}>,
): Promise<Competition> {
	const db = getDb()

	// Get the competition to verify it exists
	const existingCompetition = await getCompetition(competitionId)
	if (!existingCompetition) {
		throw new Error("Competition not found")
	}

	// If slug is being changed, validate uniqueness
	if (updates.slug && updates.slug !== existingCompetition.slug) {
		const conflicting = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.slug, updates.slug))
			.limit(1)

		if (conflicting[0]) {
			throw new Error(
				"A competition with this slug already exists. Please choose a different slug.",
			)
		}
	}

	// If groupId is being changed, validate it belongs to organizing team
	if (
		updates.groupId !== undefined &&
		updates.groupId !== existingCompetition.groupId
	) {
		if (updates.groupId) {
			const group = await getCompetitionGroup(updates.groupId)
			if (!group) {
				throw new Error("Competition series not found")
			}
			if (group.organizingTeamId !== existingCompetition.organizingTeamId) {
				throw new Error(
					"Competition series does not belong to the organizing team",
				)
			}
		}
	}

	// Build update data
	const updateData: Partial<typeof competitionsTable.$inferInsert> = {
		updatedAt: new Date(),
	}

	if (updates.name !== undefined) updateData.name = updates.name
	if (updates.slug !== undefined) updateData.slug = updates.slug
	if (updates.description !== undefined)
		updateData.description = updates.description
	if (updates.startDate !== undefined) updateData.startDate = updates.startDate
	if (updates.endDate !== undefined) updateData.endDate = updates.endDate
	if (updates.registrationOpensAt !== undefined)
		updateData.registrationOpensAt = updates.registrationOpensAt
	if (updates.registrationClosesAt !== undefined)
		updateData.registrationClosesAt = updates.registrationClosesAt
	if (updates.groupId !== undefined) updateData.groupId = updates.groupId
	if (updates.settings !== undefined) updateData.settings = updates.settings
	if (updates.visibility !== undefined)
		updateData.visibility = updates.visibility
	if (updates.status !== undefined) updateData.status = updates.status
	if (updates.profileImageUrl !== undefined)
		updateData.profileImageUrl = updates.profileImageUrl
	if (updates.bannerImageUrl !== undefined)
		updateData.bannerImageUrl = updates.bannerImageUrl

	const result = await db
		.update(competitionsTable)
		.set(updateData)
		.where(eq(competitionsTable.id, competitionId))
		.returning()

	const [competition] = Array.isArray(result) ? result : []
	if (!competition) {
		throw new Error("Failed to update competition")
	}

	return competition
}
