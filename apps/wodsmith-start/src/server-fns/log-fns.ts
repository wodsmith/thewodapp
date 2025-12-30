/**
 * Log Server Functions for TanStack Start
 * Simplified MVP for logging workout results
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import {
	createScoreId,
	type ScoreStatusNew,
	scoreRoundsTable,
	scoresTable,
} from "@/db/schemas/scores"
import { userTable } from "@/db/schemas/users"
import { workouts } from "@/db/schemas/workouts"
import {
	computeSortKey,
	decodeScore,
	encodeRounds,
	encodeScore,
	getDefaultScoreType,
	parseScore as libParseScore,
	type ScoreType,
	type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"

// Input validation schema
const submitLogInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	date: z.string().min(1, "Date is required"),
	score: z.string(), // Can be empty for multi-round workouts
	notes: z.string().optional(),
	scalingLevelId: z.string().optional(),
	asRx: z.boolean().default(true),
	// Multi-round support
	roundScores: z
		.array(
			z.object({
				score: z.string(),
			}),
		)
		.optional(),
})

type SubmitLogInput = z.infer<typeof submitLogInputSchema>

// Status order mapping for sorting
const STATUS_ORDER: Record<ScoreStatusNew, number> = {
	scored: 0,
	cap: 1,
	dq: 2,
	withdrawn: 3,
}

/**
 * Submit a workout log/score
 */
export const submitLogFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => submitLogInputSchema.parse(data))
	.handler(async ({ data }) => {
		const validatedData = data as SubmitLogInput
		const db = getDb()

		// Get session
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get workout info for encoding
		const [workout] = await db
			.select({
				id: workouts.id,
				scheme: workouts.scheme,
				scoreType: workouts.scoreType,
				timeCap: workouts.timeCap,
				scalingGroupId: workouts.scalingGroupId,
			})
			.from(workouts)
			.where(eq(workouts.id, validatedData.workoutId))
			.limit(1)

		if (!workout) {
			throw new Error("Workout not found")
		}

		const scheme = workout.scheme as WorkoutScheme
		const scoreType = (workout.scoreType ||
			getDefaultScoreType(scheme)) as ScoreType

		// Determine if this is a multi-round submission
		const isMultiRound =
			validatedData.roundScores && validatedData.roundScores.length > 0

		let scoreValue: number | null = null
		let formattedScore = ""

		if (isMultiRound) {
			// Multi-round: encode each round and aggregate
			const roundInputs = validatedData.roundScores!.map((rs) => ({
				raw: rs.score,
			}))
			const result = encodeRounds(roundInputs, scheme, scoreType)
			scoreValue = result.aggregated
			// Format the aggregated score for display
			formattedScore =
				scoreValue !== null ? decodeScore(scoreValue, scheme) : ""
		} else {
			// Single score: parse and encode directly
			if (!validatedData.score?.trim()) {
				throw new Error("Score is required")
			}
			const parseResult = libParseScore(validatedData.score, scheme, {
				timePrecision: "seconds",
			})

			if (!parseResult.isValid) {
				throw new Error(parseResult.error || "Invalid score")
			}

			scoreValue = parseResult.encoded
			formattedScore = parseResult.formatted || ""
		}

		const status: ScoreStatusNew = "scored"
		const statusOrder = STATUS_ORDER[status]

		// Compute sort key
		let sortKey: string | null = null
		if (scoreValue !== null || status !== "scored") {
			const sortKeyBigInt = computeSortKey({
				value: scoreValue,
				status,
				scheme,
				scoreType,
			})
			sortKey = sortKeyBigInt.toString()
		}

		// Resolve scaling level if not provided
		let scalingLevelId = validatedData.scalingLevelId
		if (!scalingLevelId) {
			// Try to get from workout's scaling group, or fall back to system default
			let groupId = workout.scalingGroupId

			if (!groupId) {
				// Get system default scaling group
				const [systemGroup] = await db
					.select({ id: scalingGroupsTable.id })
					.from(scalingGroupsTable)
					.where(eq(scalingGroupsTable.isSystem, 1))
					.limit(1)

				groupId = systemGroup?.id ?? null
			}

			if (groupId) {
				// Get the first scaling level (usually Rx)
				const [level] = await db
					.select({ id: scalingLevelsTable.id })
					.from(scalingLevelsTable)
					.where(eq(scalingLevelsTable.scalingGroupId, groupId))
					.orderBy(asc(scalingLevelsTable.position))
					.limit(1)

				scalingLevelId = level?.id
			}
		}

		if (!scalingLevelId) {
			throw new Error("No scaling level available")
		}

		// Parse date
		const recordedAt = new Date(validatedData.date)

		// Insert score
		const scoreId = createScoreId()
		await db.insert(scoresTable).values({
			id: scoreId,
			userId: session.userId,
			teamId: validatedData.teamId,
			workoutId: validatedData.workoutId,
			scheme,
			scoreType,
			scoreValue,
			status,
			statusOrder,
			sortKey,
			scalingLevelId,
			asRx: validatedData.asRx,
			notes: validatedData.notes || null,
			recordedAt,
			timeCapMs: workout.timeCap ? workout.timeCap * 1000 : null,
		})

		// Insert round scores for multi-round workouts
		if (isMultiRound && validatedData.roundScores) {
			const roundsToInsert = validatedData.roundScores.map((round, index) => {
				let roundValue: number

				if (scheme === "rounds-reps") {
					// Parse rounds+reps format (e.g., "5+12" or "5.12")
					const match = round.score.match(/^(\d+)[+.](\d+)$/)
					if (match) {
						const rounds = Number.parseInt(match[1], 10) || 0
						const reps = Number.parseInt(match[2], 10) || 0
						roundValue = rounds * 100000 + reps
					} else {
						// Try as plain number (just rounds)
						roundValue = (Number.parseInt(round.score, 10) || 0) * 100000
					}
				} else {
					// For other schemes, encode directly
					roundValue = encodeScore(round.score, scheme) ?? 0
				}

				return {
					scoreId,
					roundNumber: index + 1,
					value: roundValue,
					status: null,
				}
			})

			// Insert all rounds
			if (roundsToInsert.length > 0) {
				await db.insert(scoreRoundsTable).values(roundsToInsert)
			}
		}

		return {
			success: true,
			scoreId,
			formatted: formattedScore,
		}
	})

