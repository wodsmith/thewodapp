import "server-only"

import { and, eq, gte, lte, asc, inArray } from "drizzle-orm"
import { getDd } from "@/db"
import {
	results,
	scheduledWorkoutInstancesTable,
	scalingLevelsTable,
	userTable,
	workouts,
	sets,
} from "@/db/schema"

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

/**
 * Format a score based on the workout scheme
 */
export function formatScore(
	aggregatedScore: number | null,
	scheme: string | undefined,
	isTimeCapped = false,
): string {
	if (aggregatedScore === null) return "N/A"

	switch (scheme) {
		case "time":
		case "emom": {
			// Convert seconds to MM:SS format
			const minutes = Math.floor(aggregatedScore / 60)
			const seconds = Math.floor(aggregatedScore % 60)
			return `${minutes}:${seconds.toString().padStart(2, "0")}`
		}
		case "time-with-cap": {
			if (isTimeCapped) {
				// Time-capped result - show reps
				return `${aggregatedScore} reps (capped)`
			}
			// Finished result - show time
			const minutes = Math.floor(aggregatedScore / 60)
			const seconds = Math.floor(aggregatedScore % 60)
			return `${minutes}:${seconds.toString().padStart(2, "0")}`
		}
		case "reps":
		case "calories":
		case "points":
			return aggregatedScore.toString()
		case "rounds-reps": {
			// For AMRAP, show as rounds if whole number
			const rounds = Math.floor(aggregatedScore)
			const reps = Math.round((aggregatedScore % 1) * 100) // Assuming fractional part represents reps
			return reps > 0 ? `${rounds}+${reps}` : rounds.toString()
		}
		case "load":
			return `${aggregatedScore} lbs`
		case "meters":
			return `${aggregatedScore}m`
		case "feet":
			return `${aggregatedScore}ft`
		case "pass-fail":
			return `${aggregatedScore} passes`
		default:
			return aggregatedScore.toString()
	}
}

/**
 * Calculate aggregated score from sets based on scoreType
 * Returns tuple: [aggregatedScore, isTimeCapped]
 */
function calculateAggregatedScore(
	resultSets: Array<{ reps: number | null; weight: number | null; time: number | null; score: number | null; distance: number | null }>,
	scheme: string,
	scoreType: string | null,
): [number | null, boolean] {
	if (resultSets.length === 0) return [null, false]

	// Determine which field to aggregate based on scheme
	let values: number[] = []
	let isTimeCapped = false

	switch (scheme) {
		case "time":
		case "emom":
			values = resultSets.map(s => s.time).filter((v): v is number => v !== null)
			break
		case "time-with-cap": {
			// For time-with-cap, check if result is time-capped (has reps) or finished (has time)
			const hasReps = resultSets.some(s => s.reps !== null)
			const hasTime = resultSets.some(s => s.time !== null)

			if (hasReps && !hasTime) {
				// Time-capped result - use reps (higher is better)
				values = resultSets.map(s => s.reps).filter((v): v is number => v !== null)
				isTimeCapped = true
			} else {
				// Finished result - use time
				values = resultSets.map(s => s.time).filter((v): v is number => v !== null)
				isTimeCapped = false
			}
			break
		}
		case "reps":
		case "rounds-reps":
			// Try reps field first, then score field (reps are sometimes stored in score)
			values = resultSets.map(s => s.reps ?? s.score).filter((v): v is number => v !== null)
			break
		case "load":
			values = resultSets.map(s => s.weight).filter((v): v is number => v !== null)
			break
		case "calories":
		case "meters":
		case "feet":
		case "points":
			values = resultSets.map(s => s.score ?? s.reps ?? s.distance).filter((v): v is number => v !== null)
			break
		case "pass-fail":
			// Count passes (status === "pass" would be in score field as 1/0)
			values = resultSets.map(s => s.score).filter((v): v is number => v !== null)
			break
		default:
			return [null, false]
	}

	if (values.length === 0) return [null, false]

	// Apply aggregation based on scoreType
	// For time-capped results, use max (higher reps is better), otherwise use the default
	const defaultScoreType = isTimeCapped ? "max" : (scoreType || getDefaultScoreType(scheme))

	let aggregatedScore: number | null = null
	switch (defaultScoreType) {
		case "min":
			aggregatedScore = Math.min(...values)
			break
		case "max":
			aggregatedScore = Math.max(...values)
			break
		case "sum":
			aggregatedScore = values.reduce((sum, v) => sum + v, 0)
			break
		case "average":
			aggregatedScore = values.reduce((sum, v) => sum + v, 0) / values.length
			break
		case "first":
			aggregatedScore = values[0]
			break
		case "last":
			aggregatedScore = values[values.length - 1]
			break
		default:
			aggregatedScore = null
	}

	return [aggregatedScore, isTimeCapped]
}

/**
 * Get default scoreType for a scheme
 */
function getDefaultScoreType(scheme: string): string {
	const defaults: Record<string, string> = {
		time: "min", // Lower time is better
		"time-with-cap": "min", // Lower time is better
		"pass-fail": "first", // First attempt matters
		"rounds-reps": "max", // Higher rounds+reps is better
		reps: "max", // Higher reps is better
		emom: "max", // Higher reps/score in EMOM is better
		load: "max", // Higher load is better
		calories: "max", // Higher calories is better
		meters: "max", // Higher distance is better
		feet: "max", // Higher distance is better
		points: "max", // Higher points is better
	}
	return defaults[scheme] || "max"
}

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
	const db = getDd()

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
	const resultIds = workoutResults.map(r => r.result.id)

	const allSets = resultIds.length > 0
		? await db
				.select()
				.from(sets)
				.where(inArray(sets.resultId, resultIds))
		: []

	// Group sets by resultId for efficient lookup
	const setsByResultId = new Map<string, typeof allSets>()
	for (const set of allSets) {
		const existing = setsByResultId.get(set.resultId) || []
		setsByResultId.set(set.resultId, [...existing, set])
	}

	// Transform and calculate aggregated scores
	const leaderboard: LeaderboardEntry[] = workoutResults.map((row) => {
		const fullName = `${row.user.firstName || ""} ${row.user.lastName || ""}`.trim()

		// Handle legacy scalingLevelId values ('rx+', 'rx', 'scaled')
		let scalingLabel = row.scalingLevel?.label || null
		let scalingPosition = row.scalingLevel?.position ?? null

		// Fallback for legacy values when join returns null
		if (!scalingLabel && row.result.scalingLevelId) {
			const legacyId = row.result.scalingLevelId.toLowerCase()
			if (legacyId === 'rx+') {
				scalingLabel = 'Rx+'
				scalingPosition = 0
			} else if (legacyId === 'rx') {
				scalingLabel = 'Rx'
				scalingPosition = 1
			} else if (legacyId === 'scaled') {
				scalingLabel = 'Scaled'
				scalingPosition = 2
			}
		}

		// Get sets for this result and calculate aggregated score
		const resultSets = setsByResultId.get(row.result.id) || []

		const [aggregatedScore, isTimeCapped] = row.workout
			? calculateAggregatedScore(resultSets, row.workout.scheme, row.workout.scoreType)
			: [null, false]

		const formattedScore = formatScore(aggregatedScore, row.workout?.scheme, isTimeCapped)

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
	const scoreType = workout?.scoreType || (scheme ? getDefaultScoreType(scheme) : "max")

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
