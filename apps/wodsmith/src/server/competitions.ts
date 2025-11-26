import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { and, count, eq, or, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	type Competition,
	type CompetitionGroup,
	type Team,
	competitionGroupsTable,
	competitionsTable,
} from "@/db/schema"

// Competition with organizing team relation for public display
export type CompetitionWithOrganizingTeam = Competition & {
	organizingTeam: Team | null
	group: CompetitionGroup | null
}
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
 * Get all public competitions for browsing
 * Returns competitions ordered by startDate for public /compete page
 */
export async function getPublicCompetitions(): Promise<
	CompetitionWithOrganizingTeam[]
> {
	const db = getDb()

	const competitions = await db.query.competitionsTable.findMany({
		with: {
			organizingTeam: true,
			group: true,
		},
		orderBy: (table, { asc }) => [asc(table.startDate)],
	})

	return competitions as CompetitionWithOrganizingTeam[]
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
): Promise<Array<Competition & { organizingTeam: Team | null; competitionTeam: Team | null; group: CompetitionGroup | null }>> {
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
 * Get all public competitions (for competition discovery page)
 *
 * Phase 2 Implementation:
 * - Query all competitions
 * - Include organizing team and group data
 * - Order by startDate DESC (upcoming first)
 * - Return competitions with full details
 */
export async function getAllPublicCompetitions(): Promise<Array<Competition & { organizingTeam: Partial<Team> | null; group: CompetitionGroup | null }>> {
	const db = getDb()

	const competitions = await db.query.competitionsTable.findMany({
		with: {
			organizingTeam: {
				columns: {
					id: true,
					name: true,
					slug: true,
					avatarUrl: true,
				},
			},
			group: true,
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
): Promise<(Competition & { organizingTeam: Team | null; competitionTeam: Team | null; group: CompetitionGroup | null }) | null> {
	const db = getDb()

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
		description: string | null
		startDate: Date
		endDate: Date
		registrationOpensAt: Date | null
		registrationClosesAt: Date | null
		groupId: string | null
		settings: string | null
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
	const db = getDb()
	const {
		competitionRegistrationsTable,
		teamMembershipTable,
		SYSTEM_ROLES_ENUM,
		userTable,
		scalingLevelsTable,
	} = await import("@/db/schema")
	const { parseCompetitionSettings } = await import("@/types/competitions")
	const { updateAllSessionsOfUser } = await import("@/utils/kv-session")

	// 1. Validate competition exists
	const competition = await getCompetition(params.competitionId)
	if (!competition) {
		throw new Error("Competition not found")
	}

	// 2. Check registration window
	const now = new Date()
	if (competition.registrationOpensAt && new Date(competition.registrationOpensAt) > now) {
		throw new Error("Registration has not opened yet")
	}
	if (competition.registrationClosesAt && new Date(competition.registrationClosesAt) < now) {
		throw new Error("Registration has closed")
	}

	// 3. Get the user to validate profile completeness
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, params.userId),
	})

	if (!user) {
		throw new Error("User not found")
	}

	// 4. Validate user profile is complete (gender and dateOfBirth required)
	if (!user.gender) {
		throw new Error("Please complete your profile by adding your gender before registering")
	}
	if (!user.dateOfBirth) {
		throw new Error("Please complete your profile by adding your date of birth before registering")
	}

	// 5. Validate division belongs to competition's scaling group
	const settings = parseCompetitionSettings(competition.settings)
	if (!settings?.divisions?.scalingGroupId) {
		throw new Error("This competition does not have divisions configured")
	}

	const division = await db.query.scalingLevelsTable.findFirst({
		where: eq(scalingLevelsTable.id, params.divisionId),
	})

	if (!division) {
		throw new Error("Division not found")
	}

	if (division.scalingGroupId !== settings.divisions.scalingGroupId) {
		throw new Error("Selected division does not belong to this competition")
	}

	// 6. Check for duplicate registration (will be caught by unique constraint, but check anyway for better error message)
	const existingRegistration = await db.query.competitionRegistrationsTable.findFirst({
		where: and(
			eq(competitionRegistrationsTable.eventId, params.competitionId),
			eq(competitionRegistrationsTable.userId, params.userId),
		),
	})

	if (existingRegistration) {
		throw new Error("You are already registered for this competition")
	}

	// 7. Create team_membership in competition_event team
	const teamMembershipResult = await db
		.insert(teamMembershipTable)
		.values({
			teamId: competition.competitionTeamId,
			userId: params.userId,
			roleId: SYSTEM_ROLES_ENUM.MEMBER,
			isSystemRole: 1,
			joinedAt: new Date(),
			isActive: 1,
		})
		.returning()

	const teamMember = Array.isArray(teamMembershipResult) ? teamMembershipResult[0] : undefined
	if (!teamMember) {
		throw new Error("Failed to create team membership")
	}

	// 8. Create competition_registration record
	const registrationResult = await db
		.insert(competitionRegistrationsTable)
		.values({
			id: `creg_${createId()}`,
			eventId: params.competitionId,
			userId: params.userId,
			teamMemberId: teamMember.id,
			divisionId: params.divisionId,
			registeredAt: new Date(),
		})
		.returning()

	const registration = Array.isArray(registrationResult) ? registrationResult[0] : undefined
	if (!registration) {
		throw new Error("Failed to create registration")
	}

	// 9. Update all user sessions to include new team
	await updateAllSessionsOfUser(params.userId)

	return {
		registrationId: registration.id,
		teamMemberId: teamMember.id,
	}
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
) {
	const db = getDb()
	const { competitionRegistrationsTable } = await import("@/db/schema")

	// Build the where clause
	const whereConditions = [
		eq(competitionRegistrationsTable.eventId, competitionId),
	]

	if (divisionId) {
		whereConditions.push(eq(competitionRegistrationsTable.divisionId, divisionId))
	}

	const registrations = await db.query.competitionRegistrationsTable.findMany({
		where: and(...whereConditions),
		with: {
			user: {
				columns: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					avatar: true,
					gender: true,
					dateOfBirth: true,
				},
			},
			division: true,
			teamMember: true,
		},
		orderBy: (table, { asc }) => [asc(table.registeredAt)],
	})

	return registrations
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
) {
	const db = getDb()
	const { competitionRegistrationsTable } = await import("@/db/schema")

	const registration = await db.query.competitionRegistrationsTable.findFirst({
		where: and(
			eq(competitionRegistrationsTable.eventId, competitionId),
			eq(competitionRegistrationsTable.userId, userId),
		),
		with: {
			division: true,
			teamMember: true,
			user: {
				columns: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					avatar: true,
					gender: true,
					dateOfBirth: true,
				},
			},
		},
	})

	return registration ?? null
}

