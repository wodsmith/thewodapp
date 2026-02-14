/**
 * Workout Leaderboard Server Functions for TanStack Start
 * Functions for displaying team leaderboards on workout detail pages
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { scheduledWorkoutInstancesTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { userTable } from "@/db/schemas/users"
import { autochunk } from "@/utils/batch-query"

// ===========================
// Type Definitions
// ===========================

export interface LeaderboardEntry {
	rank: number
	userId: string
	userName: string
	scoreValue: number | null
	displayScore: string
	asRx: boolean
	scalingLabel: string | null
}

export interface WorkoutInstanceLeaderboard {
	instanceId: string
	instanceDate: Date
	entries: LeaderboardEntry[]
}

// ===========================
// Input Schemas
// ===========================

const getWorkoutLeaderboardInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

// ===========================
// Helper Functions
// ===========================

/**
 * Format score value for display based on scheme
 */
function formatScoreValue(scoreValue: number | null, scheme: string): string {
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
			// Load is stored in grams, convert to lbs
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

/**
 * Determine if a score scheme should be sorted ascending (lower is better)
 */
function isLowerBetter(scheme: string, scoreType: string | null): boolean {
	// Time-based schemes: lower is better
	if (scheme === "time" || scheme === "time-with-cap") {
		return true
	}
	// Use scoreType if available
	if (scoreType === "min") {
		return true
	}
	// Default: higher is better
	return false
}

// ===========================
// Server Functions
// ===========================

/**
 * Get leaderboards for a workout across all its scheduled instances
 * Returns an array of leaderboards grouped by scheduled instance date
 */
export const getWorkoutLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getWorkoutLeaderboardInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// First, get all scheduled instances for this workout
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

		if (instances.length === 0) {
			return { leaderboards: [] as WorkoutInstanceLeaderboard[] }
		}

		const instanceIds = instances.map((i) => i.id)

		// Get all scores for these scheduled instances using autochunk
		// to respect the 100 parameter limit
		const scores = await autochunk(
			{ items: instanceIds, otherParametersCount: 1 }, // 1 for teamId
			async (chunk) =>
				db
					.select({
						scoreId: scoresTable.id,
						userId: scoresTable.userId,
						scoreValue: scoresTable.scoreValue,
						scheme: scoresTable.scheme,
						scoreType: scoresTable.scoreType,
						asRx: scoresTable.asRx,
						scheduledWorkoutInstanceId: scoresTable.scheduledWorkoutInstanceId,
						userName: userTable.firstName,
						userLastName: userTable.lastName,
						scalingLabel: scalingLevelsTable.label,
					})
					.from(scoresTable)
					.innerJoin(userTable, eq(scoresTable.userId, userTable.id))
					.leftJoin(
						scalingLevelsTable,
						eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
					)
					.where(
						and(
							inArray(scoresTable.scheduledWorkoutInstanceId, chunk),
							eq(scoresTable.teamId, data.teamId),
						),
					),
		)

		// Create a map of instance ID to date for easy lookup
		const instanceDateMap = new Map<string, Date>()
		for (const instance of instances) {
			instanceDateMap.set(instance.id, instance.scheduledDate)
		}

		// Group scores by scheduled instance ID
		const scoresByInstance = new Map<
			string,
			Array<{
				userId: string
				userName: string
				scoreValue: number | null
				scheme: string
				scoreType: string | null
				asRx: boolean
				scalingLabel: string | null
			}>
		>()

		for (const score of scores) {
			if (!score.scheduledWorkoutInstanceId) continue

			const fullName =
				`${score.userName || ""} ${score.userLastName || ""}`.trim()

			const entry = {
				userId: score.userId,
				userName: fullName || "Unknown",
				scoreValue: score.scoreValue,
				scheme: score.scheme,
				scoreType: score.scoreType,
				asRx: score.asRx,
				scalingLabel: score.scalingLabel,
			}

			const instanceScores =
				scoresByInstance.get(score.scheduledWorkoutInstanceId) || []
			instanceScores.push(entry)
			scoresByInstance.set(score.scheduledWorkoutInstanceId, instanceScores)
		}

		// Build leaderboards for each instance
		const leaderboards: WorkoutInstanceLeaderboard[] = []

		for (const instance of instances) {
			const instanceScores = scoresByInstance.get(instance.id) || []

			// Skip instances with no scores
			if (instanceScores.length === 0) continue

			// Determine sort order from first score (all should have same scheme)
			const sortAscending = isLowerBetter(
				instanceScores[0].scheme,
				instanceScores[0].scoreType,
			)

			// Sort scores
			const sortedScores = [...instanceScores].sort((a, b) => {
				// First by asRx (Rx before scaled)
				if (a.asRx !== b.asRx) {
					return a.asRx ? -1 : 1
				}

				// Then by score value
				if (a.scoreValue === null && b.scoreValue === null) return 0
				if (a.scoreValue === null) return 1
				if (b.scoreValue === null) return -1

				if (sortAscending) {
					return a.scoreValue - b.scoreValue
				}
				return b.scoreValue - a.scoreValue
			})

			// Add ranks and format
			const entries: LeaderboardEntry[] = sortedScores.map((score, index) => ({
				rank: index + 1,
				userId: score.userId,
				userName: score.userName,
				scoreValue: score.scoreValue,
				displayScore: formatScoreValue(score.scoreValue, score.scheme),
				asRx: score.asRx,
				scalingLabel: score.scalingLabel,
			}))

			leaderboards.push({
				instanceId: instance.id,
				instanceDate: instance.scheduledDate,
				entries,
			})
		}

		return { leaderboards }
	})
