import { createServerFn } from '@tanstack/react-start/server'
import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'
import type { LeaderboardEntry } from '@/server/leaderboard'
import {
	getScheduledWorkoutsForTeam,
	getWorkoutResultForScheduledInstance,
	getWorkoutResultsForScheduledInstances,
} from '@/server/scheduling-service'
import { getUserTeams } from '@/server/teams'
import {
	getResultSetsById,
	getWorkoutResultsWithScalingForUser,
} from '@/server/workout-results'
import {
	createProgrammingTrackWorkoutRemix,
	createWorkout,
	createWorkoutRemix,
	getRemixedWorkouts,
	getTeamSpecificWorkout,
	getUserWorkouts,
	getUserWorkoutsCount,
	getWorkoutById,
	updateWorkout,
} from '@/server/workouts'
import { requireVerifiedEmail } from '@/utils/auth.server'
import {
	hasTeamPermission,
	isTeamMember,
	requireTeamMembership,
	requireTeamPermission,
} from '@/utils/team-auth.server'
import {
	canUserEditWorkout,
	shouldCreateRemix,
} from '@/utils/workout-permissions'
import { TEAM_PERMISSIONS } from '@/db/schemas/teams'
import { logDebug, logError } from '@/lib/logging/posthog-otel-logger'

const createWorkoutRemixSchema = z.object({
	sourceWorkoutId: z.string().min(1, 'Source workout ID is required'),
	teamId: z.string().min(1, 'Team ID is required'),
})

const createProgrammingTrackWorkoutRemixSchema = z.object({
	sourceWorkoutId: z.string().min(1, 'Source workout ID is required'),
	sourceTrackId: z.string().min(1, 'Source track ID is required'),
	teamId: z.string().min(1, 'Team ID is required'),
})

const getTeamSpecificWorkoutSchema = z.object({
	originalWorkoutId: z.string().min(1, 'Original workout ID is required'),
	teamId: z.string().min(1, 'Team ID is required'),
})

const createWorkoutSchema = z.object({
	workout: z.object({
		name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
		description: z.string().min(1, 'Description is required'),
		scope: z.enum(['private', 'public']).default('private'),
		scheme: z.enum([
			'time',
			'time-with-cap',
			'pass-fail',
			'rounds-reps',
			'reps',
			'emom',
			'load',
			'calories',
			'meters',
			'feet',
			'points',
		]),
		scoreType: z
			.enum(['min', 'max', 'sum', 'average', 'first', 'last'])
			.nullable()
			.optional()
			.transform((val) => val ?? null),
		repsPerRound: z.number().nullable(),
		roundsToScore: z.number().nullable(),
		sugarId: z.string().nullable(),
		tiebreakScheme: z.enum(['time', 'reps']).nullable(),
		scalingGroupId: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((val) => {
				if (val === '' || val === 'none' || val === null || val === undefined) {
					return null
				}
				return val
			})
			.refine(
				(val) => {
					if (val === null) return true
					return /^sgrp_[a-zA-Z0-9_-]+$/.test(val)
				},
				{
					message: 'Invalid scaling group ID format',
				},
			)
			.nullable()
			.optional(),
		timeCap: z.number().int().min(1).nullable().optional(),
	}),
	tagIds: z.array(z.string()).default([]),
	newTagNames: z.array(z.string()).optional(),
	movementIds: z.array(z.string()).default([]),
	teamId: z.string().min(1, 'Team ID is required'),
	trackId: z.string().optional(),
	scheduledDate: z.date().optional(),
	scalingDescriptions: z
		.array(
			z.object({
				scalingLevelId: z.string().min(1, 'Scaling level ID is required'),
				description: z.string().nullable(),
			}),
		)
		.optional(),
})

/**
 * Create a remix of an existing workout
 */
export const createWorkoutRemixFn = createServerFn({ method: 'POST' })
	.validator(createWorkoutRemixSchema)
	.handler(async ({ data }) => {
		try {
			const { sourceWorkoutId, teamId } = data

			await requireTeamMembership(teamId)

			const hasEditPermission = await hasTeamPermission(
				teamId,
				'EDIT_COMPONENTS',
			)
			if (!hasEditPermission) {
				throw new Error(
					"You don't have permission to create workouts in this team",
				)
			}

			const shouldRemix = await shouldCreateRemix(sourceWorkoutId)

			if (!shouldRemix) {
				throw new Error(
					"You don't have permission to remix this workout or should edit it directly instead",
				)
			}

			const remixedWorkout = await createWorkoutRemix({
				sourceWorkoutId,
				teamId,
			})

			return {
				success: true,
				data: remixedWorkout,
				message: 'Workout remix created successfully',
			}
		} catch (error) {
			logError({
				message: '[createWorkoutRemixFn] Failed to create workout remix',
				error,
				attributes: {
					sourceWorkoutId: data.sourceWorkoutId,
					teamId: data.teamId,
				},
			})
			throw error
		}
	})

