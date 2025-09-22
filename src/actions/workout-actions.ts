"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import {
	getResultSetsById,
	getWorkoutResultsWithScalingForUser,
	getWorkoutResultForScheduledInstance,
} from "@/server/workout-results"
import {
	createWorkout,
	createWorkoutRemix,
	createProgrammingTrackWorkoutRemix,
	getUserWorkouts,
	getUserWorkoutsCount,
	getWorkoutById,
	getRemixedWorkouts,
	updateWorkout,
	getTeamSpecificWorkout,
} from "@/server/workouts"
import { getScheduledWorkoutsForTeam } from "@/server/scheduling-service"
import { getWorkoutResultsForScheduledInstances } from "@/server/workout-results"
import { getUserTeams } from "@/server/teams"
import { requireVerifiedEmail } from "@/utils/auth"
import {
	requireTeamMembership,
	hasTeamPermission,
	isTeamMember,
} from "@/utils/team-auth"
import {
	canUserEditWorkout,
	shouldCreateRemix,
} from "@/utils/workout-permissions"

const createWorkoutRemixSchema = z.object({
	sourceWorkoutId: z.string().min(1, "Source workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const createProgrammingTrackWorkoutRemixSchema = z.object({
	sourceWorkoutId: z.string().min(1, "Source workout ID is required"),
	sourceTrackId: z.string().min(1, "Source track ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const getTeamSpecificWorkoutSchema = z.object({
	originalWorkoutId: z.string().min(1, "Original workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const createWorkoutSchema = z.object({
	workout: z.object({
		name: z.string().min(1, "Name is required").max(255, "Name is too long"),
		description: z.string().min(1, "Description is required"),
		scope: z.enum(["private", "public"]).default("private"),
		scheme: z.enum([
			"time",
			"time-with-cap",
			"pass-fail",
			"rounds-reps",
			"reps",
			"emom",
			"load",
			"calories",
			"meters",
			"feet",
			"points",
		]),
		repsPerRound: z.number().nullable(),
		roundsToScore: z.number().nullable(),
		sugarId: z.string().nullable(),
		tiebreakScheme: z.enum(["time", "reps"]).nullable(),
		scalingGroupId: z.string().nullable().optional(), // Add scaling group support
		secondaryScheme: z
			.enum([
				"time",
				"pass-fail",
				"rounds-reps",
				"reps",
				"emom",
				"load",
				"calories",
				"meters",
				"feet",
				"points",
			])
			.nullable(),
	}),
	tagIds: z.array(z.string()).default([]),
	newTagNames: z.array(z.string()).optional(),
	movementIds: z.array(z.string()).default([]),
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().optional(),
	scheduledDate: z.date().optional(),
})

/**
 * Create a remix of an existing workout
 */
export const createWorkoutRemixAction = createServerAction()
	.input(createWorkoutRemixSchema)
	.handler(async ({ input }) => {
		try {
			const { sourceWorkoutId, teamId } = input

			// Ensure the user is a member of the target team
			await requireTeamMembership(teamId)

			// Check if user has EDIT_COMPONENTS permission for the team
			const hasEditPermission = await hasTeamPermission(
				teamId,
				"EDIT_COMPONENTS",
			)
			if (!hasEditPermission) {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to create workouts in this team",
				)
			}

			// Check if user should create a remix (permission validation)
			const shouldRemix = await shouldCreateRemix(sourceWorkoutId)

			if (!shouldRemix) {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to remix this workout or should edit it directly instead",
				)
			}

			// Create the remix
			const remixedWorkout = await createWorkoutRemix({
				sourceWorkoutId,
				teamId,
			})

			return {
				success: true,
				data: remixedWorkout,
				message: "Workout remix created successfully",
			}
		} catch (error) {
			console.error("Failed to create workout remix:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create workout remix",
			)
		}
	})

/**
 * Create a remix of a programming track workout
 */
export const createProgrammingTrackWorkoutRemixAction = createServerAction()
	.input(createProgrammingTrackWorkoutRemixSchema)
	.handler(async ({ input }) => {
		try {
			const { sourceWorkoutId, sourceTrackId, teamId } = input

			// Ensure the user is a member of the target team
			await requireTeamMembership(teamId)

			// Check if user has EDIT_COMPONENTS permission for the team
			const hasEditPermission = await hasTeamPermission(
				teamId,
				"EDIT_COMPONENTS",
			)
			if (!hasEditPermission) {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to create workouts in this team",
				)
			}

			// Note: For programming track remixes, we don't need the shouldCreateRemix check
			// as this is specifically for external track workouts

			// Create the remix
			const remixedWorkout = await createProgrammingTrackWorkoutRemix({
				sourceWorkoutId,
				sourceTrackId,
				teamId,
			})

			return {
				success: true,
				data: remixedWorkout,
				message: "Programming track workout remix created successfully",
			}
		} catch (error) {
			console.error("Failed to create programming track workout remix:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create programming track workout remix",
			)
		}
	})

