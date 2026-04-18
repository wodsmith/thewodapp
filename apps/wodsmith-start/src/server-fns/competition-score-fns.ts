/**
 * Competition Score Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-scores.ts and
 * apps/wodsmith/src/actions/competition-score-actions.ts
 *
 * OBSERVABILITY:
 * - All score operations are logged with entity IDs for tracing
 * - Score saves/updates track competitionId, userId, scoreId
 * - Permission checks are logged for audit trails
 * - Batch operations include counts and error summaries
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, gt, inArray, isNull, ne, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  addRequestContextAttribute,
  logEntityDeleted,
  logEntityUpdated,
  logError,
  logInfo,
  logWarning,
  updateRequestContext,
} from "@/lib/logging"
import { getEvlog } from "@/lib/evlog"
import {
  type CompetitionHeat,
  competitionEventsTable,
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionRegistrationsTable,
  competitionsTable,
  competitionVenuesTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { entitlementTable } from "@/db/schemas/entitlements"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import {
  SCORE_STATUS_VALUES,
  type ScoreStatus,
  type ScoreType,
  type TiebreakScheme,
  type WorkoutScheme,
  workouts,
} from "@/db/schemas/workouts"
import {
  computeSortKey,
  decodeScore,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  type WorkoutScheme as ScoringWorkoutScheme,
  STATUS_ORDER,
  sortKeyToString,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { aggregateValues } from "@/lib/scoring"

// ============================================================================
// Types
// ============================================================================

/** Round score data for multi-round workouts */
export interface RoundScoreData {
  score: string
  /** For rounds+reps format: [rounds, reps] */
  parts?: [string, string]
}

/** Existing set data from the score_rounds table */
export interface ExistingSetData {
  setNumber: number
  score: number | null
  reps: number | null
}

/** Team member info for team competitions */
export interface TeamMemberInfo {
  userId: string
  firstName: string
  lastName: string
  isCaptain: boolean
}

export interface EventScoreEntryAthlete {
  registrationId: string
  userId: string
  firstName: string
  lastName: string
  email: string
  divisionId: string | null
  divisionLabel: string
  /** Team name for team competitions (null for individuals) */
  teamName: string | null
  /** Team members including captain (empty for individuals) */
  teamMembers: TeamMemberInfo[]
  existingResult: {
    resultId: string
    wodScore: string | null
    scoreStatus: ScoreStatus | null
    tieBreakScore: string | null
    secondaryScore: string | null
    /** Existing sets for multi-round workouts */
    sets: ExistingSetData[]
  } | null
}

export interface EventScoreEntryData {
  event: {
    id: string
    trackOrder: number
    pointsMultiplier: number | null
    workout: {
      id: string
      name: string
      description: string
      scheme: WorkoutScheme
      scoreType: ScoreType | null
      tiebreakScheme: TiebreakScheme | null
      timeCap: number | null
      repsPerRound: number | null
      roundsToScore: number | null
    }
  }
  athletes: EventScoreEntryAthlete[]
  divisions: Array<{ id: string; label: string; position: number }>
}

/** Heat info with assignment context for score entry UI */
export interface HeatScoreGroup {
  heatId: string
  heatNumber: number
  scheduledTime: Date | null
  venue: { id: string; name: string } | null
  division: { id: string; label: string } | null
  /** Lane assignments with registration IDs for linking to athletes */
  assignments: Array<{
    laneNumber: number
    registrationId: string
  }>
}

