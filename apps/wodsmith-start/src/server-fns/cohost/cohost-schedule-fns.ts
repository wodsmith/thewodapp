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
  addRequestContextAttribute,
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
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { userTable } from "@/db/schemas/users"
import { getAffiliate } from "@/utils/registration-metadata"
import { requireCohostPermission } from "@/utils/cohost-auth"

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
    await requireCohostPermission(data.competitionTeamId)

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
    await requireCohostPermission(data.competitionTeamId)

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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)

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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)
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
    await requireCohostPermission(data.competitionTeamId)

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
    await requireCohostPermission(data.competitionTeamId)

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
    await requireCohostPermission(data.competitionTeamId)

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
    await requireCohostPermission(data.competitionTeamId)

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
