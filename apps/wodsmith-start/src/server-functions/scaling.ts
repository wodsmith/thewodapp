import { createServerFn } from '@tanstack/react-start/server'
import { z } from 'zod'
import { TEAM_PERMISSIONS } from '@/db/schemas/teams'
import {
	createScalingGroup as createScalingGroupServer,
	deleteScalingGroup as deleteScalingGroupServer,
	getScalingGroupWithLevels,
	listScalingGroups,
	setTeamDefaultScalingGroup,
	updateScalingGroup as updateScalingGroupServer,
} from '@/server/scaling-groups'
import {
	createScalingLevel as createScalingLevelServer,
	getWorkoutScalingDescriptionsWithLevels,
	reorderScalingLevels as reorderScalingLevelsServer,
	upsertWorkoutScalingDescriptions,
} from '@/server/scaling-levels'
import { getSessionFromCookie } from '@/utils/auth.server'
import { hasTeamPermission } from '@/utils/team-auth.server'

/**
 * Get all scaling groups for a team
 */
export const getScalingGroupsFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			includeSystem: z.boolean().optional().default(true),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const hasAccess = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			if (!hasAccess) {
				throw new Error('No access to this team')
			}

			const groups = await listScalingGroups({
				teamId: data.teamId,
				includeSystem: data.includeSystem,
			})
			return { success: true, data: groups }
		} catch (error) {
			console.error('Failed to get scaling groups:', error)
			throw error
		}
	})

/**
 * Get a single scaling group with its levels
 */
export const getScalingGroupWithLevelsFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			groupId: z.string().min(1, 'Group ID is required'),
			teamId: z.string().min(1, 'Team ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const hasAccess = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			if (!hasAccess) {
				throw new Error('No access to this team')
			}

			const result = await getScalingGroupWithLevels({
				teamId: data.teamId,
				scalingGroupId: data.groupId,
			})

			if (!result) {
				throw new Error('Scaling group not found')
			}

			return {
				success: true,
				data: result,
			}
		} catch (error) {
			console.error('Failed to get scaling group:', error)
			throw error
		}
	})

/**
 * Create a new scaling group with levels
 */
export const createScalingGroupFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			title: z.string().min(1, 'Title is required').max(100),
			description: z.string().max(500).optional(),
			levels: z
				.array(
					z.object({
						label: z.string().min(1, 'Label is required').max(100),
						position: z.number().int().min(0),
					}),
				)
				.min(1, 'At least one scaling level is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canCreate = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.CREATE_COMPONENTS,
			)

			if (!canCreate) {
				throw new Error('Cannot create scaling groups in this team')
			}

			const group = await createScalingGroupServer({
				teamId: data.teamId,
				title: data.title,
				description: data.description,
			})

			for (const level of data.levels) {
				if (!group) {
					throw new Error('Failed to create scaling group')
				}
				await createScalingLevelServer({
					teamId: data.teamId,
					scalingGroupId: group.id,
					label: level.label,
					position: level.position,
				})
			}

			if (!group) {
				throw new Error('Failed to create scaling group')
			}

			return { success: true, data: { id: group.id } }
		} catch (error) {
			console.error('Failed to create scaling group:', error)
			throw error
		}
	})

/**
 * Update a scaling group
 */
export const updateScalingGroupFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			groupId: z.string().min(1, 'Group ID is required'),
			teamId: z.string().min(1, 'Team ID is required'),
			title: z.string().min(1, 'Title is required').max(100),
			description: z.string().max(500).optional(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canEdit = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new Error('Cannot edit scaling groups in this team')
			}

			await updateScalingGroupServer({
				teamId: data.teamId,
				scalingGroupId: data.groupId,
				data: {
					title: data.title,
					description: data.description,
				},
			})

			return { success: true }
		} catch (error) {
			console.error('Failed to update scaling group:', error)
			throw error
		}
	})

/**
 * Delete a scaling group
 */
export const deleteScalingGroupFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			groupId: z.string().min(1, 'Group ID is required'),
			teamId: z.string().min(1, 'Team ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canDelete = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.DELETE_COMPONENTS,
			)

			if (!canDelete) {
				throw new Error('Cannot delete scaling groups in this team')
			}

			await deleteScalingGroupServer({
				teamId: data.teamId,
				scalingGroupId: data.groupId,
			})

			return { success: true }
		} catch (error) {
			console.error('Failed to delete scaling group:', error)
			throw error
		}
	})