/**
 * Get scaling levels for a workout
 */
const getScalingLevelsInputSchema = z.object({
	workoutId: z.string().min(1),
})

export const getScalingLevelsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getScalingLevelsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get workout's scaling group
		const [workout] = await db
			.select({ scalingGroupId: workouts.scalingGroupId })
			.from(workouts)
			.where(eq(workouts.id, data.workoutId))
			.limit(1)

		let groupId = workout?.scalingGroupId

		// Fall back to system default if no workout-specific group
		if (!groupId) {
			const [systemGroup] = await db
				.select({ id: scalingGroupsTable.id })
				.from(scalingGroupsTable)
				.where(eq(scalingGroupsTable.isSystem, 1))
				.limit(1)

			groupId = systemGroup?.id ?? null
		}

		if (!groupId) {
			return { levels: [] }
		}

		// Get scaling levels
		const levels = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
			})
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, groupId))
			.orderBy(asc(scalingLevelsTable.position))

		return { levels }
	})

/**
 * Get scores for a workout
 * Returns scores with user info and decoded display values
 */
const getWorkoutScoresInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	limit: z.number().int().min(1).max(100).default(50),
})

export type WorkoutScore = {
	id: string
	userId: string
	userName: string | null
	userAvatar: string | null
	scoreValue: number | null
	displayScore: string | null
	scheme: string
	scalingLabel: string | null
	asRx: boolean
	notes: string | null
	recordedAt: Date
	status: string
}

