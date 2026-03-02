/**
 * Series Global Leaderboard Server Logic
 *
 * Computes a global leaderboard across all competitions in a series group.
 * Athletes from different throwdowns are ranked together by their raw performance
 * on the same shared workouts (matched by workoutId across comps).
 */

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionGroupsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
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
import { parseSeriesSettings } from "@/types/competitions"
import type { ScoringConfig } from "@/types/scoring"

// ============================================================================
// Types
// ============================================================================

export interface SeriesLeaderboardEntry {
	userId: string
	athleteName: string
	divisionId: string // scalingLevelId
	divisionLabel: string
	competitionId: string // which throwdown they competed at
	competitionName: string
	totalPoints: number
	overallRank: number
	isTeamDivision: boolean
	teamName: string | null
	eventResults: Array<{
		workoutId: string // the underlying shared workout ID (series event key)
		eventName: string
		scheme: string
		rank: number // global rank across ALL comps' athletes
		points: number
		formattedScore: string
		formattedTiebreak: string | null
	}>
}

export interface SeriesDivisionHealth {
	competitionId: string
	competitionName: string
	scalingGroupIds: string[] // unique scaling group IDs used by this comp's divisions
	matchesPrimary: boolean // does this comp use the same scalingGroupId as the majority?
}

export interface SeriesLeaderboardResult {
	entries: SeriesLeaderboardEntry[]
	scoringConfig: ScoringConfig
	seriesEvents: Array<{ workoutId: string; name: string; scheme: string }>
	divisionHealth: SeriesDivisionHealth[]
	availableDivisions: Array<{ id: string; label: string }>
}

// ============================================================================
// Helper
// ============================================================================

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

// ============================================================================
// Division Health Check
// ============================================================================

async function computeDivisionHealth(
	compIds: string[],
	compNames: Map<string, string>,
	db: ReturnType<typeof getDb>,
): Promise<{ health: SeriesDivisionHealth[]; primaryScalingGroupId: string | null }> {
	if (compIds.length === 0)
		return { health: [], primaryScalingGroupId: null }

	// Get all competition settings to extract scalingGroupId per comp
	// (Stored in competitions.settings JSON: { divisions: { scalingGroupId } })
	const comps = await db
		.select({
			id: competitionsTable.id,
			settings: competitionsTable.settings,
		})
		.from(competitionsTable)
		.where(inArray(competitionsTable.id, compIds))

	// Parse scalingGroupId from each comp's settings
	const compScalingGroups = new Map<string, string[]>()
	for (const comp of comps) {
		try {
			const settings = comp.settings ? JSON.parse(comp.settings) : null
			const sgId = settings?.divisions?.scalingGroupId as string | undefined
			compScalingGroups.set(comp.id, sgId ? [sgId] : [])
		} catch {
			compScalingGroups.set(comp.id, [])
		}
	}

	// Find primary (most common) scalingGroupId
	const countMap = new Map<string, number>()
	for (const sgIds of compScalingGroups.values()) {
		for (const sgId of sgIds) {
			countMap.set(sgId, (countMap.get(sgId) ?? 0) + 1)
		}
	}

	let primaryScalingGroupId: string | null = null
	let maxCount = 0
	for (const [sgId, count] of countMap) {
		// On a tie, pick the lexicographically smaller ID for determinism
		if (
			count > maxCount ||
			(count === maxCount &&
				primaryScalingGroupId !== null &&
				sgId < primaryScalingGroupId)
		) {
			maxCount = count
			primaryScalingGroupId = sgId
		}
	}

	const health = compIds.map((compId) => {
		const sgIds = compScalingGroups.get(compId) ?? []
		const matchesPrimary =
			primaryScalingGroupId !== null && sgIds.includes(primaryScalingGroupId)
		return {
			competitionId: compId,
			competitionName: compNames.get(compId) ?? "Unknown",
			scalingGroupIds: sgIds,
			matchesPrimary,
		}
	})

	return { health, primaryScalingGroupId }
}

// ============================================================================
// Main Function
// ============================================================================