/**
 * Get user's upcoming registered competitions
 * Returns competitions the user has registered for where the event hasn't started yet
 */
export async function getUserUpcomingRegisteredCompetitions(
	userId: string,
): Promise<CompetitionWithOrganizingTeam[]> {
	const db = getDb()
	const { competitionRegistrationsTable } = await import("@/db/schema")

	const registrations = await db.query.competitionRegistrationsTable.findMany({
		where: eq(competitionRegistrationsTable.userId, userId),
		with: {
			competition: {
				with: {
					organizingTeam: true,
					group: true,
				},
			},
		},
	})

	const now = new Date()

	// Filter to only upcoming competitions (start date in future)
	const upcomingCompetitions = registrations
		.filter((reg) => new Date(reg.competition.startDate) > now)
		.map((reg) => reg.competition as CompetitionWithOrganizingTeam)

	return upcomingCompetitions
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
	userId: string,
): Promise<{ success: boolean; competitionId: string }> {
	const db = getDb()
	const { competitionRegistrationsTable, teamMembershipTable } = await import("@/db/schema")
	const { updateAllSessionsOfUser } = await import("@/utils/kv-session")

	// 1. Get the registration to verify it exists
	const registration = await db.query.competitionRegistrationsTable.findFirst({
		where: eq(competitionRegistrationsTable.id, registrationId),
	})

	if (!registration) {
		throw new Error("Registration not found")
	}

	// 2. Validate user owns the registration
	if (registration.userId !== userId) {
		throw new Error("You can only cancel your own registration")
	}

	// 3. Delete the competition_registration record first
	await db
		.delete(competitionRegistrationsTable)
		.where(eq(competitionRegistrationsTable.id, registrationId))

	// 4. Delete the team_membership from competition_event team
	await db
		.delete(teamMembershipTable)
		.where(eq(teamMembershipTable.id, registration.teamMemberId))

	// 5. Update all user sessions to remove the competition team
	await updateAllSessionsOfUser(userId)

	return { success: true, competitionId: registration.eventId }
}