export const getWorkoutScoresFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getWorkoutScoresInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Fetch scores with user info and scaling level
		const scoresData = await db
			.select({
				id: scoresTable.id,
				userId: scoresTable.userId,
				userName: userTable.firstName,
				userAvatar: userTable.avatar,
				scoreValue: scoresTable.scoreValue,
				scheme: scoresTable.scheme,
				scalingLevelId: scoresTable.scalingLevelId,
				scalingLabel: scalingLevelsTable.label,
				asRx: scoresTable.asRx,
				notes: scoresTable.notes,
				recordedAt: scoresTable.recordedAt,
				status: scoresTable.status,
				sortKey: scoresTable.sortKey,
			})
			.from(scoresTable)
			.leftJoin(userTable, eq(scoresTable.userId, userTable.id))
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(
				and(
					eq(scoresTable.workoutId, data.workoutId),
					eq(scoresTable.teamId, data.teamId),
				),
			)
			.orderBy(desc(scoresTable.recordedAt))
			.limit(data.limit)

		// Decode scores for display
		const scores: WorkoutScore[] = scoresData.map((score) => {
			let displayScore: string | null = null
			if (score.scoreValue !== null && score.scheme) {
				displayScore = decodeScore(
					score.scoreValue,
					score.scheme as WorkoutScheme,
					{
						includeUnit: true,
					},
				)
			}

			return {
				id: score.id,
				userId: score.userId,
				userName: score.userName,
				userAvatar: score.userAvatar,
				scoreValue: score.scoreValue,
				displayScore,
				scheme: score.scheme,
				scalingLabel: score.scalingLabel,
				asRx: score.asRx,
				notes: score.notes,
				recordedAt: score.recordedAt,
				status: score.status,
			}
		})

		return { scores }
	})

/**
 * Get all logs (scores) by user ID with workout names and scaling level details
 */
const getLogsByUserInputSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
})

export const getLogsByUserFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getLogsByUserInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Verify user is requesting their own logs
		if (session.userId !== data.userId) {
			throw new Error("Not authorized to view these logs")
		}

		const logs = await db
			.select({
				id: scoresTable.id,
				userId: scoresTable.userId,
				teamId: scoresTable.teamId,
				date: scoresTable.recordedAt,
				workoutId: scoresTable.workoutId,
				notes: scoresTable.notes,
				scalingLevelId: scoresTable.scalingLevelId,
				asRx: scoresTable.asRx,
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
				scoreValue: scoresTable.scoreValue,
				secondaryValue: scoresTable.secondaryValue,
				scheme: scoresTable.scheme,
				status: scoresTable.status,
				createdAt: scoresTable.createdAt,
				updatedAt: scoresTable.updatedAt,
				workoutName: workouts.name,
			})
			.from(scoresTable)
			.leftJoin(workouts, eq(scoresTable.workoutId, workouts.id))
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(eq(scoresTable.userId, data.userId))
			.orderBy(desc(scoresTable.recordedAt))

		// Format the display score for each log
		const formattedLogs = logs.map((log) => {
			let displayScore: string | undefined

			if (log.scheme) {
				if (log.status === "cap" && log.scheme === "time-with-cap") {
					const timeStr =
						log.scoreValue !== null
							? decodeScore(log.scoreValue, log.scheme as WorkoutScheme, {
									includeUnit: true,
								})
							: ""
					displayScore =
						log.secondaryValue !== null
							? `CAP (${timeStr}) - ${log.secondaryValue} reps`
							: `CAP (${timeStr})`
				} else if (log.status === "withdrawn") {
					displayScore = "WITHDRAWN"
				} else if (log.scoreValue !== null) {
					displayScore = decodeScore(
						log.scoreValue,
						log.scheme as WorkoutScheme,
						{
							includeUnit: true,
						},
					)
				}
			}

			return {
				...log,
				displayScore,
				workoutName: log.workoutName || undefined,
				scalingLevelLabel: log.scalingLevelLabel || undefined,
				scalingLevelPosition:
					log.scalingLevelPosition !== null
						? log.scalingLevelPosition
						: undefined,
			}
		})

		return { logs: formattedLogs }
	})

/**
 * Get a single score by ID with workout details and scaling level
 */
const getLogByIdInputSchema = z.object({
	id: z.string().min(1, "Score ID is required"),
})

