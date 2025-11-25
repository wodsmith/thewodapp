import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { and, count, eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	type Competition,
	type CompetitionGroup,
	competitionGroupsTable,
	competitionsTable,
} from "@/db/schema"
import { requireFeature } from "./entitlements"
import { FEATURES } from "@/config/features"

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

	// Validate organizing team has HOST_COMPETITIONS feature
	await requireFeature(params.organizingTeamId, FEATURES.HOST_COMPETITIONS)

	// Validate slug uniqueness per organizing team
	const existing = await db.query.competitionGroupsTable.findFirst({
		where: and(
			eq(competitionGroupsTable.organizingTeamId, params.organizingTeamId),
			eq(competitionGroupsTable.slug, params.slug),
		),
	})

	if (existing) {
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
 * Get all competition groups for an organizing team
 */
export async function getCompetitionGroups(
	organizingTeamId: string,
): Promise<
	Array<CompetitionGroup & { competitionCount: number }>
> {
	const db = getDb()

	// Query groups with competition counts
	const groups = await db
		.select({
			id: competitionGroupsTable.id,
			organizingTeamId: competitionGroupsTable.organizingTeamId,
			slug: competitionGroupsTable.slug,
			name: competitionGroupsTable.name,
			description: competitionGroupsTable.description,
			createdAt: competitionGroupsTable.createdAt,
			updatedAt: competitionGroupsTable.updatedAt,
			updateCounter: competitionGroupsTable.updateCounter,
			competitionCount: sql<number>`cast(count(${competitionsTable.id}) as integer)`,
		})
		.from(competitionGroupsTable)
		.leftJoin(
			competitionsTable,
			eq(competitionsTable.groupId, competitionGroupsTable.id),
		)
		.where(eq(competitionGroupsTable.organizingTeamId, organizingTeamId))
		.groupBy(competitionGroupsTable.id)
		.orderBy(sql`${competitionGroupsTable.createdAt} DESC`)

	return groups
}

/**
 * Get a single competition group by ID
 */
export async function getCompetitionGroup(
	groupId: string,
): Promise<CompetitionGroup | null> {
	const db = getDb()

	const group = await db.query.competitionGroupsTable.findFirst({
		where: eq(competitionGroupsTable.id, groupId),
	})

	return group ?? null
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
		const conflicting = await db.query.competitionGroupsTable.findFirst({
			where: and(
				eq(
					competitionGroupsTable.organizingTeamId,
					existingGroup.organizingTeamId,
				),
				eq(competitionGroupsTable.slug, data.slug),
			),
		})

		if (conflicting) {
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
 * @param organizingTeamId - The gym team creating the competition
 * @param competitionData - Competition details
 *
 * Phase 2 Implementation:
 * - Validate organizing team has HOST_COMPETITIONS feature
 * - Generate unique slug
 * - Auto-create competition_event team
 * - Insert competition record
 * - Create default scaling group for divisions
 * - Return competitionId and competitionTeamId
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
}): Promise<{ competitionId: string; competitionTeamId: string }> {
	const db = getDb()

	// Validate organizing team has HOST_COMPETITIONS feature
	await requireFeature(params.organizingTeamId, FEATURES.HOST_COMPETITIONS)

	// Validate slug uniqueness (globally unique for public URLs)
	const existingCompetition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.slug, params.slug),
	})

	if (existingCompetition) {
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
	// Import TEAM_TYPE_ENUM from schema
	const { TEAM_TYPE_ENUM, teamTable } = await import("@/db/schema")
	const { generateSlug } = await import("@/utils/slugify")

	// Generate unique slug for competition team (internal, not public-facing)
	let teamSlug = generateSlug(`${params.name}-event`)
	let teamSlugIsUnique = false
	let attempts = 0

	while (!teamSlugIsUnique && attempts < 5) {
		const existingTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.slug, teamSlug),
		})

		if (!existingTeam) {
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
			type: TEAM_TYPE_ENUM.COMPETITION_EVENT,
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
		})
		.returning()

	const [competition] = Array.isArray(result) ? result : []
	if (!competition) {
		throw new Error("Failed to create competition")
	}

	return {
		competitionId: competition.id,
		competitionTeamId,
	}
}

/**
 * Get all competitions for an organizing team
 *
 * Phase 2 Implementation:
 * - Query competitions by organizingTeamId
 * - Include competition team and group data
 * - Order by startDate DESC
 * - Return competitions with full details
 */
export async function getCompetitions(
	organizingTeamId: string,
): Promise<Competition[]> {
	const db = getDb()

	const competitions = await db.query.competitionsTable.findMany({
		where: eq(competitionsTable.organizingTeamId, organizingTeamId),
		with: {
			competitionTeam: true,
			group: true,
			organizingTeam: true,
		},
		orderBy: (table, { desc }) => [desc(table.startDate)],
	})

	return competitions
}

/**
 * Get a single competition by ID or slug
 *
 * Phase 2 Implementation:
 * - Support lookup by ID or slug
 * - Include organizing team, competition team, and group
 * - Include registration count
 * - Return full competition details
 */
