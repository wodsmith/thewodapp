import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	scalingLevelsTable,
	scoresTable,
	teamMembershipTable,
	trackWorkoutsTable,
	userTable,
	workouts,
} from "@/db/schema"
import type { ScoringSettings } from "@/types/competitions"
import { parseCompetitionSettings } from "@/types/competitions"
import { autochunk } from "@/utils/batch-query"
import { getCompetitionTrack } from "./competition-workouts"
import { formatScore, getDefaultScoreType } from "@/lib/scoring"

export interface TeamMemberInfo {
	userId: string
	firstName: string | null
	lastName: string | null
	isCaptain: boolean
}

export interface CompetitionLeaderboardEntry {
	registrationId: string
	userId: string
	athleteName: string
	divisionId: string
	divisionLabel: string
	totalPoints: number
	overallRank: number
	// Team info (null for individual divisions)
	isTeamDivision: boolean
	teamName: string | null
	teamMembers: TeamMemberInfo[]
	eventResults: Array<{
		trackWorkoutId: string
		trackOrder: number
		eventName: string
		scheme: string
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
 * Fetch scores from new scores table (sortKey-optimized)
 */
async function fetchScoresFromNewTable(params: {
	trackWorkoutIds: string[]
	userIds: string[]
}) {
	const db = getDb()
	
	// Query new scores table with efficient sortKey ordering
	const scores = await autochunk(
		{ items: params.trackWorkoutIds, otherParametersCount: 1 },
		async (chunk) =>
			db
				.select({
					id: scoresTable.id,
					userId: scoresTable.userId,
					competitionEventId: scoresTable.competitionEventId,
					scheme: scoresTable.scheme,
					scoreValue: scoresTable.scoreValue,
					tiebreakValue: scoresTable.tiebreakValue,
					status: scoresTable.status,
					statusOrder: scoresTable.statusOrder,
					sortKey: scoresTable.sortKey,
					secondaryValue: scoresTable.secondaryValue,
					secondaryScheme: scoresTable.secondaryScheme,
					timeCapMs: scoresTable.timeCapMs,
				})
				.from(scoresTable)
				.where(
					and(
						inArray(scoresTable.competitionEventId, chunk),
						inArray(scoresTable.userId, params.userIds),
					),
				),
	)
	
	return scores
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
		? registrations.filter(
				(r) => r.registration.divisionId === params.divisionId,
			)
		: registrations

	// Get team members for team registrations
	// First, collect all athleteTeamIds from team registrations
	const athleteTeamIds = filteredRegistrations
		.filter((r) => r.registration.athleteTeamId && (r.division?.teamSize ?? 1) > 1)
		.map((r) => r.registration.athleteTeamId as string)

	// Fetch all team memberships for these teams in one query
	const allTeamMemberships = athleteTeamIds.length > 0
		? await autochunk({ items: athleteTeamIds }, async (chunk) =>
				db
					.select({
						membership: teamMembershipTable,
						user: userTable,
					})
					.from(teamMembershipTable)
					.innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
					.where(inArray(teamMembershipTable.teamId, chunk)),
			)
		: []

	// Group memberships by teamId
	const membershipsByTeamId = new Map<
		string,
		Array<{ membership: typeof allTeamMemberships[number]["membership"]; user: typeof allTeamMemberships[number]["user"] }>
	>()
	for (const m of allTeamMemberships) {
		const teamId = m.membership.teamId
		const existing = membershipsByTeamId.get(teamId) || []
		existing.push(m)
		membershipsByTeamId.set(teamId, existing)
	}

	// Get all scores for competition events from new scores table
	const trackWorkoutIds = trackWorkouts.map((tw) => tw.id)
	const userIds = filteredRegistrations.map((r) => r.user.id)
	
	const allScores = await fetchScoresFromNewTable({ trackWorkoutIds, userIds })

	// Build leaderboard entries
	const leaderboardMap = new Map<string, CompetitionLeaderboardEntry>()

	for (const reg of filteredRegistrations) {
		const fullName =
			`${reg.user.firstName || ""} ${reg.user.lastName || ""}`.trim()

		const isTeamDivision = (reg.division?.teamSize ?? 1) > 1
		const athleteTeamId = reg.registration.athleteTeamId

		// Build team members list for team divisions
		let teamMembers: TeamMemberInfo[] = []
		if (isTeamDivision && athleteTeamId) {
			const memberships = membershipsByTeamId.get(athleteTeamId) || []
			teamMembers = memberships.map((m) => ({
				userId: m.user.id,
				firstName: m.user.firstName,
				lastName: m.user.lastName,
				isCaptain: m.membership.userId === reg.registration.captainUserId,
			}))
			// Sort so captain appears first
			teamMembers.sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0))
		}

		leaderboardMap.set(reg.registration.id, {
			registrationId: reg.registration.id,
			userId: reg.user.id,
			athleteName: fullName || reg.user.email || "Unknown",
			divisionId: reg.registration.divisionId || "open",
			divisionLabel: reg.division?.label || "Open",
			totalPoints: 0,
			overallRank: 0,
			isTeamDivision,
			teamName: reg.registration.teamName,
			teamMembers,
			eventResults: [],
		})
	}

