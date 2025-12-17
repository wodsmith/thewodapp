import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionsTable,
	programmingTracksTable,
	type Sponsor,
	type SponsorGroup,
	sponsorGroupsTable,
	sponsorsTable,
	TEAM_PERMISSIONS,
	trackWorkoutsTable,
} from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"

// Types with relations
export type SponsorWithGroup = Sponsor & {
	group: SponsorGroup | null
}

export type SponsorGroupWithSponsors = SponsorGroup & {
	sponsors: Sponsor[]
}

export type CompetitionSponsorsResult = {
	groups: SponsorGroupWithSponsors[]
	ungroupedSponsors: Sponsor[]
}

/* -------------------------------------------------------------------------- */
/*                           Query Functions                                   */
/* -------------------------------------------------------------------------- */

/**
 * Get a single sponsor by ID
 */
export async function getSponsor(sponsorId: string): Promise<Sponsor | null> {
	const db = getDb()

	const [sponsor] = await db
		.select()
		.from(sponsorsTable)
		.where(eq(sponsorsTable.id, sponsorId))

	return sponsor ?? null
}

/**
 * Get all sponsors for a competition, organized by groups
 */
export async function getCompetitionSponsors(
	competitionId: string,
): Promise<CompetitionSponsorsResult> {
	const db = getDb()

	// Get all sponsor groups for this competition
	const groups = await db
		.select()
		.from(sponsorGroupsTable)
		.where(eq(sponsorGroupsTable.competitionId, competitionId))
		.orderBy(asc(sponsorGroupsTable.displayOrder))

	// Get all sponsors for this competition
	const sponsors = await db
		.select()
		.from(sponsorsTable)
		.where(eq(sponsorsTable.competitionId, competitionId))
		.orderBy(asc(sponsorsTable.displayOrder))

	// Organize sponsors by group
	const groupsWithSponsors: SponsorGroupWithSponsors[] = groups.map(
		(group) => ({
			...group,
			sponsors: sponsors.filter((s) => s.groupId === group.id),
		}),
	)

	// Get ungrouped sponsors
	const ungroupedSponsors = sponsors.filter((s) => s.groupId === null)

	return {
		groups: groupsWithSponsors,
		ungroupedSponsors,
	}
}

/**
 * Get all sponsor groups for a competition
 */
export async function getCompetitionSponsorGroups(
	competitionId: string,
): Promise<SponsorGroup[]> {
	const db = getDb()

	return db
		.select()
		.from(sponsorGroupsTable)
		.where(eq(sponsorGroupsTable.competitionId, competitionId))
		.orderBy(asc(sponsorGroupsTable.displayOrder))
}

/**
 * Get all sponsors for a user (athlete sponsors)
 */
export async function getUserSponsors(userId: string): Promise<Sponsor[]> {
	const db = getDb()

	return db
		.select()
		.from(sponsorsTable)
		.where(eq(sponsorsTable.userId, userId))
		.orderBy(asc(sponsorsTable.displayOrder))
}

/* -------------------------------------------------------------------------- */
/*                           Sponsor Group CRUD                                */
/* -------------------------------------------------------------------------- */

/**
 * Create a sponsor group
 */
export async function createSponsorGroup({
	competitionId,
	name,
	displayOrder,
}: {
	competitionId: string
	name: string
	displayOrder?: number
}): Promise<SponsorGroup> {
	const db = getDb()

	// Get competition to find organizing team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	// Check permission
	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	// If no displayOrder provided, put at end
	let order = displayOrder
	if (order === undefined) {
		const existingGroups = await db
			.select()
			.from(sponsorGroupsTable)
			.where(eq(sponsorGroupsTable.competitionId, competitionId))

		order = existingGroups.length
	}

	const [created] = await db
		.insert(sponsorGroupsTable)
		.values({
			competitionId,
			name,
			displayOrder: order,
		})
		.returning()

	if (!created) {
		throw new Error("Failed to create sponsor group")
	}

	return created
}

/**
 * Update a sponsor group
 */
