/**
 * Cohost Schedule (Heats) Server Functions
 * Mirrors organizer competition-heats-fns for cohost access.
 * Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import {
  and,
  asc,
  eq,
  inArray,
  ne,
  notInArray,
  sql,
} from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  logEntityCreated,
  logEntityDeleted,
  logInfo,
} from "@/lib/logging"
import { getEvlog } from "@/lib/evlog"
import {
  type CompetitionHeat,
  type CompetitionVenue,
  REGISTRATION_STATUS,
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionRegistrationsTable,
  competitionVenuesTable,
} from "@/db/schemas/competitions"
import {
  createCompetitionHeatAssignmentId,
  createCompetitionHeatId,
} from "@/db/schemas/common"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { userTable } from "@/db/schemas/users"
import { workouts } from "@/db/schemas/workouts"
import { getAffiliate } from "@/utils/registration-metadata"
import {
  requireCohostCompetitionOwnership,
  requireCohostPermission,
} from "@/utils/cohost-auth"

// ============================================================================
// Types
// ============================================================================

export interface CohostHeatWithAssignments extends CompetitionHeat {
  venue: CompetitionVenue | null
  division: { id: string; label: string } | null
  assignments: Array<{
    id: string
    laneNumber: number
    registration: {
      id: string
      teamName: string | null
      user: { id: string; firstName: string | null; lastName: string | null }
      division: { id: string; label: string } | null
      affiliate: string | null
    }
  }>
}

// ============================================================================
// Input Schemas
// ============================================================================

const cohostBaseSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const getHeatsInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const createHeatInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  heatNumber: z.number().int().min(1),
  scheduledTime: z.coerce.date().nullable().optional(),
  venueId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

const updateHeatInputSchema = cohostBaseSchema.extend({
  heatId: z.string().min(1, "Heat ID is required"),
  heatNumber: z.number().int().min(1).optional(),
  scheduledTime: z.coerce.date().nullable().optional(),
  venueId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

const deleteHeatInputSchema = cohostBaseSchema.extend({
  heatId: z.string().min(1, "Heat ID is required"),
})

const reorderHeatsInputSchema = cohostBaseSchema.extend({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  heatIds: z
    .array(z.string().min(1))
    .min(1, "At least one heat ID is required"),
})

const getNextHeatNumberInputSchema = cohostBaseSchema.extend({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const bulkCreateHeatsInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  heats: z.array(
    z.object({
      scheduledTime: z.coerce.date().nullable().optional(),
      venueId: z.string().nullable().optional(),
      divisionId: z.string().nullable().optional(),
      durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
    }),
  ),
})

const bulkUpdateHeatsInputSchema = cohostBaseSchema.extend({
  heats: z.array(
    z.object({
      heatId: z.string().min(1, "Heat ID is required"),
      scheduledTime: z.coerce.date().nullable().optional(),
      durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
    }),
  ),
})

const assignToHeatInputSchema = cohostBaseSchema.extend({
  heatId: z.string().min(1, "Heat ID is required"),
  registrationId: z.string().min(1, "Registration ID is required"),
  laneNumber: z.number().int().min(1, "Lane number must be at least 1"),
})

const bulkAssignToHeatInputSchema = cohostBaseSchema.extend({
  heatId: z.string().min(1, "Heat ID is required"),
  registrationIds: z
    .array(z.string().min(1))
    .min(1, "At least one registration ID is required"),
  startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
})

const removeFromHeatInputSchema = cohostBaseSchema.extend({
  assignmentId: z.string().min(1, "Assignment ID is required"),
})

const updateAssignmentInputSchema = cohostBaseSchema.extend({
  assignmentId: z.string().min(1, "Assignment ID is required"),
  laneNumber: z.number().int().min(1, "Lane number must be at least 1"),
})

const moveAssignmentInputSchema = cohostBaseSchema.extend({
  assignmentId: z.string().min(1, "Assignment ID is required"),
  targetHeatId: z.string().min(1, "Target heat ID is required"),
  targetLaneNumber: z
    .number()
    .int()
    .min(1, "Target lane number must be at least 1"),
})

const getUnassignedRegistrationsInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  divisionId: z.string().optional(),
})

const getCompetitionRegistrationsInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Helper: Build heats with assignments
// ============================================================================

async function buildHeatsWithAssignments(
  heats: CompetitionHeat[],
): Promise<CohostHeatWithAssignments[]> {
  if (heats.length === 0) return []

  const db = getDb()

  const venueIds = heats
    .map((h) => h.venueId)
    .filter((id): id is string => id !== null)
  const divisionIds = heats
    .map((h) => h.divisionId)
    .filter((id): id is string => id !== null)

  const venues =
    venueIds.length > 0
      ? await db
          .select()
          .from(competitionVenuesTable)
          .where(inArray(competitionVenuesTable.id, venueIds))
      : []
  const venueMap = new Map(venues.map((v) => [v.id, v]))

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

  const heatIds = heats.map((h) => h.id)
  const assignments = await db
    .select({
      id: competitionHeatAssignmentsTable.id,
      heatId: competitionHeatAssignmentsTable.heatId,
      laneNumber: competitionHeatAssignmentsTable.laneNumber,
      registrationId: competitionHeatAssignmentsTable.registrationId,
    })
    .from(competitionHeatAssignmentsTable)
    .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
    .orderBy(asc(competitionHeatAssignmentsTable.laneNumber))

  const registrationIds = [
    ...new Set(assignments.map((a) => a.registrationId)),
  ]
  const registrations =
    registrationIds.length > 0
      ? await db
          .select({
            id: competitionRegistrationsTable.id,
            teamName: competitionRegistrationsTable.teamName,
            userId: competitionRegistrationsTable.userId,
            divisionId: competitionRegistrationsTable.divisionId,
            metadata: competitionRegistrationsTable.metadata,
          })
          .from(competitionRegistrationsTable)
          .where(inArray(competitionRegistrationsTable.id, registrationIds))
      : []

  const userIds = [...new Set(registrations.map((r) => r.userId))]
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

  const regDivisionIds = [
    ...new Set(
      registrations
        .map((r) => r.divisionId)
        .filter((id): id is string => id !== null),
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
  const regDivisionMap = new Map(regDivisions.map((d) => [d.id, d]))

  const registrationMap = new Map(
    registrations.map((r) => [
      r.id,
      {
        id: r.id,
        teamName: r.teamName,
        user: userMap.get(r.userId) ?? {
          id: r.userId,
          firstName: null,
          lastName: null,
        },
        division: r.divisionId
          ? (regDivisionMap.get(r.divisionId) ?? null)
          : null,
        affiliate: getAffiliate(r.metadata, r.userId),
      },
    ]),
  )

  const assignmentsByHeat = new Map<string, typeof assignments>()
  for (const assignment of assignments) {
    const existing = assignmentsByHeat.get(assignment.heatId) ?? []
    existing.push(assignment)
    assignmentsByHeat.set(assignment.heatId, existing)
  }

  return heats.map((heat) => ({
    ...heat,
    venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
    division: heat.divisionId
      ? (divisionMap.get(heat.divisionId) ?? null)
      : null,
    assignments: (assignmentsByHeat.get(heat.id) ?? []).map((a) => ({
      id: a.id,
      laneNumber: a.laneNumber,
      registration: registrationMap.get(a.registrationId) ?? {
        id: a.registrationId,
        teamName: null,
        user: { id: "", firstName: null, lastName: null },
        division: null,
        affiliate: null,
      },
    })),
  }))
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all heats for a competition (cohost view)
 */
export const cohostGetHeatsForCompetitionFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getHeatsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const heats = await db
      .select()
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, data.competitionId))
      .orderBy(
        asc(competitionHeatsTable.scheduledTime),
        asc(competitionHeatsTable.heatNumber),
      )

    const heatsWithAssignments = await buildHeatsWithAssignments(heats)
    return { heats: heatsWithAssignments }
  })

/**
 * Get all registrations for a competition (for heat assignment)
 */
export const cohostGetCompetitionRegistrationsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCompetitionRegistrationsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const registrations = await db
      .select({
        id: competitionRegistrationsTable.id,
        teamName: competitionRegistrationsTable.teamName,
        registeredAt: competitionRegistrationsTable.registeredAt,
        userId: competitionRegistrationsTable.userId,
        divisionId: competitionRegistrationsTable.divisionId,
      })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .orderBy(asc(competitionRegistrationsTable.registeredAt))

    if (registrations.length === 0) {
      return { registrations: [] }
    }

    const userIds = [...new Set(registrations.map((r) => r.userId))]
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

    const divisionIds = [
      ...new Set(
        registrations
          .map((r) => r.divisionId)
          .filter((id): id is string => id !== null),
      ),
    ]
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

    const result = registrations.map((r) => ({
      id: r.id,
      teamName: r.teamName,
      registeredAt: r.registeredAt,
      user: userMap.get(r.userId) ?? {
        id: r.userId,
        firstName: null,
        lastName: null,
      },
      division: r.divisionId ? (divisionMap.get(r.divisionId) ?? null) : null,
    }))

    return { registrations: result }
  })

