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

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm"
import { getDb } from "@/db"
import { logInfo, logWarning } from "@/lib/logging"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { eventDivisionMappingsTable } from "@/db/schemas/event-division-mappings"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import {
  type ReviewStatus,
  videoSubmissionsTable,
} from "@/db/schemas/video-submissions"
import { workouts } from "@/db/schemas/workouts"
import {
  calculateEventPoints,
  calculatePointsForPlace,
  computeSortKey,
  DEFAULT_SCORING_CONFIG,
  decodeScore,
  type EventScoreInput,
  formatScore,
  getDefaultScoreType,
  isTimeBasedScheme,
  sortKeyToString,
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
import { getAffiliate } from "@/utils/registration-metadata"

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
  /** Affiliate/gym name from registration metadata */
  affiliate: string | null
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
    /** Penalty info if score was adjusted */
    penaltyType: "minor" | "major" | null
    penaltyPercentage: number | null
    /** Whether score was directly modified (adjusted without penalty) */
    isDirectlyModified: boolean
    /** Video submission URL (online competitions only) */
    videoUrl: string | null
    /** Video submission ID for voting (online competitions only) */
    videoSubmissionId: string | null
    /** Parent event ID if this is a sub-event, null for standalone/parent */
    parentEventId: string | null
    /** Parent event name if this is a sub-event, null for standalone */
    parentEventName: string | null
    /** True if this is a parent event with aggregated sub-event points */
    isParentEvent: boolean
    /** Number of individual rounds marked as capped (0 for single-round or none) */
    cappedRoundCount: number
    /** Total number of rounds persisted for this score (0 for single-round) */
    totalRoundCount: number
    /**
     * Aggregate review status across all video submissions for this event.
     * Partner/team divisions can have multiple videos (one per teammate);
     * the summary collapses them so the leaderboard cell can render a single
     * indicator. `null` when the registration has no submission rows for this
     * event yet.
     */
    reviewSummary: EventReviewSummary | null
  }>
}

/**
 * Aggregate of every video submission a registration has uploaded for a
 * single event. Powers the per-cell review indicator on the organizer
 * leaderboard preview — individual divisions resolve to one video, partner
 * divisions to N (one per teammate).
 */
export interface EventReviewSummary {
  /** Number of video rows that exist for this (registration, event). */
  totalSubmitted: number
  /** Expected video count = division `teamSize` (1 for individual). */
  expectedVideos: number
  /**
   * Count of submissions in a terminal review state — anything other than
   * `pending` or `under_review`. An organizer reading the leaderboard can
   * scan this against `totalSubmitted` to see what's still outstanding.
   */
  reviewedCount: number
  /** Distinct review statuses present across submissions, deduped. */
  statuses: ReviewStatus[]
  /**
   * The single status to surface when collapsing to one badge — picks the
   * highest-priority status across all submissions (see `REVIEW_STATUS_PRIORITY`).
   * Bias toward statuses that need organizer attention (pending > verified).
   */
  worstStatus: ReviewStatus
}

/** Round-cap summary for a single score */
interface RoundCapSummary {
  cappedRoundCount: number
  totalRoundCount: number
}

/**
 * Priority ordering used to collapse multiple review statuses into a single
 * "worst" status for the leaderboard cell indicator. Higher number = more
 * organizer attention required, so it wins. `pending` outranks any reviewed
 * status because an unreviewed video on a partner team is the actionable
 * state the organizer cares about even if the captain's video is verified.
 */
