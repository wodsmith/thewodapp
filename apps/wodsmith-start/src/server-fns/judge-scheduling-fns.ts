/**
 * Judge Scheduling Server Functions for TanStack Start
 * Port of apps/wodsmith/src/server/judge-scheduling.ts and judge-schedule.ts
 * Converted from Next.js server actions to TanStack Start createServerFn pattern
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  type CompetitionHeatVolunteer,
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionJudgeRotationsTable,
  competitionRegistrationsTable,
  competitionsTable,
  competitionVenuesTable,
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
  scalingLevelsTable,
  teamMembershipTable,
  trackWorkoutsTable,
  userTable,
  VOLUNTEER_ROLE_TYPES,
  workouts,
} from "@/db/schema"
import {
  createHeatVolunteerId,
  createJudgeAssignmentVersionId,
} from "@/db/schemas/common"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import type {
  VolunteerAvailability,
  VolunteerMembershipMetadata,
} from "@/db/schemas/volunteers"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface JudgeVolunteerInfo {
  membershipId: string
  userId: string
  firstName: string | null
  lastName: string | null
  avatar?: string | null
  volunteerRoleTypes: string[]
  credentials?: string
  availability?: VolunteerAvailability
  availabilityNotes?: string
}

export interface JudgeHeatAssignment extends CompetitionHeatVolunteer {
  volunteer: JudgeVolunteerInfo
  versionId: string | null
  isManualOverride: boolean
}

export interface JudgeConflictInfo {
  heatId: string
  heatNumber: number
  scheduledTime: Date | null
  trackWorkoutId: string
}

export interface JudgeOverview {
  totalJudges: number
  judgesRequired: number
  coveragePercent: number
  totalSlots: number
  coveredSlots: number
  gaps: number
  overlaps: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const competitionTeamIdSchema = z
  .string()
  .startsWith("team_", "Invalid team ID")

const membershipIdSchema = z
  .string()
  .startsWith("tmem_", "Invalid membership ID")

const heatIdSchema = z.string().min(1, "Heat ID is required")

const assignmentIdSchema = z.string().min(1, "Assignment ID is required")

const volunteerRoleTypeSchema = z.enum([
  VOLUNTEER_ROLE_TYPES.JUDGE,
  VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
  VOLUNTEER_ROLE_TYPES.EQUIPMENT,
  VOLUNTEER_ROLE_TYPES.MEDICAL,
  VOLUNTEER_ROLE_TYPES.CHECK_IN,
  VOLUNTEER_ROLE_TYPES.STAFF,
  VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
  VOLUNTEER_ROLE_TYPES.EMCEE,
  VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER,
  VOLUNTEER_ROLE_TYPES.MEDIA,
  VOLUNTEER_ROLE_TYPES.GENERAL,
])

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse volunteer metadata from membership record
 */
function parseVolunteerMetadata(
  metadata: string | null,
): VolunteerMembershipMetadata | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as VolunteerMembershipMetadata
  } catch {
    return null
  }
}

/**
 * Check if volunteer has judge or head_judge role type
 */
function isJudge(metadata: string | null): boolean {
  const meta = parseVolunteerMetadata(metadata)
  if (!meta?.volunteerRoleTypes) return false
  return (
    meta.volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.JUDGE) ||
    meta.volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)
  )
}

async function getTrackWorkoutIdForHeat(heatId: string): Promise<string> {
  const db = getDb()
  const heat = await db
    .select({ trackWorkoutId: competitionHeatsTable.trackWorkoutId })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.id, heatId))
    .then((rows) => rows[0] ?? null)

  if (!heat) {
    throw new Error("Heat not found")
  }

  return heat.trackWorkoutId
}

type JudgeAssignmentSnapshot = typeof judgeHeatAssignmentsTable.$inferInsert
type JudgeAssignmentRow = typeof judgeHeatAssignmentsTable.$inferSelect