/** Response for heat-grouped score entry data */
export interface EventScoreEntryDataWithHeats extends EventScoreEntryData {
  heats: HeatScoreGroup[]
  /** Registration IDs that are not assigned to any heat */
  unassignedRegistrationIds: string[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if current time is within the event's submission window.
 * Only applies to online competitions.
 */
async function isWithinSubmissionWindow(
  competitionId: string,
  trackWorkoutId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const db = getDb()

  // Get competition type
  const [competition] = await db
    .select({
      competitionType: competitionsTable.competitionType,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    return { allowed: false, reason: "Competition not found" }
  }

  // Only check submission windows for online competitions
  if (competition.competitionType !== "online") {
    return { allowed: true }
  }

  // Get competition event with submission window
  const [event] = await db
    .select({
      submissionOpensAt: competitionEventsTable.submissionOpensAt,
      submissionClosesAt: competitionEventsTable.submissionClosesAt,
    })
    .from(competitionEventsTable)
    .where(
      and(
        eq(competitionEventsTable.competitionId, competitionId),
        eq(competitionEventsTable.trackWorkoutId, trackWorkoutId),
      ),
    )
    .limit(1)

  // If no event record exists, allow submission (backward compatibility)
  if (!event) {
    return { allowed: true }
  }

  // If no submission window is configured, allow submission
  if (!event.submissionOpensAt || !event.submissionClosesAt) {
    return { allowed: true }
  }

  // Check if current time is within the window
  const now = new Date()
  const opensAt = new Date(event.submissionOpensAt)
  const closesAt = new Date(event.submissionClosesAt)

  if (now < opensAt) {
    return {
      allowed: false,
      reason: `Submission window opens at ${opensAt.toISOString()}`,
    }
  }

  if (now > closesAt) {
    return {
      allowed: false,
      reason: `Submission window closed at ${closesAt.toISOString()}`,
    }
  }

  return { allowed: true }
}

/**
 * Map ScoreStatus to the simplified status type for scores table.
 */
function mapToNewStatus(
  status: ScoreStatus,
): "scored" | "cap" | "dq" | "withdrawn" {
  switch (status) {
    case "scored":
      return "scored"
    case "cap":
      return "cap"
    case "dq":
      return "dq"
    case "withdrawn":
    case "dns":
    case "dnf":
      return "withdrawn"
    default:
      return "scored"
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const getEventScoreEntryDataInputSchema = z.object({
  competitionId: z.string().min(1),
  organizingTeamId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  divisionId: z.string().optional(),
})

/** Schema for round score data */
const roundScoreSchema = z.object({
  score: z.string(),
  parts: z.tuple([z.string(), z.string()]).optional(),
})

/** Schema for workout info needed for proper score processing */
const workoutInfoSchema = z.object({
  scheme: z.string(),
  scoreType: z.string().nullable(),
  repsPerRound: z.number().nullable(),
  roundsToScore: z.number().nullable(),
  timeCap: z.number().nullable(),
  tiebreakScheme: z.string().nullable().optional(),
})

const saveCompetitionScoreInputSchema = z.object({
  competitionId: z.string().min(1),
  organizingTeamId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  workoutId: z.string().min(1),
  registrationId: z.string().min(1),
  userId: z.string().min(1),
  divisionId: z.string().nullable(),
  score: z.string(),
  scoreStatus: z.enum(SCORE_STATUS_VALUES),
  tieBreakScore: z.string().nullable().optional(),
  secondaryScore: z.string().nullable().optional(),
  /** Round scores for multi-round workouts */
  roundScores: z.array(roundScoreSchema).optional(),
  /** Workout info for proper score processing */
  workout: workoutInfoSchema.optional(),
})

const saveCompetitionScoresInputSchema = z.object({
  competitionId: z.string().min(1),
  organizingTeamId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  workoutId: z.string().min(1),
  scores: z.array(
    z.object({
      registrationId: z.string().min(1),
      userId: z.string().min(1),
      divisionId: z.string().nullable(),
      score: z.string(),
      scoreStatus: z.enum(SCORE_STATUS_VALUES),
      tieBreakScore: z.string().nullable().optional(),
      secondaryScore: z.string().nullable().optional(),
    }),
  ),
})

const deleteCompetitionScoreInputSchema = z.object({
  organizingTeamId: z.string().min(1),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  userId: z.string().min(1),
})

// ============================================================================
// Internal Helper: Get heats for a workout
// ============================================================================

interface HeatWithAssignmentsInternal extends CompetitionHeat {
  venue: { id: string; name: string } | null
  division: { id: string; label: string } | null
  assignments: Array<{
    laneNumber: number
    registrationId: string
  }>
}

async function getHeatsForWorkoutInternal(
  trackWorkoutId: string,
): Promise<HeatWithAssignmentsInternal[]> {
  const db = getDb()

  // If this is a child event, resolve to parent for heat lookup
  // (heats are scheduled on parent events, not individual sub-events)
  let heatWorkoutId = trackWorkoutId
  const trackWorkout = await db
    .select({ parentEventId: trackWorkoutsTable.parentEventId })
    .from(trackWorkoutsTable)
    .where(eq(trackWorkoutsTable.id, trackWorkoutId))
    .limit(1)
  if (trackWorkout[0]?.parentEventId) {
    heatWorkoutId = trackWorkout[0].parentEventId
  }

  // Get heats
  const heats = await db
    .select()
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.trackWorkoutId, heatWorkoutId))

  if (heats.length === 0) {
    return []
  }

  // Get venue IDs and division IDs
  const venueIds = heats
    .map((h) => h.venueId)
    .filter((id): id is string => id !== null)
  const divisionIds = heats
    .map((h) => h.divisionId)
    .filter((id): id is string => id !== null)

  // Fetch venues
  const venues =
    venueIds.length > 0
      ? await db
          .select({
            id: competitionVenuesTable.id,
            name: competitionVenuesTable.name,
          })
          .from(competitionVenuesTable)
          .where(inArray(competitionVenuesTable.id, venueIds))
      : []
  const venueMap = new Map(venues.map((v) => [v.id, v]))

  // Fetch divisions
  const divisions =
    divisionIds.length > 0
      ? await db
          .select({
            id: scalingLevelsTable.id,
            label: scalingLevelsTable.label,
          })
          .from(scalingLevelsTable)
          .where(inArray(scalingLevelsTable.id, divisionIds))
      : []
  const divisionMap = new Map(divisions.map((d) => [d.id, d]))

  // Fetch assignments for all heats
  const heatIds = heats.map((h) => h.id)
  const assignments =
    heatIds.length > 0
      ? await db
          .select({
            heatId: competitionHeatAssignmentsTable.heatId,
            laneNumber: competitionHeatAssignmentsTable.laneNumber,
            registrationId: competitionHeatAssignmentsTable.registrationId,
          })
          .from(competitionHeatAssignmentsTable)
          .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
      : []

  // Group assignments by heat
  const assignmentsByHeat = new Map<string, typeof assignments>()
  for (const assignment of assignments) {
    const existing = assignmentsByHeat.get(assignment.heatId) ?? []
    existing.push(assignment)
    assignmentsByHeat.set(assignment.heatId, existing)
  }

  // Build result
  return heats.map((heat) => ({
    ...heat,
    venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
    division: heat.divisionId
      ? (divisionMap.get(heat.divisionId) ?? null)
      : null,
    assignments: (assignmentsByHeat.get(heat.id) ?? []).map((a) => ({
      laneNumber: a.laneNumber,
      registrationId: a.registrationId,
    })),
  }))
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get athletes and existing scores for a competition event
 */
export const getEventScoreEntryDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getEventScoreEntryDataInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<EventScoreEntryData> => {
    const db = getDb()

    // Get the track workout (event) with workout details
    const [result] = await db
      .select({
        trackWorkoutId: trackWorkoutsTable.id,
        trackOrder: trackWorkoutsTable.trackOrder,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        workoutId: workouts.id,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
        workoutScoreType: workouts.scoreType,
        workoutTiebreakScheme: workouts.tiebreakScheme,
        workoutTimeCap: workouts.timeCap,
        workoutRepsPerRound: workouts.repsPerRound,
        workoutRoundsToScore: workouts.roundsToScore,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    if (!result) {
      throw new Error("Event not found")
    }

    // Restructure to match expected format
    const trackWorkout = {
      id: result.trackWorkoutId,
      trackOrder: result.trackOrder,
      pointsMultiplier: result.pointsMultiplier,
      workout: {
        id: result.workoutId,
        name: result.workoutName,
        description: result.workoutDescription,
        scheme: result.workoutScheme as WorkoutScheme,
        scoreType: result.workoutScoreType as ScoreType | null,
        tiebreakScheme: result.workoutTiebreakScheme as TiebreakScheme | null,
        timeCap: result.workoutTimeCap,
        repsPerRound: result.workoutRepsPerRound,
        roundsToScore: result.workoutRoundsToScore,
      },
    }

    // Get all registrations for this competition (with optional division filter)
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
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
          ...(data.divisionId
            ? [eq(competitionRegistrationsTable.divisionId, data.divisionId)]
            : []),
        ),
      )

    const filteredRegistrations = registrations

    // Get existing scores for this event
    const userIds = filteredRegistrations.map((r) => r.user.id)
    const existingScores =
      userIds.length > 0
        ? await db
            .select()
            .from(scoresTable)
            .where(
              and(
                eq(scoresTable.competitionEventId, data.trackWorkoutId),
                inArray(scoresTable.userId, userIds),
              ),
            )
        : []

    // Get score_rounds for all existing scores
    const scoreIds = existingScores.map((s) => s.id)
    const existingRounds =
      scoreIds.length > 0
        ? await db
            .select({
              scoreId: scoreRoundsTable.scoreId,
              roundNumber: scoreRoundsTable.roundNumber,
              value: scoreRoundsTable.value,
            })
            .from(scoreRoundsTable)
            .where(inArray(scoreRoundsTable.scoreId, scoreIds))
        : []

    // Group rounds by scoreId and convert to legacy format
    const setsByScoreId = new Map<string, ExistingSetData[]>()
    for (const round of existingRounds) {
      const existing = setsByScoreId.get(round.scoreId) || []

      const scheme = existingScores.find((s) => s.id === round.scoreId)?.scheme
      let score: number | null = null
      let reps: number | null = null

      if (scheme === "rounds-reps") {
        const rounds = Math.floor(round.value / 100000)
        reps = round.value % 100000
        score = rounds
      } else if (
        scheme === "time" ||
        scheme === "time-with-cap" ||
        scheme === "emom"
      ) {
        score = Math.round(round.value / 1000)
      } else if (scheme === "load") {
        score = Math.round(round.value / 453.592)
      } else if (scheme === "meters") {
        score = Math.round(round.value / 1000)
      } else if (scheme === "feet") {
        score = Math.round(round.value / 304.8)
      } else {
        score = round.value
      }

      existing.push({
        setNumber: round.roundNumber,
        score,
        reps,
      })
      setsByScoreId.set(round.scoreId, existing)
    }

    // Create a map of userId to score
    const scoresByUserId = new Map(existingScores.map((s) => [s.userId, s]))

    // Get unique divisions for the filter dropdown
    const divisionIds = [
      ...new Set(
        registrations
          .map((r) => r.registration.divisionId)
          .filter((id): id is string => id !== null),
      ),
    ]

    const divisions =
      divisionIds.length > 0
        ? await db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
              position: scalingLevelsTable.position,
            })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, divisionIds))
        : []

