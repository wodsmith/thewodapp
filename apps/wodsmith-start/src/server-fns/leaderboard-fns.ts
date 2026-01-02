/**
 * Competition Leaderboard Server Functions for TanStack Start
 *
 * Ported from apps/wodsmith/src/server/competition-leaderboard.ts
 *
 * Features:
 * - Points calculation (winner_takes_more, even_spread, fixed_step)
 * - Tie detection using sortKey + secondaryValue + tiebreakValue
 * - Overall ranking with countback logic
 * - Event-specific leaderboard queries
 * - Division filtering
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

// Import type-only - safe for client bundling (types are erased at compile time)
import type { TiebreakScheme, WorkoutScheme } from "@/lib/scoring/types"

// ============================================================================
// Types (Re-export from server layer)
// ============================================================================

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
		/** Formatted tiebreak value if present (e.g., "8:30.123" or "150") */
		formattedTiebreak: string | null
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
 * Scoring configuration - three types available
 * 1st place always = 100 points (normalized)
 */
type ScoringSettings =
	| {
			type: "winner_takes_more"
			// Points: 100, 85, 75, 67, 60, 54... (decreasing increments favor top finishers)
	  }
	| {
			type: "even_spread"
			// Points distributed linearly: for 5 athletes - 100, 75, 50, 25, 0
	  }
	| {
			type: "fixed_step"
			step: number // Default: 5
			// Points: 100, 95, 90, 85... (fixed decrement per place)
	  }

/**
 * Division results publishing status - per event+division
 */
interface DivisionResultsSchema {
	[eventId: string]: {
		[divisionId: string]: {
			publishedAt: number | null
		}
	}
}

interface CompetitionSettings {
	divisions?: {
		scalingGroupId: string
	}
	scoring?: ScoringSettings
	divisionResults?: DivisionResultsSchema
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionLeaderboardInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().optional(),
})

const getEventLeaderboardInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	divisionId: z.string().optional(),
})

// ============================================================================
// Helper Functions (pure, no imports)
// ============================================================================

/**
 * Parse competition settings from JSON string
 */
function parseCompetitionSettings(
	settingsJson: string | null | undefined,
): CompetitionSettings | null {
	if (!settingsJson) return null
	try {
		return JSON.parse(settingsJson) as CompetitionSettings
	} catch {
		return null
	}
}

/**
 * Check if division results are published for a specific event+division combination
 */
function isDivisionResultPublished(
	settings: CompetitionSettings | null,
	eventId: string,
	divisionId: string,
): boolean {
	if (!settings?.divisionResults) return false
	const eventResults = settings.divisionResults[eventId]
	if (!eventResults) return false
	const divisionResult = eventResults[divisionId]
	return (
		divisionResult?.publishedAt !== null &&
		divisionResult?.publishedAt !== undefined
	)
}

/**
 * Check if two scores are equal for tie-breaking purposes
 * Scores are equal if sortKey, secondaryValue (for caps), and tiebreakValue all match
 */