/**
 * Create a remix of a programming track workout
 */
export const createProgrammingTrackWorkoutRemixFn = createServerFn({
	method: 'POST',
})
	.validator(createProgrammingTrackWorkoutRemixSchema)
	.handler(async ({ data }) => {
		try {
			const { sourceWorkoutId, sourceTrackId, teamId } = data

			await requireTeamMembership(teamId)

			const hasEditPermission = await hasTeamPermission(
				teamId,
				'EDIT_COMPONENTS',
			)
			if (!hasEditPermission) {
				throw new Error(
					"You don't have permission to create workouts in this team",
				)
			}

			const remixedWorkout = await createProgrammingTrackWorkoutRemix({
				sourceWorkoutId,
				sourceTrackId,
				teamId,
			})

			return {
				success: true,
				data: remixedWorkout,
				message: 'Programming track workout remix created successfully',
			}
		} catch (error) {
			logError({
				message:
					'[createProgrammingTrackWorkoutRemixFn] Failed to create programming track workout remix',
				error,
				attributes: {
					sourceWorkoutId: data.sourceWorkoutId,
					sourceTrackId: data.sourceTrackId,
					teamId: data.teamId,
				},
			})
			throw error
		}
	})

/**
 * Create a new workout
 */
export const createWorkoutFn = createServerFn({ method: 'POST' })
	.validator(createWorkoutSchema)
	.handler(async ({ data }) => {
		try {
			const { findOrCreateTag } = await import('@/server/tags')
			const { addWorkoutToTrack } = await import('@/server/programming-tracks')
			const { scheduleStandaloneWorkoutForTeam } = await import(
				'@/server/scheduling-service'
			)
			const { upsertWorkoutScalingDescriptions } = await import(
				'@/server/scaling-levels'
			)

			let finalTagIds = [...data.tagIds]
			if (data.newTagNames && data.newTagNames.length > 0) {
				const newTags = await Promise.all(
					data.newTagNames.map((tagName) => findOrCreateTag(tagName)),
				)
				finalTagIds = [
					...finalTagIds,
					...newTags
						.filter((tag) => tag !== null && tag !== undefined)
						.map((tag) => tag.id),
				]
			}

			const workout = await createWorkout({
				...data,
				tagIds: finalTagIds,
				workout: {
					...data.workout,
					sourceTrackId: null,
					sourceWorkoutId: null,
					scalingGroupId: data.workout.scalingGroupId ?? null,
					timeCap: data.workout.timeCap ?? null,
				},
			})

			if (data.scalingDescriptions && data.scalingDescriptions.length > 0) {
				await upsertWorkoutScalingDescriptions({
					workoutId: workout.id,
					descriptions: data.scalingDescriptions,
				})
			}

			let trackWorkoutId: string | undefined
			if (data.trackId) {
				const trackWorkout = await addWorkoutToTrack({
					trackId: data.trackId,
					workoutId: workout.id,
				})
				trackWorkoutId = trackWorkout.id
			}

			if (data.scheduledDate) {
				const normalizedDate = new Date(data.scheduledDate)
				normalizedDate.setUTCHours(12, 0, 0, 0)

				if (trackWorkoutId) {
					const { scheduleWorkoutForTeam } = await import(
						'@/server/scheduling-service'
					)
					await scheduleWorkoutForTeam({
						teamId: data.teamId,
						trackWorkoutId,
						workoutId: workout.id,
						scheduledDate: normalizedDate,
					})
				} else {
					await scheduleStandaloneWorkoutForTeam({
						teamId: data.teamId,
						workoutId: workout.id,
						scheduledDate: normalizedDate,
					})
				}
			}

			logDebug({
				message: '[createWorkoutFn] Created workout',
				attributes: {
					workoutId: workout.id,
					workoutName: workout.name,
					teamId: data.teamId,
				},
			})

			return { success: true, data: workout }
		} catch (error) {
			logError({
				message: '[createWorkoutFn] Failed to create workout',
				error,
				attributes: { teamId: data.teamId, workoutName: data.workout.name },
			})
			throw error
		}
	})

/**
 * Get all workouts for the current user
 */
