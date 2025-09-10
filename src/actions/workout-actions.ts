"use server"

import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import {
	getResultSetsById,
	getWorkoutResultsByWorkoutAndUser,
	getWorkoutResultForScheduledInstance,
} from "@/server/workout-results"
import {
	createWorkout,
	createWorkoutRemix,
	createProgrammingTrackWorkoutRemix,
	getUserWorkouts,
	getWorkoutById,
	getRemixedWorkouts,
	updateWorkout,
	updateScheduledWorkoutAfterRemix,
} from "@/server/workouts"
import { getScheduledWorkoutsForTeam } from "@/server/scheduling-service"
import { getWorkoutResultsForScheduledInstances } from "@/server/workout-results"
import { getUserTeams } from "@/server/teams"
import { requireVerifiedEmail } from "@/utils/auth"
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

const updateScheduledWorkoutAfterRemixSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	newWorkoutId: z.string().min(1, "New workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const createWorkoutSchema = z.object({
	workout: z.object({
		id: z.string().optional(),
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
	movementIds: z.array(z.string()).default([]),
	teamId: z.string().min(1, "Team ID is required"),
})

/**
 * Create a remix of an existing workout
 */
export const createWorkoutRemixAction = createServerAction()
	.input(createWorkoutRemixSchema)
	.handler(async ({ input }) => {
		try {
			const { sourceWorkoutId, teamId } = input

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

			// Note: For programming track remixes, we don't need the same permission check
			// as regular remixes since this is specifically for external track workouts
			// The permission validation is handled within the createProgrammingTrackWorkoutRemix function

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
			const result = await createWorkout({
				...input,
				workout: {
					...input.workout,
					createdAt: new Date(),
					sourceTrackId: null,
					sourceWorkoutId: null,
				},
			})
			return result
		} catch (error) {
			console.error("Failed to create workout:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create workout")
		}
	})

/**
 * Get all workouts for the current user
 */
export const getUserWorkoutsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const workouts = await getUserWorkouts(input)
			return { success: true, data: workouts }
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

			const results = await getWorkoutResultsByWorkoutAndUser(
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
			}),
			tagIds: z.array(z.string()).default([]),
			movementIds: z.array(z.string()).default([]),
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

				// Use the first team as the default, or we could add logic to choose
				const targetTeamId = userTeams[0].id

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
 * Update scheduled workout reference after remix
 */
export const updateScheduledWorkoutAfterRemixAction = createServerAction()
	.input(updateScheduledWorkoutAfterRemixSchema)
	.handler(async ({ input }) => {
		try {
			const { trackWorkoutId, newWorkoutId, teamId } = input

			const updatedTrackWorkout = await updateScheduledWorkoutAfterRemix({
				trackWorkoutId,
				newWorkoutId,
				teamId,
			})

			return {
				success: true,
				data: updatedTrackWorkout,
				message: "Scheduled workout reference updated successfully",
			}
		} catch (error) {
			console.error("Failed to update scheduled workout after remix:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update scheduled workout after remix",
			)
		}
	})
