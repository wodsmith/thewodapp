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
	getUserWorkouts,
	getWorkoutById,
	updateWorkout,
} from "@/server/workouts"
import { getScheduledWorkoutsForTeam } from "@/server/scheduling-service"
import { getUserTeams } from "@/server/teams"
import { requireVerifiedEmail } from "@/utils/auth"

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
			await updateWorkout(input)
			return { success: true }
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