async function createPublishedJudgeScheduleRevision(
  trackWorkoutId: string,
  editAssignments: (
    assignments: JudgeAssignmentSnapshot[],
  ) => JudgeAssignmentSnapshot[],
): Promise<{ assignments: JudgeAssignmentRow[]; versionId: string }> {
  const db = getDb()

  const heats = await db
    .select({ id: competitionHeatsTable.id })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))

  if (heats.length === 0) {
    throw new Error("No heats found for event")
  }

  const heatIds = heats.map((h) => h.id)
  const versions = await db.query.judgeAssignmentVersionsTable.findMany({
    where: eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
    orderBy: desc(judgeAssignmentVersionsTable.version),
  })
  const activeVersion = versions.find((version) => version.isActive) ?? null
  const nextVersion = versions.length > 0 ? (versions[0]?.version ?? 0) + 1 : 1
  const sourceAssignments = activeVersion
    ? await db
        .select()
        .from(judgeHeatAssignmentsTable)
        .where(
          and(
            inArray(judgeHeatAssignmentsTable.heatId, heatIds),
            eq(judgeHeatAssignmentsTable.versionId, activeVersion.id),
          ),
        )
    : []
  const sourceAssignmentIds = new Set(sourceAssignments.map((a) => a.id))

  const newVersionId = createJudgeAssignmentVersionId()
  const editedAssignments = editAssignments(
    sourceAssignments.map((assignment) => ({
      id: assignment.id,
      heatId: assignment.heatId,
      membershipId: assignment.membershipId,
      rotationId: assignment.rotationId,
      laneNumber: assignment.laneNumber,
      position: assignment.position,
      instructions: assignment.instructions,
      isManualOverride: assignment.isManualOverride,
    })),
  ).map((assignment) => ({
    ...assignment,
    id:
      assignment.id && !sourceAssignmentIds.has(assignment.id)
        ? assignment.id
        : createHeatVolunteerId(),
    versionId: newVersionId,
  }))

  await db.transaction(async (tx) => {
    await tx
      .update(judgeAssignmentVersionsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId))

    await tx.insert(judgeAssignmentVersionsTable).values({
      id: newVersionId,
      trackWorkoutId,
      version: nextVersion,
      notes: activeVersion
        ? `Edited published schedule v${activeVersion.version}`
        : "Edited published schedule",
      isActive: true,
    })

    if (editedAssignments.length > 0) {
      await tx.insert(judgeHeatAssignmentsTable).values(editedAssignments)
    }
  })

  const assignments =
    editedAssignments.length > 0
      ? await db
          .select()
          .from(judgeHeatAssignmentsTable)
          .where(eq(judgeHeatAssignmentsTable.versionId, newVersionId))
      : []

  return { assignments, versionId: newVersionId }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all volunteers with judge or head_judge role types for a competition team.
 */
export const getJudgeVolunteersFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<JudgeVolunteerInfo[]> => {
    const db = getDb()

    // Get all memberships for the competition team
    const memberships = await db
      .select({
        id: teamMembershipTable.id,
        userId: teamMembershipTable.userId,
        metadata: teamMembershipTable.metadata,
      })
      .from(teamMembershipTable)
      .where(eq(teamMembershipTable.teamId, data.competitionTeamId))

    // Filter for judge volunteers
    const judgeVolunteers = memberships.filter((m) => isJudge(m.metadata))

    if (judgeVolunteers.length === 0) {
      return []
    }

    // Fetch users
    const userIds = [...new Set(judgeVolunteers.map((v) => v.userId))]
    const users = await db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        avatar: userTable.avatar,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds))
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Build result
    return judgeVolunteers.map((volunteer) => {
      const meta = parseVolunteerMetadata(volunteer.metadata)
      const user = userMap.get(volunteer.userId)

      return {
        membershipId: volunteer.id,
        userId: volunteer.userId,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        avatar: user?.avatar ?? null,
        volunteerRoleTypes: meta?.volunteerRoleTypes ?? [],
        credentials: meta?.credentials,
        availability: meta?.availability,
        availabilityNotes: meta?.availabilityNotes,
      }
    })
  })

/**
 * Get all judge assignments for all heats of a track workout (event).
 */
export const getJudgeHeatAssignmentsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        trackWorkoutId: z.string().min(1, "Track workout ID is required"),
        versionId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<JudgeHeatAssignment[]> => {
    const db = getDb()

    // If no versionId provided, find the active version for this event
    let targetVersionId: string
    if (data.versionId) {
      targetVersionId = data.versionId
    } else {
      const activeVersion = await db
        .select()
        .from(judgeAssignmentVersionsTable)
        .where(
          and(
            eq(
              judgeAssignmentVersionsTable.trackWorkoutId,
              data.trackWorkoutId,
            ),
            eq(judgeAssignmentVersionsTable.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)

      // If no active version exists, return empty array (nothing published yet)
      if (!activeVersion) {
        return []
      }

      targetVersionId = activeVersion.id
    }

    // Get all heats for this event
    const heats = await db
      .select({ id: competitionHeatsTable.id })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    if (heats.length === 0) {
      return []
    }

    const heatIds = heats.map((h) => h.id)

    // Fetch assignments filtered by versionId
    const assignments = await db
      .select()
      .from(judgeHeatAssignmentsTable)
      .where(
        and(
          inArray(judgeHeatAssignmentsTable.heatId, heatIds),
          eq(judgeHeatAssignmentsTable.versionId, targetVersionId),
        ),
      )

    if (assignments.length === 0) {
      return []
    }

    // Get unique membership IDs
    const membershipIds = [...new Set(assignments.map((a) => a.membershipId))]

    // Fetch memberships
    const memberships = await db
      .select({
        id: teamMembershipTable.id,
        userId: teamMembershipTable.userId,
        metadata: teamMembershipTable.metadata,
      })
      .from(teamMembershipTable)
      .where(inArray(teamMembershipTable.id, membershipIds))

    // Fetch users
    const userIds = [...new Set(memberships.map((m) => m.userId))]
    const users = await db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        avatar: userTable.avatar,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds))
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Build membership info map
    const membershipMap = new Map(
      memberships.map((m) => {
        const meta = parseVolunteerMetadata(m.metadata)
        const user = userMap.get(m.userId)

        return [
          m.id,
          {
            membershipId: m.id,
            userId: m.userId,
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            avatar: user?.avatar ?? null,
            volunteerRoleTypes: meta?.volunteerRoleTypes ?? [],
            credentials: meta?.credentials,
            availabilityNotes: meta?.availabilityNotes,
          },
        ]
      }),
    )

    // Build result
    return assignments.map((assignment) => ({
      ...assignment,
      volunteer:
        membershipMap.get(assignment.membershipId) ??
        ({
          membershipId: assignment.membershipId,
          userId: "",
          firstName: null,
          lastName: null,
          volunteerRoleTypes: [],
        } as JudgeVolunteerInfo),
    }))
  })