/**
 * Create a new workout
 */
export const createWorkoutAction = createServerAction()
	.input(createWorkoutSchema)
	.handler(async ({ input }) => {
		try {
			// Import necessary functions
			const { findOrCreateTag } = await import("@/server/tags")
			const { addWorkoutToTrack } = await import("@/server/programming-tracks")
			const { scheduleWorkoutForTeam } = await import(
				"@/server/scheduling-service"
			)

			// Process new tags if any
			let finalTagIds = [...input.tagIds]
			if (input.newTagNames && input.newTagNames.length > 0) {
				const newTags = await Promise.all(
					input.newTagNames.map((tagName) => findOrCreateTag(tagName)),
				)
				finalTagIds = [...finalTagIds, ...newTags.map((tag) => tag.id)]
			}

			// Create the workout
			const workout = await createWorkout({
				...input,
				tagIds: finalTagIds,
				workout: {
					...input.workout,
					sourceTrackId: null,
					sourceWorkoutId: null,
					scalingGroupId: input.workout.scalingGroupId ?? null,
				},
			})

			// If trackId is provided, add workout to the track
			let trackWorkoutId: string | undefined
			if (input.trackId) {
				const trackWorkout = await addWorkoutToTrack({
					trackId: input.trackId,
					workoutId: workout.id,
				})
				trackWorkoutId = trackWorkout.id
			}

			// If scheduledDate is provided, schedule the workout
			if (input.scheduledDate) {
				const { scheduleStandaloneWorkoutForTeam } = await import(
					"@/server/scheduling-service"
				)

				// Normalize the date to noon UTC to avoid timezone boundary issues
				// This ensures the date remains stable across all timezones
				const normalizedDate = new Date(input.scheduledDate)
				normalizedDate.setUTCHours(12, 0, 0, 0)

				if (trackWorkoutId) {
					// Schedule as part of a track
					await scheduleWorkoutForTeam({
						teamId: input.teamId,
						trackWorkoutId,
						workoutId: workout.id,
						scheduledDate: normalizedDate,
					})
				} else {
					// Schedule as standalone workout
					await scheduleStandaloneWorkoutForTeam({
						teamId: input.teamId,
						workoutId: workout.id,
						scheduledDate: normalizedDate,
					})
				}
			}

			// Revalidate the workouts page to show the new workout
			revalidatePath("/workouts")
			if (input.trackId) {
				revalidatePath("/programming")
			}

			console.log("[DEBUG] Created workout:", workout)
			console.log("[DEBUG] Workout ID:", workout.id)

			return { success: true, data: workout }
		} catch (error) {
			console.error("Failed to create workout:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create workout")
		}
	})

/**
 * Add workout to a programming track
 */
