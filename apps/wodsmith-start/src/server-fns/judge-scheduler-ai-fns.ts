import "server-only"

import {createServerFn} from "@tanstack/react-start"
import {eq, inArray} from "drizzle-orm"
import {z} from "zod"
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
import {TEAM_PERMISSIONS} from "@/db/schemas/teams"
import {
  VOLUNTEER_ROLE_TYPES,
  type VolunteerMembershipMetadata,
} from "@/db/schemas/volunteers"
import {isAiHeatSchedulingEnabled} from "@/lib/env"
import {runJudgeSchedulerAgent} from "@/server/ai/judge-scheduler/agent"
import {buildSchedulingContext} from "@/server/ai/judge-scheduler/context"
import {projectCoverage} from "@/server/ai/judge-scheduler/projector"
import type {
  SchedulingHeatInput,
  SchedulingJudgeInput,
  SchedulingRotationInput,
} from "@/server/ai/judge-scheduler/types"
import {requireTeamPermission} from "@/utils/team-auth"

const inputSchema = z.object({
  competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
  organizingTeamId: z
    .string()
    .startsWith("team_", "Invalid organizing team ID"),
  competitionTeamId: z
    .string()
    .startsWith("team_", "Invalid competition team ID"),
  trackWorkoutId: z.string().min(1, "trackWorkoutId is required"),
  organizerInstructions: z.string().max(2000).optional(),
})

export const generateJudgeRotationSuggestionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({data}) => {
    if (!isAiHeatSchedulingEnabled()) {
      return {ok: false as const, reason: "feature_disabled" as const}
    }
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()

    const heats = await db
      .select({
        id: competitionHeatsTable.id,
        heatNumber: competitionHeatsTable.heatNumber,
        scheduledTime: competitionHeatsTable.scheduledTime,
        durationMinutes: competitionHeatsTable.durationMinutes,
        venueId: competitionHeatsTable.venueId,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    const venueIds = [
      ...new Set(
        heats
          .map((h) => h.venueId)
          .filter((v): v is string => !!v),
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

    const heatIds = heats.map((h) => h.id)
    const heatAssignments =
      heatIds.length > 0
        ? await db
            .select({
              heatId: competitionHeatAssignmentsTable.heatId,
              laneNumber: competitionHeatAssignmentsTable.laneNumber,
            })
            .from(competitionHeatAssignmentsTable)
            .where(
              inArray(competitionHeatAssignmentsTable.heatId, heatIds),
            )
        : []

    const occupiedByHeat = new Map<string, Set<number>>()
    for (const a of heatAssignments) {
      const set = occupiedByHeat.get(a.heatId) ?? new Set<number>()
      set.add(a.laneNumber)
      occupiedByHeat.set(a.heatId, set)
    }

    const heatInputs: SchedulingHeatInput[] = heats.map((h) => ({
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
      .where(eq(teamMembershipTable.teamId, data.competitionTeamId))

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

    const judgeInputs: SchedulingJudgeInput[] = judgeMemberships.map((m) => {
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
        eq(
          competitionJudgeRotationsTable.trackWorkoutId,
          data.trackWorkoutId,
        ),
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
      where: eq(trackWorkoutsTable.id, data.trackWorkoutId),
    })
    const minHeatBuffer = event?.minHeatBuffer ?? 1

    const context = buildSchedulingContext({
      heats: heatInputs,
      judges: judgeInputs,
      rotations: rotationInputs,
      eventDefaults: {minHeatBuffer},
    })

    const result = await runJudgeSchedulerAgent({
      context,
      organizerInstructions: data.organizerInstructions,
    })

    const proposalRotations = result.proposals.map((p) => p.proposal)
    const projected = projectCoverage(rotationInputs, proposalRotations, heatInputs)

    return {
      ok: true as const,
      proposals: result.proposals,
      narrative: result.narrative,
      coverageBefore: {
        coveragePercent: context.coverage.coveragePercent,
        coveredSlots: context.coverage.coveredSlots,
        totalSlots: context.coverage.totalSlots,
      },
      coverageAfterIfAllAccepted: {
        coveragePercent: projected.coveragePercent,
        coveredSlots: projected.coveredSlots,
        totalSlots: projected.totalSlots,
      },
    }
  })

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
