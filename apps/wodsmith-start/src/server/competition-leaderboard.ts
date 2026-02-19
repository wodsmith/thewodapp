/**
 * Competition Leaderboard Server Logic
 *
 * Provides leaderboard calculation for competitions using the configurable
 * scoring system. Supports Traditional, P-Score, and Custom scoring algorithms
 * with configurable tiebreakers.
 *
 * @see docs/plans/configurable-scoring-system.md
 * @see @/lib/scoring/algorithms - Scoring algorithm implementations
 * @see @/lib/scoring/tiebreakers - Tiebreaker logic
 */

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionHeatAssignmentsTable,
	competitionHeatsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { workouts } from "@/db/schemas/workouts"
import {
	calculateEventPoints,
	DEFAULT_SCORING_CONFIG,
	decodeScore,
	type EventScoreInput,
	formatScore,
	getDefaultScoreType,
	type WorkoutScheme,
} from "@/lib/scoring"
import {
	applyTiebreakers,
	type TiebreakerInput,
} from "@/lib/scoring/tiebreakers"
import {
	getEffectiveScoringConfig,
	parseCompetitionSettings,
} from "@/types/competitions"
import { autochunk } from "@/utils/batch-query"

// ============================================================================
// Types
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
		/** Formatted tiebreak value if present */
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

export interface CompetitionLeaderboardResult {
	entries: CompetitionLeaderboardEntry[]
	scoringConfig: import("@/types/scoring").ScoringConfig
	events: Array<{ trackWorkoutId: string; name: string }>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch scores from the scores table
 */
async function fetchScores(params: {
	trackWorkoutIds: string[]
	userIds: string[]
}) {
	const db = getDb()

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
						inArray(scoresTable.userId, params.userIds),
					),
				),
	)

	return scores
}

/**
 * Map score status to EventScoreInput status
 */
function mapScoreStatus(status: string | null): EventScoreInput["status"] {
	switch (status) {
		case "scored":
			return "scored"
		case "cap":
			return "cap"
		case "dq":
		case "dnf":
			return "dnf"
		case "withdrawn":
			return "withdrawn"
		default:
			return "dns"
	}
}

/**
 * Get competition track for a competition
 */
async function getCompetitionTrack(competitionId: string) {
	const db = getDb()
	return db.query.programmingTracksTable.findFirst({
		where: eq(programmingTracksTable.competitionId, competitionId),
	})
}

// ============================================================================
// Heat-Based Workout Filtering
// ============================================================================

interface HeatInfo {
	id: string
	trackWorkoutId: string
	divisionId: string | null
}

interface HeatAssignmentInfo {
	heatId: string
	divisionId: string | null
}

/**
 * Determine which track workouts are relevant for a division based on heat data.
 *
 * A workout is relevant to a division if:
 * 1. A heat exists with divisionId matching the target division, OR
 * 2. A mixed heat (divisionId=null) has at least one assignment from that division, OR
 * 3. The workout has scores from athletes registered in that division
 *
 * Returns null if no heats exist and no scored workout IDs provided (backward compat).
 */
export function getRelevantWorkoutIds(params: {
	heats: HeatInfo[]
	mixedHeatAssignments: HeatAssignmentInfo[]
	divisionId: string
	workoutIdsWithScores: Set<string>
}): Set<string> | null {
	if (
		params.heats.length === 0 &&
		params.workoutIdsWithScores.size === 0
	)
		return null

	// Workouts with division-specific heats matching selected division
	const relevant = new Set(
		params.heats
			.filter((h) => h.divisionId === params.divisionId)
			.map((h) => h.trackWorkoutId),
	)

	// For mixed heats (divisionId=null), check actual assignments
	const heatIdToWorkout = new Map(
		params.heats
			.filter((h) => h.divisionId === null)
			.map((h) => [h.id, h.trackWorkoutId]),
	)

	for (const assignment of params.mixedHeatAssignments) {
		if (assignment.divisionId === params.divisionId) {
			const twId = heatIdToWorkout.get(assignment.heatId)
			if (twId) relevant.add(twId)
		}
	}

	// Include workouts that have scores for this division
	for (const twId of params.workoutIdsWithScores) {
		relevant.add(twId)
	}

	return relevant
}

// ============================================================================
// Main Leaderboard Functions
// ============================================================================

/**
 * Get the competition leaderboard with configurable scoring.
 *
 * Uses the ScoringConfig from competition settings to determine:
 * - Scoring algorithm (traditional, p_score, custom)
 * - Tiebreaker method (countback, head_to_head, none)
 * - Status handling (DNF, DNS, withdrawn)
 */
