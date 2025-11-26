import "server-only"

import { and, count, eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	scalingGroupsTable,
	scalingLevelsTable,
	TEAM_PERMISSIONS,
} from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"
import {
	parseCompetitionSettings,
	stringifyCompetitionSettings,
} from "@/types/competitions"
import { createScalingGroup } from "./scaling-groups"
import { createScalingLevel, listScalingLevels } from "./scaling-levels"

/**
 * Initialize divisions for a competition
 * - If templateGroupId provided: clone that group's levels
 * - Else: create empty group with default divisions
 * - Updates competition settings with new scalingGroupId
 */
export async function initializeCompetitionDivisions({
	competitionId,
	teamId,
	templateGroupId,
}: {
	competitionId: string
	teamId: string
	templateGroupId?: string
}): Promise<{ scalingGroupId: string }> {
	const db = getDb()
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Verify competition exists and belongs to team
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	if (competition.organizingTeamId !== teamId) {
		throw new Error("Competition does not belong to this team")
	}

	// Check if competition already has divisions configured
	const settings = parseCompetitionSettings(competition.settings)
	if (settings?.divisions?.scalingGroupId) {
		throw new Error("Competition already has divisions configured")
	}

	let newScalingGroupId: string

	if (templateGroupId) {
		// Clone from template
		const templateLevels = await listScalingLevels({
			scalingGroupId: templateGroupId,
		})

		// Get template group title for naming
		const [templateGroup] = await db
			.select()
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, templateGroupId))

		const newGroup = await createScalingGroup({
			teamId,
			title: `${competition.name} Divisions`,
			description: templateGroup
				? `Cloned from ${templateGroup.title}`
				: `Divisions for ${competition.name}`,
		})

		if (!newGroup) {
			throw new Error("Failed to create scaling group")
		}

		newScalingGroupId = newGroup.id

		// Clone levels
		for (const level of templateLevels) {
			await createScalingLevel({
				teamId,
				scalingGroupId: newScalingGroupId,
				label: level.label,
				position: level.position,
			})
		}
	} else {
		// Create new empty group with default divisions
		const newGroup = await createScalingGroup({
			teamId,
			title: `${competition.name} Divisions`,
			description: `Divisions for ${competition.name}`,
		})

		if (!newGroup) {
			throw new Error("Failed to create scaling group")
		}

		newScalingGroupId = newGroup.id

		// Create default divisions (common competition divisions)
		await createScalingLevel({
			teamId,
			scalingGroupId: newScalingGroupId,
			label: "Open",
			position: 0,
		})
		await createScalingLevel({
			teamId,
			scalingGroupId: newScalingGroupId,
			label: "Scaled",
			position: 1,
		})
	}

	// Update competition settings with new scaling group
	const newSettings = stringifyCompetitionSettings({
		...settings,
		divisions: { scalingGroupId: newScalingGroupId },
	})

	await db
		.update(competitionsTable)
		.set({ settings: newSettings, updatedAt: new Date() })
		.where(eq(competitionsTable.id, competitionId))

	return { scalingGroupId: newScalingGroupId }
}

/**
 * Get divisions for a competition with registration counts
 */
