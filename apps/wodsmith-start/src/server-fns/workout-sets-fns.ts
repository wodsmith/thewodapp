/**
 * Workout Sets Server Functions for TanStack Start
 * Fetch and display multi-round workout result sets (e.g., '10x3 Back Squat')
 */

import { createServerFn } from "@tanstack/react-start"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { decodeScore, type WorkoutScheme } from "@/lib/scoring"

// Input validation schemas
const getWorkoutResultSetsInputSchema = z.object({
	scoreId: z.string().min(1, "Score ID is required"),
})

/**
 * Formatted set data for display
 */
export interface FormattedSetData {
	/** Round number (1-indexed) */
	roundNumber: number
	/** Encoded value from database */
	value: number
	/** Formatted display value (e.g., "225 lbs", "1:30", "5+12") */
	displayValue: string
	/** Optional notes for this round */
	notes: string | null
	/** Status for this round (if any) */
	status: string | null
}

/**
 * Response type for getWorkoutResultSetsFn
 */
export interface WorkoutResultSetsResponse {
	/** Score ID */
	scoreId: string
	/** Parent score scheme */
	scheme: WorkoutScheme
	/** Formatted sets ordered by round number */
	sets: FormattedSetData[]
	/** Total number of rounds */
	totalRounds: number
}

/**
 * Get all sets/rounds for a workout result (score)
 * Used for displaying multi-round workout data (e.g., "10x3 Back Squat")
 */
export const getWorkoutResultSetsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getWorkoutResultSetsInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<WorkoutResultSetsResponse> => {
		const db = getDb()

		// First, get the parent score to know the scheme
		const [score] = await db
			.select({
				id: scoresTable.id,
				scheme: scoresTable.scheme,
			})
			.from(scoresTable)
			.where(eq(scoresTable.id, data.scoreId))
			.limit(1)

		if (!score) {
			throw new Error("Score not found")
		}

		const scheme = score.scheme as WorkoutScheme

		// Get all rounds for this score, ordered by round number
		const rounds = await db
			.select({
				roundNumber: scoreRoundsTable.roundNumber,
				value: scoreRoundsTable.value,
				notes: scoreRoundsTable.notes,
				status: scoreRoundsTable.status,
			})
			.from(scoreRoundsTable)
			.where(eq(scoreRoundsTable.scoreId, data.scoreId))
			.orderBy(asc(scoreRoundsTable.roundNumber))

		// Format each round for display
		const sets: FormattedSetData[] = rounds.map((round) => {
			// Decode the value based on the parent score's scheme
			const displayValue = decodeScore(round.value, scheme, {
				includeUnit: true,
			})

			return {
				roundNumber: round.roundNumber,
				value: round.value,
				displayValue,
				notes: round.notes,
				status: round.status,
			}
		})

		return {
			scoreId: data.scoreId,
			scheme,
			sets,
			totalRounds: sets.length,
		}
	})

/**
 * Get sets for multiple scores at once (batch operation)
 * Useful for displaying sets in list views
 */
const getMultipleWorkoutResultSetsInputSchema = z.object({
	scoreIds: z.array(z.string().min(1)).min(1, "At least one score ID required"),
})

export interface BatchWorkoutResultSetsResponse {
	results: Map<string, WorkoutResultSetsResponse>
}

export const getMultipleWorkoutResultSetsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getMultipleWorkoutResultSetsInputSchema.parse(data),
	)
	.handler(
		async ({ data }): Promise<Record<string, WorkoutResultSetsResponse>> => {
			const results: Record<string, WorkoutResultSetsResponse> = {}

			// For batch operations with multiple IDs, we query each individually
			// This is a simplified implementation - for production, use autochunk
			for (const scoreId of data.scoreIds) {
				try {
					const result = await getWorkoutResultSetsFn({ data: { scoreId } })
					results[scoreId] = result
				} catch {
					// Skip scores that don't exist or have errors
				}
			}

			return results
		},
	)