/**
 * Create a new heat (cohost)
 */
export const cohostCreateHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createHeatInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    getEvlog()?.set({
      action: "cohost_create_heat",
      heat: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
      },
    })

    const db = getDb()
    const now = new Date()
    const heatId = createCompetitionHeatId()

    await db.insert(competitionHeatsTable).values({
      id: heatId,
      competitionId: data.competitionId,
      trackWorkoutId: data.trackWorkoutId,
      heatNumber: data.heatNumber,
      scheduledTime: data.scheduledTime ?? null,
      venueId: data.venueId ?? null,
      divisionId: data.divisionId ?? null,
      durationMinutes: data.durationMinutes ?? null,
      notes: data.notes ?? null,
      schedulePublishedAt: data.scheduledTime ? now : null,
    })

    const heat = await db.query.competitionHeatsTable.findFirst({
      where: eq(competitionHeatsTable.id, heatId),
    })

    if (!heat) {
      throw new Error("Failed to create heat")
    }

    logEntityCreated({
      entity: "heat",
      id: heat.id,
      parentEntity: "competition",
      parentId: data.competitionId,
      attributes: {
        trackWorkoutId: data.trackWorkoutId,
        heatNumber: data.heatNumber,
        createdByCohost: true,
      },
    })

    return { heat }
  })

/**
 * Update an existing heat (cohost)
 */
export const cohostUpdateHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateHeatInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({ action: "cohost_update_heat", heat: { id: data.heatId } })

    const db = getDb()
    const now = new Date()
    const updateData: Record<string, unknown> = { updatedAt: now }

    if (data.heatNumber !== undefined) updateData.heatNumber = data.heatNumber
    if (data.scheduledTime !== undefined) {
      updateData.scheduledTime = data.scheduledTime
      updateData.schedulePublishedAt = data.scheduledTime ? now : null
    }
    if (data.venueId !== undefined) updateData.venueId = data.venueId
    if (data.divisionId !== undefined) updateData.divisionId = data.divisionId
    if (data.durationMinutes !== undefined)
      updateData.durationMinutes = data.durationMinutes
    if (data.notes !== undefined) updateData.notes = data.notes

    await db
      .update(competitionHeatsTable)
      .set(updateData)
      .where(eq(competitionHeatsTable.id, data.heatId))

    return { success: true }
  })

/**
 * Delete a heat (cohost)
 */
export const cohostDeleteHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteHeatInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({ action: "cohost_delete_heat", heat: { id: data.heatId } })

    const db = getDb()

    await db
      .delete(competitionHeatsTable)
      .where(eq(competitionHeatsTable.id, data.heatId))

    logEntityDeleted({ entity: "heat", id: data.heatId })

    return { success: true }
  })

/**
 * Reorder heats within an event (cohost)
 */
