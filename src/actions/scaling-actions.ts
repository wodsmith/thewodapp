"use server"

import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import {
	listScalingGroups,
	createScalingGroup as createScalingGroupServer,
	updateScalingGroup as updateScalingGroupServer,
	deleteScalingGroup as deleteScalingGroupServer,
	getScalingGroupWithLevels,
	setTeamDefaultScalingGroup,
} from "@/server/scaling-groups"
import {
	createScalingLevel as createScalingLevelServer,
	updateScalingLevel as updateScalingLevelServer,
	deleteScalingLevel as deleteScalingLevelServer,
	reorderScalingLevels as reorderScalingLevelsServer,
} from "@/server/scaling-levels"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { revalidatePath } from "next/cache"

/**
 * Get all scaling groups for a team
 */
export const getScalingGroupsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			includeSystem: z.boolean().optional().default(true),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has access to the team
			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to this team")
			}

			const groups = await listScalingGroups({
				teamId: input.teamId,
				includeSystem: input.includeSystem,
			})
			return { success: true, data: groups }
		} catch (error) {
			console.error("Failed to get scaling groups:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get scaling groups",
			)
		}
	})

/**
 * Get a single scaling group with its levels
 */
export const getScalingGroupWithLevelsAction = createServerAction()
	.input(
		z.object({
			groupId: z.string().min(1, "Group ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has access to the team
			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to this team")
			}

			const result = await getScalingGroupWithLevels({
				teamId: input.teamId,
				scalingGroupId: input.groupId,
			})

			if (!result) {
				throw new ZSAError("NOT_FOUND", "Scaling group not found")
			}

			return {
				success: true,
				data: result,
			}
		} catch (error) {
			console.error("Failed to get scaling group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get scaling group")
		}
	})

/**
 * Create a new scaling group with levels
 */
export const createScalingGroupAction = createServerAction()
	.input(
		z.object({
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
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user can create components
			const canCreate = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.CREATE_COMPONENTS,
			)

			if (!canCreate) {
				throw new ZSAError(
					"FORBIDDEN",
					"Cannot create scaling groups in this team",
				)
			}

			// Create the scaling group
			const group = await createScalingGroupServer({
				teamId: input.teamId,
				title: input.title,
				description: input.description,
			})

			// Create the scaling levels
			for (const level of input.levels) {
				await createScalingLevelServer({
					teamId: input.teamId,
					scalingGroupId: group.id,
					label: level.label,
					position: level.position,
				})
			}

			// Revalidate relevant paths
			revalidatePath("/settings/scaling")
			revalidatePath("/workouts")

			return { success: true, data: { id: group.id } }
		} catch (error) {
			console.error("Failed to create scaling group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create scaling group",
			)
		}
	})

/**
 * Update a scaling group
 */
export const updateScalingGroupAction = createServerAction()
	.input(
		z.object({
			groupId: z.string().min(1, "Group ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
			title: z.string().min(1, "Title is required").max(100),
			description: z.string().max(500).optional(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user can edit components
			const canEdit = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new ZSAError(
					"FORBIDDEN",
					"Cannot edit scaling groups in this team",
				)
			}

			// Update the scaling group
			await updateScalingGroupServer({
				teamId: input.teamId,
				scalingGroupId: input.groupId,
				data: {
					title: input.title,
					description: input.description,
				},
			})

			// Revalidate relevant paths
			revalidatePath("/settings/scaling")
			revalidatePath("/workouts")

			return { success: true }
		} catch (error) {
			console.error("Failed to update scaling group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update scaling group",
			)
		}
	})

/**
 * Delete a scaling group
 */
export const deleteScalingGroupAction = createServerAction()
	.input(
		z.object({
			groupId: z.string().min(1, "Group ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user can delete components
			const canDelete = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.DELETE_COMPONENTS,
			)

			if (!canDelete) {
				throw new ZSAError(
					"FORBIDDEN",
					"Cannot delete scaling groups in this team",
				)
			}

			await deleteScalingGroupServer({
				teamId: input.teamId,
				scalingGroupId: input.groupId,
			})

			// Revalidate relevant paths
			revalidatePath("/settings/scaling")
			revalidatePath("/workouts")

			return { success: true }
		} catch (error) {
			console.error("Failed to delete scaling group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete scaling group",
			)
		}
	})

/**
 * Reorder scaling levels within a group
 */
export const reorderScalingLevelsAction = createServerAction()
	.input(
		z.object({
			groupId: z.string().min(1, "Group ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
			levelIds: z.array(z.string()).min(1, "Level IDs are required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user can edit components
			const canEdit = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new ZSAError(
					"FORBIDDEN",
					"Cannot edit scaling groups in this team",
				)
			}

			await reorderScalingLevelsServer({
				teamId: input.teamId,
				scalingGroupId: input.groupId,
				orderedLevelIds: input.levelIds,
			})

			// Revalidate relevant paths
			revalidatePath("/settings/scaling")
			revalidatePath("/workouts")

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder scaling levels:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to reorder scaling levels",
			)
		}
	})

/**
 * Set a scaling group as the team's default
 */
export const setDefaultScalingGroupAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			groupId: z.string().min(1, "Group ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user can edit team settings
			const canEdit = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)

			if (!canEdit) {
				throw new ZSAError("FORBIDDEN", "Cannot edit team settings")
			}

			await setTeamDefaultScalingGroup({
				teamId: input.teamId,
				scalingGroupId: input.groupId,
			})

			// Revalidate relevant paths
			revalidatePath("/settings/scaling")
			revalidatePath("/settings/team")

			return { success: true }
		} catch (error) {
			console.error("Failed to set default scaling group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to set default scaling group",
			)
		}
	})