export const addWorkoutToTrackAction = createServerAction()
	.input(
		z.object({
			trackId: z.string().min(1, "Track ID is required"),
			workoutId: z.string().min(1, "Workout ID is required"),
			dayNumber: z.number().min(1).optional(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const { addWorkoutToTrack } = await import("@/server/programming-tracks")

			await addWorkoutToTrack({
				trackId: input.trackId,
				workoutId: input.workoutId,
				dayNumber: input.dayNumber,
			})

			revalidatePath(`/workouts/${input.workoutId}`)
			revalidatePath("/programming")

			return { success: true }
		} catch (error) {
			console.error("Failed to add workout to track:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to add workout to track",
			)
		}
	})

/**
 * Schedule a standalone workout
 */
export const scheduleStandaloneWorkoutAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			workoutId: z.string().min(1, "Workout ID is required"),
			scheduledDate: z.date(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const { scheduleStandaloneWorkoutForTeam } = await import(
				"@/server/scheduling-service"
			)

			// Normalize the date to noon UTC to avoid timezone boundary issues
			// This ensures the date remains stable across all timezones
			const normalizedDate = new Date(input.scheduledDate)
			normalizedDate.setUTCHours(12, 0, 0, 0)

			await scheduleStandaloneWorkoutForTeam({
				teamId: input.teamId,
				workoutId: input.workoutId,
				scheduledDate: normalizedDate,
			})

			revalidatePath(`/workouts/${input.workoutId}`)
			revalidatePath("/dashboard")

			return { success: true }
		} catch (error) {
			console.error("Failed to schedule workout:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to schedule workout")
		}
	})

/**
 * Get all workouts for the current user
 */
export const getUserWorkoutsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			trackId: z.string().optional(),
			search: z.string().optional(),
			tag: z.string().optional(),
			movement: z.string().optional(),
			type: z.enum(["all", "original", "remix"]).optional(),
			page: z.number().int().min(1).optional().default(1),
			pageSize: z.number().int().min(1).max(100).optional().default(50),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const offset = (input.page - 1) * input.pageSize

			const filters = {
				search: input.search,
				tag: input.tag,
				movement: input.movement,
				type: input.type,
				trackId: input.trackId,
			}

			const [workouts, totalCount] = await Promise.all([
				getUserWorkouts({
					teamId: input.teamId,
					...filters,
					limit: input.pageSize,
					offset,
				}),
				getUserWorkoutsCount({ teamId: input.teamId, ...filters }),
			])

			return {
				success: true,
				data: workouts,
				totalCount,
				currentPage: input.page,
				pageSize: input.pageSize,
				totalPages: Math.ceil(totalCount / input.pageSize),
			}
		} catch (error) {
			console.error("Failed to get user workouts:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get user workouts")
		}
	})

/**
 * Get a single workout by ID
 */
export const getWorkoutByIdAction = createServerAction()
	.input(z.object({ id: z.string().min(1, "Workout ID is required") }))
	.handler(async ({ input }) => {
		try {
			const workout = await getWorkoutById(input.id)
			return { success: true, data: workout }
		} catch (error) {
			console.error("Failed to get workout:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get workout")
		}
	})

/**
 * Get workout results by workout and user
 */
export const getWorkoutResultsByWorkoutAndUserAction = createServerAction()
	.input(
		z.object({
			workoutId: z.string().min(1, "Workout ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
			}

			const results = await getWorkoutResultsWithScalingForUser(
				input.workoutId,
				session.user.id,
			)
			return { success: true, data: results }
		} catch (error) {
			console.error("Failed to get workout results:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get workout results",
			)
		}
	})

/**
 * Get result sets by result ID
 */
export const getResultSetsByIdAction = createServerAction()
	.input(z.object({ resultId: z.string().min(1, "Result ID is required") }))
	.handler(async ({ input }) => {
		try {
			const sets = await getResultSetsById(input.resultId)
			return { success: true, data: sets }
		} catch (error) {
			console.error("Failed to get result sets:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get result sets")
		}
	})