/**
 * Get rotations for an event
 */
export const getRotationsForEventFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ trackWorkoutId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const rotations = await db.query.competitionJudgeRotationsTable.findMany({
      where: eq(
        competitionJudgeRotationsTable.trackWorkoutId,
        data.trackWorkoutId,
      ),
      orderBy: (table, { asc }) => [asc(table.startingHeat)],
    })

    // Get event defaults from trackWorkout
    const event = await db.query.trackWorkoutsTable.findFirst({
      where: eq(trackWorkoutsTable.id, data.trackWorkoutId),
    })

    const eventDefaults = {
      defaultHeatsCount: event?.defaultHeatsCount ?? null,
      defaultLaneShiftPattern: event?.defaultLaneShiftPattern ?? null,
      minHeatBuffer: event?.minHeatBuffer ?? null,
    }

    return {
      rotations,
      eventDefaults,
    }
  })

// Note: getVersionHistoryFn and getActiveVersionFn are in judge-assignment-fns.ts

/**
 * Batched judge-scheduling data for a set of events. Replaces per-event
 * calls to getJudgeHeatAssignmentsFn / getRotationsForEventFn /
 * getVersionHistoryFn / getActiveVersionFn with a constant number of
 * queries regardless of event count.
 */
export const getJudgeSchedulingDataForEventsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z.object({ trackWorkoutIds: z.array(z.string().min(1)) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { trackWorkoutIds } = data
    const db = getDb()

    type EventDefaults = {
      defaultHeatsCount: number | null
      defaultLaneShiftPattern: string | null
      minHeatBuffer: number | null
    }

    const judgeAssignments: JudgeHeatAssignment[] = []
    const rotationsByEvent: Record<
      string,
      (typeof competitionJudgeRotationsTable.$inferSelect)[]
    > = {}
    const eventDefaultsByEvent: Record<string, EventDefaults> = {}
    const versionHistoryByEvent: Record<
      string,
      (typeof judgeAssignmentVersionsTable.$inferSelect)[]
    > = {}
    const activeVersionByEvent: Record<
      string,
      typeof judgeAssignmentVersionsTable.$inferSelect | null
    > = {}

    if (trackWorkoutIds.length === 0) {
      return {
        judgeAssignments,
        rotationsByEvent,
        eventDefaultsByEvent,
        versionHistoryByEvent,
        activeVersionByEvent,
      }
    }

    for (const id of trackWorkoutIds) {
      rotationsByEvent[id] = []
      versionHistoryByEvent[id] = []
      activeVersionByEvent[id] = null
    }

    const [versions, rotations, eventRows] = await Promise.all([
      db.query.judgeAssignmentVersionsTable.findMany({
        where: inArray(
          judgeAssignmentVersionsTable.trackWorkoutId,
          trackWorkoutIds,
        ),
        orderBy: (table, { desc }) => [desc(table.version)],
        with: {
          publishedByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      db.query.competitionJudgeRotationsTable.findMany({
        where: inArray(
          competitionJudgeRotationsTable.trackWorkoutId,
          trackWorkoutIds,
        ),
        orderBy: (table, { asc }) => [asc(table.startingHeat)],
      }),
      db
        .select({
          id: trackWorkoutsTable.id,
          defaultHeatsCount: trackWorkoutsTable.defaultHeatsCount,
          defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
          minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
        })
        .from(trackWorkoutsTable)
        .where(inArray(trackWorkoutsTable.id, trackWorkoutIds)),
    ])

    for (const version of versions) {
      versionHistoryByEvent[version.trackWorkoutId]?.push(version)
      if (version.isActive) {
        activeVersionByEvent[version.trackWorkoutId] = version
      }
    }

    for (const rotation of rotations) {
      rotationsByEvent[rotation.trackWorkoutId]?.push(rotation)
    }

    for (const row of eventRows) {
      eventDefaultsByEvent[row.id] = {
        defaultHeatsCount: row.defaultHeatsCount ?? null,
        defaultLaneShiftPattern: row.defaultLaneShiftPattern ?? null,
        minHeatBuffer: row.minHeatBuffer ?? null,
      }
    }

    // Assignments only exist under a published (active) version; a version
    // belongs to exactly one event, so filtering by active version ids is
    // sufficient to scope assignments to their events.
    const activeVersionIds = versions.filter((v) => v.isActive).map((v) => v.id)

    if (activeVersionIds.length > 0) {
      const assignments = await db
        .select()
        .from(judgeHeatAssignmentsTable)
        .where(inArray(judgeHeatAssignmentsTable.versionId, activeVersionIds))

      if (assignments.length > 0) {
        const membershipIds = [
          ...new Set(assignments.map((a) => a.membershipId)),
        ]
        const memberships = await db
          .select({
            id: teamMembershipTable.id,
            userId: teamMembershipTable.userId,
            metadata: teamMembershipTable.metadata,
          })
          .from(teamMembershipTable)
          .where(inArray(teamMembershipTable.id, membershipIds))

        const userIds = [...new Set(memberships.map((m) => m.userId))]
        const users =
          userIds.length > 0
            ? await db
                .select({
                  id: userTable.id,
                  firstName: userTable.firstName,
                  lastName: userTable.lastName,
                  avatar: userTable.avatar,
                })
                .from(userTable)
                .where(inArray(userTable.id, userIds))
            : []
        const userMap = new Map(users.map((u) => [u.id, u]))

        const membershipMap = new Map(
          memberships.map((m) => {
            const meta = parseVolunteerMetadata(m.metadata)
            const user = userMap.get(m.userId)
            return [
              m.id,
              {
                membershipId: m.id,
                userId: m.userId,
                firstName: user?.firstName ?? null,
                lastName: user?.lastName ?? null,
                avatar: user?.avatar ?? null,
                volunteerRoleTypes: meta?.volunteerRoleTypes ?? [],
                credentials: meta?.credentials,
                availabilityNotes: meta?.availabilityNotes,
              },
            ]
          }),
        )

        for (const assignment of assignments) {
          judgeAssignments.push({
            ...assignment,
            volunteer:
              membershipMap.get(assignment.membershipId) ??
              ({
                membershipId: assignment.membershipId,
                userId: "",
                firstName: null,
                lastName: null,
                volunteerRoleTypes: [],
              } as JudgeVolunteerInfo),
          })
        }
      }
    }

    return {
      judgeAssignments,
      rotationsByEvent,
      eventDefaultsByEvent,
      versionHistoryByEvent,
      activeVersionByEvent,
    }
  })

/**
 * Get judge conflicts for a heat
 */
export const getJudgeConflictsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        membershipId: membershipIdSchema,
        heatId: heatIdSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<JudgeConflictInfo | null> => {
    const db = getDb()

    // Get the target heat's time
    const targetHeat = await db
      .select({
        scheduledTime: competitionHeatsTable.scheduledTime,
        durationMinutes: competitionHeatsTable.durationMinutes,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.id, data.heatId))
      .then((rows) => rows[0])

    if (!targetHeat?.scheduledTime) {
      // No scheduled time, can't check conflicts
      return null
    }

    // Get all heat assignments for this judge
    const judgeAssignments = await db
      .select({
        heatId: judgeHeatAssignmentsTable.heatId,
      })
      .from(judgeHeatAssignmentsTable)
      .where(eq(judgeHeatAssignmentsTable.membershipId, data.membershipId))

    if (judgeAssignments.length === 0) {
      return null
    }

    const assignedHeatIds = judgeAssignments.map((a) => a.heatId)

    // Fetch heat details
    const assignedHeats = await db
      .select({
        id: competitionHeatsTable.id,
        heatNumber: competitionHeatsTable.heatNumber,
        scheduledTime: competitionHeatsTable.scheduledTime,
        durationMinutes: competitionHeatsTable.durationMinutes,
        trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      })
      .from(competitionHeatsTable)
      .where(inArray(competitionHeatsTable.id, assignedHeatIds))

    // Check for time overlaps
    const targetStart = new Date(targetHeat.scheduledTime)
    const targetEnd = new Date(targetStart)
    targetEnd.setMinutes(
      targetEnd.getMinutes() + (targetHeat.durationMinutes ?? 15),
    )

    for (const heat of assignedHeats) {
      if (!heat.scheduledTime || heat.id === data.heatId) continue

      const heatStart = new Date(heat.scheduledTime)
      const heatEnd = new Date(heatStart)
      heatEnd.setMinutes(heatEnd.getMinutes() + (heat.durationMinutes ?? 15))

      // Check for overlap: (start1 < end2) AND (end1 > start2)
      if (targetStart < heatEnd && targetEnd > heatStart) {
        return {
          heatId: heat.id,
          heatNumber: heat.heatNumber,
          scheduledTime: heat.scheduledTime,
          trackWorkoutId: heat.trackWorkoutId,
        }
      }
    }

    return null
  })

/**
 * Calculate the minimum number of unique judges required to achieve full coverage.
 */
export function calculateRequiredJudges(
  heats: Array<{ heatNumber: number; laneCount: number }>,
  rotationLength = 3,
): number {
  if (heats.length === 0) return 0

  // Total slots that need coverage
  const totalSlots = heats.reduce((sum, heat) => sum + heat.laneCount, 0)

  // Average lanes per heat
  const avgLanes =
    heats.reduce((sum, heat) => sum + heat.laneCount, 0) / heats.length

  // If each judge works rotationLength heats, they cover rotationLength slots
  // We need enough judges to cover avgLanes at any given time
  const judgesPerHeat = Math.ceil(avgLanes)

  // Minimum judges needed (considering rotations)
  const minJudges = Math.ceil(totalSlots / (rotationLength * avgLanes))

  return Math.max(minJudges, judgesPerHeat)
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Assign a single judge to a heat lane
 */
export const assignJudgeToHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        heatId: heatIdSchema,
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
        membershipId: membershipIdSchema,
        laneNumber: z.number().int().min(1),
        position: volunteerRoleTypeSchema.nullable().optional(),
        instructions: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const assignmentId = createHeatVolunteerId()
    const trackWorkoutId = await getTrackWorkoutIdForHeat(data.heatId)
    const { assignments } = await createPublishedJudgeScheduleRevision(
      trackWorkoutId,
      (currentAssignments) => [
        ...currentAssignments,
        {
          id: assignmentId,
          heatId: data.heatId,
          membershipId: data.membershipId,
          laneNumber: data.laneNumber,
          position: data.position ?? null,
          instructions: data.instructions ?? null,
          isManualOverride: true,
        },
      ],
    )

    const assignment = assignments.find((a) => a.id === assignmentId)
    if (!assignment) {
      throw new Error("Failed to assign judge to heat")
    }

    return { success: true, data: assignment }
  })

/**
 * Bulk assign multiple judges to a heat
 */
export const bulkAssignJudgesToHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        heatId: heatIdSchema,
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
        assignments: z.array(
          z.object({
            membershipId: membershipIdSchema,
            laneNumber: z.number().int().min(1).nullable(),
            position: volunteerRoleTypeSchema.nullable().optional(),
            instructions: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    if (data.assignments.length === 0) {
      return { success: true, data: [] }
    }

    const trackWorkoutId = await getTrackWorkoutIdForHeat(data.heatId)
    const insertedIds: string[] = []
    const values = data.assignments.map((a) => {
      const id = createHeatVolunteerId()
      insertedIds.push(id)
      return {
        id,
        heatId: data.heatId,
        membershipId: a.membershipId,
        laneNumber: a.laneNumber,
        position: a.position ?? null,
        instructions: a.instructions ?? null,
        isManualOverride: true,
      }
    })
    const { assignments } = await createPublishedJudgeScheduleRevision(
      trackWorkoutId,
      (currentAssignments) => [...currentAssignments, ...values],
    )
    const results = assignments.filter((assignment) =>
      insertedIds.includes(assignment.id ?? ""),
    )

    return { success: true, data: results }
  })

/**
 * Remove a judge assignment from a heat
 */
export const removeJudgeFromHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        assignmentId: assignmentIdSchema,
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()
    const assignment = await db
      .select({
        heatId: judgeHeatAssignmentsTable.heatId,
      })
      .from(judgeHeatAssignmentsTable)
      .where(eq(judgeHeatAssignmentsTable.id, data.assignmentId))
      .then((rows) => rows[0] ?? null)

    if (!assignment) {
      return { success: true }
    }

    const trackWorkoutId = await getTrackWorkoutIdForHeat(assignment.heatId)
    await createPublishedJudgeScheduleRevision(
      trackWorkoutId,
      (currentAssignments) =>
        currentAssignments.filter((a) => a.id !== data.assignmentId),
    )

    return { success: true }
  })