export async function getCompetitionDivisionsWithCounts({
	competitionId,
}: {
	competitionId: string
}): Promise<{
	scalingGroupId: string | null
	divisions: Array<{
		id: string
		label: string
		position: number
		registrationCount: number
	}>
}> {
	const db = getDb()

	// Get competition settings
	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	const settings = parseCompetitionSettings(competition.settings)
	const scalingGroupId = settings?.divisions?.scalingGroupId ?? null

	if (!scalingGroupId) {
		return { scalingGroupId: null, divisions: [] }
	}

	// Get divisions with registration counts
	const divisions = await db
		.select({
			id: scalingLevelsTable.id,
			label: scalingLevelsTable.label,
			position: scalingLevelsTable.position,
			registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as integer)`,
		})
		.from(scalingLevelsTable)
		.leftJoin(
			competitionRegistrationsTable,
			and(
				eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
				eq(competitionRegistrationsTable.eventId, competitionId),
			),
		)
		.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
		.groupBy(scalingLevelsTable.id)
		.orderBy(scalingLevelsTable.position)

	return { scalingGroupId, divisions }
}

/**
 * Check if a scaling group is owned by a competition (safe to edit inline)
 * A competition-owned group is one that:
 * 1. Is referenced in the competition settings
 * 2. Has the same teamId as the organizing team
 * 3. Title matches "{competition name} Divisions" pattern
 */
export async function isCompetitionOwnedScalingGroup({
	competitionId,
	scalingGroupId,
}: {
	competitionId: string
	scalingGroupId: string
}): Promise<boolean> {
	const db = getDb()

	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) return false

	const settings = parseCompetitionSettings(competition.settings)
	if (settings?.divisions?.scalingGroupId !== scalingGroupId) {
		return false
	}

	const [group] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, scalingGroupId))

	if (!group) return false

	// Check if group belongs to organizing team and matches naming pattern
	return (
		group.teamId === competition.organizingTeamId &&
		group.title.includes("Divisions")
	)
}

/**
 * Ensure competition has its own scaling group (clone if needed)
 * Call this before any mutation to ensure we're editing a competition-specific group
 */
export async function ensureCompetitionOwnedScalingGroup({
	competitionId,
	teamId,
}: {
	competitionId: string
	teamId: string
}): Promise<{ scalingGroupId: string; wasCloned: boolean }> {
	const db = getDb()
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const [competition] = await db
		.select()
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	if (competition.organizingTeamId !== teamId) {
		throw new Error("Competition does not belong to this team")
	}

	const settings = parseCompetitionSettings(competition.settings)
	const currentGroupId = settings?.divisions?.scalingGroupId

	if (!currentGroupId) {
		// No divisions yet - initialize with defaults
		const result = await initializeCompetitionDivisions({
			competitionId,
			teamId,
		})
		return { scalingGroupId: result.scalingGroupId, wasCloned: true }
	}

	// Check if already competition-owned
	const isOwned = await isCompetitionOwnedScalingGroup({
		competitionId,
		scalingGroupId: currentGroupId,
	})

	if (isOwned) {
		return { scalingGroupId: currentGroupId, wasCloned: false }
	}

	// Need to clone: current group is shared/template
	const templateLevels = await listScalingLevels({
		scalingGroupId: currentGroupId,
	})

	const [templateGroup] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, currentGroupId))

	const newGroup = await createScalingGroup({
		teamId,
		title: `${competition.name} Divisions`,
		description: templateGroup
			? `Cloned from ${templateGroup.title}`
			: `Divisions for ${competition.name}`,
	})

	if (!newGroup) {
		throw new Error("Failed to create scaling group")
	}

	// Clone levels
	for (const level of templateLevels) {
		await createScalingLevel({
			teamId,
			scalingGroupId: newGroup.id,
			label: level.label,
			position: level.position,
		})
	}

	// Update competition settings
	const newSettings = stringifyCompetitionSettings({
		...settings,
		divisions: { scalingGroupId: newGroup.id },
	})

	await db
		.update(competitionsTable)
		.set({ settings: newSettings, updatedAt: new Date() })
		.where(eq(competitionsTable.id, competitionId))

	return { scalingGroupId: newGroup.id, wasCloned: true }
}

/**
 * Get registration count for a specific division
 */
export async function getRegistrationCountForDivision({
	divisionId,
	competitionId,
}: {
	divisionId: string
	competitionId: string
}): Promise<number> {
	const db = getDb()

	const result = await db
		.select({ count: count() })
		.from(competitionRegistrationsTable)
		.where(
			and(
				eq(competitionRegistrationsTable.divisionId, divisionId),
				eq(competitionRegistrationsTable.eventId, competitionId),
			),
		)

	return result[0]?.count ?? 0
}

/**
 * Add a division to a competition
 * Ensures competition owns its scaling group before adding
 */
export async function addCompetitionDivision({
	competitionId,
	teamId,
	label,
}: {
	competitionId: string
	teamId: string
	label: string
}): Promise<{ divisionId: string }> {
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
		competitionId,
		teamId,
	})

	const level = await createScalingLevel({
		teamId,
		scalingGroupId,
		label,
	})

	return { divisionId: level.id }
}

/**
 * Update a division label
 */
export async function updateCompetitionDivision({
	competitionId,
	teamId,
	divisionId,
	label,
}: {
	competitionId: string
	teamId: string
	divisionId: string
	label: string
}): Promise<void> {
	const db = getDb()
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
		competitionId,
		teamId,
	})

	// Verify division belongs to this group
	const [division] = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.id, divisionId))

	if (!division || division.scalingGroupId !== scalingGroupId) {
		throw new Error("Division not found in this competition")
	}

	await db
		.update(scalingLevelsTable)
		.set({ label, updatedAt: new Date() })
		.where(eq(scalingLevelsTable.id, divisionId))
}

/**
 * Delete a division from a competition
 * Blocked if athletes are registered in this division
 */
export async function deleteCompetitionDivision({
	competitionId,
	teamId,
	divisionId,
}: {
	competitionId: string
	teamId: string
	divisionId: string
}): Promise<{ success: boolean; error?: string }> {
	const db = getDb()
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
		competitionId,
		teamId,
	})

	// Verify division belongs to this group
	const [division] = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.id, divisionId))

	if (!division || division.scalingGroupId !== scalingGroupId) {
		return { success: false, error: "Division not found in this competition" }
	}

	// Check registration count
	const regCount = await getRegistrationCountForDivision({
		divisionId,
		competitionId,
	})

	if (regCount > 0) {
		return {
			success: false,
			error: `Cannot delete: ${regCount} athlete${regCount > 1 ? "s" : ""} registered in this division`,
		}
	}

	// Check minimum divisions (must have at least 1)
	const allDivisions = await listScalingLevels({ scalingGroupId })
	if (allDivisions.length <= 1) {
		return {
			success: false,
			error: "Cannot delete: competition must have at least one division",
		}
	}

	await db
		.delete(scalingLevelsTable)
		.where(eq(scalingLevelsTable.id, divisionId))

	return { success: true }
}

/**
 * Reorder divisions for a competition
 */
export async function reorderCompetitionDivisions({
	competitionId,
	teamId,
	orderedDivisionIds,
}: {
	competitionId: string
	teamId: string
	orderedDivisionIds: string[]
}): Promise<void> {
	const db = getDb()
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
		competitionId,
		teamId,
	})

	// Update positions according to provided order
	for (let i = 0; i < orderedDivisionIds.length; i++) {
		const id = orderedDivisionIds[i]
		if (!id) continue

		await db
			.update(scalingLevelsTable)
			.set({ position: i, updatedAt: new Date() })
			.where(
				and(
					eq(scalingLevelsTable.id, id),
					eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
				),
			)
	}
}
