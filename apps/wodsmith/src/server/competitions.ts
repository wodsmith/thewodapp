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
	throw new Error("Not implemented - Phase 2 Milestone 3")
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
	throw new Error("Not implemented - Phase 2")
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
	throw new Error("Not implemented - Phase 2")
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
	throw new Error("Not implemented - Phase 2")
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
	throw new Error("Not implemented - Phase 2")
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