/**
 * Move a judge assignment to a different heat/lane
 */
export const moveJudgeAssignmentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        assignmentId: assignmentIdSchema,
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
        targetHeatId: heatIdSchema,
        targetLaneNumber: z.number().int().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const trackWorkoutId = await getTrackWorkoutIdForHeat(data.targetHeatId)
    await createPublishedJudgeScheduleRevision(
      trackWorkoutId,
      (currentAssignments) =>
        currentAssignments.map((assignment) =>
          assignment.id === data.assignmentId
            ? {
                ...assignment,
                heatId: data.targetHeatId,
                laneNumber: data.targetLaneNumber,
                isManualOverride: true,
              }
            : assignment,
        ),
    )

    return { success: true }
  })

/**
 * Copy judge assignments from one heat to another
 */
export const copyJudgeAssignmentsToHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        sourceHeatId: heatIdSchema,
        targetHeatId: heatIdSchema,
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()

    // Get source assignments
    const sourceAssignments = await db
      .select()
      .from(judgeHeatAssignmentsTable)
      .where(eq(judgeHeatAssignmentsTable.heatId, data.sourceHeatId))

    if (sourceAssignments.length === 0) {
      return { success: true, data: [] }
    }

    // Insert all into target heat in a single query (MySQL has no param limit)
    const insertedIds: string[] = []
    const values = sourceAssignments.map((a) => {
      const id = createHeatVolunteerId()
      insertedIds.push(id)
      return {
        id,
        heatId: data.targetHeatId,
        membershipId: a.membershipId,
        laneNumber: a.laneNumber,
        position: a.position,
        instructions: a.instructions,
      }
    })

    await db.insert(judgeHeatAssignmentsTable).values(values)

    // Select back the created records
    const results = await db
      .select()
      .from(judgeHeatAssignmentsTable)
      .where(inArray(judgeHeatAssignmentsTable.id, insertedIds))

    return { success: true, data: results }
  })