    // Get team members for team registrations
    const athleteTeamIds = [
      ...new Set(
        filteredRegistrations
          .map((r) => r.registration.athleteTeamId)
          .filter((id): id is string => id !== null),
      ),
    ]

    // Fetch team memberships with user info for all athlete teams
    const teamMemberships =
      athleteTeamIds.length > 0
        ? await db
            .select({
              teamId: teamMembershipTable.teamId,
              userId: teamMembershipTable.userId,
              firstName: userTable.firstName,
              lastName: userTable.lastName,
            })
            .from(teamMembershipTable)
            .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
            .where(inArray(teamMembershipTable.teamId, athleteTeamIds))
        : []

    // Group team members by teamId
    const membersByTeamId = new Map<
      string,
      Array<{
        userId: string
        firstName: string | null
        lastName: string | null
      }>
    >()
    for (const membership of teamMemberships) {
      const existing = membersByTeamId.get(membership.teamId) || []
      existing.push({
        userId: membership.userId,
        firstName: membership.firstName,
        lastName: membership.lastName,
      })
      membersByTeamId.set(membership.teamId, existing)
    }

    // Build athletes array
    const athletes: EventScoreEntryAthlete[] = filteredRegistrations.map(
      (reg) => {
        const existingScore = scoresByUserId.get(reg.user.id)
        const scoreSets = existingScore
          ? (setsByScoreId.get(existingScore.id) || []).sort(
              (a, b) => a.setNumber - b.setNumber,
            )
          : []

        // Get team members if this is a team registration
        const athleteTeamId = reg.registration.athleteTeamId
        const captainUserId = reg.registration.captainUserId || reg.user.id
        const teamMembers: TeamMemberInfo[] = athleteTeamId
          ? (membersByTeamId.get(athleteTeamId) || []).map((member) => ({
              userId: member.userId,
              firstName: member.firstName || "",
              lastName: member.lastName || "",
              isCaptain: member.userId === captainUserId,
            }))
          : []

        // Sort team members: captain first, then alphabetically by last name
        teamMembers.sort((a, b) => {
          if (a.isCaptain && !b.isCaptain) return -1
          if (!a.isCaptain && b.isCaptain) return 1
          return a.lastName.localeCompare(b.lastName)
        })

        // Decode scores from encoding to display format
        let wodScore = ""
        let tieBreakScore: string | null = null
        let secondaryScore: string | null = null

        if (existingScore) {
          // Decode primary score
          if (existingScore.scoreValue !== null) {
            wodScore = decodeScore(
              existingScore.scoreValue,
              existingScore.scheme as ScoringWorkoutScheme,
              { compact: false },
            )
          }

          // Decode tiebreak score if present
          if (
            existingScore.tiebreakValue !== null &&
            existingScore.tiebreakScheme
          ) {
            tieBreakScore = decodeScore(
              existingScore.tiebreakValue,
              existingScore.tiebreakScheme as ScoringWorkoutScheme,
              { compact: false },
            )
          }

          // Decode secondary score if present
          if (existingScore.secondaryValue !== null) {
            secondaryScore = String(existingScore.secondaryValue)
          }
        }

        return {
          registrationId: reg.registration.id,
          userId: reg.user.id,
          firstName: reg.user.firstName || "",
          lastName: reg.user.lastName || "",
          email: reg.user.email || "",
          divisionId: reg.registration.divisionId,
          divisionLabel: reg.division?.label || "Open",
          teamName: reg.registration.teamName || null,
          teamMembers,
          existingResult: existingScore
            ? {
                resultId: existingScore.id,
                wodScore,
                scoreStatus: existingScore.status as ScoreStatus | null,
                tieBreakScore,
                secondaryScore,
                sets: scoreSets,
              }
            : null,
        }
      },
    )

