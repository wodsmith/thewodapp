import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	results,
	scalingLevelsTable,
	scheduledWorkoutInstancesTable,
	sets,
	trackWorkoutsTable,
	userTable,
	workouts,
} from "@/db/schema"
import type { CompetitionSettings, ScoringSettings } from "@/types/competitions"
import { parseCompetitionSettings } from "@/types/competitions"
import {
	calculateAggregatedScore,
	formatScore,
	getDefaultScoreType,
} from "@/utils/score-formatting"
import { getCompetitionTrack } from "./competition-workouts"

export interface CompetitionLeaderboardEntry {
	registrationId: string
	userId: string
	athleteName: string
	divisionId: string
	divisionLabel: string
	totalPoints: number
	overallRank: number
	eventResults: Array<{
		trackWorkoutId: string
		trackOrder: number
		eventName: string
		rank: number
		points: number
		rawScore: string | null
		formattedScore: string
	}>
}

export interface EventLeaderboardEntry {
	registrationId: string
	userId: string
	athleteName: string
	divisionId: string
	divisionLabel: string
	rank: number
	points: number
	rawScore: string | null
	formattedScore: string
	isTimeCapped: boolean
}

/**
 * Calculate points based on scoring type
 */
function calculatePoints(
	place: number,
	athleteCount: number,
	scoringSettings: ScoringSettings | undefined,
): number {
	// Default to fixed_step with step=5 if no scoring settings
	if (!scoringSettings) {
		return Math.max(0, 100 - (place - 1) * 5) // Default fixed step
	}
	const scoring = scoringSettings

	switch (scoring.type) {
		case "winner_takes_more": {
			// Decreasing increments: 100, 85, 75, 67, 60, 54, 49, 45, 41, 38, 35, 32, 30, 28, 26, 24, 22, 20...
			const basePoints = [
				100, 85, 75, 67, 60, 54, 49, 45, 41, 38, 35, 32, 30, 28, 26, 24, 22, 20,
				18, 16, 14, 12, 10, 8, 6, 4, 2, 1,
			]
			if (place <= basePoints.length) {
				return basePoints[place - 1] ?? 1
			}
			// For places beyond the array, give 1 point
			return 1
		}

		case "even_spread": {
			// Linear distribution: 100, 75, 50, 25, 0 for 5 athletes
			if (athleteCount <= 1) return 100
			const step = 100 / (athleteCount - 1)
			return Math.max(0, Math.round(100 - (place - 1) * step))
		}

		case "fixed_step": {
			// Fixed decrement: 100, 95, 90, 85... with configurable step
			const step = scoring.step ?? 5
			return Math.max(0, 100 - (place - 1) * step)
		}
	}
}

/**
 * Get the competition leaderboard
 */