/**
 * Update a workout
 */
export const updateWorkoutAction = createServerAction()
	.input(
		z.object({
			id: z.string().min(1, "Workout ID is required"),
			workout: z.object({
				name: z
					.string()
					.min(1, "Name is required")
					.max(255, "Name is too long")
					.optional(),
				description: z.string().min(1, "Description is required").optional(),
				scheme: z
					.enum([
						"time",
						"time-with-cap",
						"pass-fail",
						"rounds-reps",
						"reps",
						"emom",
						"load",
						"calories",
						"meters",
						"feet",
						"points",
					])
					.optional(),
				scope: z.enum(["private", "public"]).optional(),
				repsPerRound: z.number().nullable().optional(),
				roundsToScore: z.number().nullable().optional(),
				scalingGroupId: z.string().nullable().optional(), // Add scaling group support
			}),
			tagIds: z.array(z.string()).default([]),
			movementIds: z.array(z.string()).default([]),
			remixTeamId: z.string().optional(), // Optional team ID for creating remixes
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
			}

			// Check if user can edit the workout directly
			const canEdit = await canUserEditWorkout(input.id)

			if (canEdit) {
				// User owns the workout, update it directly
				await updateWorkout(input)
				return {
					success: true,
					action: "updated",
					message: "Workout updated successfully",
				}
			} else {
				// User doesn't own the workout, create a remix instead
				// Get user's teams to determine which team to create the remix in
				const userTeams = session.teams || []

				if (userTeams.length === 0) {
					throw new ZSAError(
						"FORBIDDEN",
						"User must be a member of at least one team",
					)
				}

				// Use provided remixTeamId or fallback to first team
				const targetTeamId = input.remixTeamId || userTeams[0].id

				// Verify user has access to the specified team
				if (
					input.remixTeamId &&
					!userTeams.some((t) => t.id === input.remixTeamId)
				) {
					throw new ZSAError(
						"FORBIDDEN",
						"User must be a member of the specified team",
					)
				}

				// Create a remix with the updated data
				const remixResult = await createWorkoutRemix({
					sourceWorkoutId: input.id,
					teamId: targetTeamId,
				})

				if (!remixResult) {
					throw new ZSAError(
						"INTERNAL_SERVER_ERROR",
						"Failed to create workout remix",
					)
				}

				// Now update the remixed workout with the new data
				await updateWorkout({
					id: remixResult.id,
					workout: input.workout,
					tagIds: input.tagIds,
					movementIds: input.movementIds,
				})

				return {
					success: true,
					action: "remixed",
					data: remixResult,
					message: "Workout remix created successfully",
				}
			}
		} catch (error) {
			console.error("Failed to update workout:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update workout")
		}
	})

/**
 * Get user teams
 */
export const getUserTeamsAction = createServerAction()
	.input(z.object({}))
	.handler(async () => {
		try {
			const teams = await getUserTeams()
			return { success: true, data: teams }
		} catch (error) {
			console.error("Failed to get user teams:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get user teams")
		}
	})

/**
 * Align workout scaling group with track scaling group
 */