function areScoresEqual(
	a: {
		sortKey: string | null
		status: string | null
		secondaryValue: number | null
		tiebreakValue: number | null
	},
	b: {
		sortKey: string | null
		status: string | null
		secondaryValue: number | null
		tiebreakValue: number | null
	},
): boolean {
	// Primary: sortKey must match
	if (a.sortKey !== b.sortKey) return false

	// Secondary: for capped scores, secondaryValue must match
	if (a.status === "cap" && b.status === "cap") {
		if (a.secondaryValue !== b.secondaryValue) return false
	}

	// Tertiary: tiebreak values must match
	// If one has a tiebreak and the other doesn't, they're not equal
	if (a.tiebreakValue !== null || b.tiebreakValue !== null) {
		if (a.tiebreakValue !== b.tiebreakValue) return false
	}

	return true
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

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the competition leaderboard
 */
export const getCompetitionLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionLeaderboardInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Dynamic imports for server-only code (TanStack Start pattern)
		const { getDb } = await import("@/db")
		const { and, eq, inArray } = await import("drizzle-orm")
		const { autochunk } = await import("@/utils/batch-query")
		const { competitionsTable, competitionRegistrationsTable } = await import(
			"@/db/schemas/competitions"
		)
		const { programmingTracksTable, trackWorkoutsTable } = await import(
			"@/db/schemas/programming"
		)
		const { scoresTable } = await import("@/db/schemas/scores")
		const { scalingLevelsTable } = await import("@/db/schemas/scaling")
		const { teamMembershipTable } = await import("@/db/schemas/teams")
		const { userTable } = await import("@/db/schemas/users")
		const { workouts } = await import("@/db/schemas/workouts")
		const { decodeScore, formatScore, getDefaultScoreType, getSortDirection } =
			await import("@/lib/scoring")
		// WorkoutScheme type is used implicitly via formatScore/decodeScore params

		const db = getDb()

		// Get competition with settings
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		const settings = parseCompetitionSettings(competition.settings)

		// Get competition track
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		if (!track) {
			return [] as CompetitionLeaderboardEntry[]
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
			return [] as CompetitionLeaderboardEntry[]
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
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

		if (registrations.length === 0) {
			return [] as CompetitionLeaderboardEntry[]
		}

		// Filter by division if specified
		const filteredRegistrations = data.divisionId
			? registrations.filter(
					(r) => r.registration.divisionId === data.divisionId,
				)
			: registrations

		// Get team members for team registrations
		// First, collect all athleteTeamIds from team registrations
		const athleteTeamIds = filteredRegistrations
			.filter(
				(r) => r.registration.athleteTeamId && (r.division?.teamSize ?? 1) > 1,
			)
			.map((r) => r.registration.athleteTeamId as string)

		// Fetch all team memberships for these teams in one query (batched for D1)
		const allTeamMemberships =
			athleteTeamIds.length > 0
				? await autochunk({ items: athleteTeamIds }, async (chunk) =>
						db
							.select({
								membership: teamMembershipTable,
								user: userTable,
							})
							.from(teamMembershipTable)
							.innerJoin(
								userTable,
								eq(teamMembershipTable.userId, userTable.id),
							)
							.where(inArray(teamMembershipTable.teamId, chunk)),
					)
				: []

		// Group memberships by teamId
		const membershipsByTeamId = new Map<
			string,
			Array<{
				membership: (typeof allTeamMemberships)[number]["membership"]
				user: (typeof allTeamMemberships)[number]["user"]
			}>
		>()
		for (const m of allTeamMemberships) {
			const teamId = m.membership.teamId
			const existing = membershipsByTeamId.get(teamId) || []
			existing.push(m)
			membershipsByTeamId.set(teamId, existing)
		}

		// Get all scores for competition events from scores table (batched for D1)
		const trackWorkoutIds = trackWorkouts.map((tw) => tw.id)
		const userIds = filteredRegistrations.map((r) => r.user.id)

		// Fetch scores with autochunk for D1's 100 param limit
		const allScores = await autochunk(
			{ items: trackWorkoutIds, otherParametersCount: userIds.length },
			async (chunk) =>
				db
					.select({
						id: scoresTable.id,
						userId: scoresTable.userId,
						competitionEventId: scoresTable.competitionEventId,
						scheme: scoresTable.scheme,
						scoreValue: scoresTable.scoreValue,
						tiebreakScheme: scoresTable.tiebreakScheme,
						tiebreakValue: scoresTable.tiebreakValue,
						status: scoresTable.status,
						statusOrder: scoresTable.statusOrder,
						sortKey: scoresTable.sortKey,
						secondaryValue: scoresTable.secondaryValue,
						timeCapMs: scoresTable.timeCapMs,
					})
					.from(scoresTable)
					.where(
						and(
							inArray(scoresTable.competitionEventId, chunk),
							inArray(scoresTable.userId, userIds),
						),
					),
		)

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
				teamMembers.sort(
					(a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0),
				)
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
			for (const [divisionId, divisionScores] of eventScoresByDivision) {
				// Skip this division if results are not published
				if (!isDivisionResultPublished(settings, trackWorkout.id, divisionId)) {
					continue
				}
				// Sort by sortKey, then by secondary value (for capped scores), then by tiebreak
				const sortedScores = divisionScores.sort((a, b) => {
					// Primary sort: sortKey (status + normalized score)
					if (!a.sortKey || !b.sortKey) return 0
					const sortKeyCompare = a.sortKey.localeCompare(b.sortKey)
					if (sortKeyCompare !== 0) return sortKeyCompare

					// Secondary sort for capped scores: by secondaryValue (reps completed)
					// Higher reps = better, so sort descending
					if (a.status === "cap" && b.status === "cap") {
						const aSecondary = a.secondaryValue ?? 0
						const bSecondary = b.secondaryValue ?? 0
						if (aSecondary !== bSecondary) {
							return bSecondary - aSecondary // Higher is better (descending)
						}
					}

					// Tertiary sort: tiebreak value (if both have tiebreak)
					if (
						a.tiebreakValue !== null &&
						b.tiebreakValue !== null &&
						a.tiebreakScheme
					) {
						const tiebreakDirection = getSortDirection(
							a.tiebreakScheme as WorkoutScheme,
						)
						// For "asc" (time tiebreak): lower is better
						// For "desc" (reps tiebreak): higher is better
						if (tiebreakDirection === "asc") {
							return a.tiebreakValue - b.tiebreakValue
						}
						return b.tiebreakValue - a.tiebreakValue
					}

					return 0
				})

				const athleteCount = sortedScores.length

				// Track ranking state for tie detection
				let lastScore: (typeof sortedScores)[0] | null = null
				let lastRank = 1
				let lastPoints = 0

				for (let i = 0; i < sortedScores.length; i++) {
					const score = sortedScores[i]

					if (!score) continue

					let rank: number
					let points: number

					// Check if this score ties with the previous
					if (lastScore && areScoresEqual(score, lastScore)) {
						// Tie - use same rank and points as previous
						rank = lastRank
						points = lastPoints
					} else {
						// Not a tie - use current position as rank (standard 1224 ranking)
						rank = i + 1
						const basePoints = calculatePoints(
							rank,
							athleteCount,
							settings?.scoring,
						)
						const multiplier = (trackWorkout.pointsMultiplier ?? 100) / 100
						points = Math.round(basePoints * multiplier)

						// Update for next iteration
						lastRank = rank
						lastPoints = points
					}

					lastScore = score

					// Find registration for this user
					const registration = filteredRegistrations.find(
						(r) => r.user.id === score.userId,
					)
					if (!registration) continue

					const entry = leaderboardMap.get(registration.registration.id)
					if (!entry) continue

					// Format score using new encoding
					const scoreType =
						trackWorkout.workout.scoreType ||
						getDefaultScoreType(trackWorkout.workout.scheme)

					// Build Score object for formatting
					const scoreObj: Parameters<typeof formatScore>[0] = {
						scheme: score.scheme as WorkoutScheme,
						scoreType,
						value: score.scoreValue ?? 0,
						status: score.status,
					}

					// Add tiebreak if present (for any scheme that has tiebreak configured)
					if (score.tiebreakValue !== null && score.tiebreakScheme) {
						scoreObj.tiebreak = {
							scheme: score.tiebreakScheme as TiebreakScheme,
							value: score.tiebreakValue,
						}
					}

					// Add time cap if present (secondary is always reps)
					if (score.timeCapMs && score.secondaryValue !== null) {
						scoreObj.timeCap = {
							ms: score.timeCapMs,
							secondaryValue: score.secondaryValue,
						}
					}

					const formattedScore = formatScore(scoreObj, { compact: true })

					// Format tiebreak separately for display
					let formattedTiebreak: string | null = null
					if (score.tiebreakValue !== null && score.tiebreakScheme) {
						formattedTiebreak = decodeScore(
							score.tiebreakValue,
							score.tiebreakScheme as WorkoutScheme,
							{ compact: true },
						)
					}

					entry.eventResults.push({
						trackWorkoutId: trackWorkout.id,
						trackOrder: trackWorkout.trackOrder,
						eventName: trackWorkout.workout.name,
						scheme: trackWorkout.workout.scheme,
						rank,
						points,
						rawScore: String(score.scoreValue ?? ""),
						formattedScore,
						formattedTiebreak,
					})

					entry.totalPoints += points
				}
			}

			// Add empty results for athletes who didn't complete this event
			// Only add placeholders if the division results are published
			for (const [_regId, entry] of leaderboardMap) {
				// Check if this athlete's division results are published for this event
				if (
					!isDivisionResultPublished(
						settings,
						trackWorkout.id,
						entry.divisionId,
					)
				) {
					continue
				}

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
						formattedTiebreak: null,
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

		// Rank within each division with countback logic
		for (const [_divisionId, entries] of divisionGroups) {
			// Helper to count published event results (results with rank > 0)
			const getPublishedResultCount = (entry: CompetitionLeaderboardEntry) =>
				entry.eventResults.filter((er) => er.rank > 0).length

			// Sort by total points descending, then countback (1st places, 2nd places, etc.)
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

			// Assign ranks with tie detection
			// Only rank athletes who have at least one published event result
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i]
				if (!entry) continue

				// If athlete has no published event results, leave them unranked (0)
				if (getPublishedResultCount(entry) === 0) {
					entry.overallRank = 0
					continue
				}

				// Check for tie with previous entry
				if (i > 0) {
					const prev = entries[i - 1]
					// Only consider tie if previous entry also has published results
					if (
						prev &&
						getPublishedResultCount(prev) > 0 &&
						entry.totalPoints === prev.totalPoints
					) {
						// Check tiebreaker counts too
						const entryFirsts = entry.eventResults.filter(
							(er) => er.rank === 1,
						).length
						const prevFirsts = prev.eventResults.filter(
							(er) => er.rank === 1,
						).length
						const entrySeconds = entry.eventResults.filter(
							(er) => er.rank === 2,
						).length
						const prevSeconds = prev.eventResults.filter(
							(er) => er.rank === 2,
						).length

						if (entryFirsts === prevFirsts && entrySeconds === prevSeconds) {
							// True tie - use same rank as previous
							entry.overallRank = prev.overallRank
							continue
						}
					}
				}

				// Not a tie - count how many ranked entries came before this one
				const rankedBefore = entries
					.slice(0, i)
					.filter((e) => e && getPublishedResultCount(e) > 0).length
				entry.overallRank = rankedBefore + 1
			}
		}

		// Return sorted by overall rank (grouped by division first)
		return leaderboard.sort((a, b) => {
			// First by division, then by rank
			if (a.divisionId !== b.divisionId) {
				return a.divisionId.localeCompare(b.divisionId)
			}
			return a.overallRank - b.overallRank
		}) as CompetitionLeaderboardEntry[]
	})