    // Sort by division label, then by team name (or last name for individuals)
    athletes.sort((a, b) => {
      if (a.divisionLabel !== b.divisionLabel) {
        return a.divisionLabel.localeCompare(b.divisionLabel)
      }
      const aName = a.teamName || a.lastName
      const bName = b.teamName || b.lastName
      return aName.localeCompare(bName)
    })

    return {
      event: {
        id: trackWorkout.id,
        trackOrder: trackWorkout.trackOrder,
        pointsMultiplier: trackWorkout.pointsMultiplier,
        workout: trackWorkout.workout,
      },
      athletes,
      divisions: divisions.sort((a, b) => a.position - b.position),
    }
  })

/**
 * Get score entry data with heat groupings for a competition event.
 * This extends getEventScoreEntryData with heat assignment information.
 */
export const getEventScoreEntryDataWithHeatsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getEventScoreEntryDataInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<EventScoreEntryDataWithHeats> => {
    // Get the base score entry data
    const baseData = await getEventScoreEntryDataFn({ data })

    // Get heats for this workout
    const heatsWithAssignments = await getHeatsForWorkoutInternal(
      data.trackWorkoutId,
    )

    // Build a set of all assigned registration IDs
    const assignedRegistrationIds = new Set<string>()
    for (const heat of heatsWithAssignments) {
      for (const assignment of heat.assignments) {
        assignedRegistrationIds.add(assignment.registrationId)
      }
    }

    // Find unassigned registration IDs (athletes in baseData but not in any heat)
    const allRegistrationIds = new Set(
      baseData.athletes.map((a) => a.registrationId),
    )
    const unassignedRegistrationIds = [...allRegistrationIds].filter(
      (id) => !assignedRegistrationIds.has(id),
    )

    // Transform heats to simplified format for UI
    const heats: HeatScoreGroup[] = heatsWithAssignments.map((heat) => ({
      heatId: heat.id,
      heatNumber: heat.heatNumber,
      scheduledTime: heat.scheduledTime,
      venue: heat.venue,
      division: heat.division,
      assignments: heat.assignments.map((a) => ({
        laneNumber: a.laneNumber,
        registrationId: a.registrationId,
      })),
    }))

    // Sort heats by number
    heats.sort((a, b) => a.heatNumber - b.heatNumber)

    return {
      ...baseData,
      heats,
      unassignedRegistrationIds,
    }
  })

/**
 * Save a single athlete's competition score
 */