export async function updateSponsorGroup({
	groupId,
	competitionId,
	name,
	displayOrder,
}: {
	groupId: string
	competitionId: string
	name?: string
	displayOrder?: number
}): Promise<SponsorGroup | null> {
	const db = getDb()

	// Get competition to find organizing team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	// Verify group belongs to competition
	const [existing] = await db
		.select()
		.from(sponsorGroupsTable)
		.where(
			and(
				eq(sponsorGroupsTable.id, groupId),
				eq(sponsorGroupsTable.competitionId, competitionId),
			),
		)

	if (!existing) {
		return null
	}

	const [updated] = await db
		.update(sponsorGroupsTable)
		.set({
			name: name ?? existing.name,
			displayOrder: displayOrder ?? existing.displayOrder,
			updatedAt: new Date(),
		})
		.where(eq(sponsorGroupsTable.id, groupId))
		.returning()

	return updated ?? null
}

/**
 * Delete a sponsor group
 * Sponsors in the group become ungrouped (groupId set to null via FK)
 */
export async function deleteSponsorGroup({
	groupId,
	competitionId,
}: {
	groupId: string
	competitionId: string
}): Promise<{ success: boolean; error?: string }> {
	const db = getDb()

	// Get competition to find organizing team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		return { success: false, error: "Competition not found" }
	}

	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	// Verify group belongs to competition
	const [existing] = await db
		.select()
		.from(sponsorGroupsTable)
		.where(
			and(
				eq(sponsorGroupsTable.id, groupId),
				eq(sponsorGroupsTable.competitionId, competitionId),
			),
		)

	if (!existing) {
		return { success: true } // Already deleted
	}

	await db.delete(sponsorGroupsTable).where(eq(sponsorGroupsTable.id, groupId))

	return { success: true }
}

/**
 * Reorder sponsor groups
 */
export async function reorderSponsorGroups({
	competitionId,
	groupIds,
}: {
	competitionId: string
	groupIds: string[]
}): Promise<{ success: boolean }> {
	const db = getDb()

	// Get competition to find organizing team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	// Update each group's displayOrder
	for (let i = 0; i < groupIds.length; i++) {
		const groupId = groupIds[i]
		if (!groupId) continue

		await db
			.update(sponsorGroupsTable)
			.set({ displayOrder: i, updatedAt: new Date() })
			.where(
				and(
					eq(sponsorGroupsTable.id, groupId),
					eq(sponsorGroupsTable.competitionId, competitionId),
				),
			)
	}

	return { success: true }
}

/* -------------------------------------------------------------------------- */
/*                           Sponsor CRUD                                      */
/* -------------------------------------------------------------------------- */

/**
 * Create a sponsor (competition or user)
 */
export async function createSponsor({
	competitionId,
	userId,
	groupId,
	name,
	logoUrl,
	website,
	displayOrder,
}: {
	competitionId?: string
	userId?: string
	groupId?: string
	name: string
	logoUrl?: string
	website?: string
	displayOrder?: number
}): Promise<Sponsor> {
	const db = getDb()

	// Validate one of competitionId or userId is set
	if (!competitionId && !userId) {
		throw new Error("Either competitionId or userId is required")
	}

	// For competition sponsors, check permission
	if (competitionId) {
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, competitionId))

		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)
	}

	// If no displayOrder, put at end
	let order = displayOrder
	if (order === undefined) {
		const existingSponsors = await db
			.select()
			.from(sponsorsTable)
			.where(
				competitionId
					? eq(sponsorsTable.competitionId, competitionId)
					: eq(sponsorsTable.userId, userId as string),
			)

		order = existingSponsors.length
	}

	const [created] = await db
		.insert(sponsorsTable)
		.values({
			competitionId: competitionId ?? null,
			userId: userId ?? null,
			groupId: groupId ?? null,
			name,
			logoUrl: logoUrl ?? null,
			website: website ?? null,
			displayOrder: order,
		})
		.returning()

	if (!created) {
		throw new Error("Failed to create sponsor")
	}

	return created
}

/**
 * Update a sponsor
 */