export const alignWorkoutScalingWithTrackAction = createServerAction()
	.input(
		z.object({
			workoutId: z.string().min(1, "Workout ID is required"),
			trackId: z.string().min(1, "Track ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await requireVerifiedEmail()
			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Authentication required")
			}

			// Check team membership
			const isMember = await isTeamMember(input.teamId)
			if (!isMember) {
				throw new ZSAError("FORBIDDEN", "User must be a member of this team")
			}

			// Get the track's scaling group
			const { getProgrammingTrackById } = await import(
				"@/server/programming-tracks"
			)
			const track = await getProgrammingTrackById(input.trackId)
			if (!track) {
				throw new ZSAError("NOT_FOUND", "Programming track not found")
			}

			// Check if the user can edit the workout
			const workout = await getWorkoutById(input.workoutId)
			if (!workout) {
				throw new ZSAError("NOT_FOUND", "Workout not found")
			}

			// Get database handles for updating track workout
			const db = (await import("@/db")).getDd()
			const { workouts, trackWorkoutsTable } = await import("@/db/schema")
			const { eq, and } = await import("drizzle-orm")

			// Check if this workout has already been remixed for this track
			// (i.e., if it already has the correct scaling group and sourceWorkoutId)
			if (
				workout.scalingGroupId === track.scalingGroupId &&
				workout.sourceWorkoutId
			) {
				// Already aligned, no action needed
				return {
					success: true,
					action: "already_aligned",
					data: workout,
					message: "Workout is already aligned with the track scaling",
				}
			}

			const canEdit = await canUserEditWorkout(input.workoutId)

			if (canEdit) {
				// User can edit the workout directly - but we need to handle scalingGroupId properly
				// For now, we'll create a remix since updateWorkout doesn't support scalingGroupId yet
				const remixResult = await createProgrammingTrackWorkoutRemix({
					sourceWorkoutId: input.workoutId,
					sourceTrackId: input.trackId,
					teamId: input.teamId,
				})

				if (!remixResult) {
					throw new ZSAError(
						"INTERNAL_SERVER_ERROR",
						"Failed to create workout remix",
					)
				}

				// Update the remix with the track's scaling group
				await db
					.update(workouts)
					.set({ scalingGroupId: track.scalingGroupId })
					.where(eq(workouts.id, remixResult.id))

				// Update the track to use the remixed workout instead of the original
				await db
					.update(trackWorkoutsTable)
					.set({ workoutId: remixResult.id })
					.where(
						and(
							eq(trackWorkoutsTable.trackId, input.trackId),
							eq(trackWorkoutsTable.workoutId, input.workoutId),
						),
					)

				revalidatePath(`/admin/teams/${input.teamId}/programming`)

				return {
					success: true,
					action: "remixed",
					data: remixResult,
					message: "Workout scaling aligned with track",
				}
			} else if (await shouldCreateRemix(input.workoutId)) {
				// Create a remix for this team
				const remixResult = await createProgrammingTrackWorkoutRemix({
					sourceWorkoutId: input.workoutId,
					sourceTrackId: input.trackId,
					teamId: input.teamId,
				})

				if (!remixResult) {
					throw new ZSAError(
						"INTERNAL_SERVER_ERROR",
						"Failed to create workout remix",
					)
				}

				// Update the remix with the track's scaling group
				await db
					.update(workouts)
					.set({ scalingGroupId: track.scalingGroupId })
					.where(eq(workouts.id, remixResult.id))

				// Update the track to use the remixed workout instead of the original
				await db
					.update(trackWorkoutsTable)
					.set({ workoutId: remixResult.id })
					.where(
						and(
							eq(trackWorkoutsTable.trackId, input.trackId),
							eq(trackWorkoutsTable.workoutId, input.workoutId),
						),
					)

				revalidatePath(`/admin/teams/${input.teamId}/programming`)

				return {
					success: true,
					action: "remixed",
					data: remixResult,
					message: "Workout remix created with aligned scaling",
				}
			} else {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to modify this workout",
				)
			}
		} catch (error) {
			console.error("Failed to align workout scaling with track:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to align workout scaling with track",
			)
		}
	})

/**
 * Get scheduled workouts for a team within a date range
 */
export const getScheduledTeamWorkoutsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const { teamId, startDate, endDate } = input

			const scheduledWorkouts = await getScheduledWorkoutsForTeam(teamId, {
				start: new Date(startDate),
				end: new Date(endDate),
			})

			return { success: true, data: scheduledWorkouts }
		} catch (error) {
			console.error("Failed to get scheduled team workouts:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get scheduled team workouts",
			)
		}
	})