export const cohostReorderHeatsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reorderHeatsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_reorder_heats",
      heat: { trackWorkoutId: data.trackWorkoutId },
    })

    const db = getDb()

    const heats = await db
      .select()
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    const heatIdSet = new Set(heats.map((h) => h.id))
    for (const heatId of data.heatIds) {
      if (!heatIdSet.has(heatId)) {
        throw new Error(
          `Heat ${heatId} does not belong to workout ${data.trackWorkoutId}`,
        )
      }
    }

    if (data.heatIds.length !== heats.length) {
      throw new Error(
        `Expected ${heats.length} heat IDs, received ${data.heatIds.length}`,
      )
    }

    const TEMP_OFFSET = 1000
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(competitionHeatsTable)
        .set({
          heatNumber: sql`CASE ${sql.join(
            data.heatIds.map(
              (heatId, index) =>
                sql`WHEN ${competitionHeatsTable.id} = ${heatId} THEN ${TEMP_OFFSET + index}`,
            ),
            sql` `,
          )} END`,
          updatedAt: now,
        })
        .where(inArray(competitionHeatsTable.id, data.heatIds))

      await tx
        .update(competitionHeatsTable)
        .set({
          heatNumber: sql`CASE ${sql.join(
            data.heatIds.map(
              (heatId, index) =>
                sql`WHEN ${competitionHeatsTable.id} = ${heatId} THEN ${index + 1}`,
            ),
            sql` `,
          )} END`,
          updatedAt: now,
        })
        .where(inArray(competitionHeatsTable.id, data.heatIds))
    })

    const updatedHeats = await db
      .select()
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))
      .orderBy(asc(competitionHeatsTable.heatNumber))

    return { heats: updatedHeats }
  })

/**
 * Get next heat number for a workout (cohost)
 */
export const cohostGetNextHeatNumberFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getNextHeatNumberInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")

    const db = getDb()

    const heats = await db
      .select({ heatNumber: competitionHeatsTable.heatNumber })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    if (heats.length === 0) {
      return { nextHeatNumber: 1 }
    }

    const maxNumber = Math.max(...heats.map((h) => h.heatNumber))
    return { nextHeatNumber: maxNumber + 1 }
  })

/**
 * Bulk create heats (cohost)
 */
export const cohostBulkCreateHeatsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bulkCreateHeatsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    getEvlog()?.set({
      action: "cohost_bulk_create_heats",
      heat: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
      },
    })

    const db = getDb()

    if (data.heats.length === 0) {
      return { heats: [] }
    }

    // Get the starting heat number
    const existingHeats = await db
      .select({ heatNumber: competitionHeatsTable.heatNumber })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    const startNumber =
      existingHeats.length === 0
        ? 1
        : Math.max(...existingHeats.map((h) => h.heatNumber)) + 1

    const now = new Date()
    const heatsToCreate = data.heats.map((heat, index) => ({
      id: createCompetitionHeatId(),
      competitionId: data.competitionId,
      trackWorkoutId: data.trackWorkoutId,
      heatNumber: startNumber + index,
      venueId: heat.venueId ?? null,
      scheduledTime: heat.scheduledTime ?? null,
      durationMinutes: heat.durationMinutes ?? null,
      divisionId: heat.divisionId ?? null,
      notes: null,
      schedulePublishedAt: heat.scheduledTime ? now : null,
    }))

    await db.insert(competitionHeatsTable).values(heatsToCreate)

    const heatIds = heatsToCreate.map((h) => h.id)
    const createdHeats = await db
      .select()
      .from(competitionHeatsTable)
      .where(inArray(competitionHeatsTable.id, heatIds))

    logInfo({
      message: "[Cohost Heat] Bulk heats created",
      attributes: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
        heatCount: createdHeats.length,
      },
    })

    return { heats: createdHeats }
  })

/**
 * Bulk update heats (cohost)
 */
export const cohostBulkUpdateHeatsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bulkUpdateHeatsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_bulk_update_heats",
      heat: { count: data.heats.length },
    })

    const db = getDb()

    if (data.heats.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    const now = new Date()

    await db.transaction(async (tx) => {
      for (const heat of data.heats) {
        const updateData: Record<string, unknown> = { updatedAt: now }

        if (heat.scheduledTime !== undefined) {
          updateData.scheduledTime = heat.scheduledTime
          updateData.schedulePublishedAt = heat.scheduledTime ? now : null
        }
        if (heat.durationMinutes !== undefined) {
          updateData.durationMinutes = heat.durationMinutes
        }

        await tx
          .update(competitionHeatsTable)
          .set(updateData)
          .where(eq(competitionHeatsTable.id, heat.heatId))
      }
    })

    return { success: true, updatedCount: data.heats.length }
  })

