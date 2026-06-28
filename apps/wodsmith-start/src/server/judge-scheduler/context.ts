import "server-only"

import { and, asc, desc, eq, inArray, max, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionJudgeRotationsTable,
  competitionsTable,
  competitionVenuesTable,
  programmingTracksTable,
  trackWorkoutsTable,
  userTable,
  workouts,
} from "@/db/schema"
import { SYSTEM_ROLES_ENUM, teamMembershipTable } from "@/db/schemas/teams"
import {
  LANE_SHIFT_PATTERN,
  type LaneShiftPattern,
  type VolunteerMembershipMetadata,
} from "@/db/schemas/volunteers"
import type {
  EventContextDto,
  HeatInfoDto,
  JudgeRosterEntry,
  PriorRotationExample,
} from "@/lib/judge-scheduler/schemas"

const DEFAULT_HEATS_PER_ROTATION = 4
const DEFAULT_LANE_SHIFT_PATTERN: LaneShiftPattern = LANE_SHIFT_PATTERN.STAY
const DEFAULT_MIN_HEAT_BUFFER = 2

/**
 * Load everything the agent needs to know about the event being scheduled.
 *
 * The DTO is intentionally flat and pre-formatted: the LLM never sees raw
 * column names or DB joins, only the concepts it reasons about.
 */
export async function loadEventContext(
  trackWorkoutId: string,
): Promise<EventContextDto> {
  const db = getDb()

  const [eventRow] = await db
    .select({
      trackWorkoutId: trackWorkoutsTable.id,
      workoutName: workouts.name,
      competitionId: programmingTracksTable.competitionId,
      defaultHeatsCount: trackWorkoutsTable.defaultHeatsCount,
      defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
      minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(trackWorkoutsTable.id, trackWorkoutId))

  if (!eventRow || !eventRow.competitionId) {
    throw new Error(`Event not found or has no competition: ${trackWorkoutId}`)
  }

  const competitionId = eventRow.competitionId

  // Competition-level defaults are the fallback when the per-event
  // columns are null. Without this, the agent gets a hardcoded code
  // constant instead of the organizer's competition-wide setting.
  const [competitionDefaults] = await db
    .select({
      defaultHeatsPerRotation: competitionsTable.defaultHeatsPerRotation,
      defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))

  const heatRows = await db
    .select({
      id: competitionHeatsTable.id,
      heatNumber: competitionHeatsTable.heatNumber,
      scheduledTime: competitionHeatsTable.scheduledTime,
      laneCount: competitionVenuesTable.laneCount,
    })
    .from(competitionHeatsTable)
    .leftJoin(
      competitionVenuesTable,
      eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
    )
    .where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))
    .orderBy(asc(competitionHeatsTable.heatNumber))

  const heatIds = heatRows.map((h) => h.id)
  const occupiedRows =
    heatIds.length > 0
      ? await db
          .select({
            heatId: competitionHeatAssignmentsTable.heatId,
            laneNumber: competitionHeatAssignmentsTable.laneNumber,
          })
          .from(competitionHeatAssignmentsTable)
          .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
      : []

  const occupiedByHeatId = new Map<string, number[]>()
  for (const row of occupiedRows) {
    const list = occupiedByHeatId.get(row.heatId) ?? []
    list.push(row.laneNumber)
    occupiedByHeatId.set(row.heatId, list)
  }

  const fallbackLaneCount = await getCompetitionFallbackLaneCount(competitionId)

  const heats: HeatInfoDto[] = heatRows.map((h) => ({
    heatNumber: h.heatNumber,
    laneCount: h.laneCount ?? fallbackLaneCount,
    startTime: h.scheduledTime ? h.scheduledTime.toISOString() : null,
    occupiedLanes: (occupiedByHeatId.get(h.id) ?? []).sort((a, b) => a - b),
  }))

  const rotationRows = await db
    .select({
      membershipId: competitionJudgeRotationsTable.membershipId,
      startingHeat: competitionJudgeRotationsTable.startingHeat,
      startingLane: competitionJudgeRotationsTable.startingLane,
      heatsCount: competitionJudgeRotationsTable.heatsCount,
      laneShiftPattern: competitionJudgeRotationsTable.laneShiftPattern,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
    })
    .from(competitionJudgeRotationsTable)
    .leftJoin(
      teamMembershipTable,
      eq(competitionJudgeRotationsTable.membershipId, teamMembershipTable.id),
    )
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutId))

  const totalHeats = heats.length

  // Resolve defaults in order: event → competition → code constant.
  // Clamp the rotation length to totalHeats so the model isn't told
  // "default is 4 heats" on a 3-heat workout, which would otherwise
  // burn steps producing rotations that fail the hard length check.
  const rawDefaultHeats =
    eventRow.defaultHeatsCount ??
    competitionDefaults?.defaultHeatsPerRotation ??
    DEFAULT_HEATS_PER_ROTATION
  const defaultHeatsPerRotation =
    totalHeats > 0 ? Math.min(rawDefaultHeats, totalHeats) : rawDefaultHeats
  const defaultLaneShiftPattern =
    (eventRow.defaultLaneShiftPattern as LaneShiftPattern | null) ??
    (competitionDefaults?.defaultLaneShiftPattern as LaneShiftPattern | null) ??
    DEFAULT_LANE_SHIFT_PATTERN

  return {
    trackWorkoutId,
    workoutName: eventRow.workoutName,
    competitionId,
    totalHeats,
    defaultHeatsPerRotation,
    defaultLaneShiftPattern,
    minHeatBuffer: eventRow.minHeatBuffer ?? DEFAULT_MIN_HEAT_BUFFER,
    heats,
    existingRotations: rotationRows.map((r) => ({
      membershipId: r.membershipId ?? "",
      judgeName: formatJudgeName(r.firstName, r.lastName, r.email),
      startingHeat: r.startingHeat,
      startingLane: r.startingLane,
      heatsCount: r.heatsCount,
      laneShiftPattern:
        (r.laneShiftPattern as LaneShiftPattern) ?? DEFAULT_LANE_SHIFT_PATTERN,
    })),
  }
}