/**
 * Copy judge assignments from a heat to all remaining heats in the event
 */
export const copyJudgeAssignmentsToRemainingHeatsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        sourceHeatId: heatIdSchema,
        trackWorkoutId: z.string().min(1, "Track workout ID is required"),
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()

    // Get source heat details
    const sourceHeat = await db
      .select({ heatNumber: competitionHeatsTable.heatNumber })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.id, data.sourceHeatId))
      .then((rows) => rows[0])

    if (!sourceHeat) {
      throw new Error("Source heat not found")
    }

    // Get all heats for this event to filter by heat number
    const allHeats = await db
      .select({
        id: competitionHeatsTable.id,
        heatNumber: competitionHeatsTable.heatNumber,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    const targetHeats = allHeats
      .filter((h) => h.heatNumber > sourceHeat.heatNumber)
      .sort((a, b) => a.heatNumber - b.heatNumber)

    if (targetHeats.length === 0) {
      return { success: true, data: [] }
    }

    // Get source assignments
    const sourceAssignments = await db
      .select()
      .from(judgeHeatAssignmentsTable)
      .where(eq(judgeHeatAssignmentsTable.heatId, data.sourceHeatId))

    if (sourceAssignments.length === 0) {
      return { success: true, data: [] }
    }

    // Copy to each remaining heat in a single insert per heat (MySQL has no param limit)
    const results = await Promise.all(
      targetHeats.map(async (heat) => {
        const insertedIds: string[] = []
        const values = sourceAssignments.map((a) => {
          const id = createHeatVolunteerId()
          insertedIds.push(id)
          return {
            id,
            heatId: heat.id,
            membershipId: a.membershipId,
            laneNumber: a.laneNumber,
            position: a.position,
            instructions: a.instructions,
          }
        })

        await db.insert(judgeHeatAssignmentsTable).values(values)

        // Select back the created records for this heat
        const assignments = await db
          .select()
          .from(judgeHeatAssignmentsTable)
          .where(inArray(judgeHeatAssignmentsTable.id, insertedIds))

        return {
          heatId: heat.id,
          assignments,
        }
      }),
    )

    return { success: true, data: results }
  })