export async function getSeriesLeaderboard(params: {
	groupId: string
	divisionId?: string
}): Promise<SeriesLeaderboardResult> {
	const db = getDb()

	// 1. Load group with settings
	const group = await db.query.competitionGroupsTable.findFirst({
		where: eq(competitionGroupsTable.id, params.groupId),
	})
	if (!group) throw new Error("Series group not found")

	const seriesSettings = parseSeriesSettings(group.settings)
	const scoringConfig = seriesSettings?.scoringConfig ?? DEFAULT_SCORING_CONFIG

	// 2. Load all competitions in this group
	const comps = await db
		.select({ id: competitionsTable.id, name: competitionsTable.name })
		.from(competitionsTable)
		.where(eq(competitionsTable.groupId, params.groupId))

	if (comps.length === 0) {
		return {
			entries: [],
			scoringConfig,
			seriesEvents: [],
			divisionHealth: [],
			availableDivisions: [],
		}
	}

	const compIds = comps.map((c) => c.id)
	const compNames = new Map<string, string>(comps.map((c) => [c.id, c.name]))

	// 3. Compute division health early so we can filter to primary-group comps only
	const { health: divisionHealth, primaryScalingGroupId } =
		await computeDivisionHealth(compIds, compNames, db)

	// Load available divisions from the primary scaling group
	const availableDivisions: Array<{ id: string; label: string }> = []
	if (primaryScalingGroupId) {
		const levels = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
			})
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, primaryScalingGroupId))
		levels
			.sort((a, b) => a.position - b.position)
			.forEach((l) => availableDivisions.push({ id: l.id, label: l.label }))
	}

	// Only include comps that use the primary scaling group
	const primaryCompIds = divisionHealth
		.filter((h) => h.matchesPrimary)
		.map((h) => h.competitionId)

	if (primaryCompIds.length === 0) {
		return {
			entries: [],
			scoringConfig,
			seriesEvents: [],
			divisionHealth,
			availableDivisions,
		}
	}

	// 4. Load programming tracks for primary comps only
	const tracks = await db
		.select({
			id: programmingTracksTable.id,
			competitionId: programmingTracksTable.competitionId,
		})
		.from(programmingTracksTable)
		.where(inArray(programmingTracksTable.competitionId, primaryCompIds))

	if (tracks.length === 0) {
		return {
			entries: [],
			scoringConfig,
			seriesEvents: [],
			divisionHealth,
			availableDivisions,
		}
	}

	const trackIds = tracks.map((t) => t.id)

	// 5. Load all published track workouts, joining workout data
	const allTrackWorkouts = await db
		.select({
			id: trackWorkoutsTable.id,
			trackId: trackWorkoutsTable.trackId,
			trackOrder: trackWorkoutsTable.trackOrder,
			workoutId: trackWorkoutsTable.workoutId,
			workout: workouts,
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(
			and(
				inArray(trackWorkoutsTable.trackId, trackIds),
				eq(trackWorkoutsTable.eventStatus, "published"),
			),
		)
		.orderBy(trackWorkoutsTable.trackOrder)

	// 6. Build workoutId → trackWorkouts map (series event groups)
	// A "series event" is identified by its workoutId (shared across all throwdowns)
	const workoutIdToTrackWorkouts = new Map<string, typeof allTrackWorkouts>()
	for (const tw of allTrackWorkouts) {
		const existing = workoutIdToTrackWorkouts.get(tw.workoutId) ?? []
		existing.push(tw)
		workoutIdToTrackWorkouts.set(tw.workoutId, existing)
	}

	// Series events ordered by the minimum trackOrder seen
	const seriesEventOrder = new Map<string, number>()
	for (const tw of allTrackWorkouts) {
		const current = seriesEventOrder.get(tw.workoutId) ?? Infinity
		if (tw.trackOrder < current) seriesEventOrder.set(tw.workoutId, tw.trackOrder)
	}

	const uniqueWorkoutIds = Array.from(workoutIdToTrackWorkouts.keys()).sort(
		(a, b) =>
			(seriesEventOrder.get(a) ?? 0) - (seriesEventOrder.get(b) ?? 0),
	)

	const seriesEvents = uniqueWorkoutIds.map((wId) => {
		const tw = workoutIdToTrackWorkouts.get(wId)![0]
		return { workoutId: wId, name: tw.workout.name, scheme: tw.workout.scheme }
	})

	const allTrackWorkoutIds = allTrackWorkouts.map((tw) => tw.id)

	// 7. Load registrations only from primary comps (filters out mismatched-group athletes)
	const allRegistrations = await db
		.select({
			registration: competitionRegistrationsTable,
			user: userTable,
			division: scalingLevelsTable,
			competitionId: competitionsTable.id,
			competitionName: competitionsTable.name,
		})
		.from(competitionRegistrationsTable)
		.innerJoin(
			userTable,
			eq(competitionRegistrationsTable.userId, userTable.id),
		)
		.innerJoin(
			competitionsTable,
			eq(competitionRegistrationsTable.eventId, competitionsTable.id),
		)
		.leftJoin(
			scalingLevelsTable,
			eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
		)
		.where(
			and(
				inArray(competitionRegistrationsTable.eventId, primaryCompIds),
				inArray(competitionRegistrationsTable.status, ["active"]),
				...(params.divisionId
					? [eq(competitionRegistrationsTable.divisionId, params.divisionId)]
					: []),
			),
		)
		// Deterministic ordering ensures consistent deduplication when an athlete
		// appears in multiple comps (we keep the first one seen)
		.orderBy(competitionsTable.id)

	if (allRegistrations.length === 0) {
		return {
			entries: [],
			scoringConfig,
			seriesEvents,
			divisionHealth,
			availableDivisions,
		}
	}

	// 8. Deduplicate: per (userId, divisionId) keep one entry
	// If an athlete appears in multiple comps, keep the first one we see
	const athleteKey = (userId: string, divisionId: string | null) =>
		`${userId}::${divisionId ?? "open"}`

	const seenAthletes = new Set<string>()
	const dedupedRegistrations: typeof allRegistrations = []
	for (const reg of allRegistrations) {
		const key = athleteKey(reg.user.id, reg.registration.divisionId)
		if (!seenAthletes.has(key)) {
			seenAthletes.add(key)
			dedupedRegistrations.push(reg)
		}
	}

	const allUserIds = Array.from(
		new Set<string>(dedupedRegistrations.map((r) => r.user.id)),
	)

	// 9. Load all scores for these track workouts and users
	const allScores = await db
		.select({
			id: scoresTable.id,
			userId: scoresTable.userId,
			competitionEventId: scoresTable.competitionEventId,
			scheme: scoresTable.scheme,
			scoreValue: scoresTable.scoreValue,
			tiebreakScheme: scoresTable.tiebreakScheme,
			tiebreakValue: scoresTable.tiebreakValue,
			status: scoresTable.status,
			sortKey: scoresTable.sortKey,
			timeCapMs: scoresTable.timeCapMs,
			secondaryValue: scoresTable.secondaryValue,
		})
		.from(scoresTable)
		.where(
			and(
				inArray(scoresTable.competitionEventId, allTrackWorkoutIds),
				inArray(scoresTable.userId, allUserIds),
			),
		)

	// 10. Build leaderboard map: athleteKey → SeriesLeaderboardEntry
	const leaderboardMap = new Map<string, SeriesLeaderboardEntry>()

	for (const reg of dedupedRegistrations) {
		const fullName =
			`${reg.user.firstName || ""} ${reg.user.lastName || ""}`.trim()
		const divisionId = reg.registration.divisionId ?? "open"
		const key = athleteKey(reg.user.id, reg.registration.divisionId)

		leaderboardMap.set(key, {
			userId: reg.user.id,
			athleteName: fullName || reg.user.email || "Unknown",
			divisionId,
			divisionLabel: reg.division?.label ?? "Open",
			competitionId: reg.competitionId,
			competitionName: reg.competitionName,
			totalPoints: 0,
			overallRank: 0,
			isTeamDivision: (reg.division?.teamSize ?? 1) > 1,
			teamName: reg.registration.teamName,
			eventResults: [],
		})
	}

	// 11. For each series event (shared workoutId), compute global rankings
	for (const workoutId of uniqueWorkoutIds) {
		const tws = workoutIdToTrackWorkouts.get(workoutId) ?? []
		const twIds = tws.map((tw) => tw.id)
		const sampleTw = tws[0]
		if (!sampleTw) continue

		const scheme = sampleTw.workout.scheme as WorkoutScheme
		const scoreType =
			sampleTw.workout.scoreType || getDefaultScoreType(sampleTw.workout.scheme)

		// Pool scores from all primary comps for this workout
		const eventScores = allScores.filter((s) =>
			twIds.includes(s.competitionEventId ?? ""),
		)

		// Map from userId to score
		const userScoreMap = new Map<string, (typeof eventScores)[number]>()
		for (const score of eventScores) {
			userScoreMap.set(score.userId, score)
		}

		// Group by divisionId
		const divisionScores = new Map<string, EventScoreInput[]>()
		for (const reg of dedupedRegistrations) {
			const divId = reg.registration.divisionId ?? "open"
			const score = userScoreMap.get(reg.user.id)
			const input: EventScoreInput = score
				? {
						userId: reg.user.id,
						value: score.scoreValue ?? 0,
						status: mapScoreStatus(score.status),
						sortKey: score.sortKey,
					}
				: {
						userId: reg.user.id,
						value: 0,
						status: "dns",
						sortKey: null,
					}

			const existing = divisionScores.get(divId) ?? []
			existing.push(input)
			divisionScores.set(divId, existing)
		}

		// Calculate points per division globally
		for (const [divId, inputs] of Array.from(divisionScores.entries())) {
			const pointsMap = calculateEventPoints(
				workoutId,
				inputs,
				scheme,
				scoringConfig,
			)

			for (const reg of dedupedRegistrations) {
				if ((reg.registration.divisionId ?? "open") !== divId) continue

				const key = athleteKey(reg.user.id, reg.registration.divisionId)
				const entry = leaderboardMap.get(key)
				if (!entry) continue

				const pointsResult = pointsMap.get(reg.user.id)
				const rank = pointsResult?.rank ?? 0
				const points = pointsResult?.points ?? 0

				const rawScore = userScoreMap.get(reg.user.id)
				let formattedScore = "—"
				let formattedTiebreak: string | null = null

				if (rawScore && rawScore.scoreValue !== null) {
					const scoreObj: Parameters<typeof formatScore>[0] = {
						scheme: rawScore.scheme as WorkoutScheme,
						scoreType,
						value: rawScore.scoreValue,
						status: rawScore.status as "scored" | "cap" | "dq" | "withdrawn",
					}
					if (rawScore.tiebreakValue !== null && rawScore.tiebreakScheme) {
						scoreObj.tiebreak = {
							scheme: rawScore.tiebreakScheme as "reps" | "time",
							value: rawScore.tiebreakValue,
						}
						formattedTiebreak = decodeScore(
							rawScore.tiebreakValue,
							rawScore.tiebreakScheme as WorkoutScheme,
							{ compact: true },
						)
					}
					if (rawScore.timeCapMs && rawScore.secondaryValue !== null) {
						scoreObj.timeCap = {
							ms: rawScore.timeCapMs,
							secondaryValue: rawScore.secondaryValue,
						}
					}
					formattedScore = formatScore(scoreObj, { compact: true })
				}

				entry.eventResults.push({
					workoutId,
					eventName: sampleTw.workout.name,
					scheme: sampleTw.workout.scheme,
					rank,
					points,
					formattedScore,
					formattedTiebreak,
				})
				entry.totalPoints += points
			}
		}

		// Add empty results for athletes who have no entry for this event
		for (const [_key, entry] of Array.from(leaderboardMap.entries())) {
			const hasResult = entry.eventResults.some(
				(er) => er.workoutId === workoutId,
			)
			if (!hasResult) {
				entry.eventResults.push({
					workoutId,
					eventName: sampleTw.workout.name,
					scheme: sampleTw.workout.scheme,
					rank: 0,
					points: 0,
					formattedScore: "—",
					formattedTiebreak: null,
				})
			}
		}
	}

	// 12. Group by division, apply tiebreakers, assign overallRank
	const divisionGroups = new Map<string, SeriesLeaderboardEntry[]>()
	for (const entry of Array.from(leaderboardMap.values())) {
		const existing = divisionGroups.get(entry.divisionId) ?? []
		existing.push(entry)
		divisionGroups.set(entry.divisionId, existing)
	}

	for (const [_divId, entries] of Array.from(divisionGroups.entries())) {
		const tiebreakerInput: TiebreakerInput = {
			athletes: entries.map((e) => ({
				userId: e.userId,
				totalPoints: e.totalPoints,
				eventPlacements: new Map(
					e.eventResults
						.filter((er) => er.rank > 0)
						.map((er) => [er.workoutId, er.rank]),
				),
			})),
			config: scoringConfig.tiebreaker,
			scoringAlgorithm: scoringConfig.algorithm,
		}

		const ranked = applyTiebreakers(tiebreakerInput)
		for (const r of ranked) {
			const entry = entries.find((e) => e.userId === r.userId)
			if (entry) entry.overallRank = r.rank
		}
	}

	// Sort: by divisionId then overallRank
	const sortedEntries = Array.from(leaderboardMap.values()).sort((a, b) => {
		if (a.divisionId !== b.divisionId)
			return a.divisionId.localeCompare(b.divisionId)
		return a.overallRank - b.overallRank
	})

	return {
		entries: sortedEntries,
		scoringConfig,
		seriesEvents,
		divisionHealth,
		availableDivisions,
	}
}