	// Process each event
	for (const trackWorkout of trackWorkouts) {
		// Get scores for this event, grouped by division
		const eventScoresByDivision = new Map<string, typeof allScores>()

		for (const score of allScores) {
			if (score.competitionEventId !== trackWorkout.id) continue

			const registration = filteredRegistrations.find(
				(r) => r.user.id === score.userId,
			)
			if (!registration) continue

			const divisionId = registration.registration.divisionId || "open"
			const existing = eventScoresByDivision.get(divisionId) || []
			existing.push(score)
			eventScoresByDivision.set(divisionId, existing)
		}

		// Rank athletes within each division using sortKey
		for (const [_divisionId, divisionScores] of eventScoresByDivision) {
			// Sort by sortKey (already contains status + normalized score)
			const sortedScores = divisionScores.sort((a, b) => {
				// sortKey is stored as text, but represents a bigint
				// Format: status_order (1 digit) + normalized_score (15 digits)
				if (!a.sortKey || !b.sortKey) return 0
				return a.sortKey.localeCompare(b.sortKey)
			})

			const athleteCount = sortedScores.length

			for (let i = 0; i < sortedScores.length; i++) {
				const score = sortedScores[i]

				if (!score) continue
				const rank = i + 1
				const basePoints = calculatePoints(
					rank,
					athleteCount,
					settings?.scoring,
				)
				const multiplier = (trackWorkout.pointsMultiplier ?? 100) / 100
				const points = Math.round(basePoints * multiplier)

				// Find registration for this user
				const registration = filteredRegistrations.find(
					(r) => r.user.id === score.userId,
				)
				if (!registration) continue

				const entry = leaderboardMap.get(registration.registration.id)
				if (!entry) continue

				// Format score using new encoding
				const scoreType = trackWorkout.workout.scoreType || getDefaultScoreType(trackWorkout.workout.scheme)
				
				// Build Score object for formatting
				const scoreObj: Parameters<typeof formatScore>[0] = {
					scheme: score.scheme,
					scoreType,
					value: score.scoreValue ?? 0,
					status: score.status,
				}
				
				// Add tiebreak if present
				if (score.tiebreakValue && score.scheme === "time-with-cap") {
					scoreObj.tiebreak = {
						scheme: "reps",
						value: score.tiebreakValue,
					}
				}
				
				// Add time cap if present
				if (score.timeCapMs && score.secondaryScheme && score.secondaryValue !== null) {
					scoreObj.timeCap = {
						ms: score.timeCapMs,
						secondaryScheme: score.secondaryScheme,
						secondaryValue: score.secondaryValue,
					}
				}

				const formattedScore = formatScore(scoreObj, { compact: false })

				entry.eventResults.push({
					trackWorkoutId: trackWorkout.id,
					trackOrder: trackWorkout.trackOrder,
					eventName: trackWorkout.workout.name,
					scheme: trackWorkout.workout.scheme,
					rank,
					points,
					rawScore: String(score.scoreValue ?? ""),
					formattedScore,
				})

				entry.totalPoints += points
			}
		}

		// Add empty results for athletes who didn't complete this event
		for (const [_regId, entry] of leaderboardMap) {
			const hasResult = entry.eventResults.some(
				(er) => er.trackWorkoutId === trackWorkout.id,
			)
			if (!hasResult) {
				entry.eventResults.push({
					trackWorkoutId: trackWorkout.id,
					trackOrder: trackWorkout.trackOrder,
					eventName: trackWorkout.workout.name,
					scheme: trackWorkout.workout.scheme,
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
	for (const [_divisionId, entries] of divisionGroups) {
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
	const _db = getDb()

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