export const getLogByIdFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getLogByIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const [score] = await db
			.select({
				id: scoresTable.id,
				userId: scoresTable.userId,
				teamId: scoresTable.teamId,
				date: scoresTable.recordedAt,
				workoutId: scoresTable.workoutId,
				notes: scoresTable.notes,
				scalingLevelId: scoresTable.scalingLevelId,
				asRx: scoresTable.asRx,
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
				scoreValue: scoresTable.scoreValue,
				secondaryValue: scoresTable.secondaryValue,
				scheme: scoresTable.scheme,
				scoreType: scoresTable.scoreType,
				status: scoresTable.status,
				sortKey: scoresTable.sortKey,
				createdAt: scoresTable.createdAt,
				updatedAt: scoresTable.updatedAt,
				scheduledWorkoutInstanceId: scoresTable.scheduledWorkoutInstanceId,
				workoutName: workouts.name,
				workoutScheme: workouts.scheme,
				workoutRepsPerRound: workouts.repsPerRound,
				workoutRoundsToScore: workouts.roundsToScore,
			})
			.from(scoresTable)
			.leftJoin(workouts, eq(scoresTable.workoutId, workouts.id))
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(eq(scoresTable.id, data.id))
			.limit(1)

		if (!score) {
			return { score: null }
		}

		// Authorization check: verify user owns the score OR user has access to the team
		const isOwner = score.userId === session.userId
		const hasTeamAccess = session.teams?.some(
			(team) => team.id === score.teamId,
		)

		if (!isOwner && !hasTeamAccess) {
			throw new Error("Not authorized to access this score")
		}

		return { score }
	})

/**
 * Create a new workout result/score
 */
const createLogInputSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	scoreValue: z.number().nullable(),
	scheme: z.string().min(1, "Scheme is required"),
	asRx: z.boolean().default(false),
	scalingLevelId: z.string().optional(),
	notes: z.string().optional(),
	scheduledWorkoutInstanceId: z.string().optional(),
	recordedAt: z.date().optional(),
})

export type CreateLogInput = z.infer<typeof createLogInputSchema>

export const createLogFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createLogInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Verify user is creating their own log
		if (session.userId !== data.userId) {
			throw new Error("Not authorized to create logs for other users")
		}

		// Get score type from scheme if not provided
		const scheme = data.scheme as WorkoutScheme
		const scoreType = getDefaultScoreType(scheme) as ScoreType

		// Compute sort key if we have a score value
		let sortKey: string | null = null
		if (data.scoreValue !== null) {
			const sortKeyBigInt = computeSortKey({
				value: data.scoreValue,
				status: "scored",
				scheme,
				scoreType,
			})
			sortKey = sortKeyBigInt.toString()
		}

		// Create the score
		const scoreId = createScoreId()
		const [newScore] = await db
			.insert(scoresTable)
			.values({
				id: scoreId,
				userId: data.userId,
				teamId: data.teamId,
				workoutId: data.workoutId,
				scoreValue: data.scoreValue,
				scheme,
				scoreType,
				asRx: data.asRx,
				scalingLevelId: data.scalingLevelId ?? null,
				notes: data.notes ?? null,
				scheduledWorkoutInstanceId: data.scheduledWorkoutInstanceId ?? null,
				recordedAt: data.recordedAt ?? new Date(),
				status: "scored",
				statusOrder: 0,
				sortKey,
			})
			.returning()

		if (!newScore) {
			throw new Error("Failed to create log")
		}

		return { score: newScore }
	})

/**
 * Get existing round scores for a score
 */
const getScoreRoundsInputSchema = z.object({
	scoreId: z.string().min(1, "Score ID is required"),
})

export const getScoreRoundsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getScoreRoundsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get rounds ordered by round number
		const rounds = await db
			.select({
				id: scoreRoundsTable.id,
				scoreId: scoreRoundsTable.scoreId,
				roundNumber: scoreRoundsTable.roundNumber,
				value: scoreRoundsTable.value,
				status: scoreRoundsTable.status,
				secondaryValue: scoreRoundsTable.secondaryValue,
				notes: scoreRoundsTable.notes,
			})
			.from(scoreRoundsTable)
			.where(eq(scoreRoundsTable.scoreId, data.scoreId))
			.orderBy(asc(scoreRoundsTable.roundNumber))

		return { rounds }
	})

/**
 * Update an existing score
 */
const updateLogInputSchema = z.object({
	id: z.string().min(1, "Score ID is required"),
	scoreValue: z.number().nullable().optional(),
	notes: z.string().optional(),
	asRx: z.boolean().optional(),
	scalingLevelId: z.string().optional(),
	date: z.string().optional(),
	// Multi-round support
	roundScores: z
		.array(
			z.object({
				score: z.string(),
			}),
		)
		.optional(),
})

