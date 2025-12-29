/**
 * Competition Divisions Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-divisions.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, count, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionDivisionsTable } from "@/db/schemas/commerce"
import {
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

/**
 * Parse competition settings from JSON string
 */
export function parseCompetitionSettings(settings: string | null): {
	divisions?: { scalingGroupId?: string }
} | null {
	if (!settings) return null
	try {
		return JSON.parse(settings)
	} catch {
		return null
	}
}

/**
 * Stringify competition settings to JSON
 */
function stringifyCompetitionSettings(
	settings: {
		divisions?: { scalingGroupId?: string }
		[key: string]: unknown
	} | null,
): string | null {
	if (!settings) return null
	try {
		return JSON.stringify(settings)
	} catch {
		return null
	}
}

/**
 * Check if user has permission on a team
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

export interface PublicCompetitionDivision {
	id: string
	label: string
	description: string | null
	registrationCount: number
	feeCents: number
	teamSize: number
}

export interface CompetitionDivisionWithCounts {
	id: string
	label: string
	position: number
	registrationCount: number
	description: string | null
	feeCents: number | null
}

export interface ScalingGroupForTemplate {
	id: string
	title: string
	description: string | null
	teamId: string | null
	isSystem: number
	levels: Array<{
		id: string
		label: string
		position: number
	}>
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPublicCompetitionDivisionsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getCompetitionDivisionsWithCountsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const listScalingGroupsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const initializeCompetitionDivisionsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	templateGroupId: z.string().optional(),
})

const addCompetitionDivisionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	label: z.string().min(1, "Division name is required").max(100),
	teamSize: z.number().int().min(1).max(10).default(1),
})

const updateCompetitionDivisionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	divisionId: z.string().min(1, "Division ID is required"),
	label: z.string().min(1, "Division name is required").max(100),
})

const deleteCompetitionDivisionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	divisionId: z.string().min(1, "Division ID is required"),
})

const reorderCompetitionDivisionsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	orderedDivisionIds: z.array(z.string()).min(1, "Division IDs are required"),
})

const updateDivisionDescriptionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	divisionId: z.string().min(1, "Division ID is required"),
	description: z.string().max(2000).nullable(),
})

const getScalingGroupWithLevelsInputSchema = z.object({
	scalingGroupId: z.string().min(1, "Scaling Group ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a scaling group for competition divisions
 */
async function createScalingGroup({
	teamId,
	title,
	description,
}: {
	teamId: string
	title: string
	description?: string | null
}) {
	const db = getDb()

	const [created] = await db
		.insert(scalingGroupsTable)
		.values({
			title,
			description: description ?? null,
			teamId,
			isDefault: 0,
			isSystem: 0,
		})
		.returning()

	return created
}

/**
 * Create a scaling level (division)
 */
async function createScalingLevel({
	scalingGroupId,
	label,
	position,
	teamSize = 1,
}: {
	scalingGroupId: string
	label: string
	position?: number
	teamSize?: number
}) {
	const db = getDb()

	// Determine position (0 = hardest). If not provided, append to end.
	let newPosition = position
	if (newPosition === undefined || newPosition === null) {
		const result = (await db
			.select({ maxPos: sql<number>`max(${scalingLevelsTable.position})` })
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))) as Array<{
			maxPos: number | null
		}>
		const maxPos = result[0]?.maxPos ?? null
		newPosition = (maxPos ?? -1) + 1
	}

	const [created] = await db
		.insert(scalingLevelsTable)
		.values({
			scalingGroupId,
			label,
			position: newPosition,
			teamSize,
		})
		.returning()

	if (!created) {
		throw new Error("Failed to create scaling level")
	}
	return created
}

/**
 * List scaling levels for a scaling group
 */
async function listScalingLevels({
	scalingGroupId,
}: {
	scalingGroupId: string
}) {
	const db = getDb()
	const rows = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
		.orderBy(asc(scalingLevelsTable.position))
	return rows
}

/**
 * Check if a scaling group is owned by a competition
 */