/**
 * Get leaderboard for a specific event
 */
export const getEventLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventLeaderboardInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Get full leaderboard (reuses the main function's logic)
		const leaderboard = await getCompetitionLeaderboardFn({
			data: {
				competitionId: data.competitionId,
				divisionId: data.divisionId,
			},
		})

		// Extract event results for the specific track workout
		const eventResults: EventLeaderboardEntry[] = []

		for (const entry of leaderboard) {
			const eventResult = entry.eventResults.find(
				(er) => er.trackWorkoutId === data.trackWorkoutId,
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
					isTimeCapped: eventResult.formattedScore
						.toUpperCase()
						.includes("CAP"),
				})
			}
		}

		// Sort by rank
		return eventResults.sort(
			(a, b) => a.rank - b.rank,
		) as EventLeaderboardEntry[]
	})

// ============================================================================
// Legacy API (for backwards compatibility with existing components)
// ============================================================================

export interface LegacyLeaderboardEntry {
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

const getLeaderboardDataInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().optional(),
})

/**
 * Legacy leaderboard function for backwards compatibility.
 * Returns a simplified structure matching the old placeholder API.
 */
export const getLeaderboardDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getLeaderboardDataInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Dynamic imports for server-only code
		const { getDb } = await import("@/db")
		const { eq, and } = await import("drizzle-orm")
		const { competitionsTable, competitionRegistrationsTable } = await import(
			"@/db/schemas/competitions"
		)
		const { programmingTracksTable, trackWorkoutsTable } = await import(
			"@/db/schemas/programming"
		)

		const db = getDb()

		// Verify competition exists
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
		})

		if (!competition) {
			return { leaderboard: [], workouts: [] }
		}

		// Get published workouts for this competition
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		const trackWorkoutsWithWorkouts = track
			? await db.query.trackWorkoutsTable.findMany({
					where: and(
						eq(trackWorkoutsTable.trackId, track.id),
						eq(trackWorkoutsTable.eventStatus, "published"),
					),
					with: {
						workout: true,
					},
					orderBy: (trackWorkouts, { asc }) => [asc(trackWorkouts.trackOrder)],
				})
			: []

		// Get registrations for this competition
		const registrations = await db.query.competitionRegistrationsTable.findMany(
			{
				where: data.divisionId
					? and(
							eq(competitionRegistrationsTable.eventId, data.competitionId),
							eq(competitionRegistrationsTable.divisionId, data.divisionId),
						)
					: eq(competitionRegistrationsTable.eventId, data.competitionId),
				with: {
					user: true,
					division: true,
				},
				orderBy: (regs, { asc }) => [asc(regs.registeredAt)],
			},
		)

		// Transform to legacy leaderboard format
		const leaderboard: LegacyLeaderboardEntry[] = registrations.map((reg) => {
			const fullName =
				`${reg.user.firstName || ""} ${reg.user.lastName || ""}`.trim()

			return {
				userId: reg.userId,
				userName: fullName || reg.user.email || "Unknown",
				userAvatar: reg.user.avatar,
				score: null,
				aggregatedScore: null,
				formattedScore: "N/A",
				scalingLevelId: reg.divisionId,
				scalingLevelLabel: reg.division?.label ?? null,
				scalingLevelPosition: reg.division?.position ?? null,
				asRx: false,
				completedAt: reg.registeredAt,
				isTimeCapped: false,
			}
		})

		return {
			leaderboard,
			workouts: trackWorkoutsWithWorkouts.map((tw) => ({
				id: tw.id,
				workoutId: tw.workoutId,
				name:
					(tw as unknown as { workout?: { name: string } }).workout?.name ??
					"Unknown Workout",
				trackOrder: tw.trackOrder,
			})),
		}
	})