export type UpdateLogInput = z.infer<typeof updateLogInputSchema>

export const updateLogFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateLogInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user is authenticated
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Verify user owns the score
		const [existingScore] = await db
			.select({
				userId: scoresTable.userId,
				scheme: scoresTable.scheme,
				scoreType: scoresTable.scoreType,
			})
			.from(scoresTable)
			.where(eq(scoresTable.id, data.id))
			.limit(1)

		if (!existingScore) {
			throw new Error("Score not found")
		}

		if (existingScore.userId !== session.userId) {
			throw new Error("Not authorized to update this score")
		}

		const scheme = existingScore.scheme as WorkoutScheme
		const scoreType = (existingScore.scoreType ||
			getDefaultScoreType(scheme)) as ScoreType

		// Determine if this is a multi-round update
		const isMultiRound = data.roundScores && data.roundScores.length > 0

		// Build the update object with only provided fields
		const updateData: {
			scoreValue?: number | null
			notes?: string | null
			asRx?: boolean
			scalingLevelId?: string | null
			sortKey?: string | null
			recordedAt?: Date
			updatedAt: Date
		} = {
			updatedAt: new Date(),
		}

		if (isMultiRound) {
			// Multi-round: encode each round and aggregate
			const roundInputs = data.roundScores!.map((rs) => ({
				raw: rs.score,
			}))
			const result = encodeRounds(roundInputs, scheme, scoreType)
			updateData.scoreValue = result.aggregated

			// Recompute sort key
			if (result.aggregated !== null) {
				const sortKeyBigInt = computeSortKey({
					value: result.aggregated,
					status: "scored",
					scheme,
					scoreType,
				})
				updateData.sortKey = sortKeyBigInt.toString()
			} else {
				updateData.sortKey = null
			}
		} else if (data.scoreValue !== undefined) {
			updateData.scoreValue = data.scoreValue

			// Recompute sort key if score value changed
			if (data.scoreValue !== null) {
				const sortKeyBigInt = computeSortKey({
					value: data.scoreValue,
					status: "scored",
					scheme,
					scoreType,
				})
				updateData.sortKey = sortKeyBigInt.toString()
			} else {
				updateData.sortKey = null
			}
		}

		if (data.notes !== undefined) {
			updateData.notes = data.notes || null
		}
		if (data.asRx !== undefined) {
			updateData.asRx = data.asRx
		}
		if (data.scalingLevelId !== undefined) {
			updateData.scalingLevelId = data.scalingLevelId || null
		}
		if (data.date !== undefined) {
			updateData.recordedAt = new Date(data.date)
		}

		// Update the score
		const [updatedScore] = await db
			.update(scoresTable)
			.set(updateData)
			.where(eq(scoresTable.id, data.id))
			.returning()

		if (!updatedScore) {
			throw new Error("Failed to update score")
		}

		// Handle multi-round updates: delete old rounds and insert new ones
		if (isMultiRound && data.roundScores) {
			// Delete existing rounds
			await db
				.delete(scoreRoundsTable)
				.where(eq(scoreRoundsTable.scoreId, data.id))

			// Insert new rounds
			const roundsToInsert = data.roundScores.map((round, index) => {
				let roundValue: number

				if (scheme === "rounds-reps") {
					// Parse rounds+reps format (e.g., "5+12" or "5.12")
					const match = round.score.match(/^(\d+)[+.](\d+)$/)
					if (match) {
						const rounds = Number.parseInt(match[1], 10) || 0
						const reps = Number.parseInt(match[2], 10) || 0
						roundValue = rounds * 100000 + reps
					} else {
						// Try as plain number (just rounds)
						roundValue = (Number.parseInt(round.score, 10) || 0) * 100000
					}
				} else {
					// For other schemes, encode directly
					roundValue = encodeScore(round.score, scheme) ?? 0
				}

				return {
					scoreId: data.id,
					roundNumber: index + 1,
					value: roundValue,
					status: null,
				}
			})

			if (roundsToInsert.length > 0) {
				await db.insert(scoreRoundsTable).values(roundsToInsert)
			}
		}

		return { score: updatedScore }
	})