export const saveCompetitionScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    saveCompetitionScoreInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean
      data: { resultId: string; isNew: boolean }
    }> => {
      const db = getDb()

      getEvlog()?.set({
        action: "save_score",
        score: {
          competitionId: data.competitionId,
          registrationId: data.registrationId,
          workoutId: data.workoutId,
        },
      })

      // Update request context for tracing
      addRequestContextAttribute("competitionId", data.competitionId)
      addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)
      addRequestContextAttribute("athleteUserId", data.userId)

      logInfo({
        message: "[Score] Save competition score started",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          userId: data.userId,
          registrationId: data.registrationId,
          divisionId: data.divisionId,
          scoreStatus: data.scoreStatus,
        },
      })

      // Check submission window for online competitions
      const submissionCheck = await isWithinSubmissionWindow(
        data.competitionId,
        data.trackWorkoutId,
      )

      if (!submissionCheck.allowed) {
        logWarning({
          message: "[Score] Submission window blocked",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            userId: data.userId,
            reason: submissionCheck.reason,
          },
        })
        throw new Error(
          submissionCheck.reason || "Score submission not allowed at this time",
        )
      }

      // Validate workout info is provided
      if (!data.workout) {
        throw new Error("Workout info is required to save competition score")
      }

      const scheme = data.workout.scheme as ScoringWorkoutScheme
      const scoreType =
        (data.workout.scoreType as ScoreType) || getDefaultScoreType(scheme)
      const workoutTiebreakScheme =
        (data.workout.tiebreakScheme as TiebreakScheme) ?? null

      // Encode score using encoding
      let encodedValue: number | null = null
      let encodedRounds: number[] = []
      const hasRoundScores = !!(data.roundScores && data.roundScores.length > 0)

      if (data.roundScores && data.roundScores.length > 0) {
        // Multi-round: encode each round and aggregate
        const roundInputs = data.roundScores.map((rs) => ({ raw: rs.score }))
        const result = encodeRounds(roundInputs, scheme, scoreType)
        // `encodeRounds` drops rounds that fail to encode — that would
        // misalign roundStatuses with the per-round rows we insert below.
        if (result.rounds.length !== data.roundScores.length) {
          throw new Error("Every round in roundScores must be a valid score")
        }
        encodedValue = result.aggregated
        encodedRounds = result.rounds
      } else if (data.score?.trim()) {
        // Single score: encode directly
        encodedValue = encodeScore(data.score, scheme)
      }

      // Map client-declared status to simplified type. For multi-round
      // `time-with-cap` we derive status server-side from the rounds
      // themselves (mirroring `submitVideoFn`), ignoring the client value.
      let newStatus = mapToNewStatus(data.scoreStatus)
      const roundStatuses: Array<"scored" | "cap"> = []
      let cappedRoundCount = 0

      if (
        scheme === "time-with-cap" &&
        data.workout.timeCap &&
        hasRoundScores &&
        encodedValue !== null
      ) {
        // Multi-round time cap: per-round inference. Preserve the summed
        // total — do NOT clamp to cap. Parent status becomes "cap" if any
        // round is capped.
        const capMs = data.workout.timeCap * 1000
        for (const roundValue of encodedRounds) {
          const isRoundCapped = roundValue >= capMs
          roundStatuses.push(isRoundCapped ? "cap" : "scored")
          if (isRoundCapped) cappedRoundCount++
        }
        // Preserve terminal statuses (dq/withdrawn). Only flip between
        // scored/cap when the caller declared a non-terminal status.
        if (newStatus !== "dq" && newStatus !== "withdrawn") {
          newStatus = cappedRoundCount > 0 ? "cap" : "scored"
        }
      } else if (
        newStatus === "cap" &&
        scheme === "time-with-cap" &&
        data.workout.timeCap
      ) {
        // Single-round legacy clamp + reps-at-cap behavior.
        encodedValue = data.workout.timeCap * 1000
      }

      // Parse secondary score (reps completed at cap) if provided
      let secondaryValue: number | null = null
      if (data.secondaryScore && newStatus === "cap") {
        const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
        if (!Number.isNaN(parsed) && parsed >= 0) {
          secondaryValue = parsed
        }
      }

      // Store time cap in milliseconds for reference
      const timeCapMs = data.workout.timeCap
        ? data.workout.timeCap * 1000
        : null

      // Encode tiebreak if provided (needed for sortKey computation)
      let tiebreakValue: number | null = null
      if (data.tieBreakScore && data.workout.tiebreakScheme) {
        try {
          tiebreakValue = encodeScore(
            data.tieBreakScore,
            data.workout.tiebreakScheme as ScoringWorkoutScheme,
          )
        } catch (_error) {
          // Silently ignore tiebreak encoding errors
        }
      }

      // Compute sort key for efficient leaderboard queries.
      // Includes the multi-round `cappedRoundCount` tiebreaker so scores
      // with fewer capped rounds sort ahead of scores with more, even
      // when the summed total is slower.
      const sortKey =
        encodedValue !== null
          ? computeSortKey({
              value: encodedValue,
              status: newStatus,
              scheme,
              scoreType,
              cappedRoundCount,
              // Include time cap info for capped scores
              timeCap:
                newStatus === "cap" && timeCapMs && secondaryValue !== null
                  ? { ms: timeCapMs, secondaryValue }
                  : undefined,
              // Include tiebreak for proper tie-breaking in rankings
              tiebreak:
                tiebreakValue !== null && data.workout.tiebreakScheme
                  ? {
                      scheme: data.workout.tiebreakScheme as "time" | "reps",
                      value: tiebreakValue,
                    }
                  : undefined,
            })
          : null

      // Get teamId from competition context
      const [teamResult] = await db
        .select({
          ownerTeamId: programmingTracksTable.ownerTeamId,
        })
        .from(trackWorkoutsTable)
        .innerJoin(
          programmingTracksTable,
          eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
        )
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (!teamResult?.ownerTeamId) {
        throw new Error("Could not determine team ownership for competition")
      }

      const teamId = teamResult.ownerTeamId

      // Use a transaction for atomicity: upsert score → retrieve ID → manage rounds
      const scoreId = await db.transaction(async (tx) => {
        // Insert/update scores table
        await tx
          .insert(scoresTable)
          .values({
            userId: data.userId,
            teamId,
            workoutId: data.workoutId,
            competitionEventId: data.trackWorkoutId,
            scheme,
            scoreType,
            scoreValue: encodedValue,
            status: newStatus,
            statusOrder: STATUS_ORDER[newStatus],
            sortKey: sortKey ? sortKeyToString(sortKey) : null,
            tiebreakScheme: workoutTiebreakScheme,
            tiebreakValue,
            timeCapMs,
            secondaryValue,
            scalingLevelId: data.divisionId,
            asRx: true,
            recordedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              scoreValue: encodedValue,
              status: newStatus,
              statusOrder: STATUS_ORDER[newStatus],
              sortKey: sortKey ? sortKeyToString(sortKey) : null,
              tiebreakScheme: workoutTiebreakScheme,
              tiebreakValue,
              timeCapMs,
              secondaryValue,
              scalingLevelId: data.divisionId,
              updatedAt: new Date(),
            },
          })

        // Get the final score ID (either new or existing)
        const [finalScore] = await tx
          .select({ id: scoresTable.id })
          .from(scoresTable)
          .where(
            and(
              eq(scoresTable.competitionEventId, data.trackWorkoutId),
              eq(scoresTable.userId, data.userId),
            ),
          )
          .limit(1)

        if (!finalScore) {
          throw new Error("Failed to retrieve score after upsert")
        }

        const id = finalScore.id

        // Handle score_rounds - delete existing and insert new
        if (data.roundScores && data.roundScores.length > 0) {
          // Delete existing rounds
          await tx
            .delete(scoreRoundsTable)
            .where(eq(scoreRoundsTable.scoreId, id))

          // Convert and insert new rounds. For multi-round time caps we
          // persist per-round `status` ("cap" / "scored") derived above
          // so the leaderboard can count capped rounds without replaying
          // the cap check, and so the round breakdown UI tags each round.
          const roundsToInsert = data.roundScores.map((round, index) => {
            let roundValue: number

            if (scheme === "rounds-reps") {
              const roundsNum =
                Number.parseInt(round.parts?.[0] ?? round.score, 10) || 0
              const reps = Number.parseInt(round.parts?.[1] ?? "0", 10) || 0
              roundValue = roundsNum * 100000 + reps
            } else if (
              scheme === "time" ||
              scheme === "time-with-cap" ||
              scheme === "emom"
            ) {
              roundValue = encodeScore(round.score, scheme) ?? 0
            } else {
              roundValue = encodeScore(round.score, scheme) ?? 0
            }

            return {
              scoreId: id,
              roundNumber: index + 1,
              value: roundValue,
              status: roundStatuses[index] ?? null,
            }
          })

          await tx.insert(scoreRoundsTable).values(roundsToInsert)
        }

        return id
      })

      // Log score entity creation/update
      addRequestContextAttribute("scoreId", scoreId)
      logEntityUpdated({
        entity: "score",
        id: scoreId,
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          userId: data.userId,
          registrationId: data.registrationId,
          divisionId: data.divisionId,
          scoreStatus: data.scoreStatus,
          hasRoundScores: !!(data.roundScores && data.roundScores.length > 0),
        },
      })

      if (data.roundScores && data.roundScores.length > 0) {
        logInfo({
          message: "[Score] Round scores saved",
          attributes: {
            scoreId,
            roundCount: data.roundScores.length,
          },
        })
      }

      logInfo({
        message: "[Score] Competition score saved successfully",
        attributes: {
          scoreId,
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          userId: data.userId,
          scoreStatus: data.scoreStatus,
        },
      })

      return { success: true, data: { resultId: scoreId, isNew: true } }
    },
  )