export const getUserWorkoutsFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			teamId: z.union([
				z.string().min(1, 'Team ID is required'),
				z.array(z.string().min(1, 'Team ID is required')),
			]),
			trackId: z.string().optional(),
			search: z.string().optional(),
			tag: z.string().optional(),
			movement: z.string().optional(),
			type: z.enum(['all', 'original', 'remix']).optional(),
			page: z.number().int().min(1).optional().default(1),
			pageSize: z.number().int().min(1).max(100).optional().default(50),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const offset = (data.page - 1) * data.pageSize

			const filters = {
				search: data.search,
				tag: data.tag,
				movement: data.movement,
				type: data.type,
				trackId: data.trackId,
			}

			logDebug({
				message: '[getUserWorkoutsFn] called',
				attributes: {
					teamId: Array.isArray(data.teamId)
						? data.teamId.join(',')
						: data.teamId,
					filters: JSON.stringify(filters),
					limit: data.pageSize,
					offset,
				},
			})

			const [workouts, totalCount] = await Promise.all([
				getUserWorkouts({
					teamId: data.teamId,
					...filters,
					limit: data.pageSize,
					offset,
				}),
				getUserWorkoutsCount({ teamId: data.teamId, ...filters }),
			])

			logDebug({
				message: '[getUserWorkoutsFn] result',
				attributes: {
					workoutCount: workouts.length,
					totalCount,
					firstWorkoutId: workouts[0]?.id ?? 'none',
					firstWorkoutName: workouts[0]?.name ?? 'none',
				},
			})

			return {
				success: true,
				data: workouts,
				totalCount,
				currentPage: data.page,
				pageSize: data.pageSize,
				totalPages: Math.ceil(totalCount / data.pageSize),
			}
		} catch (error) {
			logError({
				message: '[getUserWorkoutsFn] Failed to get user workouts',
				error,
				attributes: {
					teamId: Array.isArray(data.teamId)
						? data.teamId.join(',')
						: data.teamId,
				},
			})
			throw error
		}
	})

/**
 * Get a single workout by ID
 */
export const getWorkoutByIdFn = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1, 'Workout ID is required') }))
	.handler(async ({ data }) => {
		try {
			const workout = await getWorkoutById(data.id)
			return { success: true, data: workout }
		} catch (error) {
			logError({
				message: '[getWorkoutByIdFn] Failed to get workout',
				error,
				attributes: { workoutId: data.id },
			})
			throw error
		}
	})

/**
 * Get workout results by workout and user
 */
export const getWorkoutResultsByWorkoutAndUserFn = createServerFn({
	method: 'POST',
})
	.validator(z.object({ workoutId: z.string().min(1, 'Workout ID is required') }))
	.handler(async ({ data }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.user?.id) {
				throw new Error('User must be authenticated')
			}

			const results = await getWorkoutResultsWithScalingForUser(
				data.workoutId,
				session.user.id,
			)
			return { success: true, data: results }
		} catch (error) {
			logError({
				message: '[getWorkoutResultsByWorkoutAndUserFn] Failed to get workout results',
				error,
				attributes: { workoutId: data.workoutId },
			})
			throw error
		}
	})

/**
 * Get result sets by result ID
 */
export const getResultSetsByIdFn = createServerFn({ method: 'POST' })
	.validator(z.object({ resultId: z.string().min(1, 'Result ID is required') }))
	.handler(async ({ data }) => {
		try {
			const sets = await getResultSetsById(data.resultId)
			return { success: true, data: sets }
		} catch (error) {
			logError({
				message: '[getResultSetsByIdFn] Failed to get result sets',
				error,
				attributes: { resultId: data.resultId },
			})
			throw error
		}
	})

/**
 * Get scheduled workouts for a team within a date range
 */
export const getScheduledTeamWorkoutsFn = createServerFn({
	method: 'POST',
})
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const { teamId, startDate, endDate } = data

			const scheduledWorkouts = await getScheduledWorkoutsForTeam(teamId, {
				start: new Date(startDate),
				end: new Date(endDate),
			})

			return { success: true, data: scheduledWorkouts }
		} catch (error) {
			logError({
				message: '[getScheduledTeamWorkoutsFn] Failed to get scheduled team workouts',
				error,
				attributes: {
					teamId: data.teamId,
					startDate: data.startDate,
					endDate: data.endDate,
				},
			})
			throw error
		}
	})

/**
 * Get scheduled workouts with results for a team within a date range
 */