/**
 * Clear all judge assignments from a heat
 */
export const clearHeatJudgeAssignmentsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        heatId: heatIdSchema,
        organizingTeamId: competitionTeamIdSchema,
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(
      data.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const db = getDb()
    await db
      .delete(judgeHeatAssignmentsTable)
      .where(eq(judgeHeatAssignmentsTable.heatId, data.heatId))

    return { success: true }
  })

// ============================================================================
// Judges Schedule Types
// ============================================================================

export interface JudgesScheduleHeat {
  id: string
  heatNumber: number
  scheduledTime: Date | null
  durationMinutes: number | null
  venue: { id: string; name: string; laneCount: number } | null
  division: { id: string; label: string } | null
  judges: Array<{
    assignmentId: string
    laneNumber: number | null
    membershipId: string
    userId: string
    firstName: string | null
    lastName: string | null
    position: string | null
  }>
  laneAssignments: Array<{
    laneNumber: number
    division: { id: string; label: string } | null
  }>
}

export interface JudgesScheduleEvent {
  trackWorkoutId: string
  eventName: string
  trackOrder: number
  heats: JudgesScheduleHeat[]
}

// ============================================================================
// Judges Schedule Server Functions
// ============================================================================

/**
 * Lightweight check: does the competition have any heats at all?
 * Used to conditionally show the "Judges Schedule" button.
 */