/**
 * Batch save multiple competition scores
 */
export const saveCompetitionScoresFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    saveCompetitionScoresInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean
      data: {
        savedCount: number
        errors: Array<{ userId: string; error: string }>
      }
    }> => {
      const errors: Array<{ userId: string; error: string }> = []
      let savedCount = 0

      getEvlog()?.set({
        action: "save_scores_batch",
        batch: { competitionId: data.competitionId, count: data.scores.length },
      })

      // Update request context
      addRequestContextAttribute("competitionId", data.competitionId)
      addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)

      logInfo({
        message: "[Score] Batch save competition scores started",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          scoreCount: data.scores.length,
        },
      })

      // Check submission window for online competitions
      const submissionCheck = await isWithinSubmissionWindow(
        data.competitionId,
        data.trackWorkoutId,
      )

      if (!submissionCheck.allowed) {
        logWarning({
          message: "[Score] Batch submission window blocked",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            reason: submissionCheck.reason,
          },
        })
        throw new Error(
          submissionCheck.reason || "Score submission not allowed at this time",
        )
      }

      // Get workout info for all scores
      const db = getDb()
      const [workoutResult] = await db
        .select({
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          repsPerRound: workouts.repsPerRound,
          roundsToScore: workouts.roundsToScore,
          timeCap: workouts.timeCap,
          tiebreakScheme: workouts.tiebreakScheme,
        })
        .from(workouts)
        .where(eq(workouts.id, data.workoutId))
        .limit(1)

      if (!workoutResult) {
        throw new Error("Workout not found")
      }

      for (const scoreData of data.scores) {
        try {
          await saveCompetitionScoreFn({
            data: {
              competitionId: data.competitionId,
              organizingTeamId: data.organizingTeamId,
              trackWorkoutId: data.trackWorkoutId,
              workoutId: data.workoutId,
              registrationId: scoreData.registrationId,
              userId: scoreData.userId,
              divisionId: scoreData.divisionId,
              score: scoreData.score,
              scoreStatus: scoreData.scoreStatus,
              tieBreakScore: scoreData.tieBreakScore,
              secondaryScore: scoreData.secondaryScore,
              workout: workoutResult,
            },
          })
          savedCount++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error"
          errors.push({
            userId: scoreData.userId,
            error: errorMessage,
          })
          logError({
            message: "[Score] Failed to save individual score in batch",
            error,
            attributes: {
              userId: scoreData.userId,
              registrationId: scoreData.registrationId,
            },
          })
        }
      }

      // Restore batch-level action after per-item saves overwrote it
      getEvlog()?.set({
        action: "save_scores_batch",
        batch: {
          competitionId: data.competitionId,
          count: data.scores.length,
          saved: savedCount,
          errors: errors.length,
        },
      })

      logInfo({
        message: "[Score] Batch save competition scores completed",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          savedCount,
          errorCount: errors.length,
        },
      })

      return { success: true, data: { savedCount, errors } }
    },
  )

/**
 * Delete a competition score
 */
export const deleteCompetitionScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    deleteCompetitionScoreInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const db = getDb()

    getEvlog()?.set({
      action: "delete_score",
      score: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
      },
    })

    // Update request context
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)
    addRequestContextAttribute("targetUserId", data.userId)

    logInfo({
      message: "[Score] Delete competition score started",
      attributes: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
        userId: data.userId,
      },
    })

    // Delete from scores table (score_rounds are cascade deleted)
    await db
      .delete(scoresTable)
      .where(
        and(
          eq(scoresTable.competitionEventId, data.trackWorkoutId),
          eq(scoresTable.userId, data.userId),
        ),
      )

    logEntityDeleted({
      entity: "score",
      id: `${data.trackWorkoutId}:${data.userId}`,
      attributes: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
        userId: data.userId,
      },
    })

    return { success: true }
  })

