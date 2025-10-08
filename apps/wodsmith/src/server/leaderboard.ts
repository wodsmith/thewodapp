import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	results,
	scalingLevelsTable,
	scheduledWorkoutInstancesTable,
	sets,
	userTable,
	workouts,
} from "@/db/schema"
import {
	calculateAggregatedScore,
	formatScore,
	getDefaultScoreType,
} from "@/utils/score-formatting"

export interface LeaderboardEntry {
	userId: string
	userName: string
	userAvatar: string | null
	score: string | null
	aggregatedScore: number | null
	formattedScore: string
	scalingLevelId: string | null
	scalingLevelLabel: string | null
	scalingLevelPosition: number | null
	asRx: boolean
	completedAt: Date
	isTimeCapped?: boolean
}

// Note: formatScore, calculateAggregatedScore, and getDefaultScoreType have been moved to
// @/utils/score-formatting for reuse across the application

/**
 * Get the leaderboard for a specific scheduled workout instance
 * Results are sorted by scaling level position (lower = harder) first, then by asRx status, then by score
 */
export async function getLeaderboardForScheduledWorkout({
	scheduledWorkoutInstanceId,
	teamId,
}: {
	scheduledWorkoutInstanceId: string
	teamId: string
}): Promise<LeaderboardEntry[]> {
	const db = getDb()

	// Get all results for this scheduled workout instance with workout and sets data
	const workoutResults = await db
		.select({
			result: results,
			user: userTable,
			scalingLevel: scalingLevelsTable,
			workout: workouts,
		})
		.from(results)
		.innerJoin(userTable, eq(results.userId, userTable.id))
		.innerJoin(
			scheduledWorkoutInstancesTable,
			eq(results.scheduledWorkoutInstanceId, scheduledWorkoutInstancesTable.id),
		)
		.leftJoin(
			scalingLevelsTable,
			eq(results.scalingLevelId, scalingLevelsTable.id),
		)
		.leftJoin(workouts, eq(results.workoutId, workouts.id))
		.where(
			and(
				eq(results.scheduledWorkoutInstanceId, scheduledWorkoutInstanceId),
				eq(scheduledWorkoutInstancesTable.teamId, teamId),
				eq(results.type, "wod"),
			),
		)

	// Get all sets for these results in one query
	const resultIds = workoutResults.map((r) => r.result.id)

	const allSets =
		resultIds.length > 0
			? await db.select().from(sets).where(inArray(sets.resultId, resultIds))
			: []

	// Group sets by resultId for efficient lookup
	const setsByResultId = new Map<string, typeof allSets>()
	for (const set of allSets) {
		const existing = setsByResultId.get(set.resultId) || []
		setsByResultId.set(set.resultId, [...existing, set])
	}

	// Transform and calculate aggregated scores
	const leaderboard: LeaderboardEntry[] = workoutResults.map((row) => {
		const fullName = `${row.user.firstName || ""} ${
			row.user.lastName || ""
		}`.trim()

		// Handle legacy scalingLevelId values ('rx+', 'rx', 'scaled')
		let scalingLabel = row.scalingLevel?.label || null
		let scalingPosition = row.scalingLevel?.position ?? null

		// Fallback for legacy values when join returns null
		if (!scalingLabel && row.result.scalingLevelId) {
			const legacyId = row.result.scalingLevelId.toLowerCase()
			if (legacyId === "rx+") {
				scalingLabel = "Rx+"
				scalingPosition = 0
			} else if (legacyId === "rx") {
				scalingLabel = "Rx"
				scalingPosition = 1
			} else if (legacyId === "scaled") {
				scalingLabel = "Scaled"
				scalingPosition = 2
			}
		}

		// Get sets for this result and calculate aggregated score
		const resultSets = setsByResultId.get(row.result.id) || []

		const [aggregatedScore, isTimeCapped] = row.workout
			? calculateAggregatedScore(
					resultSets,
					row.workout.scheme,
					row.workout.scoreType,
				)
			: [null, false]

		// Format score from calculated aggregatedScore, or fall back to raw wodScore
		// This handles legacy data before sets were implemented and edge cases
		let formattedScore = formatScore(
			aggregatedScore,
			row.workout?.scheme,
			isTimeCapped,
		)
		if (formattedScore === "N/A" && row.result.wodScore) {
			// Fall back to the raw wodScore field if sets calculation failed
			formattedScore = row.result.wodScore
		}

		return {
			userId: row.user.id,
			userName: fullName || row.user.email || "Unknown",
			userAvatar: row.user.avatar,
			score: row.result.wodScore,
			aggregatedScore,
			formattedScore,
			scalingLevelId: row.result.scalingLevelId,
			scalingLevelLabel: scalingLabel,
			scalingLevelPosition: scalingPosition,
			asRx: row.result.asRx || false,
			completedAt: row.result.date,
			isTimeCapped,
		}
	})

	// Get workout scheme and scoreType for sorting
	const workout = workoutResults[0]?.workout
	const scheme = workout?.scheme
	const scoreType =
		workout?.scoreType || (scheme ? getDefaultScoreType(scheme) : "max")

	// Sort the leaderboard:
	// 1. By scaling level position (lower = harder, so ascending)
	// 2. By asRx status (true before false)
	// 3. By aggregated score (based on scheme and scoreType)
	leaderboard.sort((a, b) => {
		// First, sort by scaling level position (nulls last)
		if (a.scalingLevelPosition === null && b.scalingLevelPosition === null) {
			// Both null, continue to next sort criteria
		} else if (a.scalingLevelPosition === null) {
			return 1 // a after b
		} else if (b.scalingLevelPosition === null) {
			return -1 // a before b
		} else if (a.scalingLevelPosition !== b.scalingLevelPosition) {
			return a.scalingLevelPosition - b.scalingLevelPosition
		}

		// Then sort by asRx (true before false)
		if (a.asRx !== b.asRx) {
			return a.asRx ? -1 : 1
		}

		// Finally, sort by aggregated score
		if (a.aggregatedScore !== null && b.aggregatedScore !== null) {
			// For time-capped results, higher reps is better (max)
			// For time-based schemes and emom, lower time is better (min)
			// For everything else, higher is better (max)
			const aIsLowerBetter = a.isTimeCapped ? false : scoreType === "min"
			const bIsLowerBetter = b.isTimeCapped ? false : scoreType === "min"

			// If both have the same sort direction, compare normally
			if (aIsLowerBetter === bIsLowerBetter) {
				return aIsLowerBetter
					? a.aggregatedScore - b.aggregatedScore
					: b.aggregatedScore - a.aggregatedScore
			}

			// If they have different sort directions (one time-capped, one not)
			// Place time-capped (didn't finish) after those who finished
			return a.isTimeCapped ? 1 : -1
		} else if (a.aggregatedScore !== null) {
			return -1 // a has score, b doesn't
		} else if (b.aggregatedScore !== null) {
			return 1 // b has score, a doesn't
		}

		return 0
	})

	return leaderboard
}
