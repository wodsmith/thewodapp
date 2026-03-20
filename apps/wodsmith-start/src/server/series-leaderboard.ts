/**
 * Series Global Leaderboard Server Logic
 *
 * Computes a global leaderboard across all competitions in a series group.
 * Athletes from different throwdowns are ranked together by their raw performance
 * on the same shared workouts (matched by workoutId across comps).
 *
 * Uses series_division_mappings to translate each registration's divisionId
 * to a series-level division, allowing competitions with different scaling groups
 * to participate in the same leaderboard.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm"
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
import { seriesDivisionMappingsTable } from "@/db/schemas/series"
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
  divisionId: string // series template scalingLevelId
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

export interface SeriesLeaderboardResult {
  entries: SeriesLeaderboardEntry[]
  scoringConfig: ScoringConfig
  seriesEvents: Array<{ workoutId: string; name: string; scheme: string }>
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
  const templateGroupId = seriesSettings?.scalingGroupId

  const emptyResult: SeriesLeaderboardResult = {
    entries: [],
    scoringConfig,
    seriesEvents: [],
    availableDivisions: [],
  }

  // If no template is configured, no leaderboard is possible
  if (!templateGroupId) {
    return emptyResult
  }

  // 2. Load series template divisions
  const templateLevels = await db
    .select({
      id: scalingLevelsTable.id,
      label: scalingLevelsTable.label,
      position: scalingLevelsTable.position,
      teamSize: scalingLevelsTable.teamSize,
    })
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.scalingGroupId, templateGroupId))
    .orderBy(scalingLevelsTable.position)

  const availableDivisions = templateLevels.map((l) => ({
    id: l.id,
    label: l.label,
  }))

  const templateDivisionMap = new Map(templateLevels.map((l) => [l.id, l]))

  // 3. Load all competitions in this group
  const comps = await db
    .select({ id: competitionsTable.id, name: competitionsTable.name })
    .from(competitionsTable)
    .where(eq(competitionsTable.groupId, params.groupId))

  if (comps.length === 0) {
    return { ...emptyResult, availableDivisions }
  }

  const compIds = comps.map((c) => c.id)

  // 4. Load division mappings for this series
  const mappings = await db
    .select()
    .from(seriesDivisionMappingsTable)
    .where(eq(seriesDivisionMappingsTable.groupId, params.groupId))

  if (mappings.length === 0) {
    return { ...emptyResult, availableDivisions }
  }

  // Build lookup: competitionDivisionId → seriesDivisionId
  const divisionMappingLookup = new Map<string, string>()
  const mappedCompIds = new Set<string>()
  for (const m of mappings) {
    divisionMappingLookup.set(m.competitionDivisionId, m.seriesDivisionId)
    mappedCompIds.add(m.competitionId)
  }

  // Only include competitions that have at least one mapping
  const participatingCompIds = compIds.filter((id) => mappedCompIds.has(id))
  if (participatingCompIds.length === 0) {
    return { ...emptyResult, availableDivisions }
  }

  // 5. Load programming tracks for participating comps
  const tracks = await db
    .select({
      id: programmingTracksTable.id,
      competitionId: programmingTracksTable.competitionId,
    })
    .from(programmingTracksTable)
    .where(
      and(
        inArray(programmingTracksTable.competitionId, participatingCompIds),
        isNotNull(programmingTracksTable.competitionId),
      ),
    )

  if (tracks.length === 0) {
    return { ...emptyResult, availableDivisions }
  }

  const trackIds = tracks.map((t) => t.id)

  // 6. Load all published track workouts, joining workout data
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

  // 7. Build workoutId → trackWorkouts map (series event groups)
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
    if (tw.trackOrder < current)
      seriesEventOrder.set(tw.workoutId, tw.trackOrder)
  }

  const uniqueWorkoutIds = Array.from(workoutIdToTrackWorkouts.keys()).sort(
    (a, b) => (seriesEventOrder.get(a) ?? 0) - (seriesEventOrder.get(b) ?? 0),
  )

  const seriesEvents = uniqueWorkoutIds.map((wId) => {
    const tw = workoutIdToTrackWorkouts.get(wId)![0]
    return {
      workoutId: wId,
      name: tw.workout.name,
      scheme: tw.workout.scheme,
    }
  })

  const allTrackWorkoutIds = allTrackWorkouts.map((tw) => tw.id)

  // 8. Load registrations from participating comps
  // Filter by series division if specified (we need to check via mapping)
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
        inArray(competitionRegistrationsTable.eventId, participatingCompIds),
        inArray(competitionRegistrationsTable.status, ["active"]),
      ),
    )
    .orderBy(competitionsTable.id)

  if (allRegistrations.length === 0) {
    return { ...emptyResult, availableDivisions, seriesEvents }
  }

  // 9. Filter registrations to only those with mapped divisions,
  // and translate to series division IDs
  type EnrichedRegistration = (typeof allRegistrations)[number] & {
    seriesDivisionId: string
    seriesDivisionLabel: string
    seriesDivisionTeamSize: number
  }
  const mappedRegistrations: EnrichedRegistration[] = []

  for (const reg of allRegistrations) {
    const compDivId = reg.registration.divisionId
    if (!compDivId) continue

    const seriesDivId = divisionMappingLookup.get(compDivId)
    if (!seriesDivId) continue // Unmapped division — excluded

    // If filtering by series division, check here
    if (params.divisionId && seriesDivId !== params.divisionId) continue

    const seriesDiv = templateDivisionMap.get(seriesDivId)
    if (!seriesDiv) continue

    mappedRegistrations.push({
      ...reg,
      seriesDivisionId: seriesDivId,
      seriesDivisionLabel: seriesDiv.label,
      seriesDivisionTeamSize: seriesDiv.teamSize,
    })
  }

  if (mappedRegistrations.length === 0) {
    return { ...emptyResult, availableDivisions, seriesEvents }
  }

  // 10. Deduplicate: per (userId, seriesDivisionId) keep one entry
  const athleteKey = (userId: string, seriesDivisionId: string) =>
    `${userId}::${seriesDivisionId}`

  const seenAthletes = new Set<string>()
  const dedupedRegistrations: EnrichedRegistration[] = []
  for (const reg of mappedRegistrations) {
    const key = athleteKey(reg.user.id, reg.seriesDivisionId)
    if (!seenAthletes.has(key)) {
      seenAthletes.add(key)
      dedupedRegistrations.push(reg)
    }
  }

  const allUserIds = Array.from(
    new Set<string>(dedupedRegistrations.map((r) => r.user.id)),
  )

  // 11. Load all scores for these track workouts and users
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

  // 12. Build leaderboard map: athleteKey → SeriesLeaderboardEntry
  const leaderboardMap = new Map<string, SeriesLeaderboardEntry>()

  for (const reg of dedupedRegistrations) {
    const fullName =
      `${reg.user.firstName || ""} ${reg.user.lastName || ""}`.trim()
    const key = athleteKey(reg.user.id, reg.seriesDivisionId)

    leaderboardMap.set(key, {
      userId: reg.user.id,
      athleteName: fullName || reg.user.email || "Unknown",
      divisionId: reg.seriesDivisionId,
      divisionLabel: reg.seriesDivisionLabel,
      competitionId: reg.competitionId,
      competitionName: reg.competitionName,
      totalPoints: 0,
      overallRank: 0,
      isTeamDivision: reg.seriesDivisionTeamSize > 1,
      teamName: reg.registration.teamName,
      eventResults: [],
    })
  }

  // 13. For each series event (shared workoutId), compute global rankings
  for (const workoutId of uniqueWorkoutIds) {
    const tws = workoutIdToTrackWorkouts.get(workoutId) ?? []
    const twIds = tws.map((tw) => tw.id)
    const sampleTw = tws[0]
    if (!sampleTw) continue

    const scheme = sampleTw.workout.scheme as WorkoutScheme
    const scoreType =
      sampleTw.workout.scoreType || getDefaultScoreType(sampleTw.workout.scheme)

    // Pool scores from all participating comps for this workout
    const eventScores = allScores.filter((s) =>
      twIds.includes(s.competitionEventId ?? ""),
    )

    // Map from userId to score
    const userScoreMap = new Map<string, (typeof eventScores)[number]>()
    for (const score of eventScores) {
      userScoreMap.set(score.userId, score)
    }

    // Group by series divisionId
    const divisionScores = new Map<string, EventScoreInput[]>()
    for (const reg of dedupedRegistrations) {
      const divId = reg.seriesDivisionId
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
        if (reg.seriesDivisionId !== divId) continue

        const key = athleteKey(reg.user.id, reg.seriesDivisionId)
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

  // 14. Group by division, apply tiebreakers, assign overallRank
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
    availableDivisions,
  }
}