export async function getCompetitionLeaderboard(params: {
	competitionId: string
	divisionId?: string
}): Promise<CompetitionLeaderboardResult> {
	const db = getDb()

	// Get competition with settings
	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, params.competitionId),
	})

	if (!competition) {
		throw new Error("Competition not found")
	}

	// Parse settings and get scoring config
	const settings = parseCompetitionSettings(competition.settings)
	const scoringConfig =
		getEffectiveScoringConfig(settings) ?? DEFAULT_SCORING_CONFIG

	// Division results publishing state — controls leaderboard visibility
	const divisionResults = settings?.divisionResults

	// Get competition track
	const track = await getCompetitionTrack(params.competitionId)
	if (!track) {
		return { entries: [], scoringConfig, events: [] }
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
		.where(
			and(
				eq(trackWorkoutsTable.trackId, track.id),
				eq(trackWorkoutsTable.eventStatus, "published"),
			),
		)
		.orderBy(trackWorkoutsTable.trackOrder)

	if (trackWorkouts.length === 0) {
		return { entries: [], scoringConfig, events: [] }
	}

	// Filter workouts by division relevance when a division is selected.
	// A workout is relevant if it has heats OR scores for the division.
	let filteredTrackWorkouts = trackWorkouts
	if (params.divisionId) {
		const trackWorkoutIds = trackWorkouts.map((tw) => tw.id)

		// Query heats and scores for division in parallel
		const [heatsForWorkouts, scoredWorkoutRows] = await Promise.all([
			autochunk(
				{ items: trackWorkoutIds, otherParametersCount: 0 },
				async (chunk) =>
					db
						.select({
							id: competitionHeatsTable.id,
							trackWorkoutId: competitionHeatsTable.trackWorkoutId,
							divisionId: competitionHeatsTable.divisionId,
						})
						.from(competitionHeatsTable)
						.where(inArray(competitionHeatsTable.trackWorkoutId, chunk)),
			),
			// Find workouts that have scores from athletes in this division
			autochunk(
				{ items: trackWorkoutIds, otherParametersCount: 1 },
				async (chunk) =>
					db
						.selectDistinct({
							competitionEventId: scoresTable.competitionEventId,
						})
						.from(scoresTable)
						.innerJoin(
							competitionRegistrationsTable,
							and(
								eq(scoresTable.userId, competitionRegistrationsTable.userId),
								eq(
									competitionRegistrationsTable.eventId,
									params.competitionId,
								),
							),
						)
						.where(
							and(
								inArray(scoresTable.competitionEventId, chunk),
								eq(
									competitionRegistrationsTable.divisionId,
									params.divisionId!,
								),
							),
						),
			),
		])

		const workoutIdsWithScores = new Set(
			scoredWorkoutRows
				.map((r) => r.competitionEventId)
				.filter((id): id is string => id !== null),
		)

		// Fetch assignments for mixed heats (divisionId=null)
		const mixedHeatIds = heatsForWorkouts
			.filter((h) => h.divisionId === null)
			.map((h) => h.id)

		const mixedHeatAssignments =
			mixedHeatIds.length > 0
				? await autochunk(
						{ items: mixedHeatIds, otherParametersCount: 0 },
						async (chunk) =>
							db
								.select({
									heatId: competitionHeatAssignmentsTable.heatId,
									divisionId: competitionRegistrationsTable.divisionId,
								})
								.from(competitionHeatAssignmentsTable)
								.innerJoin(
									competitionRegistrationsTable,
									eq(
										competitionHeatAssignmentsTable.registrationId,
										competitionRegistrationsTable.id,
									),
								)
								.where(
									inArray(competitionHeatAssignmentsTable.heatId, chunk),
								),
					)
				: []

		const relevantIds = getRelevantWorkoutIds({
			heats: heatsForWorkouts,
			mixedHeatAssignments,
			divisionId: params.divisionId,
			workoutIdsWithScores,
		})

		if (relevantIds) {
			filteredTrackWorkouts = trackWorkouts.filter((tw) =>
				relevantIds.has(tw.id),
			)

			if (filteredTrackWorkouts.length === 0) {
				return { entries: [], scoringConfig, events: [] }
			}
		}
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
		const events = filteredTrackWorkouts.map((tw) => ({
			trackWorkoutId: tw.id,
			name: tw.workout.name,
		}))
		return { entries: [], scoringConfig, events }
	}

	// Filter by division if specified
	const filteredRegistrations = params.divisionId
		? registrations.filter(
				(r) => r.registration.divisionId === params.divisionId,
			)
		: registrations

	// Get team members for team registrations
	const athleteTeamIds = filteredRegistrations
		.filter(
			(r) => r.registration.athleteTeamId && (r.division?.teamSize ?? 1) > 1,
		)
		.map((r) => r.registration.athleteTeamId as string)

	const allTeamMemberships =
		athleteTeamIds.length > 0
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

	// Get all scores for competition events
	const trackWorkoutIds = filteredTrackWorkouts.map((tw) => tw.id)
	const userIds = filteredRegistrations.map((r) => r.user.id)

	const allScores = await fetchScores({ trackWorkoutIds, userIds })

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

	// Process each event using configurable scoring
	for (const trackWorkout of filteredTrackWorkouts) {
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

		// Calculate points for each division using the scoring algorithm
		for (const [divisionId, divisionScores] of eventScoresByDivision) {
			// Filter by division results publishing state.
			// When divisionResults exists, the organizer has opted into per-event publishing.
			// Divisions default to "Draft" (hidden) — only show explicitly published ones.
			// When divisionResults is absent, all results show (backwards compat).
			if (divisionResults) {
				const eventPublishState = divisionResults[trackWorkout.id]
				if (eventPublishState) {
					const divisionPublishState = eventPublishState[divisionId]
					if (!divisionPublishState?.publishedAt) continue
				}
			}

			// Convert to EventScoreInput format
			const eventScoreInputs: EventScoreInput[] = divisionScores.map((s) => ({
				userId: s.userId,
				value: s.scoreValue ?? 0,
				status: mapScoreStatus(s.status),
				sortKey: s.sortKey,
			}))

			// Calculate points using the factory
			const scheme = trackWorkout.workout.scheme as WorkoutScheme
			const pointsMap = calculateEventPoints(
				trackWorkout.id,
				eventScoreInputs,
				scheme,
				scoringConfig,
			)

			// Apply points multiplier
			const multiplier = (trackWorkout.pointsMultiplier ?? 100) / 100

			// Update leaderboard entries with results
			for (const score of divisionScores) {
				const registration = filteredRegistrations.find(
					(r) => r.user.id === score.userId,
				)
				if (!registration) continue

				const entry = leaderboardMap.get(registration.registration.id)
				if (!entry) continue

				const pointsResult = pointsMap.get(score.userId)
				const rank = pointsResult?.rank ?? 0
				const basePoints = pointsResult?.points ?? 0
				const points = Math.round(basePoints * multiplier)

				// Format score for display
				const scoreType =
					trackWorkout.workout.scoreType ||
					getDefaultScoreType(trackWorkout.workout.scheme)

				const scoreObj: Parameters<typeof formatScore>[0] = {
					scheme: score.scheme as WorkoutScheme,
					scoreType,
					value: score.scoreValue ?? 0,
					status: score.status as "scored" | "cap" | "dq" | "withdrawn",
				}

				if (score.tiebreakValue !== null && score.tiebreakScheme) {
					scoreObj.tiebreak = {
						scheme: score.tiebreakScheme as "reps" | "time",
						value: score.tiebreakValue,
					}
				}

				if (score.timeCapMs && score.secondaryValue !== null) {
					scoreObj.timeCap = {
						ms: score.timeCapMs,
						secondaryValue: score.secondaryValue,
					}
				}

				const formattedScore = formatScore(scoreObj, { compact: true })

				// Format tiebreak separately
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
					formattedTiebreak: null,
				})
			}
		}
	}

	// Convert to array and apply tiebreakers for overall ranking
	const leaderboard = Array.from(leaderboardMap.values())

	// Group by division for ranking
	const divisionGroups = new Map<string, CompetitionLeaderboardEntry[]>()
	for (const entry of leaderboard) {
		const existing = divisionGroups.get(entry.divisionId) || []
		existing.push(entry)
		divisionGroups.set(entry.divisionId, existing)
	}

	// Apply tiebreakers within each division
	for (const [_divisionId, entries] of divisionGroups) {
		// Build event placements map for tiebreaker
		const tiebreakerInput: TiebreakerInput = {
			athletes: entries.map((e) => ({
				userId: e.userId,
				totalPoints: e.totalPoints,
				eventPlacements: new Map(
					e.eventResults
						.filter((er) => er.rank > 0)
						.map((er) => [er.trackWorkoutId, er.rank]),
				),
			})),
			config: scoringConfig.tiebreaker,
			scoringAlgorithm: scoringConfig.algorithm,
		}

		const rankedAthletes = applyTiebreakers(tiebreakerInput)

		// Update entries with final ranks
		for (const ranked of rankedAthletes) {
			const entry = entries.find((e) => e.userId === ranked.userId)
			if (entry) {
				entry.overallRank = ranked.rank
			}
		}
	}

	// Sort by overall rank
	const sortedEntries = leaderboard.sort((a, b) => {
		// First by division, then by rank
		if (a.divisionId !== b.divisionId) {
			return a.divisionId.localeCompare(b.divisionId)
		}
		return a.overallRank - b.overallRank
	})

	// Build events list for the response
	const events = filteredTrackWorkouts.map((tw) => ({
		trackWorkoutId: tw.id,
		name: tw.workout.name,
	}))

	return {
		entries: sortedEntries,
		scoringConfig,
		events,
	}
}

/**
 * Get leaderboard for a specific event
 */
export async function getEventLeaderboard(params: {
	competitionId: string
	trackWorkoutId: string
	divisionId?: string
}): Promise<EventLeaderboardEntry[]> {
	// Get full leaderboard
	const { entries } = await getCompetitionLeaderboard({
		competitionId: params.competitionId,
		divisionId: params.divisionId,
	})

	// Extract event results for the specific track workout
	const eventResults: EventLeaderboardEntry[] = []

	for (const entry of entries) {
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
