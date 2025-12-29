/**
 * Workout Server Functions for TanStack Start
 * Port of getUserWorkouts logic from wodsmith app
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { scheduledWorkoutInstancesTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import {
	SCORE_TYPE_VALUES,
	WORKOUT_SCHEME_VALUES,
	workouts,
} from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"

// Input validation schema
const getWorkoutsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	search: z.string().optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(50),
})

type GetWorkoutsInput = z.infer<typeof getWorkoutsInputSchema>

/**
 * Get workouts for a team
 * Returns team-owned workouts and public workouts
 */
export const getWorkoutsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getWorkoutsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const validatedData = data as GetWorkoutsInput
		const db = getDb()
		const offset = (validatedData.page - 1) * validatedData.pageSize

		// Build base query conditions
		const conditions = []

		// Base condition: team-owned or public workouts
		conditions.push(
			or(
				eq(workouts.teamId, validatedData.teamId),
				eq(workouts.scope, "public"),
			),
		)

		// Search filter
		if (validatedData.search) {
			const searchLower = validatedData.search.toLowerCase()
			// Use SQL LIKE for proper search functionality
			conditions.push(
				or(
					sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
					sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
				),
			)
		}

		// Fetch workouts with pagination
		const workoutsList = await db
			.select({
				id: workouts.id,
				name: workouts.name,
				description: workouts.description,
				scheme: workouts.scheme,
				scope: workouts.scope,
				teamId: workouts.teamId,
				createdAt: workouts.createdAt,
				updatedAt: workouts.updatedAt,
			})
			.from(workouts)
			.where(and(...conditions))
			.orderBy(desc(workouts.updatedAt))
			.limit(validatedData.pageSize)
			.offset(offset)

		// Get total count for pagination
		// Note: For MVP, we're not including the count query
		// This can be added later if needed for pagination UI

		return {
			workouts: workoutsList,
			currentPage: validatedData.page,
			pageSize: validatedData.pageSize,
		}
	})

// Input validation schema for single workout
const getWorkoutByIdInputSchema = z.object({
	id: z.string().min(1, "Workout ID is required"),
})

/**
 * Get a single workout by ID
 */
export const getWorkoutByIdFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getWorkoutByIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const workout = await db
			.select({
				id: workouts.id,
				name: workouts.name,
				description: workouts.description,
				scheme: workouts.scheme,
				scope: workouts.scope,
				teamId: workouts.teamId,
				scoreType: workouts.scoreType,
				repsPerRound: workouts.repsPerRound,
				roundsToScore: workouts.roundsToScore,
				timeCap: workouts.timeCap,
				tiebreakScheme: workouts.tiebreakScheme,
				createdAt: workouts.createdAt,
				updatedAt: workouts.updatedAt,
			})
			.from(workouts)
			.where(eq(workouts.id, data.id))
			.limit(1)

		if (!workout[0]) {
			return { workout: null }
		}

		return { workout: workout[0] }
	})

// Schema for creating a workout
const createWorkoutInputSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().min(1, "Description is required"),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).optional(),
	scope: z.enum(["private", "public"]).default("private"),
	timeCap: z.number().int().min(1).optional(),
	roundsToScore: z.number().int().min(1).optional(),
	teamId: z.string().min(1, "Team ID is required"),
})

export type CreateWorkoutInput = z.infer<typeof createWorkoutInputSchema>

/**
 * Create a new workout
 */
export const createWorkoutFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createWorkoutInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get session to verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Create the workout
		const workoutId = `workout_${createId()}`
		const newWorkout = await db
			.insert(workouts)
			.values({
				id: workoutId,
				name: data.name,
				description: data.description,
				scheme: data.scheme,
				scoreType: data.scoreType ?? null,
				scope: data.scope,
				timeCap: data.timeCap ?? null,
				roundsToScore: data.roundsToScore ?? null,
				teamId: data.teamId,
			})
			.returning()

		return { workout: newWorkout[0] }
	})

// Schema for updating a workout
const updateWorkoutInputSchema = z.object({
	id: z.string().min(1, "Workout ID is required"),
	name: z.string().min(1, "Name is required"),
	description: z.string().min(1, "Description is required"),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).optional(),
	scope: z.enum(["private", "public"]),
	timeCap: z.number().int().min(1).optional(),
	roundsToScore: z.number().int().min(1).optional(),
})

export type UpdateWorkoutInput = z.infer<typeof updateWorkoutInputSchema>

/**
 * Update an existing workout
 */
export const updateWorkoutFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateWorkoutInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get session to verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Update the workout
		const updatedWorkout = await db
			.update(workouts)
			.set({
				name: data.name,
				description: data.description,
				scheme: data.scheme,
				scoreType: data.scoreType ?? null,
				scope: data.scope,
				timeCap: data.timeCap ?? null,
				roundsToScore: data.roundsToScore ?? null,
				updatedAt: new Date(),
			})
			.where(eq(workouts.id, data.id))
			.returning()

		if (!updatedWorkout[0]) {
			throw new Error("Workout not found")
		}

		return { workout: updatedWorkout[0] }
	})