/**
 * Get scheduled workouts with results for a team within a date range
 */
export const getScheduledTeamWorkoutsWithResultsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
			userId: z.string().min(1, "User ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const { teamId, startDate, endDate, userId } = input

			// Get scheduled workouts
			const scheduledWorkouts = await getScheduledWorkoutsForTeam(teamId, {
				start: new Date(startDate),
				end: new Date(endDate),
			})

			// Prepare instances for result fetching
			const instances = scheduledWorkouts.map((workout) => ({
				id: workout.id,
				scheduledDate: workout.scheduledDate,
				workoutId:
					workout.trackWorkout?.workoutId || workout.trackWorkout?.workout?.id,
			}))

			// Fetch results for all instances
			const workoutResults = await getWorkoutResultsForScheduledInstances(
				instances,
				userId,
			)

			// Attach results to scheduled workouts
			const workoutsWithResults = scheduledWorkouts.map((workout) => ({
				...workout,
				result: workout.id ? workoutResults[workout.id] || null : null,
			}))

			return { success: true, data: workoutsWithResults }
		} catch (error) {
			console.error(
				"Failed to get scheduled team workouts with results:",
				error,
			)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get scheduled team workouts with results",
			)
		}
	})

/**
 * Get workout result for a scheduled workout instance
 */
export const getScheduledWorkoutResultAction = createServerAction()
	.input(
		z.object({
			scheduledInstanceId: z
				.string()
				.min(1, "Scheduled instance ID is required"),
			date: z.string().datetime(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
			}

			const result = await getWorkoutResultForScheduledInstance(
				input.scheduledInstanceId,
				session.user.id,
				new Date(input.date),
			)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get scheduled workout result:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get scheduled workout result",
			)
		}
	})

/**
 * Get workouts that are remixes of a given workout
 */
export const getRemixedWorkoutsAction = createServerAction()
	.input(
		z.object({
			sourceWorkoutId: z.string().min(1, "Source workout ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const remixedWorkouts = await getRemixedWorkouts(input.sourceWorkoutId)
			return { success: true, data: remixedWorkouts }
		} catch (error) {
			console.error("Failed to get remixed workouts:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get remixed workouts",
			)
		}
	})

/**
 * Get team-specific workout (checks for team remix, otherwise returns original)
 */
export const getTeamSpecificWorkoutAction = createServerAction()
	.input(getTeamSpecificWorkoutSchema)
	.handler(async ({ input }) => {
		try {
			const { originalWorkoutId, teamId } = input

			// Require authentication first
			const session = await requireVerifiedEmail()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Authentication required")
			}

			// Verify the user is a member of the specified team
			const isMember = await isTeamMember(teamId)
			if (!isMember) {
				throw new ZSAError(
					"FORBIDDEN",
					"You are not authorized to access this team's workouts",
				)
			}

			// Only fetch the workout after authorization checks pass
			const workout = await getTeamSpecificWorkout({
				originalWorkoutId,
				teamId,
			})

			return {
				success: true,
				data: workout,
			}
		} catch (error) {
			console.error("Failed to get team-specific workout:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get team-specific workout",
			)
		}
	})

/**
 * Migrate scaling descriptions from source workout to remixed workout
 */