export async function getCompetitionLeaderboard(params: {
	competitionId: string
	divisionId?: string
}): Promise<CompetitionLeaderboardEntry[]> {
	const db = getDb()

	// Get competition with settings
	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, params.competitionId),
	})

	if (!competition) {
		throw new Error("Competition not found")
	}

	const settings = parseCompetitionSettings(competition.settings)

	// Get competition track
	const track = await getCompetitionTrack(params.competitionId)
	if (!track) {
		return []
	}

	// Get all track workouts for this competition
	const trackWorkouts = await db
		.select({
			id: trackWorkoutsTable.id,
			trackOrder: trackWorkoutsTable.trackOrder,
			pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
			workoutId: trackWorkoutsTable.workoutId,
			workout: workouts,
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.trackId, track.id))
		.orderBy(trackWorkoutsTable.trackOrder)

	if (trackWorkouts.length === 0) {
		return []
	}

	// Get all registrations for this competition
	const registrations = await db
		.select({
			registration: competitionRegistrationsTable,
			user: userTable,
			division: scalingLevelsTable,
		})
		.from(competitionRegistrationsTable)
		.innerJoin(
			userTable,
			eq(competitionRegistrationsTable.userId, userTable.id),
		)
		.leftJoin(
			scalingLevelsTable,
			eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
		)
		.where(eq(competitionRegistrationsTable.eventId, params.competitionId))

	if (registrations.length === 0) {
		return []
	}

	// Filter by division if specified
	const filteredRegistrations = params.divisionId
		? registrations.filter((r) => r.registration.divisionId === params.divisionId)
		: registrations

	// Get all scheduled workout instances for this competition
	const scheduledInstances = await db
		.select()
		.from(scheduledWorkoutInstancesTable)
		.where(eq(scheduledWorkoutInstancesTable.teamId, competition.competitionTeamId))

	// Map track workout IDs to scheduled instance IDs
	const trackWorkoutToScheduled = new Map<string, string>()
	for (const instance of scheduledInstances) {
		if (instance.trackWorkoutId) {
			trackWorkoutToScheduled.set(instance.trackWorkoutId, instance.id)
		}
	}

	// Get all results for scheduled instances
	const scheduledInstanceIds = scheduledInstances.map((si) => si.id)
	const allResults =
		scheduledInstanceIds.length > 0
			? await db
					.select()
					.from(results)
					.where(
						and(
							inArray(results.scheduledWorkoutInstanceId, scheduledInstanceIds),
							eq(results.type, "wod"),
						),
					)
			: []

	// Get all sets for results
	const resultIds = allResults.map((r) => r.id)
	const allSets =
		resultIds.length > 0
			? await db.select().from(sets).where(inArray(sets.resultId, resultIds))
			: []

	// Group sets by result ID
	const setsByResultId = new Map<string, (typeof allSets)[number][]>()
	for (const set of allSets) {
		const existing = setsByResultId.get(set.resultId) || []
		existing.push(set)
		setsByResultId.set(set.resultId, existing)
	}

	// Build leaderboard entries
	const leaderboardMap = new Map<string, CompetitionLeaderboardEntry>()

	for (const reg of filteredRegistrations) {
		const fullName = `${reg.user.firstName || ""} ${reg.user.lastName || ""}`.trim()

		leaderboardMap.set(reg.registration.id, {
			registrationId: reg.registration.id,
			userId: reg.user.id,
			athleteName: fullName || reg.user.email || "Unknown",
			divisionId: reg.registration.divisionId || "open",
			divisionLabel: reg.division?.label || "Open",
			totalPoints: 0,
			overallRank: 0,
			eventResults: [],
		})
	}

	// Process each event
	for (const trackWorkout of trackWorkouts) {
		const scheduledInstanceId = trackWorkoutToScheduled.get(trackWorkout.id)

		// Get results for this event, grouped by division
		const eventResultsByDivision = new Map<string, typeof allResults>()

		for (const result of allResults) {
			if (result.scheduledWorkoutInstanceId !== scheduledInstanceId) continue

			const registration = filteredRegistrations.find(
				(r) => r.user.id === result.userId,
			)
			if (!registration) continue

			const divisionId = registration.registration.divisionId || "open"
			const existing = eventResultsByDivision.get(divisionId) || []
			existing.push(result)
			eventResultsByDivision.set(divisionId, existing)
		}

		// Rank athletes within each division
		for (const [divisionId, divisionResults] of eventResultsByDivision) {
			// Calculate scores and sort
			const scoredResults = divisionResults.map((result) => {
				const resultSets = setsByResultId.get(result.id) || []
				const [aggregatedScore, isTimeCapped] = calculateAggregatedScore(
					resultSets,
					trackWorkout.workout.scheme,
					trackWorkout.workout.scoreType,
				)

				return {
					result,
					aggregatedScore,
					isTimeCapped,
				}
			})

			// Sort by score
			const scoreType =
				trackWorkout.workout.scoreType ||
				getDefaultScoreType(trackWorkout.workout.scheme)
			const lowerIsBetter = scoreType === "min"

			scoredResults.sort((a, b) => {
				if (a.aggregatedScore === null && b.aggregatedScore === null) return 0
				if (a.aggregatedScore === null) return 1
				if (b.aggregatedScore === null) return -1

				// Time-capped results sort after non-time-capped
				if (a.isTimeCapped !== b.isTimeCapped) {
					return a.isTimeCapped ? 1 : -1
				}

				return lowerIsBetter
					? a.aggregatedScore - b.aggregatedScore
					: b.aggregatedScore - a.aggregatedScore
			})

			// Assign ranks and calculate points
			const athleteCount = scoredResults.length

			for (let i = 0; i < scoredResults.length; i++) {
				const scoredResult = scoredResults[i]
				if (!scoredResult) continue
				const { result, aggregatedScore, isTimeCapped } = scoredResult
				const rank = i + 1
				const basePoints = calculatePoints(rank, athleteCount, settings?.scoring)
				const multiplier = (trackWorkout.pointsMultiplier ?? 100) / 100
				const points = Math.round(basePoints * multiplier)

				// Find registration for this user
				const registration = filteredRegistrations.find(
					(r) => r.user.id === result.userId,
				)
				if (!registration) continue

				const entry = leaderboardMap.get(registration.registration.id)
				if (!entry) continue

				const formattedScore = formatScore(
					aggregatedScore,
					trackWorkout.workout.scheme,
					isTimeCapped,
				)

				entry.eventResults.push({
					trackWorkoutId: trackWorkout.id,
					trackOrder: trackWorkout.trackOrder,
					eventName: trackWorkout.workout.name,
					rank,
					points,
					rawScore: result.wodScore,
					formattedScore,
				})

				entry.totalPoints += points
			}
		}

		// Add empty results for athletes who didn't complete this event
		for (const [regId, entry] of leaderboardMap) {
			const hasResult = entry.eventResults.some(
				(er) => er.trackWorkoutId === trackWorkout.id,
			)
			if (!hasResult) {
				entry.eventResults.push({
					trackWorkoutId: trackWorkout.id,
					trackOrder: trackWorkout.trackOrder,
					eventName: trackWorkout.workout.name,
					rank: 0,
					points: 0,
					rawScore: null,
					formattedScore: "N/A",
				})
			}
		}
	}

	// Convert to array and calculate overall ranks
	const leaderboard = Array.from(leaderboardMap.values())

	// Group by division for ranking
	const divisionGroups = new Map<string, CompetitionLeaderboardEntry[]>()
	for (const entry of leaderboard) {
		const existing = divisionGroups.get(entry.divisionId) || []
		existing.push(entry)
		divisionGroups.set(entry.divisionId, existing)
	}

	// Rank within each division
	for (const [divisionId, entries] of divisionGroups) {
		// Sort by total points descending
		entries.sort((a, b) => {
			if (b.totalPoints !== a.totalPoints) {
				return b.totalPoints - a.totalPoints
			}

			// Tie-breaker: count of 1st places
			const aFirsts = a.eventResults.filter((er) => er.rank === 1).length
			const bFirsts = b.eventResults.filter((er) => er.rank === 1).length
			if (bFirsts !== aFirsts) {
				return bFirsts - aFirsts
			}

			// Tie-breaker: count of 2nd places
			const aSeconds = a.eventResults.filter((er) => er.rank === 2).length
			const bSeconds = b.eventResults.filter((er) => er.rank === 2).length
			return bSeconds - aSeconds
		})

		// Assign ranks
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (entry) {
				entry.overallRank = i + 1
			}
		}
	}

	// Return sorted by overall rank
	return leaderboard.sort((a, b) => {
		// First by division, then by rank
		if (a.divisionId !== b.divisionId) {
			return a.divisionId.localeCompare(b.divisionId)
		}
		return a.overallRank - b.overallRank
	})
}

/**
 * Get leaderboard for a specific event
 */
export async function getEventLeaderboard(params: {
	competitionId: string
	trackWorkoutId: string
	divisionId?: string
}): Promise<EventLeaderboardEntry[]> {
	const db = getDb()

	// Get full leaderboard
	const leaderboard = await getCompetitionLeaderboard({
		competitionId: params.competitionId,
		divisionId: params.divisionId,
	})

	// Extract event results for the specific track workout
	const eventResults: EventLeaderboardEntry[] = []

	for (const entry of leaderboard) {
		const eventResult = entry.eventResults.find(
			(er) => er.trackWorkoutId === params.trackWorkoutId,
		)
		if (eventResult && eventResult.rank > 0) {
			eventResults.push({
				registrationId: entry.registrationId,
				userId: entry.userId,
				athleteName: entry.athleteName,
				divisionId: entry.divisionId,
				divisionLabel: entry.divisionLabel,
				rank: eventResult.rank,
				points: eventResult.points,
				rawScore: eventResult.rawScore,
				formattedScore: eventResult.formattedScore,
				isTimeCapped: eventResult.formattedScore.includes("cap"),
			})
		}
	}

	// Sort by rank
	return eventResults.sort((a, b) => a.rank - b.rank)
}
