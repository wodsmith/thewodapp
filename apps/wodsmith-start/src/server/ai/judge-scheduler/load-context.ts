import "server-only"

import {eq, inArray} from "drizzle-orm"
import {getDb} from "@/db"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionJudgeRotationsTable,
  competitionVenuesTable,
  teamMembershipTable,
  trackWorkoutsTable,
  userTable,
} from "@/db/schema"
import {
  VOLUNTEER_ROLE_TYPES,
  type VolunteerMembershipMetadata,
} from "@/db/schemas/volunteers"
import {buildSchedulingContext} from "./context"
import type {
  SchedulingContext,
  SchedulingHeatInput,
  SchedulingJudgeInput,
  SchedulingRotationInput,
} from "./types"

export interface LoadEventContextInput {
  /** Team that owns the volunteer roster (competition team). */
  competitionTeamId: string
  /** Event id. */
  trackWorkoutId: string
}

/**
 * Load all the data the AI judge-scheduler agent needs to reason about an event:
 * heats with venue lane counts and per-heat occupied lanes, the judge roster
 * with availability metadata, existing rotations, and event scheduling defaults.
 *
 * Pure DB read — does NOT enforce permissions; the caller (server fn or API
 * route) must run requireTeamPermission first.
 */
export async function loadEventContext(
  input: LoadEventContextInput,
): Promise<SchedulingContext> {
  const db = getDb()

  const heatRows = await db
    .select({
      id: competitionHeatsTable.id,
      heatNumber: competitionHeatsTable.heatNumber,
      scheduledTime: competitionHeatsTable.scheduledTime,
      durationMinutes: competitionHeatsTable.durationMinutes,
      venueId: competitionHeatsTable.venueId,
    })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.trackWorkoutId, input.trackWorkoutId))

  const venueIds = [
    ...new Set(
      heatRows.map((h) => h.venueId).filter((v): v is string => !!v),
    ),
  ]
  const venues =
    venueIds.length > 0
      ? await db
          .select({
            id: competitionVenuesTable.id,
            laneCount: competitionVenuesTable.laneCount,
          })
          .from(competitionVenuesTable)
          .where(inArray(competitionVenuesTable.id, venueIds))
      : []
  const venueMap = new Map(venues.map((v) => [v.id, v]))

  const heatIds = heatRows.map((h) => h.id)
  const heatAssignments =
    heatIds.length > 0
      ? await db
          .select({
            heatId: competitionHeatAssignmentsTable.heatId,
            laneNumber: competitionHeatAssignmentsTable.laneNumber,
          })
          .from(competitionHeatAssignmentsTable)
          .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
      : []

  const occupiedByHeat = new Map<string, Set<number>>()
  for (const a of heatAssignments) {
    const set = occupiedByHeat.get(a.heatId) ?? new Set<number>()
    set.add(a.laneNumber)
    occupiedByHeat.set(a.heatId, set)
  }

  const heats: SchedulingHeatInput[] = heatRows.map((h) => ({
    heatNumber: h.heatNumber,
    laneCount: h.venueId ? venueMap.get(h.venueId)?.laneCount ?? 0 : 0,
    occupiedLanes: occupiedByHeat.get(h.id),
    scheduledTime: h.scheduledTime,
    durationMinutes: h.durationMinutes,
  }))

  const memberships = await db
    .select({
      id: teamMembershipTable.id,
      userId: teamMembershipTable.userId,
      metadata: teamMembershipTable.metadata,
    })
    .from(teamMembershipTable)
    .where(eq(teamMembershipTable.teamId, input.competitionTeamId))

  const judgeMemberships = memberships.filter((m) =>
    isJudgeMembership(m.metadata),
  )
  const userIds = [...new Set(judgeMemberships.map((m) => m.userId))]
  const users =
    userIds.length > 0
      ? await db
          .select({
            id: userTable.id,
            firstName: userTable.firstName,
            lastName: userTable.lastName,
          })
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const judges: SchedulingJudgeInput[] = judgeMemberships.map((m) => {
    const meta = parseMetadata(m.metadata)
    const user = userMap.get(m.userId)
    const displayName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      "Unknown judge"
    return {
      membershipId: m.id,
      displayName,
      availability: meta?.availability,
      availabilityNotes: meta?.availabilityNotes,
      credentials: meta?.credentials,
    }
  })

  const rotations = await db
    .select()
    .from(competitionJudgeRotationsTable)
    .where(
      eq(competitionJudgeRotationsTable.trackWorkoutId, input.trackWorkoutId),
    )
  const rotationInputs: SchedulingRotationInput[] = rotations.map((r) => ({
    id: r.id,
    membershipId: r.membershipId,
    startingHeat: r.startingHeat,
    startingLane: r.startingLane,
    heatsCount: r.heatsCount,
    laneShiftPattern: r.laneShiftPattern,
  }))

  const event = await db.query.trackWorkoutsTable.findFirst({
    where: eq(trackWorkoutsTable.id, input.trackWorkoutId),
  })
  const minHeatBuffer = event?.minHeatBuffer ?? 1

  return buildSchedulingContext({
    heats,
    judges,
    rotations: rotationInputs,
    eventDefaults: {minHeatBuffer},
  })
}

function parseMetadata(
  metadata: string | null,
): VolunteerMembershipMetadata | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as VolunteerMembershipMetadata
  } catch {
    return null
  }
}

function isJudgeMembership(metadata: string | null): boolean {
  const meta = parseMetadata(metadata)
  if (!meta?.volunteerRoleTypes) return false
  return (
    meta.volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.JUDGE) ||
    meta.volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)
  )
}