export const migrateScalingDescriptionsAction = createServerAction()
	.input(
		z.object({
			originalWorkoutId: z.string().min(1, "Original workout ID is required"),
			remixedWorkoutId: z.string().min(1, "Remixed workout ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
			mappings: z.array(
				z.object({
					originalScalingLevelId: z
						.string()
						.min(1, "Original scaling level ID is required"),
					newScalingLevelId: z
						.string()
						.min(1, "New scaling level ID is required"),
					description: z.string(),
				}),
			),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const { originalWorkoutId, remixedWorkoutId, teamId, mappings } = input

			// Ensure the user is a member of the target team
			await requireTeamMembership(teamId)

			// Check if user has permission to edit workouts in this team
			const hasEditPermission = await hasTeamPermission(
				teamId,
				"EDIT_COMPONENTS",
			)
			if (!hasEditPermission) {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to edit workouts in this team",
				)
			}

			// Import the migration function
			const { migrateScalingDescriptions } = await import(
				"@/server/scaling-levels"
			)

			// Perform the migration
			const result = await migrateScalingDescriptions({
				originalWorkoutId,
				remixedWorkoutId,
				mappings,
			})

			return {
				success: true,
				data: result,
				message: `Successfully migrated ${result.migratedCount} scaling descriptions`,
			}
		} catch (error) {
			console.error("Failed to migrate scaling descriptions:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to migrate scaling descriptions",
			)
		}
	})

/**
 * Get workout scaling descriptions with level details
 */
export const getWorkoutScalingDescriptionsAction = createServerAction()
	.input(
		z.object({
			workoutId: z.string().min(1, "Workout ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const { getWorkoutScalingDescriptionsWithLevels } = await import(
				"@/server/scaling-levels"
			)

			const descriptions = await getWorkoutScalingDescriptionsWithLevels({
				workoutId: input.workoutId,
			})

			return {
				success: true,
				data: descriptions,
			}
		} catch (error) {
			console.error("Failed to get workout scaling descriptions:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get workout scaling descriptions",
			)
		}
	})

/**
 * Enhanced align workout scaling with track action that detects scaling description migration needs
 */
export const enhancedAlignWorkoutScalingWithTrackAction = createServerAction()
	.input(
		z.object({
			workoutId: z.string().min(1, "Workout ID is required"),
			trackId: z.string().min(1, "Track ID is required"),
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await requireVerifiedEmail()
			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Authentication required")
			}

			// Check team membership
			const isMember = await isTeamMember(input.teamId)
			if (!isMember) {
				throw new ZSAError("FORBIDDEN", "User must be a member of this team")
			}

			// Get the track's scaling group
			const { getProgrammingTrackById } = await import(
				"@/server/programming-tracks"
			)
			const track = await getProgrammingTrackById(input.trackId)
			if (!track) {
				throw new ZSAError("NOT_FOUND", "Programming track not found")
			}

			// Get the workout
			const workout = await getWorkoutById(input.workoutId)
			if (!workout) {
				throw new ZSAError("NOT_FOUND", "Workout not found")
			}

			// Check if the workout already has the track's scaling group
			if (workout.scalingGroupId === track.scalingGroupId) {
				return {
					success: true,
					action: "already_aligned" as const,
					data: workout,
					message: "Workout is already aligned with the track scaling",
				}
			}

			// Check if workout has existing scaling descriptions
			const { getWorkoutScalingDescriptionsWithLevels } = await import(
				"@/server/scaling-levels"
			)

			const existingDescriptions =
				await getWorkoutScalingDescriptionsWithLevels({
					workoutId: input.workoutId,
				})

			// If no descriptions exist, proceed with normal alignment
			if (existingDescriptions.length === 0) {
				// Use the original align action
				const result = await alignWorkoutScalingWithTrackAction(input)
				return result
			}

			// Get the new scaling levels from the track's scaling group
			const { listScalingLevels } = await import("@/server/scaling-levels")
			const newScalingLevels = await listScalingLevels({
				scalingGroupId: track.scalingGroupId || "",
			})

			// Return information needed for migration UI
			return {
				success: true,
				action: "requires_migration" as const,
				data: {
					workout,
					track,
					existingDescriptions,
					newScalingLevels,
				},
				message: "Scaling descriptions migration required",
			}
		} catch (error) {
			console.error("Failed to check workout scaling alignment:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to check workout scaling alignment",
			)
		}
	})

/**
 * Complete workout remix with scaling migration
 */