const REVIEW_STATUS_PRIORITY: Record<ReviewStatus, number> = {
  pending: 6,
  under_review: 5,
  invalid: 4,
  penalized: 3,
  adjusted: 2,
  verified: 1,
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
  events: Array<{
    trackWorkoutId: string
    name: string
    parentEventId: string | null
    parentEventName: string | null
    isParentEvent: boolean
  }>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch scores from the scores table.
 *
 * In preview mode, we return every score regardless of `verificationStatus`
 * (including `"invalid"`) so organizers can see the full raw picture. The
 * verification status comes back on each entry so the UI can flag it.
 * The public path still excludes invalidated scores.
 */
async function fetchScores(params: {
  trackWorkoutIds: string[]
  userIds: string[]
  includeInvalid?: boolean
}) {
  const db = getDb()

  const scores = await db
    .select({
      id: scoresTable.id,
      userId: scoresTable.userId,
      competitionEventId: scoresTable.competitionEventId,
      scalingLevelId: scoresTable.scalingLevelId,
      scheme: scoresTable.scheme,
      scoreValue: scoresTable.scoreValue,
      tiebreakScheme: scoresTable.tiebreakScheme,
      tiebreakValue: scoresTable.tiebreakValue,
      status: scoresTable.status,
      statusOrder: scoresTable.statusOrder,
      sortKey: scoresTable.sortKey,
      secondaryValue: scoresTable.secondaryValue,
      timeCapMs: scoresTable.timeCapMs,
      verificationStatus: scoresTable.verificationStatus,
      penaltyType: scoresTable.penaltyType,
      penaltyPercentage: scoresTable.penaltyPercentage,
      scalingLevelId: scoresTable.scalingLevelId,
    })
    .from(scoresTable)
    .where(
      params.includeInvalid
        ? and(
            inArray(scoresTable.competitionEventId, params.trackWorkoutIds),
            inArray(scoresTable.userId, params.userIds),
          )
        : and(
            inArray(scoresTable.competitionEventId, params.trackWorkoutIds),
            inArray(scoresTable.userId, params.userIds),
            // Exclude invalidated scores from leaderboard
            or(
              isNull(scoresTable.verificationStatus),
              ne(scoresTable.verificationStatus, "invalid"),
            ),
          ),
    )

  return scores
}

/**
 * For each score id, count how many rounds were persisted and how many
 * of those carry `status = "cap"`. Drives two things at once:
 *
 * 1. The capped-rounds badge on multi-round leaderboard scores (without
 *    shipping the full round payload to the client).
 * 2. The in-flight `computeSortKey` recomputation below, which uses
 *    `cappedRoundCount` as a dominant tiebreaker inside the cap bucket
 *    ("fewer caps beats more caps").
 */
async function fetchRoundCapSummaries(
  scoreIds: string[],
): Promise<Map<string, RoundCapSummary>> {
  const summaries = new Map<string, RoundCapSummary>()
  if (scoreIds.length === 0) return summaries

  const db = getDb()
  const rows = await db
    .select({
      scoreId: scoreRoundsTable.scoreId,
      status: scoreRoundsTable.status,
    })
    .from(scoreRoundsTable)
    .where(inArray(scoreRoundsTable.scoreId, scoreIds))

  for (const row of rows) {
    const existing = summaries.get(row.scoreId) ?? {
      cappedRoundCount: 0,
      totalRoundCount: 0,
    }
    existing.totalRoundCount += 1
    if (row.status === "cap") existing.cappedRoundCount += 1
    summaries.set(row.scoreId, existing)
  }

  return summaries
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
 * 2. A mixed heat (divisionId=null) has at least one assignment from that division
 *
 * Returns null if no heats exist (backward compat: show all workouts).
 */
export function getRelevantWorkoutIds(params: {
  heats: HeatInfo[]
  mixedHeatAssignments: HeatAssignmentInfo[]
  divisionId: string
}): Set<string> | null {
  if (params.heats.length === 0) return null

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
  /**
   * When true, skip both the event-visibility (`eventStatus`) filter and
   * the per-division `divisionResults` publishing filter — include every
   * track workout and score regardless of publish state. Used by the
   * organizer leaderboard preview so organizers can see aggregated
   * standings before publishing events to athletes. Must be authorized at
   * the caller layer — this function does not enforce organizer permissions.
   */
  bypassPublicationFilter?: boolean
}): Promise<CompetitionLeaderboardResult> {
  const db = getDb()

  logInfo({
    message: "[Leaderboard] getCompetitionLeaderboard start",
    attributes: {
      competitionId: params.competitionId,
      divisionId: params.divisionId ?? null,
      bypassPublicationFilter: params.bypassPublicationFilter === true,
    },
  })

  // Get competition with settings
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, params.competitionId),
  })

  if (!competition) {
    logWarning({
      message: "[Leaderboard] Competition not found",
      attributes: { competitionId: params.competitionId },
    })
    throw new Error("Competition not found")
  }

  // Parse settings and get scoring config
  const settings = parseCompetitionSettings(competition.settings)
  const scoringConfig =
    getEffectiveScoringConfig(settings) ?? DEFAULT_SCORING_CONFIG

  // Division results publishing state — controls leaderboard visibility.
  // For online competitions, default to empty (everything hidden until explicitly published).
  // For in-person competitions, absent divisionResults means show all (backwards compat).
  // When `bypassPublicationFilter` is set, we treat divisionResults as undefined so
  // every score is included (used by the organizer preview).
  const divisionResults = params.bypassPublicationFilter
    ? undefined
    : (settings?.divisionResults ??
      (competition.competitionType === "online" ? {} : undefined))

  logInfo({
    message: "[Leaderboard] Publication gates",
    attributes: {
      competitionId: params.competitionId,
      bypassPublicationFilter: params.bypassPublicationFilter === true,
      competitionType: competition.competitionType,
      hasDivisionResultsSetting: !!settings?.divisionResults,
      divisionResultsActive: !!divisionResults,
    },
  })

  // Get competition track
  const track = await getCompetitionTrack(params.competitionId)
  if (!track) {
    logWarning({
      message: "[Leaderboard] No programming track for competition",
      attributes: { competitionId: params.competitionId },
    })
    return { entries: [], scoringConfig, events: [] }
  }

  // Get all track workouts for this competition.
  // In preview mode, include draft events too — organizers can enter scores
  // on draft events and need to see them before publishing.
  const trackWorkouts = await db
    .select({
      id: trackWorkoutsTable.id,
      trackOrder: trackWorkoutsTable.trackOrder,
      pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
      workoutId: trackWorkoutsTable.workoutId,
      parentEventId: trackWorkoutsTable.parentEventId,
      eventStatus: trackWorkoutsTable.eventStatus,
      workout: workouts,
    })
    .from(trackWorkoutsTable)
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(
      params.bypassPublicationFilter
        ? eq(trackWorkoutsTable.trackId, track.id)
        : and(
            eq(trackWorkoutsTable.trackId, track.id),
            eq(trackWorkoutsTable.eventStatus, "published"),
          ),
    )
    .orderBy(trackWorkoutsTable.trackOrder)

  const draftTrackWorkouts = trackWorkouts.filter(
    (tw) => tw.eventStatus !== "published",
  ).length

  logInfo({
    message: "[Leaderboard] Track workouts loaded",
    attributes: {
      competitionId: params.competitionId,
      trackId: track.id,
      trackWorkoutCount: trackWorkouts.length,
      // Preview includes draft events — count separately so we know if this
      // pathway is pulling in draft events that the public query would skip
      draftEventsIncluded: params.bypassPublicationFilter
        ? draftTrackWorkouts
        : 0,
    },
  })

  if (trackWorkouts.length === 0) {
    logWarning({
      message: "[Leaderboard] No track workouts match filters",
      attributes: {
        competitionId: params.competitionId,
        trackId: track.id,
        bypassPublicationFilter: params.bypassPublicationFilter === true,
      },
    })
    return { entries: [], scoringConfig, events: [] }
  }

  // Filter workouts by division when a division is selected.
  // Two filtering mechanisms (event-division mappings take priority over heats):
  // 1. Event-division mappings: explicit organizer-configured event↔division assignments
  // 2. Heat-based filtering: fallback using heat assignments when no explicit mappings exist
  let filteredTrackWorkouts = trackWorkouts
  if (params.divisionId) {
    // Check for explicit event-division mappings first
    let eventDivisionMappings: Array<{ trackWorkoutId: string }> = []
    try {
      eventDivisionMappings = await db
        .select({
          trackWorkoutId: eventDivisionMappingsTable.trackWorkoutId,
        })
        .from(eventDivisionMappingsTable)
        .where(
          eq(eventDivisionMappingsTable.competitionId, params.competitionId),
        )
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string | number }).code === "ER_NO_SUCH_TABLE"
      ) {
        // Table may not exist yet — skip mapping-based filtering
      } else {
        throw error
      }
    }

    if (eventDivisionMappings.length > 0) {
      // Mappings exist — filter to events mapped to this division
      const mappedToDiv = await db
        .select({
          trackWorkoutId: eventDivisionMappingsTable.trackWorkoutId,
        })
        .from(eventDivisionMappingsTable)
        .where(
          and(
            eq(eventDivisionMappingsTable.competitionId, params.competitionId),
            eq(eventDivisionMappingsTable.divisionId, params.divisionId),
          ),
        )

      const mappedToSelectedDiv = new Set(
        mappedToDiv.map((m) => m.trackWorkoutId),
      )
      const allMappedEventIds = new Set(
        eventDivisionMappings.map((m) => m.trackWorkoutId),
      )

      // Only filter events that have explicit mappings; unmapped events stay visible
      filteredTrackWorkouts = trackWorkouts.filter((tw) => {
        const hasMapping =
          allMappedEventIds.has(tw.id) ||
          (tw.parentEventId && allMappedEventIds.has(tw.parentEventId))
        if (!hasMapping) return true // unmapped → visible to all
        return (
          mappedToSelectedDiv.has(tw.id) ||
          (tw.parentEventId && mappedToSelectedDiv.has(tw.parentEventId))
        )
      })
    } else {
      // No explicit mappings — fall back to heat-based filtering
      const trackWorkoutIds = trackWorkouts.map((tw) => tw.id)
      const heatsForWorkouts = await db
        .select({
          id: competitionHeatsTable.id,
          trackWorkoutId: competitionHeatsTable.trackWorkoutId,
          divisionId: competitionHeatsTable.divisionId,
        })
        .from(competitionHeatsTable)
        .where(inArray(competitionHeatsTable.trackWorkoutId, trackWorkoutIds))

      // Fetch assignments for mixed heats (divisionId=null)
      const mixedHeatIds = heatsForWorkouts
        .filter((h) => h.divisionId === null)
        .map((h) => h.id)

      const mixedHeatAssignments =
        mixedHeatIds.length > 0
          ? await db
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
                and(
                  inArray(
                    competitionHeatAssignmentsTable.heatId,
                    mixedHeatIds,
                  ),
                  ne(
                    competitionRegistrationsTable.status,
                    REGISTRATION_STATUS.REMOVED,
                  ),
                ),
              )
          : []

      const relevantIds = getRelevantWorkoutIds({
        heats: heatsForWorkouts,
        mixedHeatAssignments,
        divisionId: params.divisionId,
      })

      if (relevantIds) {
        // Also include child events whose parent is relevant (children inherit parent's heat relevance)
        filteredTrackWorkouts = trackWorkouts.filter(
          (tw) =>
            relevantIds.has(tw.id) ||
            (tw.parentEventId && relevantIds.has(tw.parentEventId)),
        )

        if (filteredTrackWorkouts.length === 0) {
          return { entries: [], scoringConfig, events: [] }
        }
      }
    }
  }

  // Partition track workouts into parents, children, and standalone events.
  // Parent = has children referencing it. Child = has parentEventId. Standalone = neither.
  const childEventIds = new Set(
    filteredTrackWorkouts
      .filter((tw) => tw.parentEventId)
      .map((tw) => tw.parentEventId as string),
  )
  // Build a map of parent event names for sub-event grouping on the leaderboard
  // Use unfiltered trackWorkouts so division filtering doesn't drop parent names
  const parentNameMap = new Map<string, string>()
  for (const tw of trackWorkouts) {
    if (childEventIds.has(tw.id)) {
      parentNameMap.set(tw.id, tw.workout.name)
    }
  }

  // Scorable events = standalone + children (parents have no scores of their own)
  const scorableEvents = filteredTrackWorkouts.filter(
    (tw) => !childEventIds.has(tw.id),
  )

  logInfo({
    message: "[Leaderboard] Event filtering complete",
    attributes: {
      competitionId: params.competitionId,
      divisionId: params.divisionId ?? null,
      trackWorkoutCount: trackWorkouts.length,
      filteredTrackWorkoutCount: filteredTrackWorkouts.length,
      scorableEventCount: scorableEvents.length,
      parentEventCount: childEventIds.size,
    },
  })

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
    .where(
      and(
        eq(competitionRegistrationsTable.eventId, params.competitionId),
        ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
      ),
    )

  if (registrations.length === 0) {
    // Build parent name map for sub-event grouping
    const earlyParentNameMap = new Map<string, string>()
    for (const tw of trackWorkouts) {
      if (childEventIds.has(tw.id)) {
        earlyParentNameMap.set(tw.id, tw.workout.name)
      }
    }
    const events = filteredTrackWorkouts
      .filter((tw) => !childEventIds.has(tw.id))
      .map((tw) => ({
        trackWorkoutId: tw.id,
        name: tw.workout.name,
        parentEventId: tw.parentEventId,
        parentEventName: tw.parentEventId
          ? (earlyParentNameMap.get(tw.parentEventId) ?? null)
          : null,
        isParentEvent: false,
      }))
    logWarning({
      message: "[Leaderboard] No registrations for competition",
      attributes: {
        competitionId: params.competitionId,
        divisionId: params.divisionId ?? null,
      },
    })
    return { entries: [], scoringConfig, events }
  }

  // Filter by division if specified
  const filteredRegistrations = params.divisionId
    ? registrations.filter(
        (r) => r.registration.divisionId === params.divisionId,
      )
    : registrations

  logInfo({
    message: "[Leaderboard] Registrations loaded",
    attributes: {
      competitionId: params.competitionId,
      divisionId: params.divisionId ?? null,
      totalRegistrations: registrations.length,
      filteredRegistrations: filteredRegistrations.length,
    },
  })

  // Get team members for team registrations
  const athleteTeamIds = filteredRegistrations
    .filter(
      (r) => r.registration.athleteTeamId && (r.division?.teamSize ?? 1) > 1,
    )
    .map((r) => r.registration.athleteTeamId as string)

  const allTeamMemberships =
    athleteTeamIds.length > 0
      ? await db
          .select({
            membership: teamMembershipTable,
            user: userTable,
          })
          .from(teamMembershipTable)
          .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
          .where(
            and(
              inArray(teamMembershipTable.teamId, athleteTeamIds),
              eq(teamMembershipTable.isActive, true),
            ),
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

  const allScores = await fetchScores({
    trackWorkoutIds,
    userIds,
    includeInvalid: params.bypassPublicationFilter === true,
  })
  const roundCapSummariesByScoreId = await fetchRoundCapSummaries(
    allScores.map((s) => s.id),
  )

  // Breakdown so we can see what the raw scores actually look like:
  // status tells us whether points get computed (only "scored"/"cap" earn
  // points in online scoring — "dns"/"dnf"/etc. are treated as inactive).
  // verificationStatus tells us review state (null = unreviewed).
  const statusBreakdown = allScores.reduce<Record<string, number>>(
    (acc, s) => {
      const key = s.status ?? "null"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    {},
  )
  const verificationBreakdown = allScores.reduce<Record<string, number>>(
    (acc, s) => {
      const key = s.verificationStatus ?? "null"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    {},
  )

  logInfo({
    message: "[Leaderboard] Scores fetched",
    attributes: {
      competitionId: params.competitionId,
      divisionId: params.divisionId ?? null,
      trackWorkoutCount: trackWorkoutIds.length,
      userCount: userIds.length,
      scoreCount: allScores.length,
      scoresByStatus: statusBreakdown,
      scoresByVerificationStatus: verificationBreakdown,
      includedInvalid: params.bypassPublicationFilter === true,
    },
  })

  // Fetch video submissions for online competitions
  const registrationIds = filteredRegistrations.map((r) => r.registration.id)
  const videoSubmissions =
    competition.competitionType === "online" && registrationIds.length > 0
      ? await db
          .select({
            id: videoSubmissionsTable.id,
            registrationId: videoSubmissionsTable.registrationId,
            trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
            videoUrl: videoSubmissionsTable.videoUrl,
            videoIndex: videoSubmissionsTable.videoIndex,
            reviewStatus: videoSubmissionsTable.reviewStatus,
          })
          .from(videoSubmissionsTable)
          .where(inArray(videoSubmissionsTable.registrationId, registrationIds))
      : []

  // Index video submissions by registrationId+trackWorkoutId for fast lookup.
  // Two indexes are kept side by side:
  // - `videoMap` returns a single representative (lowest videoIndex first, so
  //   the captain's video is preferred) for the existing url/submissionId
  //   accessors.
  // - `videoSubmissionsByKey` keeps the full list per (registration, event)
  //   so we can build a `reviewSummary` covering every teammate's video.
  const videoMap = new Map<string, { url: string; submissionId: string }>()
  const videoSubmissionsByKey = new Map<
    string,
    Array<{ id: string; videoIndex: number; reviewStatus: ReviewStatus }>
  >()
  // Sort so videoIndex 0 (captain) is the representative entry in `videoMap`.
  const sortedVideoSubmissions = [...videoSubmissions].sort(
    (a, b) => a.videoIndex - b.videoIndex,
  )
  for (const vs of sortedVideoSubmissions) {
    const key = `${vs.registrationId}:${vs.trackWorkoutId}`
    if (!videoMap.has(key)) {
      videoMap.set(key, {
        url: vs.videoUrl,
        submissionId: vs.id,
      })
    }
    const list = videoSubmissionsByKey.get(key) ?? []
    list.push({
      id: vs.id,
      videoIndex: vs.videoIndex,
      reviewStatus: vs.reviewStatus as ReviewStatus,
    })
    videoSubmissionsByKey.set(key, list)
  }

  // teamSize lookup per registration so we can compute "expected videos"
  // for partner divisions when building the per-cell review summary.
  const teamSizeByRegistrationId = new Map<string, number>()
  for (const reg of filteredRegistrations) {
    teamSizeByRegistrationId.set(
      reg.registration.id,
      reg.division?.teamSize ?? 1,
    )
  }

  /**
   * Collapse the set of submissions for a (registration, event) into a single
   * `reviewSummary`. Returns `null` when the registration has no rows for
   * this event so the UI can fall back to "no submission yet".
   */
  function buildReviewSummary(
    registrationId: string,
    trackWorkoutId: string,
  ): EventReviewSummary | null {
    const submissions = videoSubmissionsByKey.get(
      `${registrationId}:${trackWorkoutId}`,
    )
    if (!submissions || submissions.length === 0) return null

    const expectedVideos = teamSizeByRegistrationId.get(registrationId) ?? 1
    const statusSet = new Set<ReviewStatus>()
    let reviewedCount = 0
    let worst: ReviewStatus = submissions[0].reviewStatus

    for (const sub of submissions) {
      statusSet.add(sub.reviewStatus)
      if (sub.reviewStatus !== "pending" && sub.reviewStatus !== "under_review") {
        reviewedCount++
      }
      if (
        REVIEW_STATUS_PRIORITY[sub.reviewStatus] >
        REVIEW_STATUS_PRIORITY[worst]
      ) {
        worst = sub.reviewStatus
      }
    }

    return {
      totalSubmitted: submissions.length,
      expectedVideos,
      reviewedCount,
      statuses: Array.from(statusSet),
      worstStatus: worst,
    }
  }

  // Helper: check if an event+division is published (for gating video visibility)
  function isEventDivisionPublished(
    trackWorkoutId: string,
    divisionId: string,
  ): boolean {
    if (!divisionResults) return true // no publish gating
    const eventPublishState = divisionResults[trackWorkoutId]
    const divisionPublishState = eventPublishState?.[divisionId]
    return !!divisionPublishState?.publishedAt
  }

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
      affiliate: getAffiliate(reg.registration.metadata, reg.user.id),
      eventResults: [],
    })
  }

  // Track per-event outcomes so we can surface why scores may be missing
  const eventProcessingLog: Array<{
    trackWorkoutId: string
    eventName: string
    eventStatus: string | null
    scoresInDivisionMap: number
    divisionsWithScores: number
    divisionsGatedOut: number
    divisionsProcessed: number
  }> = []

  // Process each scorable event (standalone + children, skip parents)
  for (const trackWorkout of scorableEvents) {
    // Get scores for this event, grouped by division.
    //
    // A single (userId, competitionEventId) can have more than one row when a
    // score was re-submitted under a different scaling level or when a team
    // captain's submission was copied across divisions. We must keep exactly
    // one authoritative score per registration per event: otherwise both
    // duplicates get ranked, inflating `activeCount` and, with it, the
    // `activeCount + 1` penalty handed to registrations that never submitted
    // — which lets a no-show team out-rank teams who submitted but placed
    // poorly. Prefer the row whose `scalingLevelId` matches the registration's
    // `divisionId`; otherwise keep the first row seen.
    const dedupedByReg = new Map<string, (typeof allScores)[number]>()

    let scoresSeenForEvent = 0
    let scoresMissingRegistration = 0

    for (const score of allScores) {
      if (score.competitionEventId !== trackWorkout.id) continue
      scoresSeenForEvent++

      // Group by the score's own scalingLevelId — NOT the first registration's
      // division. An athlete in multiple divisions holds a distinct score row
      // per division (the unique key is event+user+scalingLevel); resolving via
      // `filteredRegistrations.find(r.user.id === score.userId)` would
      // attribute every one of their scores to whichever registration happened
      // to come first in the list, so the partner division's score would leak
      // onto the individual leaderboard.
      const scoreDivisionId = score.scalingLevelId || "open"
      const registration = filteredRegistrations.find(
        (r) =>
          r.user.id === score.userId &&
          (r.registration.divisionId || "open") === scoreDivisionId,
      )
      if (!registration) {
        scoresMissingRegistration++
        continue
      }

      const regId = registration.registration.id
      const regDivisionId = registration.registration.divisionId || "open"
      const existing = dedupedByReg.get(regId)
      if (!existing) {
        dedupedByReg.set(regId, score)
        continue
      }
      const existingMatches = existing.scalingLevelId === regDivisionId
      const candidateMatches = score.scalingLevelId === regDivisionId
      if (candidateMatches && !existingMatches) {
        dedupedByReg.set(regId, score)
      }
    }

    const eventScoresByDivision = new Map<string, typeof allScores>()
    for (const [regId, score] of dedupedByReg) {
      const registration = filteredRegistrations.find(
        (r) => r.registration.id === regId,
      )
      if (!registration) continue
      const divisionId = registration.registration.divisionId || "open"
      const existing = eventScoresByDivision.get(divisionId) || []
      existing.push(score)
      eventScoresByDivision.set(divisionId, existing)
    }

    let gatedOut = 0
    let processed = 0

    // Calculate points for each division using the scoring algorithm
    for (const [divisionId, divisionScores] of eventScoresByDivision) {
      // Filter by division results publishing state.
      // When divisionResults exists, the organizer has opted into per-event publishing.
      // Divisions default to "Draft" (hidden) — only show explicitly published ones.
      // When divisionResults is absent, all results show (backwards compat).
      if (divisionResults) {
        const eventPublishState = divisionResults[trackWorkout.id]
        const divisionPublishState = eventPublishState?.[divisionId]
        if (!divisionPublishState?.publishedAt) {
          gatedOut++
          continue
        }
      }

      // Convert to EventScoreInput format.
      //
      // IMPORTANT: we deliberately recompute `sortKey` here rather than
      // trusting the stored `s.sortKey`. The stored value is only refreshed
      // when a score is written through `computeSortKey` — direct DB edits
      // to `scoreRoundsTable.status`, and any scores written before the
      // cap-count tiebreaker was added to `computeSortKey`, leave the
      // persisted key stale. Recomputing here with the freshly-fetched
      // `cappedRoundCount` guarantees "fewer caps beats more caps" on the
      // public leaderboard with no backfill required.
      const eventScoreType =
        trackWorkout.workout.scoreType ||
        getDefaultScoreType(trackWorkout.workout.scheme)
      const eventScoreInputs: EventScoreInput[] = divisionScores.map((s) => {
        // Invalid scores must rank last, not sort by their zeroed scoreValue.
        // The mark-invalid write path sets `scoreValue=0, status="scored"` —
        // for ascending schemes (time) that 0 would otherwise sort to first
        // place on the organizer preview (the public path already excludes
        // invalids in `fetchScores`). Routing through the inactive branch as
        // "dnf" makes every algorithm honor `statusHandling.dnf`
        // (default `last_place`).
        if (s.verificationStatus === "invalid") {
          return {
            userId: s.userId,
            value: 0,
            status: "dnf" as const,
            sortKey: null,
          }
        }

        const roundSummary = roundCapSummariesByScoreId.get(s.id)
        const recomputedSortKey = computeSortKey({
          scheme: s.scheme as WorkoutScheme,
          scoreType: eventScoreType,
          value: s.scoreValue,
          status: s.status as "scored" | "cap" | "dq" | "withdrawn",
          cappedRoundCount: roundSummary?.cappedRoundCount ?? 0,
          timeCap:
            s.timeCapMs && s.secondaryValue !== null
              ? { ms: s.timeCapMs, secondaryValue: s.secondaryValue }
              : undefined,
          tiebreak:
            s.tiebreakValue !== null && s.tiebreakScheme
              ? {
                  scheme: s.tiebreakScheme as "reps" | "time",
                  value: s.tiebreakValue,
                }
              : undefined,
        })
        return {
          userId: s.userId,
          value: s.scoreValue ?? 0,
          status: mapScoreStatus(s.status),
          sortKey: sortKeyToString(recomputedSortKey),
        }
      })

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

      // Update leaderboard entries with results. Match the score to its
      // exact registration by (userId, scalingLevelId) so an athlete in
      // multiple divisions lands on the correct registration entry — matching
      // by userId alone would point every score at whichever of their
      // registrations appears first in `filteredRegistrations`.
      for (const score of divisionScores) {
        const registration = filteredRegistrations.find(
          (r) =>
            r.user.id === score.userId &&
            (r.registration.divisionId || "open") ===
              (score.scalingLevelId || "open"),
        )
        if (!registration) continue

        const entry = leaderboardMap.get(registration.registration.id)
        if (!entry) continue

        const pointsResult = pointsMap.get(score.userId)
        const rank = pointsResult?.rank ?? 0
        const basePoints = pointsResult?.points ?? 0
        const points = Math.round(basePoints * multiplier)

        const roundSummary = roundCapSummariesByScoreId.get(score.id) ?? {
          cappedRoundCount: 0,
          totalRoundCount: 0,
        }

        // DB `status` is wider than `formatScore`'s accepted union — it can
        // also be "dns" / "dnf" / null, which `formatScore` would silently
        // fall through on and render misleading values (e.g. a DNS with
        // value 0 would print "0:00"). Handle those inactive statuses with
        // explicit labels before touching `formatScore`.
        const scoreScheme = score.scheme as WorkoutScheme

        let formattedScore: string
        if (score.verificationStatus === "invalid") {
          // The mark-invalid write path zeros scoreValue and keeps
          // status="scored". Surface the verification state explicitly so the
          // leaderboard cell doesn't render a misleading "0:00" for the
          // invalidated entry.
          formattedScore = "Invalid"
        } else if (score.status === "dns") {
          formattedScore = "DNS"
        } else if (score.status === "dnf") {
          formattedScore = "DNF"
        } else {
          // Multi-round scores (partner/team relays, multi-round time, etc.)
          // aggregate a real numeric total even when individual rounds hit the
          // cap — the athlete logs cap time + 1s/missed-rep per round and we
          // sum those into `scoreValue`. Rendering the literal "CAP" label
          // would hide that aggregate. For multi-round entries we therefore
          // force status to "scored" so `formatScore` emits the value, and
          // surface the cap state through `CappedRoundsIndicator` instead.
          const isMultiRound = roundSummary.totalRoundCount > 1
          const isKnownFormatStatus =
            score.status === "scored" ||
            score.status === "cap" ||
            score.status === "dq" ||
            score.status === "withdrawn"
          const formatStatus: "scored" | "cap" | "dq" | "withdrawn" =
            isMultiRound && score.scoreValue !== null
              ? "scored"
              : isKnownFormatStatus
                ? (score.status as "scored" | "cap" | "dq" | "withdrawn")
                : "scored"

          // Clamp time values to whole seconds for leaderboard display.
          // `compact: true` only hides milliseconds when they happen to be
          // zero, so an aggregated multi-round total like 905_123 ms would
          // still render as `15:05.123` — which is noise we don't want on
          // the board.
          const displayValue =
            score.scoreValue !== null && isTimeBasedScheme(scoreScheme)
              ? Math.floor(score.scoreValue / 1000) * 1000
              : (score.scoreValue ?? 0)

          const scoreObj: Parameters<typeof formatScore>[0] = {
            scheme: scoreScheme,
            scoreType: eventScoreType,
            value: displayValue,
            status: formatStatus,
          }

          if (score.tiebreakValue !== null && score.tiebreakScheme) {
            const tbScheme = score.tiebreakScheme as "reps" | "time"
            scoreObj.tiebreak = {
              scheme: tbScheme,
              value:
                tbScheme === "time"
                  ? Math.floor(score.tiebreakValue / 1000) * 1000
                  : score.tiebreakValue,
            }
          }

          if (score.timeCapMs && score.secondaryValue !== null) {
            scoreObj.timeCap = {
              ms: score.timeCapMs,
              secondaryValue: score.secondaryValue,
            }
          }

          formattedScore = formatScore(scoreObj, { compact: true })
        }

        // Format tiebreak separately
        let formattedTiebreak: string | null = null
        if (score.tiebreakValue !== null && score.tiebreakScheme) {
          const tbScheme = score.tiebreakScheme as WorkoutScheme
          const tbDisplay = isTimeBasedScheme(tbScheme)
            ? Math.floor(score.tiebreakValue / 1000) * 1000
            : score.tiebreakValue
          formattedTiebreak = decodeScore(tbDisplay, tbScheme, {
            compact: true,
          })
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
          penaltyType: (score.penaltyType as "minor" | "major") ?? null,
          penaltyPercentage: score.penaltyPercentage ?? null,
          isDirectlyModified:
            score.verificationStatus === "adjusted" && !score.penaltyType,
          videoUrl: isEventDivisionPublished(trackWorkout.id, divisionId)
            ? (videoMap.get(
                `${registration.registration.id}:${trackWorkout.id}`,
              )?.url ?? null)
            : null,
          videoSubmissionId: isEventDivisionPublished(
            trackWorkout.id,
            divisionId,
          )
            ? (videoMap.get(
                `${registration.registration.id}:${trackWorkout.id}`,
              )?.submissionId ?? null)
            : null,
          parentEventId: trackWorkout.parentEventId,
          parentEventName: trackWorkout.parentEventId
            ? (parentNameMap.get(trackWorkout.parentEventId) ?? null)
            : null,
          isParentEvent: false,
          cappedRoundCount: roundSummary.cappedRoundCount,
          totalRoundCount: roundSummary.totalRoundCount,
          reviewSummary: buildReviewSummary(
            registration.registration.id,
            trackWorkout.id,
          ),
        })

        entry.totalPoints += points
      }

      // Athletes registered in this division who didn't submit a score for
      // this event tie at the worst position (activeCount + 1). Without this,
      // an absent submission would have totalPoints = 0 and outrank a
      // recorded submission under lower-is-better algorithms (online).
      const activeCount = eventScoreInputs.filter(
        (s) => s.status === "scored" || s.status === "cap",
      ).length
      const missingPlace = activeCount + 1
      const missingPoints = Math.round(
        calculatePointsForPlace({
          place: missingPlace,
          config: scoringConfig,
        }) * multiplier,
      )

      const scoredUserIds = new Set(divisionScores.map((s) => s.userId))
      const missingRegs = filteredRegistrations.filter(
        (r) =>
          (r.registration.divisionId || "open") === divisionId &&
          !scoredUserIds.has(r.user.id),
      )

      for (const reg of missingRegs) {
        const entry = leaderboardMap.get(reg.registration.id)
        if (!entry) continue

        const eventDivPublished = isEventDivisionPublished(
          trackWorkout.id,
          divisionId,
        )
        const videoInfo = videoMap.get(
          `${reg.registration.id}:${trackWorkout.id}`,
        )

        entry.eventResults.push({
          trackWorkoutId: trackWorkout.id,
          trackOrder: trackWorkout.trackOrder,
          eventName: trackWorkout.workout.name,
          scheme: trackWorkout.workout.scheme,
          rank: missingPlace,
          points: missingPoints,
          rawScore: null,
          formattedScore: "N/A",
          formattedTiebreak: null,
          penaltyType: null,
          penaltyPercentage: null,
          isDirectlyModified: false,
          videoUrl: eventDivPublished ? (videoInfo?.url ?? null) : null,
          videoSubmissionId: eventDivPublished
            ? (videoInfo?.submissionId ?? null)
            : null,
          parentEventId: trackWorkout.parentEventId,
          parentEventName: trackWorkout.parentEventId
            ? (parentNameMap.get(trackWorkout.parentEventId) ?? null)
            : null,
          isParentEvent: false,
          cappedRoundCount: 0,
          totalRoundCount: 0,
          reviewSummary: buildReviewSummary(
            reg.registration.id,
            trackWorkout.id,
          ),
        })

        entry.totalPoints += missingPoints
      }

      processed++
    }

    eventProcessingLog.push({
      trackWorkoutId: trackWorkout.id,
      eventName: trackWorkout.workout.name,
      eventStatus: trackWorkout.eventStatus ?? null,
      scoresInDivisionMap: scoresSeenForEvent - scoresMissingRegistration,
      divisionsWithScores: eventScoresByDivision.size,
      divisionsGatedOut: gatedOut,
      divisionsProcessed: processed,
    })

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
          scheme: trackWorkout.workout.scheme,
          rank: 0,
          points: 0,
          rawScore: null,
          formattedScore: "N/A",
          formattedTiebreak: null,
          penaltyType: null,
          penaltyPercentage: null,
          isDirectlyModified: false,
          videoUrl: isEventDivisionPublished(trackWorkout.id, entry.divisionId)
            ? (videoMap.get(`${regId}:${trackWorkout.id}`)?.url ?? null)
            : null,
          videoSubmissionId: isEventDivisionPublished(
            trackWorkout.id,
            entry.divisionId,
          )
            ? (videoMap.get(`${regId}:${trackWorkout.id}`)?.submissionId ??
              null)
            : null,
          parentEventId: trackWorkout.parentEventId,
          parentEventName: trackWorkout.parentEventId
            ? (parentNameMap.get(trackWorkout.parentEventId) ?? null)
            : null,
          isParentEvent: false,
          cappedRoundCount: 0,
          totalRoundCount: 0,
          reviewSummary: isEventDivisionPublished(
            trackWorkout.id,
            entry.divisionId,
          )
            ? buildReviewSummary(regId, trackWorkout.id)
            : null,
        })
      }
    }
  }

  // Parent events are not scored directly — sub-events appear as top-level columns
  // on the leaderboard, so we skip adding parent aggregate entries to eventResults.

  const totalScoresProcessed = eventProcessingLog.reduce(
    (sum, e) => sum + e.scoresInDivisionMap,
    0,
  )
  const totalDivisionsGated = eventProcessingLog.reduce(
    (sum, e) => sum + e.divisionsGatedOut,
    0,
  )

  logInfo({
    message: "[Leaderboard] Event processing breakdown",
    attributes: {
      competitionId: params.competitionId,
      divisionId: params.divisionId ?? null,
      totalScoresProcessed,
      totalDivisionsGatedByPublishFilter: totalDivisionsGated,
      perEvent: eventProcessingLog,
    },
  })

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

  // Build events list for the response — exclude parent events since sub-events
  // appear as top-level columns on the leaderboard
  const events = filteredTrackWorkouts
    .filter((tw) => !childEventIds.has(tw.id))
    .map((tw) => ({
      trackWorkoutId: tw.id,
      name: tw.workout.name,
      parentEventId: tw.parentEventId,
      parentEventName: tw.parentEventId
        ? (parentNameMap.get(tw.parentEventId) ?? null)
        : null,
      isParentEvent: false,
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
