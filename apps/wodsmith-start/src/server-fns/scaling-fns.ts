/**
 * Scaling Groups Server Functions for TanStack Start
 * Port of scaling logic from wodsmith app
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { eq, asc, desc, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface ScalingLevel {
	id: string
	scalingGroupId: string
	label: string
	position: number
	teamSize: number
	createdAt: Date
	updatedAt: Date
}

export interface ScalingGroup {
	id: string
	title: string
	description: string | null
	teamId: string | null
	isDefault: number
	isSystem: number
	createdAt: Date
	updatedAt: Date
}

export interface ScalingGroupWithLevels extends ScalingGroup {
	levels: ScalingLevel[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const getScalingGroupsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	includeSystem: z.boolean().optional().default(true),
})

const getScalingGroupWithLevelsInputSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const createScalingGroupInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	title: z.string().min(1, "Title is required").max(100),
	description: z.string().max(500).optional(),
	levels: z
		.array(
			z.object({
				label: z.string().min(1, "Label is required").max(100),
				position: z.number().int().min(0),
			}),
		)
		.min(1, "At least one scaling level is required"),
})

const updateScalingGroupInputSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	title: z.string().min(1, "Title is required").max(100),
	description: z.string().max(500).optional(),
})

const deleteScalingGroupInputSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const setDefaultScalingGroupInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	groupId: z.string().min(1, "Group ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all scaling groups for a team (including system groups if requested)
 */
export const getScalingGroupsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getScalingGroupsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check if user has access to the team
		const hasAccess = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.ACCESS_DASHBOARD,
		)

		if (!hasAccess) {
			throw new Error("No access to this team")
		}

		const db = getDb()

		// Get scaling groups for the team (and optionally system groups)
		const rows = await db
			.select()
			.from(scalingGroupsTable)
			.where(
				data.includeSystem
					? inArray(scalingGroupsTable.teamId, [data.teamId, null as any])
					: eq(scalingGroupsTable.teamId, data.teamId),
			)
			.orderBy(desc(scalingGroupsTable.isSystem), asc(scalingGroupsTable.title))

		// Fetch levels for each group
		const groupsWithLevels = await Promise.all(
			rows.map(async (group) => {
				const levels = await db
					.select()
					.from(scalingLevelsTable)
					.where(eq(scalingLevelsTable.scalingGroupId, group.id))
					.orderBy(asc(scalingLevelsTable.position))

				return {
					...group,
					levels,
				}
			}),
		)

		return { scalingGroups: groupsWithLevels }
	})

/**
 * Get a single scaling group with its levels
 */
export const getScalingGroupWithLevelsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getScalingGroupWithLevelsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check if user has access to the team
		const hasAccess = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.ACCESS_DASHBOARD,
		)

		if (!hasAccess) {
			throw new Error("No access to this team")
		}

		const db = getDb()

		const [group] = await db
			.select()
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, data.groupId))

		if (!group) {
			return { scalingGroup: null }
		}

		// Verify the group belongs to this team (or is a system group with null teamId)
		if (group.teamId !== null && group.teamId !== data.teamId) {
			throw new Error("Cannot access scaling group from another team")
		}

		const levels = await db
			.select()
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, data.groupId))
			.orderBy(asc(scalingLevelsTable.position))

		return {
			scalingGroup: {
				...group,
				levels,
			},
		}
	})

/**
 * Create a new scaling group with levels
 */
export const createScalingGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createScalingGroupInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check if user can create components
		const canCreate = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.CREATE_COMPONENTS,
		)

		if (!canCreate) {
			throw new Error("Cannot create scaling groups in this team")
		}

		const db = getDb()

		// Create the scaling group
		const [group] = await db
			.insert(scalingGroupsTable)
			.values({
				title: data.title,
				description: data.description ?? null,
				teamId: data.teamId,
				isDefault: 0,
				isSystem: 0,
			})
			.returning()

		if (!group) {
			throw new Error("Failed to create scaling group")
		}

		// Create the scaling levels
		for (const level of data.levels) {
			await db.insert(scalingLevelsTable).values({
				scalingGroupId: group.id,
				label: level.label,
				position: level.position,
				teamSize: 1,
			})
		}

		return { success: true, scalingGroup: group }
	})

/**
 * Update a scaling group
 */
export const updateScalingGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateScalingGroupInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check if user can edit components
		const canEdit = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.EDIT_COMPONENTS,
		)

		if (!canEdit) {
			throw new Error("Cannot edit scaling groups in this team")
		}

		const db = getDb()

		// Get the existing group to verify ownership
		const [existing] = await db
			.select()
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, data.groupId))

		if (!existing) {
			throw new Error("Scaling group not found")
		}

		// Verify the group belongs to this team (or is system)
		if (existing.teamId && existing.teamId !== data.teamId) {
			throw new Error("Cannot edit scaling group from another team")
		}

		// Prevent editing system groups
		if (existing.isSystem === 1) {
			throw new Error("Cannot edit system scaling groups")
		}

		// Update the group
		const [updated] = await db
			.update(scalingGroupsTable)
			.set({
				title: data.title,
				description: data.description ?? null,
				updatedAt: new Date(),
			})
			.where(eq(scalingGroupsTable.id, data.groupId))
			.returning()

		return { success: true, scalingGroup: updated }
	})

/**
 * Delete a scaling group
 */
export const deleteScalingGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteScalingGroupInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check if user can delete components
		const canDelete = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.DELETE_COMPONENTS,
		)

		if (!canDelete) {
			throw new Error("Cannot delete scaling groups in this team")
		}

		const db = getDb()

		// Get the existing group to verify ownership
		const [existing] = await db
			.select()
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, data.groupId))

		if (!existing) {
			return { success: true } // Already deleted
		}

		// Prevent deleting system groups
		if (existing.isSystem === 1) {
			throw new Error("Cannot delete system scaling groups")
		}

		// Verify the group belongs to this team
		if (existing.teamId && existing.teamId !== data.teamId) {
			throw new Error("Cannot delete scaling group from another team")
		}

		// Delete the group (cascade will handle levels)
		await db
			.delete(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, data.groupId))

		return { success: true }
	})

/**
 * Set a scaling group as the team's default
 */
export const setDefaultScalingGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		setDefaultScalingGroupInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check if user can edit team settings
		const canEdit = await hasTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
		)

		if (!canEdit) {
			throw new Error("Cannot edit team settings")
		}

		const db = getDb()

		// Validate group exists and is accessible to this team
		const [group] = await db
			.select()
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, data.groupId))

		if (!group) {
			throw new Error("Scaling group not found")
		}

		// Must be either system group or owned by this team
		if (group.teamId && group.teamId !== data.teamId) {
			throw new Error("Cannot use scaling group from another team")
		}

		// Update the team's default scaling group
		const [team] = await db
			.update(teamTable)
			.set({
				defaultScalingGroupId: data.groupId,
				updatedAt: new Date(),
			})
			.where(eq(teamTable.id, data.teamId))
			.returning()

		return { success: true, team }
	})