export const completeWorkoutRemixWithScalingMigrationAction =
	createServerAction()
		.input(
			z.object({
				workoutId: z.string().min(1, "Workout ID is required"),
				trackId: z.string().min(1, "Track ID is required"),
				teamId: z.string().min(1, "Team ID is required"),
				mappings: z
					.array(
						z.object({
							originalScalingLevelId: z
								.string()
								.min(1, "Original scaling level ID is required"),
							newScalingLevelId: z
								.string()
								.min(1, "New scaling level ID is required"),
							description: z.string(),
						}),
					)
					.optional(),
			}),
		)
		.handler(async ({ input }) => {
			try {
				const session = await requireVerifiedEmail()
				if (!session?.user?.id) {
					throw new ZSAError("NOT_AUTHORIZED", "Authentication required")
				}

				// Check team membership
				const isMember = await isTeamMember(input.teamId)
				if (!isMember) {
					throw new ZSAError("FORBIDDEN", "User must be a member of this team")
				}

				// Get the track's scaling group
				const { getProgrammingTrackById } = await import(
					"@/server/programming-tracks"
				)
				const track = await getProgrammingTrackById(input.trackId)
				if (!track) {
					throw new ZSAError("NOT_FOUND", "Programming track not found")
				}

				// Check if user can edit or should create remix
				const canEdit = await canUserEditWorkout(input.workoutId)

				let remixResult: Awaited<
					ReturnType<typeof createProgrammingTrackWorkoutRemix>
				>
				if (canEdit) {
					// Create a programming track remix
					remixResult = await createProgrammingTrackWorkoutRemix({
						sourceWorkoutId: input.workoutId,
						sourceTrackId: input.trackId,
						teamId: input.teamId,
					})
				} else if (await shouldCreateRemix(input.workoutId)) {
					// Create a programming track remix
					remixResult = await createProgrammingTrackWorkoutRemix({
						sourceWorkoutId: input.workoutId,
						sourceTrackId: input.trackId,
						teamId: input.teamId,
					})
				} else {
					throw new ZSAError(
						"FORBIDDEN",
						"You don't have permission to modify this workout",
					)
				}

				if (!remixResult) {
					throw new ZSAError(
						"INTERNAL_SERVER_ERROR",
						"Failed to create workout remix",
					)
				}

				// Get database handles for updating track workout
				const db = (await import("@/db")).getDd()
				const { workouts, trackWorkoutsTable } = await import("@/db/schema")
				const { eq, and } = await import("drizzle-orm")

				// Update the remix with the track's scaling group
				await db
					.update(workouts)
					.set({ scalingGroupId: track.scalingGroupId })
					.where(eq(workouts.id, remixResult.id))

				// Migrate scaling descriptions if provided
				if (input.mappings && input.mappings.length > 0) {
					const { migrateScalingDescriptions } = await import(
						"@/server/scaling-levels"
					)

					await migrateScalingDescriptions({
						originalWorkoutId: input.workoutId,
						remixedWorkoutId: remixResult.id,
						mappings: input.mappings,
					})
				}

				// Update the track to use the remixed workout instead of the original
				await db
					.update(trackWorkoutsTable)
					.set({ workoutId: remixResult.id })
					.where(
						and(
							eq(trackWorkoutsTable.trackId, input.trackId),
							eq(trackWorkoutsTable.workoutId, input.workoutId),
						),
					)

				revalidatePath(`/admin/teams/${input.teamId}/programming`)

				return {
					success: true,
					action: "remixed" as const,
					data: remixResult,
					message: input.mappings?.length
						? `Workout scaling aligned with ${input.mappings.length} descriptions migrated`
						: "Workout scaling aligned with track",
				}
			} catch (error) {
				console.error(
					"Failed to complete workout remix with scaling migration:",
					error,
				)

				if (error instanceof ZSAError) {
					throw error
				}

				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"Failed to complete workout remix with scaling migration",
				)
			}
		})