/**
 * Reorder scaling levels within a group
 */
export const reorderScalingLevelsFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			groupId: z.string().min(1, 'Group ID is required'),
			teamId: z.string().min(1, 'Team ID is required'),
			levelIds: z.array(z.string()).min(1, 'Level IDs are required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canEdit = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new Error('Cannot edit scaling groups in this team')
			}

			await reorderScalingLevelsServer({
				teamId: data.teamId,
				scalingGroupId: data.groupId,
				orderedLevelIds: data.levelIds,
			})

			return { success: true }
		} catch (error) {
			console.error('Failed to reorder scaling levels:', error)
			throw error
		}
	})

/**
 * Set a scaling group as the team's default
 */
export const setDefaultScalingGroupFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			groupId: z.string().min(1, 'Group ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canEdit = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)

			if (!canEdit) {
				throw new Error('Cannot edit team settings')
			}

			await setTeamDefaultScalingGroup({
				teamId: data.teamId,
				scalingGroupId: data.groupId,
			})

			return { success: true }
		} catch (error) {
			console.error('Failed to set default scaling group:', error)
			throw error
		}
	})

/**
 * Get workout scaling descriptions with level details
 */
export const getWorkoutScalingDescriptionsFn = createServerFn({
	method: 'POST',
})
	.validator(
		z.object({
			workoutId: z.string().min(1, 'Workout ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const descriptions = await getWorkoutScalingDescriptionsWithLevels({
				workoutId: data.workoutId,
			})

			return { success: true, data: descriptions }
		} catch (error) {
			console.error('Failed to get workout scaling descriptions:', error)
			throw error
		}
	})

/**
 * Create a new scaling level in a group
 */
export const createScalingLevelFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			scalingGroupId: z.string().min(1, 'Group ID is required'),
			label: z.string().min(1, 'Label is required').max(100),
			position: z.number().int().min(0).optional(),
			teamSize: z.number().int().min(1).default(1),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canEdit = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new Error('Cannot edit scaling groups in this team')
			}

			const level = await createScalingLevelServer({
				teamId: data.teamId,
				scalingGroupId: data.scalingGroupId,
				label: data.label,
				position: data.position,
				teamSize: data.teamSize,
			})

			return { success: true, data: level }
		} catch (error) {
			console.error('Failed to create scaling level:', error)
			throw error
		}
	})

/**
 * Update a scaling level
 */
export const updateScalingLevelFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			scalingLevelId: z.string().min(1, 'Level ID is required'),
			label: z.string().min(1, 'Label is required').max(100).optional(),
			teamSize: z.number().int().min(1).optional(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canEdit = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new Error('Cannot edit scaling groups in this team')
			}

			const { updateScalingLevel } = await import('@/server/scaling-levels')
			const level = await updateScalingLevel({
				teamId: data.teamId,
				scalingLevelId: data.scalingLevelId,
				data: {
					label: data.label,
					teamSize: data.teamSize,
				},
			})

			if (!level) {
				throw new Error('Scaling level not found')
			}

			return { success: true, data: level }
		} catch (error) {
			console.error('Failed to update scaling level:', error)
			throw error
		}
	})

/**
 * Delete a scaling level
 */
export const deleteScalingLevelFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			scalingLevelId: z.string().min(1, 'Level ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const canEdit = await hasTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			)

			if (!canEdit) {
				throw new Error('Cannot edit scaling groups in this team')
			}

			const { deleteScalingLevel } = await import('@/server/scaling-levels')
			const result = await deleteScalingLevel({
				teamId: data.teamId,
				scalingLevelId: data.scalingLevelId,
			})

			if (!result.success) {
				throw new Error(result.error || 'Failed to delete')
			}

			return { success: true }
		} catch (error) {
			console.error('Failed to delete scaling level:', error)
			throw error
		}
	})

/**
 * Update workout scaling descriptions
 */
export const updateWorkoutScalingDescriptionsFn = createServerFn({
	method: 'POST',
})
	.validator(
		z.object({
			workoutId: z.string().min(1, 'Workout ID is required'),
			descriptions: z.array(
				z.object({
					scalingLevelId: z.string().min(1, 'Scaling level ID is required'),
					description: z.string().nullable(),
				}),
			),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error('Not authenticated')
			}

			const result = await upsertWorkoutScalingDescriptions({
				workoutId: data.workoutId,
				descriptions: data.descriptions,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error('Failed to update workout scaling descriptions:', error)
			throw error
		}
	})