export const hasJudgesScheduleFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ competitionId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const [row] = await db
      .select({ id: competitionHeatsTable.id })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, data.competitionId))
      .limit(1)
    return { hasSchedule: !!row }
  })

/**
 * Get all heats with judge assignments for the judges schedule view.
 * Returns events with heats sorted by time, including judge and lane assignments.
 */
export const getJudgesScheduleDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
        organizingTeamId: z
          .string()
          .startsWith("team_", "Invalid organizing team ID"),
        competitionTeamId: z
          .string()
          .startsWith("team_", "Invalid competition team ID")
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ events: JudgesScheduleEvent[] }> => {
    const db = getDb()

    // No auth required - accessible to anyone with the direct link.
    // Validate that the provided team IDs match the competition to prevent
    // using arbitrary team context to access unrelated competition data.
    const [competition] = await db
      .select({
        organizingTeamId: competitionsTable.organizingTeamId,
        competitionTeamId: competitionsTable.competitionTeamId,
      })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      return { events: [] }
    }

    if (
      competition.organizingTeamId !== data.organizingTeamId ||
      competition.competitionTeamId !== data.competitionTeamId
    ) {
      return { events: [] }
    }

    // Get all heats for this competition with venues and divisions
    const heats = await db
      .select({
        id: competitionHeatsTable.id,
        trackWorkoutId: competitionHeatsTable.trackWorkoutId,
        heatNumber: competitionHeatsTable.heatNumber,
        scheduledTime: competitionHeatsTable.scheduledTime,
        durationMinutes: competitionHeatsTable.durationMinutes,
        venueId: competitionHeatsTable.venueId,
        divisionId: competitionHeatsTable.divisionId,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, data.competitionId))

    if (heats.length === 0) {
      return { events: [] }
    }

    // Collect IDs for batch fetching
    const heatIds = heats.map((h) => h.id)
    const trackWorkoutIds = [...new Set(heats.map((h) => h.trackWorkoutId))]
    const venueIds = [
      ...new Set(
        heats.map((h) => h.venueId).filter((id): id is string => !!id),
      ),
    ]
    const divisionIds = [
      ...new Set(
        heats.map((h) => h.divisionId).filter((id): id is string => !!id),
      ),
    ]

    // Get active versions for all events
    const activeVersions = await db
      .select()
      .from(judgeAssignmentVersionsTable)
      .where(
        and(
          inArray(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutIds),
          eq(judgeAssignmentVersionsTable.isActive, true),
        ),
      )
    // Get judge assignments for active versions
    const versionIds = [...new Set(activeVersions.map((v) => v.id))]
    const judgeAssignments =
      versionIds.length > 0
        ? await db
            .select()
            .from(judgeHeatAssignmentsTable)
            .where(
              and(
                inArray(judgeHeatAssignmentsTable.heatId, heatIds),
                inArray(judgeHeatAssignmentsTable.versionId, versionIds),
              ),
            )
        : []

    // Get membership and user info for judges
    const membershipIds = [
      ...new Set(judgeAssignments.map((a) => a.membershipId)),
    ]
    const memberships =
      membershipIds.length > 0
        ? await db
            .select({
              id: teamMembershipTable.id,
              userId: teamMembershipTable.userId,
            })
            .from(teamMembershipTable)
            .where(inArray(teamMembershipTable.id, membershipIds))
        : []
    const membershipMap = new Map(memberships.map((m) => [m.id, m]))

    const userIds = [...new Set(memberships.map((m) => m.userId))]
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

    // Get venues
    const venues =
      venueIds.length > 0
        ? await db
            .select({
              id: competitionVenuesTable.id,
              name: competitionVenuesTable.name,
              laneCount: competitionVenuesTable.laneCount,
            })
            .from(competitionVenuesTable)
            .where(inArray(competitionVenuesTable.id, venueIds))
        : []
    const venueMap = new Map(venues.map((v) => [v.id, v]))

    // Get divisions (scaling levels)
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

    // Get track workouts with workout names
    const trackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
      })
      .from(trackWorkoutsTable)
      .where(inArray(trackWorkoutsTable.id, trackWorkoutIds))
    const trackWorkoutMap = new Map(trackWorkouts.map((tw) => [tw.id, tw]))

    // Get workout names
    const workoutIds = [
      ...new Set(trackWorkouts.map((tw) => tw.workoutId).filter(Boolean)),
    ]
    const workoutsData =
      workoutIds.length > 0
        ? await db
            .select({
              id: workouts.id,
              name: workouts.name,
            })
            .from(workouts)
            .where(inArray(workouts.id, workoutIds))
        : []
    const workoutMap = new Map(workoutsData.map((w) => [w.id, w]))

    // Get heat lane assignments for division info
    const heatAssignments = await db
      .select({
        heatId: competitionHeatAssignmentsTable.heatId,
        laneNumber: competitionHeatAssignmentsTable.laneNumber,
        registrationId: competitionHeatAssignmentsTable.registrationId,
      })
      .from(competitionHeatAssignmentsTable)
      .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))

    // Get registration divisions (filter out null registrationIds)
    const registrationIds = [
      ...new Set(
        heatAssignments
          .map((a) => a.registrationId)
          .filter((id): id is string => !!id),
      ),
    ]
    const registrations =
      registrationIds.length > 0
        ? await db
            .select({
              id: competitionRegistrationsTable.id,
              divisionId: competitionRegistrationsTable.divisionId,
            })
            .from(competitionRegistrationsTable)
            .where(inArray(competitionRegistrationsTable.id, registrationIds))
        : []
    const registrationDivisionMap = new Map(
      registrations.map((r) => [r.id, r.divisionId]),
    )

    // Fetch division labels for registration divisions
    const regDivisionIds = [
      ...new Set(
        registrations
          .map((r) => r.divisionId)
          .filter((id): id is string => !!id),
      ),
    ]
    const regDivisions =
      regDivisionIds.length > 0
        ? await db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
            })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, regDivisionIds))
        : []
    for (const div of regDivisions) {
      if (!divisionMap.has(div.id)) {
        divisionMap.set(div.id, div)
      }
    }

    // Group judge assignments by heat
    const judgesByHeat = new Map<string, Array<(typeof judgeAssignments)[0]>>()
    for (const assignment of judgeAssignments) {
      const existing = judgesByHeat.get(assignment.heatId) || []
      existing.push(assignment)
      judgesByHeat.set(assignment.heatId, existing)
    }

    // Group lane assignments by heat
    const lanesByHeat = new Map<string, Array<(typeof heatAssignments)[0]>>()
    for (const assignment of heatAssignments) {
      const existing = lanesByHeat.get(assignment.heatId) || []
      existing.push(assignment)
      lanesByHeat.set(assignment.heatId, existing)
    }

    // Build result grouped by event
    const eventMap = new Map<string, JudgesScheduleEvent>()

    for (const heat of heats) {
      const trackWorkout = trackWorkoutMap.get(heat.trackWorkoutId)
      if (!trackWorkout) continue

      const workout = trackWorkout.workoutId
        ? workoutMap.get(trackWorkout.workoutId)
        : null
      const eventName = workout?.name || "Unknown Event"

      // Get or create event entry
      let event = eventMap.get(heat.trackWorkoutId)
      if (!event) {
        event = {
          trackWorkoutId: heat.trackWorkoutId,
          eventName,
          trackOrder: trackWorkout.trackOrder,
          heats: [],
        }
        eventMap.set(heat.trackWorkoutId, event)
      }

      // Build judge list for this heat
      const heatJudges = judgesByHeat.get(heat.id) || []
      const judges = heatJudges.map((ja) => {
        const membership = membershipMap.get(ja.membershipId)
        const user = membership ? userMap.get(membership.userId) : null
        return {
          assignmentId: ja.id,
          laneNumber: ja.laneNumber,
          membershipId: ja.membershipId,
          userId: membership?.userId || "",
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          position: ja.position,
        }
      })

      // Build lane assignments with division info
      const heatLanes = lanesByHeat.get(heat.id) || []
      const laneAssignments = heatLanes.map((la) => {
        const regDivisionId = registrationDivisionMap.get(la.registrationId)
        const division = regDivisionId ? divisionMap.get(regDivisionId) : null
        return {
          laneNumber: la.laneNumber,
          division: division || null,
        }
      })

      // Add heat to event
      event.heats.push({
        id: heat.id,
        heatNumber: heat.heatNumber,
        scheduledTime: heat.scheduledTime,
        durationMinutes: heat.durationMinutes,
        venue: heat.venueId ? venueMap.get(heat.venueId) || null : null,
        division: heat.divisionId
          ? divisionMap.get(heat.divisionId) || null
          : null,
        judges: judges.sort(
          (a, b) => (a.laneNumber || 0) - (b.laneNumber || 0),
        ),
        laneAssignments: laneAssignments.sort(
          (a, b) => a.laneNumber - b.laneNumber,
        ),
      })
    }

    // Sort heats within each event
    for (const event of eventMap.values()) {
      event.heats.sort((a, b) => {
        if (a.scheduledTime && b.scheduledTime) {
          return (
            new Date(a.scheduledTime).getTime() -
            new Date(b.scheduledTime).getTime()
          )
        }
        return a.heatNumber - b.heatNumber
      })
    }

    // Sort events by track order
    const events = Array.from(eventMap.values()).sort(
      (a, b) => a.trackOrder - b.trackOrder,
    )

    return { events }
  })