/**
 * Load the eligible judges (volunteers with the volunteer system role) for
 * a competition along with the preference fields the agent reasons over.
 */
export async function loadJudgeRoster(
  competitionId: string,
): Promise<JudgeRosterEntry[]> {
  const db = getDb()

  const [competition] = await db
    .select({ competitionTeamId: competitionsTable.competitionTeamId })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
  if (!competition) {
    throw new Error(`Competition not found: ${competitionId}`)
  }

  const memberships = await db
    .select({
      id: teamMembershipTable.id,
      metadata: teamMembershipTable.metadata,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
    })
    .from(teamMembershipTable)
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, competition.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    )

  const rotationCounts = await db
    .select({
      membershipId: competitionJudgeRotationsTable.membershipId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(competitionJudgeRotationsTable)
    .where(eq(competitionJudgeRotationsTable.competitionId, competitionId))
    .groupBy(competitionJudgeRotationsTable.membershipId)

  const countByMembership = new Map(
    rotationCounts.map((r) => [r.membershipId, Number(r.count)]),
  )

  const judges: JudgeRosterEntry[] = []
  for (const m of memberships) {
    const meta = parseVolunteerMetadata(m.metadata)
    if (!includesJudgeRole(meta)) continue
    judges.push({
      membershipId: m.id,
      name: formatJudgeName(m.firstName, m.lastName, m.email),
      availability: meta?.availability ?? null,
      availabilityNotes: meta?.availabilityNotes ?? null,
      credentials: meta?.credentials ?? null,
      currentRotationCount: countByMembership.get(m.id) ?? 0,
    })
  }

  return judges
}

/**
 * Pull a small number of recent rotations from other workouts in the same
 * competition. The agent uses these as style examples when proposing.
 */
export async function loadPriorRotations(
  competitionId: string,
  excludeTrackWorkoutId: string,
  limit = 12,
): Promise<PriorRotationExample[]> {
  const db = getDb()

  const rows = await db
    .select({
      workoutName: workouts.name,
      startingHeat: competitionJudgeRotationsTable.startingHeat,
      startingLane: competitionJudgeRotationsTable.startingLane,
      heatsCount: competitionJudgeRotationsTable.heatsCount,
      laneShiftPattern: competitionJudgeRotationsTable.laneShiftPattern,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
      createdAt: competitionJudgeRotationsTable.createdAt,
    })
    .from(competitionJudgeRotationsTable)
    .innerJoin(
      trackWorkoutsTable,
      eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutsTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .leftJoin(
      teamMembershipTable,
      eq(competitionJudgeRotationsTable.membershipId, teamMembershipTable.id),
    )
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(competitionJudgeRotationsTable.competitionId, competitionId),
        ne(
          competitionJudgeRotationsTable.trackWorkoutId,
          excludeTrackWorkoutId,
        ),
      ),
    )
    .orderBy(desc(competitionJudgeRotationsTable.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    workoutName: r.workoutName,
    judgeName: formatJudgeName(r.firstName, r.lastName, r.email),
    startingHeat: r.startingHeat,
    startingLane: r.startingLane,
    heatsCount: r.heatsCount,
    laneShiftPattern:
      (r.laneShiftPattern as LaneShiftPattern) ?? DEFAULT_LANE_SHIFT_PATTERN,
  }))
}

async function getCompetitionFallbackLaneCount(
  competitionId: string,
): Promise<number> {
  const db = getDb()
  const [row] = await db
    .select({ maxLanes: max(competitionVenuesTable.laneCount) })
    .from(competitionVenuesTable)
    .where(eq(competitionVenuesTable.competitionId, competitionId))
  return row?.maxLanes ?? 5
}

function parseVolunteerMetadata(
  raw: string | null,
): VolunteerMembershipMetadata | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as VolunteerMembershipMetadata
  } catch {
    return null
  }
}

function includesJudgeRole(
  metadata: VolunteerMembershipMetadata | null,
): boolean {
  const roles = metadata?.volunteerRoleTypes
  if (!roles || roles.length === 0) return true
  return roles.includes("judge")
}

function formatJudgeName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim()
  return full || email || "Unnamed Judge"
}