export async function updateSponsor({
	sponsorId,
	groupId,
	name,
	logoUrl,
	website,
	displayOrder,
}: {
	sponsorId: string
	groupId?: string | null
	name?: string
	logoUrl?: string | null
	website?: string | null
	displayOrder?: number
}): Promise<Sponsor | null> {
	const db = getDb()

	// Get existing sponsor
	const [existing] = await db
		.select()
		.from(sponsorsTable)
		.where(eq(sponsorsTable.id, sponsorId))

	if (!existing) {
		return null
	}

	// Verify authorization
	if (existing.competitionId) {
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, existing.competitionId))

		if (competition) {
			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
		}
	}
	// For user sponsors, authorization is checked at action level

	const [updated] = await db
		.update(sponsorsTable)
		.set({
			groupId: groupId === undefined ? existing.groupId : groupId,
			name: name ?? existing.name,
			logoUrl: logoUrl === undefined ? existing.logoUrl : logoUrl,
			website: website === undefined ? existing.website : website,
			displayOrder: displayOrder ?? existing.displayOrder,
			updatedAt: new Date(),
		})
		.where(eq(sponsorsTable.id, sponsorId))
		.returning()

	return updated ?? null
}

/**
 * Delete a sponsor
 */
export async function deleteSponsor({
	sponsorId,
}: {
	sponsorId: string
}): Promise<{ success: boolean; error?: string }> {
	const db = getDb()

	// Get existing sponsor
	const [existing] = await db
		.select()
		.from(sponsorsTable)
		.where(eq(sponsorsTable.id, sponsorId))

	if (!existing) {
		return { success: true } // Already deleted
	}

	// Verify authorization
	if (existing.competitionId) {
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, existing.competitionId))

		if (competition) {
			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
		}
	}

	// Clear any workout sponsor references first
	await db
		.update(trackWorkoutsTable)
		.set({ sponsorId: null, updatedAt: new Date() })
		.where(eq(trackWorkoutsTable.sponsorId, sponsorId))

	await db.delete(sponsorsTable).where(eq(sponsorsTable.id, sponsorId))

	return { success: true }
}

/**
 * Reorder sponsors within a competition (can move between groups)
 */
export async function reorderSponsors({
	competitionId,
	sponsorOrders,
}: {
	competitionId: string
	sponsorOrders: Array<{
		sponsorId: string
		groupId: string | null
		displayOrder: number
	}>
}): Promise<{ success: boolean }> {
	const db = getDb()

	// Get competition to find organizing team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	// Update each sponsor
	for (const { sponsorId, groupId, displayOrder } of sponsorOrders) {
		await db
			.update(sponsorsTable)
			.set({
				groupId,
				displayOrder,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(sponsorsTable.id, sponsorId),
					eq(sponsorsTable.competitionId, competitionId),
				),
			)
	}

	return { success: true }
}

/* -------------------------------------------------------------------------- */
/*                           Workout Sponsor Assignment                        */
/* -------------------------------------------------------------------------- */

/**
 * Assign a sponsor to a track workout ("Presented by")
 */
export async function assignWorkoutSponsor({
	trackWorkoutId,
	competitionId,
	sponsorId,
}: {
	trackWorkoutId: string
	competitionId: string
	sponsorId: string | null
}): Promise<{ success: boolean; error?: string }> {
	const db = getDb()

	// Get competition to find organizing team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		return { success: false, error: "Competition not found" }
	}

	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	// Verify the track workout belongs to this competition
	const [trackWorkout] = await db
		.select({ id: trackWorkoutsTable.id })
		.from(trackWorkoutsTable)
		.innerJoin(
			programmingTracksTable,
			eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
		)
		.where(
			and(
				eq(trackWorkoutsTable.id, trackWorkoutId),
				eq(programmingTracksTable.competitionId, competitionId),
			),
		)

	if (!trackWorkout) {
		return {
			success: false,
			error: "Track workout not found for this competition",
		}
	}

	// If assigning a sponsor, verify it belongs to this competition
	if (sponsorId) {
		const [sponsor] = await db
			.select()
			.from(sponsorsTable)
			.where(
				and(
					eq(sponsorsTable.id, sponsorId),
					eq(sponsorsTable.competitionId, competitionId),
				),
			)

		if (!sponsor) {
			return { success: false, error: "Sponsor not found for this competition" }
		}
	}

	await db
		.update(trackWorkoutsTable)
		.set({ sponsorId, updatedAt: new Date() })
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))

	return { success: true }
}

/**
 * Get workout sponsor for display
 */
export async function getWorkoutSponsor(
	trackWorkoutId: string,
): Promise<Sponsor | null> {
	const db = getDb()

	const [trackWorkout] = await db
		.select({ sponsorId: trackWorkoutsTable.sponsorId })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))

	if (!trackWorkout?.sponsorId) {
		return null
	}

	return getSponsor(trackWorkout.sponsorId)
}