// Schema for scheduling a workout
const scheduleWorkoutInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	scheduledDate: z.string().min(1, "Scheduled date is required"), // ISO string
})

export type ScheduleWorkoutInput = z.infer<typeof scheduleWorkoutInputSchema>

/**
 * Schedule a standalone workout for a team
 */
export const scheduleWorkoutFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => scheduleWorkoutInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get session to verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Import the scheduled workout instances table
		const { scheduledWorkoutInstancesTable } = await import(
			"@/db/schemas/programming"
		)
		const { createScheduledWorkoutInstanceId } = await import(
			"@/db/schemas/common"
		)

		// Parse the date and normalize to noon UTC to avoid timezone boundary issues
		const scheduledDate = new Date(data.scheduledDate)
		scheduledDate.setUTCHours(12, 0, 0, 0)

		// Create the scheduled workout instance
		const [instance] = await db
			.insert(scheduledWorkoutInstancesTable)
			.values({
				id: createScheduledWorkoutInstanceId(),
				teamId: data.teamId,
				trackWorkoutId: null, // No track workout for standalone
				workoutId: data.workoutId, // Direct workout reference
				scheduledDate: scheduledDate,
			})
			.returning()

		if (!instance) {
			throw new Error("Failed to schedule workout")
		}

		return { success: true, instance }
	})

// Schema for getting scheduled workouts
const getScheduledWorkoutsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	startDate: z.string().min(1, "Start date is required"), // ISO string
	endDate: z.string().min(1, "End date is required"), // ISO string
})

export type GetScheduledWorkoutsInput = z.infer<
	typeof getScheduledWorkoutsInputSchema
>

export interface ScheduledWorkoutWithDetails {
	id: string
	scheduledDate: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: string
	} | null
}

/**
 * Get scheduled workouts for a team within a date range
 */
export const getScheduledWorkoutsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getScheduledWorkoutsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const startDate = new Date(data.startDate)
		const endDate = new Date(data.endDate)

		// Get scheduled workout instances with workout details
		const instances = await db
			.select({
				id: scheduledWorkoutInstancesTable.id,
				scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
				workoutId: scheduledWorkoutInstancesTable.workoutId,
				workoutName: workouts.name,
				workoutDescription: workouts.description,
				workoutScheme: workouts.scheme,
			})
			.from(scheduledWorkoutInstancesTable)
			.leftJoin(
				workouts,
				eq(scheduledWorkoutInstancesTable.workoutId, workouts.id),
			)
			.where(
				and(
					eq(scheduledWorkoutInstancesTable.teamId, data.teamId),
					gte(scheduledWorkoutInstancesTable.scheduledDate, startDate),
					lte(scheduledWorkoutInstancesTable.scheduledDate, endDate),
				),
			)
			.orderBy(scheduledWorkoutInstancesTable.scheduledDate)

		// Transform to expected format
		const scheduledWorkouts: ScheduledWorkoutWithDetails[] = instances.map(
			(instance) => ({
				id: instance.id,
				scheduledDate: instance.scheduledDate,
				workout: instance.workoutId
					? {
							id: instance.workoutId,
							name: instance.workoutName || "Unknown Workout",
							description: instance.workoutDescription,
							scheme: instance.workoutScheme || "time",
						}
					: null,
			}),
		)

		return { scheduledWorkouts }
	})

// Schema for getting scheduled workouts with results
const getScheduledWorkoutsWithResultsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	userId: z.string().min(1, "User ID is required"),
	startDate: z.string().min(1, "Start date is required"), // ISO string
	endDate: z.string().min(1, "End date is required"), // ISO string
})

export type GetScheduledWorkoutsWithResultsInput = z.infer<
	typeof getScheduledWorkoutsWithResultsInputSchema
>

export interface ScheduledWorkoutWithResult {
	id: string
	scheduledDate: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: string
	} | null
	result: {
		scoreValue: number | null
		displayScore: string
		scalingLabel: string | null
		asRx: boolean
		recordedAt: Date
	} | null
}

/**
 * Get scheduled workouts for a team within a date range with user's results
 * This combines scheduled workout instances with the user's logged scores
 */
// Schema for getting scheduled instances for a specific workout
const getWorkoutScheduledInstancesInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

export type GetWorkoutScheduledInstancesInput = z.infer<
	typeof getWorkoutScheduledInstancesInputSchema
>

export interface WorkoutScheduledInstance {
	id: string
	scheduledDate: Date
}

/**
 * Get all scheduled instances for a specific workout
 */
export const getWorkoutScheduledInstancesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getWorkoutScheduledInstancesInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const instances = await db
			.select({
				id: scheduledWorkoutInstancesTable.id,
				scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
			})
			.from(scheduledWorkoutInstancesTable)
			.where(
				and(
					eq(scheduledWorkoutInstancesTable.workoutId, data.workoutId),
					eq(scheduledWorkoutInstancesTable.teamId, data.teamId),
				),
			)
			.orderBy(desc(scheduledWorkoutInstancesTable.scheduledDate))

		return { instances }
	})

export const getScheduledWorkoutsWithResultsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getScheduledWorkoutsWithResultsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const startDate = new Date(data.startDate)
		const endDate = new Date(data.endDate)

		// Get scheduled workout instances with workout details
		const instances = await db
			.select({
				id: scheduledWorkoutInstancesTable.id,
				scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
				workoutId: scheduledWorkoutInstancesTable.workoutId,
				workoutName: workouts.name,
				workoutDescription: workouts.description,
				workoutScheme: workouts.scheme,
			})
			.from(scheduledWorkoutInstancesTable)
			.leftJoin(
				workouts,
				eq(scheduledWorkoutInstancesTable.workoutId, workouts.id),
			)
			.where(
				and(
					eq(scheduledWorkoutInstancesTable.teamId, data.teamId),
					gte(scheduledWorkoutInstancesTable.scheduledDate, startDate),
					lte(scheduledWorkoutInstancesTable.scheduledDate, endDate),
				),
			)
			.orderBy(scheduledWorkoutInstancesTable.scheduledDate)

		// Fetch user's scores for these scheduled instances
		// We'll query by userId + date range to get all scores, then match them up
		const scores = await db
			.select({
				scoreId: scoresTable.id,
				scoreValue: scoresTable.scoreValue,
				scheme: scoresTable.scheme,
				scheduledWorkoutInstanceId: scoresTable.scheduledWorkoutInstanceId,
				workoutId: scoresTable.workoutId,
				recordedAt: scoresTable.recordedAt,
				asRx: scoresTable.asRx,
				scalingLevelId: scoresTable.scalingLevelId,
				scalingLabel: scalingLevelsTable.label,
			})
			.from(scoresTable)
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(
				and(
					eq(scoresTable.userId, data.userId),
					eq(scoresTable.teamId, data.teamId),
					gte(scoresTable.recordedAt, startDate),
					lte(scoresTable.recordedAt, endDate),
				),
			)

		// Helper function to format score value for display
		const formatScoreValue = (
			scoreValue: number | null,
			scheme: string,
		): string => {
			if (scoreValue === null) return "No score"

			switch (scheme) {
				case "time":
				case "time-with-cap": {
					// Time is stored in milliseconds
					const totalSeconds = Math.floor(scoreValue / 1000)
					const minutes = Math.floor(totalSeconds / 60)
					const seconds = totalSeconds % 60
					return `${minutes}:${seconds.toString().padStart(2, "0")}`
				}
				case "rounds-reps": {
					// Encoded as rounds * 100000 + reps
					const rounds = Math.floor(scoreValue / 100000)
					const reps = scoreValue % 100000
					return `${rounds}+${reps}`
				}
				case "reps":
					return `${scoreValue} reps`
				case "load": {
					// Load is stored in grams, convert to lbs or kg
					const lbs = Math.round(scoreValue / 453.592)
					return `${lbs} lbs`
				}
				case "calories":
					return `${scoreValue} cal`
				case "meters":
					return `${scoreValue} m`
				case "feet":
					return `${scoreValue} ft`
				case "points":
					return `${scoreValue} pts`
				default:
					return String(scoreValue)
			}
		}

		// Create a map of scores by scheduled instance ID or workout ID
		const scoresMap = new Map<
			string,
			{
				scoreValue: number | null
				displayScore: string
				scalingLabel: string | null
				asRx: boolean
				recordedAt: Date
			}
		>()

		for (const score of scores) {
			const formattedScore = {
				scoreValue: score.scoreValue,
				displayScore: formatScoreValue(score.scoreValue, score.scheme),
				scalingLabel: score.scalingLabel,
				asRx: score.asRx,
				recordedAt: score.recordedAt,
			}

			// Match by scheduled instance ID first
			if (score.scheduledWorkoutInstanceId) {
				scoresMap.set(score.scheduledWorkoutInstanceId, formattedScore)
			} else if (score.workoutId) {
				// Fallback to workout ID matching
				scoresMap.set(score.workoutId, formattedScore)
			}
		}

		// Transform to expected format with results attached
		const scheduledWorkoutsWithResults: ScheduledWorkoutWithResult[] =
			instances.map((instance) => {
				// Try to find a score by instance ID first, then by workout ID
				const result =
					scoresMap.get(instance.id) ||
					(instance.workoutId ? scoresMap.get(instance.workoutId) : null) ||
					null

				return {
					id: instance.id,
					scheduledDate: instance.scheduledDate,
					workout: instance.workoutId
						? {
								id: instance.workoutId,
								name: instance.workoutName || "Unknown Workout",
								description: instance.workoutDescription,
								scheme: instance.workoutScheme || "time",
							}
						: null,
					result,
				}
			})

		return { scheduledWorkoutsWithResults }
	})