async function isCompetitionOwnedScalingGroup({
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
 */
async function ensureCompetitionOwnedScalingGroup({
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
		// No divisions yet - create empty group with defaults
		const newGroup = await createScalingGroup({
			teamId,
			title: `${competition.name} Divisions`,
			description: `Divisions for ${competition.name}`,
		})

		if (!newGroup) {
			throw new Error("Failed to create scaling group")
		}

		// Create default divisions
		await createScalingLevel({
			scalingGroupId: newGroup.id,
			label: "Open",
			position: 0,
		})
		await createScalingLevel({
			scalingGroupId: newGroup.id,
			label: "Scaled",
			position: 1,
		})

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
			scalingGroupId: newGroup.id,
			label: level.label,
			position: level.position,
			teamSize: level.teamSize,
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
async function getRegistrationCountForDivision({
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

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get a scaling group with its levels (divisions)
 * Used by pricing page to get division options
 */
export const getScalingGroupWithLevelsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getScalingGroupWithLevelsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const scalingGroup = await db.query.scalingGroupsTable.findFirst({
			where: eq(scalingGroupsTable.id, data.scalingGroupId),
			with: {
				scalingLevels: {
					orderBy: (table, { asc }) => [asc(table.position)],
				},
			},
		})

		return scalingGroup
	})

/**
 * Get divisions for public competition display
 * Returns divisions with descriptions and registration counts
 * Used by competition details page
 */
export const getPublicCompetitionDivisionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getPublicCompetitionDivisionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get competition with settings
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
		})

		if (!competition) {
			return { divisions: [] }
		}

		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		if (!scalingGroupId) {
			return { divisions: [] }
		}

		// Get divisions with descriptions and registration counts
		const divisions = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				teamSize: scalingLevelsTable.teamSize,
				description: competitionDivisionsTable.description,
				feeCents: competitionDivisionsTable.feeCents,
				registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as integer)`,
			})
			.from(scalingLevelsTable)
			.leftJoin(
				competitionDivisionsTable,
				and(
					eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
					eq(competitionDivisionsTable.competitionId, data.competitionId),
				),
			)
			.leftJoin(
				competitionRegistrationsTable,
				and(
					eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
					eq(competitionRegistrationsTable.eventId, data.competitionId),
				),
			)
			.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
			.groupBy(
				scalingLevelsTable.id,
				competitionDivisionsTable.description,
				competitionDivisionsTable.feeCents,
			)
			.orderBy(scalingLevelsTable.position)

		// Apply default fee from competition
		const result: PublicCompetitionDivision[] = divisions.map((d) => ({
			id: d.id,
			label: d.label,
			description: d.description ?? null,
			registrationCount: d.registrationCount,
			feeCents: d.feeCents ?? competition.defaultRegistrationFeeCents ?? 0,
			teamSize: d.teamSize,
		}))

		return { divisions: result }
	})

/**
 * Get divisions for a competition with registration counts (organizer view)
 */
export const getCompetitionDivisionsWithCountsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getCompetitionDivisionsWithCountsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Get competition settings
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))

		if (!competition) {
			throw new Error("Competition not found")
		}

		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId ?? null

		if (!scalingGroupId) {
			return { scalingGroupId: null, divisions: [] }
		}

		// Get divisions with registration counts and descriptions
		const divisions = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
				description: competitionDivisionsTable.description,
				feeCents: competitionDivisionsTable.feeCents,
				registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as integer)`,
			})
			.from(scalingLevelsTable)
			.leftJoin(
				competitionDivisionsTable,
				and(
					eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
					eq(competitionDivisionsTable.competitionId, data.competitionId),
				),
			)
			.leftJoin(
				competitionRegistrationsTable,
				and(
					eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
					eq(competitionRegistrationsTable.eventId, data.competitionId),
				),
			)
			.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
			.groupBy(
				scalingLevelsTable.id,
				competitionDivisionsTable.description,
				competitionDivisionsTable.feeCents,
			)
			.orderBy(scalingLevelsTable.position)

		return {
			scalingGroupId,
			divisions: divisions.map((d) => ({
				...d,
				description: d.description ?? null,
				feeCents: d.feeCents ?? null,
			})) as CompetitionDivisionWithCounts[],
		}
	})

/**
 * List scaling groups available as division templates
 */
export const listScalingGroupsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => listScalingGroupsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Get team's scaling groups + system groups with their levels
		const groups = await db.query.scalingGroupsTable.findMany({
			where: sql`${scalingGroupsTable.teamId} = ${data.teamId} OR ${scalingGroupsTable.teamId} IS NULL`,
			orderBy: sql`${scalingGroupsTable.isSystem} DESC, ${scalingGroupsTable.title} ASC`,
			with: {
				scalingLevels: {
					orderBy: (table, { asc }) => [asc(table.position)],
				},
			},
		})

		// Transform to expected format
		const transformedGroups = groups.map((g) => ({
			id: g.id,
			title: g.title,
			description: g.description,
			teamId: g.teamId,
			isSystem: g.isSystem,
			levels: g.scalingLevels.map((l) => ({
				id: l.id,
				label: l.label,
				position: l.position,
			})),
		}))

		return { groups: transformedGroups }
	})

/**
 * Initialize divisions for a competition
 */
export const initializeCompetitionDivisionsFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		initializeCompetitionDivisionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify competition exists and belongs to team
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))

		if (!competition) {
			throw new Error("Competition not found")
		}

		if (competition.organizingTeamId !== data.teamId) {
			throw new Error("Competition does not belong to this team")
		}

		// Check if competition already has divisions configured
		const settings = parseCompetitionSettings(competition.settings)
		if (settings?.divisions?.scalingGroupId) {
			throw new Error("Competition already has divisions configured")
		}

		let newScalingGroupId: string

		if (data.templateGroupId) {
			// Clone from template
			const templateLevels = await listScalingLevels({
				scalingGroupId: data.templateGroupId,
			})

			// Get template group title for naming
			const [templateGroup] = await db
				.select()
				.from(scalingGroupsTable)
				.where(eq(scalingGroupsTable.id, data.templateGroupId))

			const newGroup = await createScalingGroup({
				teamId: data.teamId,
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
					scalingGroupId: newScalingGroupId,
					label: level.label,
					position: level.position,
					teamSize: level.teamSize,
				})
			}
		} else {
			// Create new empty group with default divisions
			const newGroup = await createScalingGroup({
				teamId: data.teamId,
				title: `${competition.name} Divisions`,
				description: `Divisions for ${competition.name}`,
			})

			if (!newGroup) {
				throw new Error("Failed to create scaling group")
			}

			newScalingGroupId = newGroup.id

			// Create default divisions
			await createScalingLevel({
				scalingGroupId: newScalingGroupId,
				label: "Open",
				position: 0,
			})
			await createScalingLevel({
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
			.where(eq(competitionsTable.id, data.competitionId))

		return { scalingGroupId: newScalingGroupId }
	})

/**
 * Add a division to a competition
 */
export const addCompetitionDivisionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		addCompetitionDivisionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
			competitionId: data.competitionId,
			teamId: data.teamId,
		})

		const level = await createScalingLevel({
			scalingGroupId,
			label: data.label,
			teamSize: data.teamSize,
		})

		return { divisionId: level.id }
	})

/**
 * Update a division label
 */
export const updateCompetitionDivisionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateCompetitionDivisionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
			competitionId: data.competitionId,
			teamId: data.teamId,
		})

		// Verify division belongs to this group
		const [division] = await db
			.select()
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.id, data.divisionId))

		if (!division || division.scalingGroupId !== scalingGroupId) {
			throw new Error("Division not found in this competition")
		}

		await db
			.update(scalingLevelsTable)
			.set({ label: data.label, updatedAt: new Date() })
			.where(eq(scalingLevelsTable.id, data.divisionId))

		return { success: true }
	})

/**
 * Delete a division (blocked if registrations exist)
 */
export const deleteCompetitionDivisionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		deleteCompetitionDivisionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
			competitionId: data.competitionId,
			teamId: data.teamId,
		})

		// Verify division belongs to this group
		const [division] = await db
			.select()
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.id, data.divisionId))

		if (!division || division.scalingGroupId !== scalingGroupId) {
			throw new Error("Division not found in this competition")
		}

		// Check registration count
		const regCount = await getRegistrationCountForDivision({
			divisionId: data.divisionId,
			competitionId: data.competitionId,
		})

		if (regCount > 0) {
			throw new Error(
				`Cannot delete: ${regCount} athlete${regCount > 1 ? "s" : ""} registered in this division`,
			)
		}

		// Check minimum divisions (must have at least 1)
		const allDivisions = await listScalingLevels({ scalingGroupId })
		if (allDivisions.length <= 1) {
			throw new Error(
				"Cannot delete: competition must have at least one division",
			)
		}

		await db
			.delete(scalingLevelsTable)
			.where(eq(scalingLevelsTable.id, data.divisionId))

		return { success: true }
	})

/**
 * Reorder divisions (drag and drop)
 */
export const reorderCompetitionDivisionsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		reorderCompetitionDivisionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
			competitionId: data.competitionId,
			teamId: data.teamId,
		})

		// Update positions according to provided order
		for (let i = 0; i < data.orderedDivisionIds.length; i++) {
			const id = data.orderedDivisionIds[i]
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

		return { success: true }
	})

/**
 * Update a division's description
 */
export const updateDivisionDescriptionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateDivisionDescriptionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
			competitionId: data.competitionId,
			teamId: data.teamId,
		})

		// Verify division belongs to this group
		const [division] = await db
			.select()
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.id, data.divisionId))

		if (!division || division.scalingGroupId !== scalingGroupId) {
			throw new Error("Division not found in this competition")
		}

		// Check if division config exists
		const existing = await db.query.competitionDivisionsTable.findFirst({
			where: and(
				eq(competitionDivisionsTable.competitionId, data.competitionId),
				eq(competitionDivisionsTable.divisionId, data.divisionId),
			),
		})

		if (existing) {
			// Update existing
			await db
				.update(competitionDivisionsTable)
				.set({ description: data.description, updatedAt: new Date() })
				.where(eq(competitionDivisionsTable.id, existing.id))
		} else {
			// Insert new (with default fee of 0)
			await db.insert(competitionDivisionsTable).values({
				competitionId: data.competitionId,
				divisionId: data.divisionId,
				feeCents: 0,
				description: data.description,
			})
		}

		return { success: true }
	})