// ============================================================================
// Volunteer Score Access Functions
// These functions check for score access entitlement instead of organizer permissions
// ============================================================================

/**
 * Check if the current user has score access for a competition team
 */
async function requireScoreAccess(competitionTeamId: string): Promise<void> {
  const session = await getSessionFromCookie()
  if (!session?.userId) {
    logWarning({
      message: "[Score] Volunteer access denied - not authenticated",
      attributes: { competitionTeamId },
    })
    throw new Error("Not authenticated")
  }

  updateRequestContext({ userId: session.userId })
  addRequestContextAttribute("competitionTeamId", competitionTeamId)

  const db = getDb()
  const entitlements = await db.query.entitlementTable.findMany({
    where: and(
      eq(entitlementTable.userId, session.userId),
      eq(entitlementTable.teamId, competitionTeamId),
      eq(entitlementTable.entitlementTypeId, "competition_score_input"),
      isNull(entitlementTable.deletedAt),
      or(
        isNull(entitlementTable.expiresAt),
        gt(entitlementTable.expiresAt, new Date()),
      ),
    ),
  })

  if (entitlements.length === 0) {
    logWarning({
      message: "[Score] Volunteer access denied - missing entitlement",
      attributes: {
        userId: session.userId,
        competitionTeamId,
        entitlementType: "competition_score_input",
      },
    })
    throw new Error("Missing score access permission")
  }

  logInfo({
    message: "[Score] Volunteer access granted",
    attributes: {
      userId: session.userId,
      competitionTeamId,
    },
  })
}

const volunteerScoreAccessInputSchema = z.object({
  competitionId: z.string().min(1),
  competitionTeamId: z.string().min(1),
})

/**
 * Get competition workouts for volunteers with score access
 * This is a simplified version that only requires score access entitlement
 */
export const getCompetitionWorkoutsForScoreEntryFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    volunteerScoreAccessInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    // Check score access permission
    await requireScoreAccess(data.competitionTeamId)

    const db = getDb()

    // Get the competition's programming track via programmingTracksTable
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.competitionId, data.competitionId),
    })

    if (!track) {
      return { workouts: [] }
    }

    // Get all workouts for this track
    const trackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        parentEventId: trackWorkoutsTable.parentEventId,
        heatStatus: trackWorkoutsTable.heatStatus,
        eventStatus: trackWorkoutsTable.eventStatus,
        sponsorId: trackWorkoutsTable.sponsorId,
        createdAt: trackWorkoutsTable.createdAt,
        updatedAt: trackWorkoutsTable.updatedAt,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          roundsToScore: workouts.roundsToScore,
          repsPerRound: workouts.repsPerRound,
          tiebreakScheme: workouts.tiebreakScheme,
          timeCap: workouts.timeCap,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.trackId, track.id))
      .orderBy(trackWorkoutsTable.trackOrder)

    return { workouts: trackWorkouts }
  })

/**
 * Get competition divisions for volunteers with score access
 * This is a simplified version that only requires score access entitlement
 */
export const getCompetitionDivisionsForScoreEntryFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    volunteerScoreAccessInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    // Check score access permission
    await requireScoreAccess(data.competitionTeamId)

    const db = getDb()

    // Get competition settings to find the scaling group
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Parse settings to get scaling group ID
    let scalingGroupId: string | null = null
    if (competition.settings) {
      try {
        const settings = JSON.parse(competition.settings) as {
          divisions?: { scalingGroupId?: string }
        }
        scalingGroupId = settings?.divisions?.scalingGroupId ?? null
      } catch {
        // Ignore parse errors
      }
    }

    if (!scalingGroupId) {
      return { divisions: [] }
    }

    // Get divisions
    const divisions = await db
      .select({
        id: scalingLevelsTable.id,
        label: scalingLevelsTable.label,
        position: scalingLevelsTable.position,
      })
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
      .orderBy(scalingLevelsTable.position)

    return { divisions }
  })

/**
 * Backfill: Recompute multi-round time-with-cap scores that were saved
 * with the old clamping bug (parent scoreValue clamped to timeCap).
 *
 * For each affected score:
 * - Re-aggregates parent scoreValue from the persisted rounds using the
 *   workout's scoreType.
 * - Recomputes per-round status based on encoded value vs cap.
 * - Recomputes parent status: "cap" if any round capped, else "scored".
 * - Recomputes sortKey.
 *
 * Scoped to a single competition. Requires MANAGE_COMPETITIONS.
 */
export const backfillMultiRoundCapScoresFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        organizingTeamId: z.string().min(1),
        competitionId: z.string().min(1),
        /** Dry-run: compute but don't write. Defaults to false. */
        dryRun: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (competition.organizingTeamId !== data.organizingTeamId) {
      throw new Error("Competition does not belong to this team")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    // Resolve track for this competition to scope trackWorkoutIds.
    // Competition ownership was verified above, so competitionId filter is
    // sufficient for multi-tenant isolation.
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.competitionId, data.competitionId),
    })
    if (!track) {
      return { scanned: 0, updated: 0, skipped: 0, changes: [] }
    }

    const trackWorkoutRows = await db
      .select({
        id: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
        scheme: workouts.scheme,
        scoreType: workouts.scoreType,
        timeCap: workouts.timeCap,
        tiebreakScheme: workouts.tiebreakScheme,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(
        and(
          eq(trackWorkoutsTable.trackId, track.id),
          eq(workouts.scheme, "time-with-cap"),
        ),
      )

    if (trackWorkoutRows.length === 0) {
      return { scanned: 0, updated: 0, skipped: 0, changes: [] }
    }

    const trackWorkoutIds = trackWorkoutRows.map((tw) => tw.id)
    const twById = new Map(trackWorkoutRows.map((tw) => [tw.id, tw]))

    // Load all scores for these track workouts
    const scores = await db
      .select({
        id: scoresTable.id,
        userId: scoresTable.userId,
        competitionEventId: scoresTable.competitionEventId,
        scheme: scoresTable.scheme,
        scoreType: scoresTable.scoreType,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        timeCapMs: scoresTable.timeCapMs,
        tiebreakScheme: scoresTable.tiebreakScheme,
        tiebreakValue: scoresTable.tiebreakValue,
        secondaryValue: scoresTable.secondaryValue,
        sortKey: scoresTable.sortKey,
      })
      .from(scoresTable)
      .where(inArray(scoresTable.competitionEventId, trackWorkoutIds))

    if (scores.length === 0) {
      return { scanned: 0, updated: 0, skipped: 0, changes: [] }
    }

    const scoreIds = scores.map((s) => s.id)
    const roundRows = await db
      .select({
        scoreId: scoreRoundsTable.scoreId,
        id: scoreRoundsTable.id,
        roundNumber: scoreRoundsTable.roundNumber,
        value: scoreRoundsTable.value,
        status: scoreRoundsTable.status,
      })
      .from(scoreRoundsTable)
      .where(inArray(scoreRoundsTable.scoreId, scoreIds))

    // Group rounds by scoreId
    const roundsByScore = new Map<string, typeof roundRows>()
    for (const r of roundRows) {
      const list = roundsByScore.get(r.scoreId) ?? []
      list.push(r)
      roundsByScore.set(r.scoreId, list)
    }

    const changes: Array<{
      scoreId: string
      userId: string
      trackWorkoutId: string | null
      before: { scoreValue: number | null; status: string }
      after: { scoreValue: number; status: "scored" | "cap" }
      rounds: Array<{
        roundNumber: number
        value: number
        status: "scored" | "cap"
      }>
    }> = []

    let updated = 0
    let skipped = 0

    for (const score of scores) {
      const rounds = (roundsByScore.get(score.id) ?? []).sort(
        (a, b) => a.roundNumber - b.roundNumber,
      )
      if (rounds.length < 2) {
        skipped++
        continue
      }
      const tw = score.competitionEventId
        ? twById.get(score.competitionEventId)
        : null
      if (!tw || !tw.timeCap) {
        skipped++
        continue
      }

      const capMs = tw.timeCap * 1000
      const roundValues = rounds.map((r) => r.value)
      const effectiveScoreType =
        (tw.scoreType as ScoreType) ||
        (score.scoreType as ScoreType) ||
        getDefaultScoreType("time-with-cap")

      const recomputedValue = aggregateValues(roundValues, effectiveScoreType)
      if (recomputedValue === null) {
        skipped++
        continue
      }

      const roundStatuses: Array<"scored" | "cap"> = roundValues.map((v) =>
        v >= capMs ? "cap" : "scored",
      )
      const cappedRoundCount = roundStatuses.filter((s) => s === "cap").length
      const anyCap = cappedRoundCount > 0
      const newStatus: "scored" | "cap" = anyCap ? "cap" : "scored"

      const newSortKey = computeSortKey({
        value: recomputedValue,
        status: newStatus,
        scheme: "time-with-cap",
        scoreType: effectiveScoreType,
        cappedRoundCount,
        tiebreak:
          score.tiebreakValue !== null && score.tiebreakScheme
            ? {
                scheme: score.tiebreakScheme as "time" | "reps",
                value: score.tiebreakValue,
              }
            : undefined,
      })
      const newSortKeyString = sortKeyToString(newSortKey)

      // Only update when something actually changed. A stale `sortKey` is
      // on its own sufficient reason to rewrite — this is how the backfill
      // repairs scores written before the cap-count tiebreaker was added.
      const valueChanged = score.scoreValue !== recomputedValue
      const statusChanged = score.status !== newStatus
      const roundStatusChanged = rounds.some(
        (r, i) => (r.status ?? null) !== roundStatuses[i],
      )
      const sortKeyChanged = score.sortKey !== newSortKeyString

      if (
        !valueChanged &&
        !statusChanged &&
        !roundStatusChanged &&
        !sortKeyChanged
      ) {
        skipped++
        continue
      }

      changes.push({
        scoreId: score.id,
        userId: score.userId,
        trackWorkoutId: score.competitionEventId,
        before: { scoreValue: score.scoreValue, status: score.status },
        after: { scoreValue: recomputedValue, status: newStatus },
        rounds: rounds.map((r, i) => ({
          roundNumber: r.roundNumber,
          value: r.value,
          status: roundStatuses[i],
        })),
      })

      if (!data.dryRun) {
        await db.transaction(async (tx) => {
          await tx
            .update(scoresTable)
            .set({
              scoreValue: recomputedValue,
              status: newStatus,
              statusOrder: STATUS_ORDER[newStatus],
              sortKey: newSortKeyString,
              updatedAt: new Date(),
            })
            .where(eq(scoresTable.id, score.id))

          for (let i = 0; i < rounds.length; i++) {
            const round = rounds[i]
            const desired = roundStatuses[i]
            if ((round.status ?? null) !== desired) {
              await tx
                .update(scoreRoundsTable)
                .set({ status: desired })
                .where(eq(scoreRoundsTable.id, round.id))
            }
          }
        })
      }

      updated++
    }

    logInfo({
      message: "[Score] Multi-round cap backfill completed",
      attributes: {
        competitionId: data.competitionId,
        scanned: scores.length,
        updated,
        skipped,
        dryRun: !!data.dryRun,
      },
    })

    return {
      scanned: scores.length,
      updated,
      skipped,
      dryRun: !!data.dryRun,
      changes,
    }
  })