export const getScheduledTeamWorkoutsWithResultsFn = createServerFn({
	method: 'POST',
})
	.validator(
		z.object({
			teamId: z.string().min(1, 'Team ID is required'),
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
			userId: z.string().min(1, 'User ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const { teamId, startDate, endDate, userId } = data

			const scheduledWorkouts = await getScheduledWorkoutsForTeam(teamId, {
				start: new Date(startDate),
				end: new Date(endDate),
			})

			const instances = scheduledWorkouts.map((workout) => ({
				id: workout.id,
				scheduledDate: workout.scheduledDate,
				workoutId:
					workout.trackWorkout?.workoutId || workout.trackWorkout?.workout?.id,
			}))

			const workoutResults = await getWorkoutResultsForScheduledInstances(
				instances,
				userId,
			)

			const workoutsWithResults = scheduledWorkouts.map((workout) => ({
				...workout,
				result: workout.id ? workoutResults[workout.id] || null : null,
			}))

			return { success: true, data: workoutsWithResults }
		} catch (error) {
			logError({
				message:
					'[getScheduledTeamWorkoutsWithResultsFn] Failed to get scheduled team workouts with results',
				error,
				attributes: {
					teamId: data.teamId,
					userId: data.userId,
					startDate: data.startDate,
					endDate: data.endDate,
				},
			})
			throw error
		}
	})

/**
 * Get workout result for a scheduled workout instance
 */
export const getScheduledWorkoutResultFn = createServerFn({
	method: 'POST',
})
	.validator(
		z.object({
			scheduledInstanceId: z
				.string()
				.min(1, 'Scheduled instance ID is required'),
			date: z.string().datetime(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.user?.id) {
				throw new Error('User must be authenticated')
			}

			const result = await getWorkoutResultForScheduledInstance(
				data.scheduledInstanceId,
				session.user.id,
				new Date(data.date),
			)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					'[getScheduledWorkoutResultFn] Failed to get scheduled workout result',
				error,
				attributes: {
					scheduledInstanceId: data.scheduledInstanceId,
					date: data.date,
				},
			})
			throw error
		}
	})

/**
 * Get workouts that are remixes of a given workout
 */
export const getRemixedWorkoutsFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			sourceWorkoutId: z.string().min(1, 'Source workout ID is required'),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const remixedWorkouts = await getRemixedWorkouts(data.sourceWorkoutId)
			return { success: true, data: remixedWorkouts }
		} catch (error) {
			logError({
				message: '[getRemixedWorkoutsFn] Failed to get remixed workouts',
				error,
				attributes: { sourceWorkoutId: data.sourceWorkoutId },
			})
			throw error
		}
	})

/**
 * Get team-specific workout (checks for team remix, otherwise returns original)
 */
export const getTeamSpecificWorkoutFn = createServerFn({ method: 'POST' })
	.validator(getTeamSpecificWorkoutSchema)
	.handler(async ({ data }) => {
		try {
			const { originalWorkoutId, teamId } = data

			const session = await requireVerifiedEmail()
			if (!session) {
				throw new Error('Authentication required')
			}

			const isMember = await isTeamMember(teamId)
			if (!isMember) {
				throw new Error(
					'You are not authorized to access this team\'s workouts',
				)
			}

			const workout = await getTeamSpecificWorkout({
				originalWorkoutId,
				teamId,
			})

			return {
				success: true,
				data: workout,
			}
		} catch (error) {
			logError({
				message: '[getTeamSpecificWorkoutFn] Failed to get team-specific workout',
				error,
				attributes: {
					originalWorkoutId: data.originalWorkoutId,
					teamId: data.teamId,
				},
			})
			throw error
		}
	})

/**
 * Get user teams
 */
export const getUserTeamsFn = createServerFn({ method: 'POST' })
	.validator(z.object({}))
	.handler(async () => {
		try {
			const teams = await getUserTeams()
			return { success: true, data: teams }
		} catch (error) {
			logError({
				message: '[getUserTeamsFn] Failed to get user teams',
				error,
			})
			throw error
		}
	})

/**
 * Get team leaderboards for multiple scheduled workout instances
 */
export const getTeamLeaderboardsFn = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			scheduledWorkoutInstanceIds: z.array(z.string()).min(1),
			teamId: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const { getLeaderboardForScheduledWorkout } = await import(
				'@/server/leaderboard'
			)

			const leaderboards: Record<string, LeaderboardEntry[]> = {}

			await Promise.all(
				data.scheduledWorkoutInstanceIds.map(async (instanceId) => {
					const leaderboard = await getLeaderboardForScheduledWorkout({
						scheduledWorkoutInstanceId: instanceId,
						teamId: data.teamId,
					})
					leaderboards[instanceId] = leaderboard
				}),
			)

			return {
				success: true,
				data: leaderboards,
			}
		} catch (error) {
			logError({
				message: '[getTeamLeaderboardsFn] Failed to fetch team leaderboards',
				error,
				attributes: {
					teamId: data.teamId,
					instanceCount: data.scheduledWorkoutInstanceIds.length,
				},
			})
			throw error
		}
	})