// ============================================================================
// Heat Assignment Server Functions
// ============================================================================

/**
 * Assign a registration to a heat lane (cohost)
 */
export const cohostAssignToHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => assignToHeatInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_assign_to_heat",
      assignment: { heatId: data.heatId, registrationId: data.registrationId },
    })

    const db = getDb()

    const assignmentId = createCompetitionHeatAssignmentId()
    await db.insert(competitionHeatAssignmentsTable).values({
      id: assignmentId,
      heatId: data.heatId,
      registrationId: data.registrationId,
      laneNumber: data.laneNumber,
    })

    const assignment = await db.query.competitionHeatAssignmentsTable.findFirst(
      {
        where: eq(competitionHeatAssignmentsTable.id, assignmentId),
      },
    )

    if (!assignment) {
      throw new Error("Failed to create heat assignment")
    }

    return { assignment }
  })

/**
 * Bulk assign registrations to a heat (cohost)
 */
export const cohostBulkAssignToHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bulkAssignToHeatInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_bulk_assign_to_heat",
      assignment: { heatId: data.heatId, count: data.registrationIds.length },
    })

    const db = getDb()

    if (data.registrationIds.length === 0) {
      return { assignments: [] }
    }

    const assignmentsToCreate = data.registrationIds.map(
      (registrationId, index) => ({
        id: createCompetitionHeatAssignmentId(),
        heatId: data.heatId,
        registrationId,
        laneNumber: data.startingLane + index,
      }),
    )

    await db.insert(competitionHeatAssignmentsTable).values(assignmentsToCreate)

    const assignmentIds = assignmentsToCreate.map((a) => a.id)
    const assignments = await db
      .select()
      .from(competitionHeatAssignmentsTable)
      .where(inArray(competitionHeatAssignmentsTable.id, assignmentIds))

    return { assignments }
  })

/**
 * Remove an assignment from a heat (cohost)
 */
export const cohostRemoveFromHeatFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => removeFromHeatInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")

    const db = getDb()

    await db
      .delete(competitionHeatAssignmentsTable)
      .where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))

    return { success: true }
  })

/**
 * Update the lane number for an assignment (cohost)
 */
export const cohostUpdateAssignmentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateAssignmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")

    const db = getDb()

    await db
      .update(competitionHeatAssignmentsTable)
      .set({ laneNumber: data.laneNumber, updatedAt: new Date() })
      .where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))

    return { success: true }
  })

/**
 * Move an assignment to a different heat and/or lane (cohost)
 */
export const cohostMoveAssignmentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveAssignmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")

    const db = getDb()

    const currentAssignment =
      await db.query.competitionHeatAssignmentsTable.findFirst({
        where: eq(competitionHeatAssignmentsTable.id, data.assignmentId),
      })

    if (!currentAssignment) {
      throw new Error("Assignment not found")
    }

    if (currentAssignment.heatId === data.targetHeatId) {
      await db
        .update(competitionHeatAssignmentsTable)
        .set({ laneNumber: data.targetLaneNumber, updatedAt: new Date() })
        .where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))
    } else {
      await db.transaction(async (tx) => {
        await tx
          .delete(competitionHeatAssignmentsTable)
          .where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))

        await tx.insert(competitionHeatAssignmentsTable).values({
          id: createCompetitionHeatAssignmentId(),
          heatId: data.targetHeatId,
          registrationId: currentAssignment.registrationId,
          laneNumber: data.targetLaneNumber,
        })
      })
    }

    return { success: true }
  })

/**
 * Get unassigned registrations for a workout (cohost)
 */
export const cohostGetUnassignedRegistrationsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getUnassignedRegistrationsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const assignedIds = await db
      .select({
        registrationId: competitionHeatAssignmentsTable.registrationId,
      })
      .from(competitionHeatAssignmentsTable)
      .innerJoin(
        competitionHeatsTable,
        eq(competitionHeatAssignmentsTable.heatId, competitionHeatsTable.id),
      )
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    const assignedRegIds = [
      ...new Set(assignedIds.map((a) => a.registrationId)),
    ]

    const conditions = [
      eq(competitionRegistrationsTable.eventId, data.competitionId),
      ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
    ]
    if (assignedRegIds.length > 0) {
      conditions.push(
        notInArray(competitionRegistrationsTable.id, assignedRegIds),
      )
    }
    if (data.divisionId) {
      conditions.push(
        eq(competitionRegistrationsTable.divisionId, data.divisionId),
      )
    }

    const registrations = await db
      .select({
        id: competitionRegistrationsTable.id,
        teamName: competitionRegistrationsTable.teamName,
        userId: competitionRegistrationsTable.userId,
        divisionId: competitionRegistrationsTable.divisionId,
      })
      .from(competitionRegistrationsTable)
      .where(and(...conditions))

    if (registrations.length === 0) {
      return { registrations: [] }
    }

    const userIds = [...new Set(registrations.map((r) => r.userId))]
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

    const divisionIds = [
      ...new Set(
        registrations
          .map((r) => r.divisionId)
          .filter((id): id is string => id !== null),
      ),
    ]
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

    const result = registrations.map((r) => ({
      id: r.id,
      teamName: r.teamName,
      user: userMap.get(r.userId) ?? {
        id: r.userId,
        firstName: null,
        lastName: null,
      },
      division: r.divisionId ? (divisionMap.get(r.divisionId) ?? null) : null,
    }))

    return { registrations: result }
  })

// ============================================================================
// ============================================================================
// Heat Publishing Input Schemas
// ============================================================================

const publishHeatScheduleInputSchema = cohostBaseSchema.extend({
  heatId: z.string().min(1, "Heat ID is required"),
  publish: z.boolean(),
})

const publishAllHeatsForEventInputSchema = cohostBaseSchema.extend({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  publish: z.boolean(),
})

// ============================================================================
// Heat Publishing Server Functions
// ============================================================================

/**
 * Publish or unpublish an individual heat schedule (cohost)
 * Sets or clears the schedulePublishedAt timestamp
 */
export const cohostPublishHeatScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => publishHeatScheduleInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_publish_heat_schedule",
      heat: { id: data.heatId, publish: data.publish },
    })

    const db = getDb()
    const now = new Date()

    await db
      .update(competitionHeatsTable)
      .set({
        schedulePublishedAt: data.publish ? now : null,
        updatedAt: now,
      })
      .where(eq(competitionHeatsTable.id, data.heatId))

    return {
      success: true,
      schedulePublishedAt: data.publish ? now : null,
    }
  })

/**
 * Bulk publish or unpublish all heats for an event (cohost)
 * Sets or clears schedulePublishedAt for all heats belonging to the workout
 */
export const cohostPublishAllHeatsForEventFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    publishAllHeatsForEventInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_publish_all_heats",
      heat: { trackWorkoutId: data.trackWorkoutId, publish: data.publish },
    })

    const db = getDb()
    const now = new Date()

    // Count heats first for the response
    const heats = await db
      .select({ id: competitionHeatsTable.id })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    if (heats.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    // Update all heats for this track workout in a single query
    await db
      .update(competitionHeatsTable)
      .set({
        schedulePublishedAt: data.publish ? now : null,
        updatedAt: now,
      })
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    return {
      success: true,
      updatedCount: heats.length,
      schedulePublishedAt: data.publish ? now : null,
    }
  })

// ============================================================================
// Events With Heats + Copy Heats Input Schemas
// ============================================================================

const getEventsWithHeatsInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  excludeTrackWorkoutId: z.string().optional(),
})

const copyHeatsFromEventInputSchema = cohostBaseSchema.extend({
  sourceTrackWorkoutId: z
    .string()
    .min(1, "Source track workout ID is required"),
  targetTrackWorkoutId: z
    .string()
    .min(1, "Target track workout ID is required"),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(1).max(180).default(10),
  transitionMinutes: z.number().int().min(0).max(120).default(3),
  copyAssignments: z.boolean().default(true),
})

// ============================================================================
// Events With Heats + Copy Heats Server Functions
// ============================================================================

/**
 * Get events that have heats scheduled (cohost)
 * Used to populate "copy from" dropdown in heat schedule manager
 */
export const cohostGetEventsWithHeatsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getEventsWithHeatsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Get all heats for the competition
    const heats = await db
      .select({
        trackWorkoutId: competitionHeatsTable.trackWorkoutId,
        scheduledTime: competitionHeatsTable.scheduledTime,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, data.competitionId))
      .orderBy(asc(competitionHeatsTable.scheduledTime))

    if (heats.length === 0) {
      return { events: [] }
    }

    // Group heats by trackWorkoutId
    const heatsByWorkout = new Map<
      string,
      Array<{ scheduledTime: Date | null }>
    >()
    for (const heat of heats) {
      const existing = heatsByWorkout.get(heat.trackWorkoutId) ?? []
      existing.push({ scheduledTime: heat.scheduledTime })
      heatsByWorkout.set(heat.trackWorkoutId, existing)
    }

    // Get unique trackWorkoutIds, excluding the target if specified
    const trackWorkoutIds = [...heatsByWorkout.keys()].filter(
      (id) => id !== data.excludeTrackWorkoutId,
    )

    if (trackWorkoutIds.length === 0) {
      return { events: [] }
    }

    // Fetch track workouts with their associated workouts
    const trackWorkoutList = await db
      .select({
        id: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
      })
      .from(trackWorkoutsTable)
      .where(inArray(trackWorkoutsTable.id, trackWorkoutIds))

    // Fetch workout names
    const workoutIds = trackWorkoutList.map((tw) => tw.workoutId)
    const workoutListData =
      workoutIds.length > 0
        ? await db
            .select({
              id: workouts.id,
              name: workouts.name,
            })
            .from(workouts)
            .where(inArray(workouts.id, workoutIds))
        : []
    const workoutMap = new Map(workoutListData.map((w) => [w.id, w]))

    // Build result
    const events = trackWorkoutList.map((tw) => {
      const workoutHeats = heatsByWorkout.get(tw.id) ?? []
      const workout = workoutMap.get(tw.workoutId)

      const times = workoutHeats
        .map((h) => h.scheduledTime)
        .filter((t): t is Date => t !== null)
      const firstHeatTime: Date | null =
        times.length > 0 ? (times[0] ?? null) : null
      const lastHeatTime: Date | null =
        times.length > 0 ? (times[times.length - 1] ?? null) : null

      return {
        trackWorkoutId: tw.id,
        workoutName: workout?.name ?? "Unknown Workout",
        heatCount: workoutHeats.length,
        firstHeatTime,
        lastHeatTime,
      }
    })

    return { events }
  })

/**
 * Copy heats from one event to another (cohost)
 * Copies heat structure and optionally athlete assignments
 * Times are calculated as: startTime + (heatIndex * (duration + transition))
 */
export const cohostCopyHeatsFromEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => copyHeatsFromEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_copy_heats",
      heat: {
        sourceTrackWorkoutId: data.sourceTrackWorkoutId,
        targetTrackWorkoutId: data.targetTrackWorkoutId,
      },
    })

    const db = getDb()

    // Fetch source heats
    const sourceHeatsRaw = await db
      .select()
      .from(competitionHeatsTable)
      .where(
        eq(competitionHeatsTable.trackWorkoutId, data.sourceTrackWorkoutId),
      )
      .orderBy(asc(competitionHeatsTable.heatNumber))

    if (sourceHeatsRaw.length === 0) {
      return { heats: [] }
    }

    // Build source heats with assignments via shared helper
    const sourceHeats = await buildHeatsWithAssignments(sourceHeatsRaw)
    sourceHeats.sort((a, b) => a.heatNumber - b.heatNumber)

    // Get the target workout's competition ID
    const targetWorkout = await db.query.trackWorkoutsTable.findFirst({
      where: eq(trackWorkoutsTable.id, data.targetTrackWorkoutId),
      columns: { trackId: true },
    })

    if (!targetWorkout) {
      throw new Error("Target track workout not found")
    }

    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.id, targetWorkout.trackId),
      columns: { competitionId: true },
    })

    if (!track || !track.competitionId) {
      throw new Error("Competition not found for target track")
    }

    const competitionId = track.competitionId
    const durationMinutes = data.durationMinutes
    const timeSlotMinutes = durationMinutes + data.transitionMinutes

    // Create new heats with calculated times
    const now = new Date()
    const heatsToCreate: Array<{
      id: string
      competitionId: string
      trackWorkoutId: string
      heatNumber: number
      venueId: string | null
      scheduledTime: Date
      durationMinutes: number | null
      divisionId: string | null
      notes: string | null
      schedulePublishedAt: Date
    }> = []

    for (let i = 0; i < sourceHeats.length; i++) {
      const sourceHeat = sourceHeats[i]
      if (!sourceHeat) continue

      const offsetMinutes = i * timeSlotMinutes
      const newTime = new Date(
        data.startTime.getTime() + offsetMinutes * 60 * 1000,
      )

      heatsToCreate.push({
        id: createCompetitionHeatId(),
        competitionId,
        trackWorkoutId: data.targetTrackWorkoutId,
        heatNumber: sourceHeat.heatNumber,
        venueId: sourceHeat.venueId,
        scheduledTime: newTime,
        durationMinutes: durationMinutes,
        divisionId: sourceHeat.divisionId,
        notes: sourceHeat.notes,
        schedulePublishedAt: now,
      })
    }

    await db.insert(competitionHeatsTable).values(heatsToCreate)

    // Fetch created heats
    const createdHeatIds = heatsToCreate.map((h) => h.id)
    const createdHeats = await db
      .select()
      .from(competitionHeatsTable)
      .where(inArray(competitionHeatsTable.id, createdHeatIds))

    // If copying assignments, create heat ID mapping and copy assignments
    if (data.copyAssignments) {
      const heatIdMap = new Map<number, string>()
      for (const heat of createdHeats) {
        heatIdMap.set(heat.heatNumber, heat.id)
      }

      const assignmentsToCreate: Array<{
        id: string
        heatId: string
        registrationId: string
        laneNumber: number
      }> = []

      for (const sourceHeat of sourceHeats) {
        const newHeatId = heatIdMap.get(sourceHeat.heatNumber)
        if (!newHeatId) continue

        for (const assignment of sourceHeat.assignments) {
          assignmentsToCreate.push({
            id: createCompetitionHeatAssignmentId(),
            heatId: newHeatId,
            registrationId: assignment.registration.id,
            laneNumber: assignment.laneNumber,
          })
        }
      }

      if (assignmentsToCreate.length > 0) {
        await db
          .insert(competitionHeatAssignmentsTable)
          .values(assignmentsToCreate)
      }
    }

    logInfo({
      message: "[Cohost Heat] Copied heats from event",
      attributes: {
        sourceTrackWorkoutId: data.sourceTrackWorkoutId,
        targetTrackWorkoutId: data.targetTrackWorkoutId,
        heatCount: createdHeats.length,
        copyAssignments: data.copyAssignments,
      },
    })

    // Return created heats with assignments
    const result = await buildHeatsWithAssignments(createdHeats)
    return { heats: result }
  })

// ============================================================================
// Update Competition Workout (heatStatus/eventStatus) for cohost
// ============================================================================

const updateCompetitionWorkoutInputSchema = cohostBaseSchema.extend({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  trackOrder: z.number().int().min(0).optional(),
  pointsMultiplier: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
  heatStatus: z.enum(["draft", "published"]).optional(),
})

/**
 * Update competition workout fields (cohost)
 * Primarily used for heatStatus toggle in the schedule manager
 */
export const cohostUpdateCompetitionWorkoutFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    updateCompetitionWorkoutInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "schedule")
    getEvlog()?.set({
      action: "cohost_update_competition_workout",
      workout: { trackWorkoutId: data.trackWorkoutId },
    })

    const db = getDb()

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.trackOrder !== undefined) {
      updateData.trackOrder = data.trackOrder
    }
    if (data.pointsMultiplier !== undefined) {
      updateData.pointsMultiplier = data.pointsMultiplier
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes
    }
    if (data.heatStatus !== undefined) {
      updateData.heatStatus = data.heatStatus
    }

    await db
      .update(trackWorkoutsTable)
      .set(updateData)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    return { success: true }
  })