export async function getCompetition(
	idOrSlug: string,
): Promise<Competition | null> {
	const db = getDb()
	const { or } = await import("drizzle-orm")

	const competition = await db.query.competitionsTable.findFirst({
		where: or(
			eq(competitionsTable.id, idOrSlug),
			eq(competitionsTable.slug, idOrSlug),
		),
		with: {
			competitionTeam: true,
			group: true,
			organizingTeam: true,
		},
	})

	return competition ?? null
}

/**
 * Update an existing competition
 *
 * Phase 2 Implementation:
 * - Validate user has permission to modify
 * - Update competition fields
 * - Handle slug changes (ensure uniqueness)
 * - Return updated competition
 */
export async function updateCompetition(
	competitionId: string,
	updates: Partial<{
		name: string
		slug: string
		description: string
		startDate: Date
		endDate: Date
		registrationOpensAt: Date
		registrationClosesAt: Date
		groupId: string
		settings: string
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
		const conflicting = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.slug, updates.slug),
		})

		if (conflicting) {
			throw new Error(
				"A competition with this slug already exists. Please choose a different slug.",
			)
		}
	}

	// If groupId is being changed, validate it belongs to organizing team
	if (updates.groupId !== undefined && updates.groupId !== existingCompetition.groupId) {
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
	if (updates.description !== undefined) updateData.description = updates.description
	if (updates.startDate !== undefined) updateData.startDate = updates.startDate
	if (updates.endDate !== undefined) updateData.endDate = updates.endDate
	if (updates.registrationOpensAt !== undefined) updateData.registrationOpensAt = updates.registrationOpensAt
	if (updates.registrationClosesAt !== undefined) updateData.registrationClosesAt = updates.registrationClosesAt
	if (updates.groupId !== undefined) updateData.groupId = updates.groupId
	if (updates.settings !== undefined) updateData.settings = updates.settings

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

/**
 * Delete a competition
 *
 * Phase 2 Implementation:
 * - Validate user has permission
 * - Check for existing registrations (warn if any)
 * - Delete competition (cascade to registrations)
 * - Delete competition_event team
 * - Return success
 */
export async function deleteCompetition(
	competitionId: string,
): Promise<{ success: boolean }> {
	const db = getDb()
	const { competitionRegistrationsTable } = await import("@/db/schema")
	const { teamTable } = await import("@/db/schema")

	// Get the competition to verify it exists and get the competitionTeamId
	const competition = await getCompetition(competitionId)
	if (!competition) {
		throw new Error("Competition not found")
	}

	// Check for existing registrations
	const registrations = await db
		.select({ count: count() })
		.from(competitionRegistrationsTable)
		.where(eq(competitionRegistrationsTable.eventId, competitionId))

	const registrationCount = registrations[0]?.count ?? 0
	if (registrationCount > 0) {
		throw new Error(
			`Cannot delete competition with ${registrationCount} existing registration(s). Please remove registrations first.`,
		)
	}

	// Delete the competition (will cascade delete registrations due to schema)
	await db
		.delete(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	// Delete the competition_event team
	await db
		.delete(teamTable)
		.where(eq(teamTable.id, competition.competitionTeamId))

	return { success: true }
}


/**
 * Register an athlete for a competition
 *
 * Phase 2 Implementation:
 * - Validate competition exists and registration is open
 * - Validate division exists
 * - Check for duplicate registration
 * - Create team_membership in competition_event team
 * - Create competition_registration record
 * - Process payment if required
 * - Return registrationId and teamMemberId
 */
export async function registerForCompetition(params: {
	competitionId: string
	userId: string
	divisionId: string
}): Promise<{ registrationId: string; teamMemberId: string }> {
	throw new Error("Not implemented - Phase 2")
}

/**
 * Get all registrations for a competition
 *
 * Phase 2 Implementation:
 * - Query registrations by competitionId
 * - Include user and division details
 * - Support filtering by division
 * - Order by registeredAt ASC
 * - Return registrations with full details
 */
export async function getCompetitionRegistrations(
	competitionId: string,
	divisionId?: string,
): Promise<any[]> {
	throw new Error("Not implemented - Phase 2")
}

/**
 * Get a user's competition registration
 *
 * Phase 2 Implementation:
 * - Query registration by competitionId and userId
 * - Include division and team membership details
 * - Return registration or null
 */
export async function getUserCompetitionRegistration(
	competitionId: string,
	userId: string,
): Promise<any | null> {
	throw new Error("Not implemented - Phase 2")
}

/**
 * Cancel a competition registration
 *
 * Phase 2 Implementation:
 * - Validate user owns registration or has admin permission
 * - Check refund policy/timing
 * - Remove team_membership from competition_event team
 * - Delete competition_registration record
 * - Process refund if applicable
 * - Return success
 */
export async function cancelCompetitionRegistration(
	registrationId: string,
): Promise<{ success: boolean; refundAmount?: number }> {
	throw new Error("Not implemented - Phase 2")
}
