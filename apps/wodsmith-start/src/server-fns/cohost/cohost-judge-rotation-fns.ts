/**
 * Cohost Judge Rotation & Assignment Server Functions
 * Mirrors organizer judge-rotation-fns and judge-assignment-fns for cohost access.
 * Uses requireCohostPermission("volunteers") instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { CompetitionJudgeRotation, JudgeAssignmentVersion } from "@/db/schema"
import {
  competitionHeatsTable,
  competitionJudgeRotationsTable,
  competitionsTable,
  competitionVenuesTable,
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
  LANE_SHIFT_PATTERN,
  type LaneShiftPattern,
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schema"
import { expandRotationToAssignments } from "@/lib/judge-rotation-utils"
import { requireCohostCompetitionOwnership, requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostBaseSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const createRotationSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Event ID is required"),
  membershipId: z.string().min(1, "Judge ID is required"),
  startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
  startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
  heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
  laneShiftPattern: z
    .enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
    .optional(),
  notes: z.string().max(500, "Notes too long").optional(),
})

const updateRotationSchema = cohostBaseSchema.extend({
  rotationId: z.string().min(1, "Rotation ID is required"),
  startingHeat: z.number().int().min(1).optional(),
  startingLane: z.number().int().min(1).optional(),
  heatsCount: z.number().int().min(1).optional(),
  laneShiftPattern: z
    .enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
    .optional(),
  notes: z.string().max(500).optional(),
})

const deleteRotationSchema = cohostBaseSchema.extend({
  rotationId: z.string().min(1, "Rotation ID is required"),
})

const updateEventDefaultsSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Event ID is required"),
  defaultHeatsCount: z.number().int().min(1).nullable().optional(),
  defaultLaneShiftPattern: z
    .enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
    .nullable()
    .optional(),
  minHeatBuffer: z.number().int().min(1).max(10).nullable().optional(),
})

const batchCreateRotationsSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Event ID is required"),
  membershipId: z.string().min(1, "Judge ID is required"),
  rotations: z
    .array(
      z.object({
        startingHeat: z
          .number()
          .int()
          .min(1, "Starting heat must be at least 1"),
        startingLane: z
          .number()
          .int()
          .min(1, "Starting lane must be at least 1"),
        heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
        notes: z.string().max(500, "Notes too long").optional(),
      }),
    )
    .min(1, "At least one rotation required"),
  laneShiftPattern: z.enum([
    LANE_SHIFT_PATTERN.STAY,
    LANE_SHIFT_PATTERN.SHIFT_RIGHT,
  ]),
})

const batchUpdateVolunteerRotationsSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Event ID is required"),
  membershipId: z.string().min(1, "Judge ID is required"),
  rotations: z
    .array(
      z.object({
        startingHeat: z
          .number()
          .int()
          .min(1, "Starting heat must be at least 1"),
        startingLane: z
          .number()
          .int()
          .min(1, "Starting lane must be at least 1"),
        heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
        notes: z.string().max(500, "Notes too long").optional(),
      }),
    )
    .min(1, "At least one rotation required"),
  laneShiftPattern: z.enum([
    LANE_SHIFT_PATTERN.STAY,
    LANE_SHIFT_PATTERN.SHIFT_RIGHT,
  ]),
})

const deleteVolunteerRotationsSchema = cohostBaseSchema.extend({
  membershipId: z.string().min(1, "Judge ID is required"),
  trackWorkoutId: z.string().min(1, "Event ID is required"),
})

const batchDeleteRotationsSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  rotationIds: z
    .array(z.string().min(1))
    .min(1, "At least one rotation ID required"),
})

const adjustRotationsForOccupiedLanesSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Event ID is required"),
  /** Map of heatNumber -> array of occupied lane numbers */
  occupiedLanesByHeat: z.record(z.string(), z.array(z.number())),
  /** Rotation IDs to adjust */
  rotationIds: z
    .array(z.string().min(1))
    .min(1, "At least one rotation ID required"),
})

const publishRotationsSchema = cohostBaseSchema.extend({
  trackWorkoutId: z.string().min(1, "Event ID is required"),
  publishedBy: z.string().min(1, "Publisher user ID is required"),
  notes: z.string().max(1000, "Notes too long").optional(),
})

const rollbackToVersionSchema = cohostBaseSchema.extend({
  versionId: z.string().min(1, "Version ID is required"),
})

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Validate rotation for conflicts (double-booking, invalid lanes, buffer violations)
 * Same logic as judge-rotation-fns validateRotationConflictsInternal
 */
async function validateRotationConflictsInternal(
  rotation: {
    id?: string
    trackWorkoutId: string
    membershipId: string
    startingHeat: number
    startingLane: number
    heatsCount: number
    laneShiftPattern: LaneShiftPattern
  },
  options?: {
    excludeAllForMembership?: boolean
  },
) {
  const db = getDb()

  interface RotationConflict {
    rotationId: string
    conflictType:
      | "double_booking"
      | "invalid_lane"
      | "invalid_heat"
      | "buffer_violation"
    message: string
    heatNumber?: number
    laneNumber?: number
  }

  const conflicts: RotationConflict[] = []

  // Get all heats for the event with venue lane count
  const heatsRaw = await db
    .select({
      heatNumber: competitionHeatsTable.heatNumber,
      venueId: competitionHeatsTable.venueId,
      venueLaneCount: competitionVenuesTable.laneCount,
    })
    .from(competitionHeatsTable)
    .leftJoin(
      competitionVenuesTable,
      eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
    )
    .where(eq(competitionHeatsTable.trackWorkoutId, rotation.trackWorkoutId))

  const heats = heatsRaw.map((h) => ({
    heatNumber: h.heatNumber,
    laneCount: h.venueLaneCount ?? 10,
  }))

  if (heats.length === 0) {
    conflicts.push({
      rotationId: rotation.id ?? "new",
      conflictType: "invalid_heat",
      message: "No heats found for this event",
    })
    return {
      conflicts,
      effectiveHeatsCount: 0,
      requestedHeatsCount: rotation.heatsCount,
      truncated: true,
    }
  }

  const heatMap = new Map(heats.map((h) => [h.heatNumber, h]))
  let effectiveHeatsCount = 0

  for (let i = 0; i < rotation.heatsCount; i++) {
    const heatNumber = rotation.startingHeat + i
    const heat = heatMap.get(heatNumber)

    if (!heat) continue
    effectiveHeatsCount++

    let laneNumber = rotation.startingLane
    switch (rotation.laneShiftPattern) {
      case LANE_SHIFT_PATTERN.SHIFT_RIGHT:
        laneNumber = ((rotation.startingLane - 1 + i) % heat.laneCount) + 1
        break
    }

    if (laneNumber < 1 || laneNumber > heat.laneCount) {
      conflicts.push({
        rotationId: rotation.id ?? "new",
        conflictType: "invalid_lane",
        message: `Lane ${laneNumber} is invalid for heat ${heatNumber} (max: ${heat.laneCount})`,
        heatNumber,
        laneNumber,
      })
    }
  }

  // Check for double-booking with existing rotations
  if (!options?.excludeAllForMembership) {
    const { ne } = await import("drizzle-orm")
    const existingRotations = await db
      .select()
      .from(competitionJudgeRotationsTable)
      .where(
        and(
          eq(
            competitionJudgeRotationsTable.trackWorkoutId,
            rotation.trackWorkoutId,
          ),
          eq(
            competitionJudgeRotationsTable.membershipId,
            rotation.membershipId,
          ),
          ...(rotation.id
            ? [ne(competitionJudgeRotationsTable.id, rotation.id)]
            : []),
        ),
      )

    const currentAssignments = expandRotationToAssignments(
      {
        ...rotation,
        id: rotation.id ?? "new",
        competitionId: "",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        updateCounter: null,
      },
      heats,
    )

    for (const existing of existingRotations) {
      const existingAssignments = expandRotationToAssignments(existing, heats)

      for (const current of currentAssignments) {
        for (const exist of existingAssignments) {
          if (current.heatNumber === exist.heatNumber) {
            conflicts.push({
              rotationId: existing.id,
              conflictType: "double_booking",
              message: `Judge is already assigned to heat ${current.heatNumber}`,
              heatNumber: current.heatNumber,
              laneNumber: current.laneNumber,
            })
          }
        }
      }
    }

    // Check buffer violations
    const [eventSettings] = await db
      .select({
        minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
      })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, rotation.trackWorkoutId))

    const minHeatBuffer = eventSettings?.minHeatBuffer ?? 2

    for (const existing of existingRotations) {
      const existingAssignments = expandRotationToAssignments(existing, heats)
      if (existingAssignments.length === 0) continue

      const existingHeatNumbers = existingAssignments.map((a) => a.heatNumber)
      const existingStart = Math.min(...existingHeatNumbers)
      const existingEnd = Math.max(...existingHeatNumbers)

      const bufferAfterStart = existingEnd + 1
      const bufferAfterEnd = existingEnd + minHeatBuffer
      const bufferBeforeStart = existingStart - minHeatBuffer
      const bufferBeforeEnd = existingStart - 1

      for (const current of currentAssignments) {
        const { heatNumber } = current
        if (heatNumber >= bufferAfterStart && heatNumber <= bufferAfterEnd) {
          conflicts.push({
            rotationId: existing.id,
            conflictType: "buffer_violation",
            message: `Heat ${heatNumber} is within the buffer zone (needs ${minHeatBuffer} heat gap after rotation ending at heat ${existingEnd})`,
            heatNumber,
          })
        }
        if (heatNumber >= bufferBeforeStart && heatNumber <= bufferBeforeEnd) {
          conflicts.push({
            rotationId: existing.id,
            conflictType: "buffer_violation",
            message: `Heat ${heatNumber} is within the buffer zone (needs ${minHeatBuffer} heat gap before rotation starting at heat ${existingStart})`,
            heatNumber,
          })
        }
      }
    }
  }

  return {
    conflicts,
    effectiveHeatsCount,
    requestedHeatsCount: rotation.heatsCount,
    truncated: effectiveHeatsCount < rotation.heatsCount,
  }
}

/**
 * Create a judge rotation (internal helper).
 * Same logic as judge-rotation-fns createRotationInternal but no permission check
 * (permission check happens in the server fn wrapper).
 */
async function createRotationInternal(params: {
  competitionId: string
  trackWorkoutId: string
  membershipId: string
  startingHeat: number
  startingLane: number
  heatsCount: number
  laneShiftPattern?: LaneShiftPattern
  notes?: string
}): Promise<CompetitionJudgeRotation> {
  const db = getDb()

  // Determine lane shift pattern from hierarchy
  let laneShiftPattern = params.laneShiftPattern

  if (!laneShiftPattern) {
    const [event] = await db
      .select({
        defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
        trackId: trackWorkoutsTable.trackId,
      })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, params.trackWorkoutId))

    if (event?.defaultLaneShiftPattern) {
      laneShiftPattern = event.defaultLaneShiftPattern as LaneShiftPattern
    } else if (event?.trackId) {
      const [competition] = await db
        .select({
          defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.id, params.competitionId))

      laneShiftPattern =
        (competition?.defaultLaneShiftPattern as LaneShiftPattern) ??
        LANE_SHIFT_PATTERN.STAY
    }

    if (!laneShiftPattern) {
      laneShiftPattern = LANE_SHIFT_PATTERN.STAY
    }
  }

  const { createJudgeRotationId } = await import("@/db/schemas/common")
  const id = createJudgeRotationId()

  await db.insert(competitionJudgeRotationsTable).values({
    id,
    competitionId: params.competitionId,
    trackWorkoutId: params.trackWorkoutId,
    membershipId: params.membershipId,
    startingHeat: params.startingHeat,
    startingLane: params.startingLane,
    heatsCount: params.heatsCount,
    laneShiftPattern,
    notes: params.notes ?? null,
  })

  const rotation = await db.query.competitionJudgeRotationsTable.findFirst({
    where: eq(competitionJudgeRotationsTable.id, id),
  })

  if (!rotation) {
    throw new Error("Failed to create judge rotation")
  }

  return rotation
}

/**
 * Delete a judge rotation (internal helper).
 * Clears FK references before deleting.
 */
async function deleteRotationInternal(rotationId: string): Promise<void> {
  const db = getDb()

  await db
    .update(judgeHeatAssignmentsTable)
    .set({ rotationId: null })
    .where(eq(judgeHeatAssignmentsTable.rotationId, rotationId))

  await db
    .delete(competitionJudgeRotationsTable)
    .where(eq(competitionJudgeRotationsTable.id, rotationId))
}

/**
 * Calculate lane number based on shift pattern
 */
function calculateLane(
  startingLane: number,
  heatIndex: number,
  laneShiftPattern: string,
  maxLanes: number,
): number {
  switch (laneShiftPattern) {
    case LANE_SHIFT_PATTERN.STAY:
      return startingLane
    case LANE_SHIFT_PATTERN.SHIFT_RIGHT:
      return ((startingLane - 1 + heatIndex) % maxLanes) + 1
    default:
      return startingLane
  }
}

/**
 * Expand rotations into individual heat+lane assignments
 */
async function materializeRotations(
  trackWorkoutId: string,
  maxLanes: number,
) {
  const db = getDb()

  type MaterializedAssignment = Record<string, unknown> & {
    heatId: string
    membershipId: string
    rotationId: string
    laneNumber: number
    position: "judge"
  }

  const assignments: MaterializedAssignment[] = []

  const rotations = await db.query.competitionJudgeRotationsTable.findMany({
    where: eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutId),
  })

  const heats = await db
    .select({
      id: competitionHeatsTable.id,
      heatNumber: competitionHeatsTable.heatNumber,
    })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))
    .orderBy(asc(competitionHeatsTable.heatNumber))

  const heatMap = new Map(heats.map((h) => [h.heatNumber, h.id]))

  const seen = new Set<string>()

  for (const rotation of rotations) {
    for (let i = 0; i < rotation.heatsCount; i++) {
      const heatNumber = rotation.startingHeat + i
      const heatId = heatMap.get(heatNumber)

      if (!heatId) continue

      const key = `${heatId}:${rotation.membershipId}`
      if (seen.has(key)) continue
      seen.add(key)

      const laneNumber = calculateLane(
        rotation.startingLane,
        i,
        rotation.laneShiftPattern,
        maxLanes,
      )

      assignments.push({
        heatId,
        membershipId: rotation.membershipId,
        rotationId: rotation.id,
        laneNumber,
        position: "judge",
      })
    }
  }

  return assignments
}

// ============================================================================
// Rotation Mutation Functions
// ============================================================================

/**
 * Create a new judge rotation (cohost)
 */
export const cohostCreateJudgeRotationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createRotationSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const validation = await validateRotationConflictsInternal({
      trackWorkoutId: data.trackWorkoutId,
      membershipId: data.membershipId,
      startingHeat: data.startingHeat,
      startingLane: data.startingLane,
      heatsCount: data.heatsCount,
      laneShiftPattern: data.laneShiftPattern ?? LANE_SHIFT_PATTERN.STAY,
    })

    if (validation.conflicts.length > 0) {
      throw new Error(
        `Rotation has conflicts: ${validation.conflicts.map((c) => c.message).join(", ")}`,
      )
    }

    const rotation = await createRotationInternal(data)
    return { success: true, data: rotation }
  })

/**
 * Update an existing judge rotation (cohost)
 */
export const cohostUpdateJudgeRotationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateRotationSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")

    const db = getDb()

    const existing = await db.query.competitionJudgeRotationsTable.findFirst({
      where: (table, { eq }) => eq(table.id, data.rotationId),
    })

    if (!existing) {
      throw new Error("Rotation not found")
    }

    const validation = await validateRotationConflictsInternal({
      id: data.rotationId,
      trackWorkoutId: existing.trackWorkoutId,
      membershipId: existing.membershipId,
      startingHeat: data.startingHeat ?? existing.startingHeat,
      startingLane: data.startingLane ?? existing.startingLane,
      heatsCount: data.heatsCount ?? existing.heatsCount,
      laneShiftPattern: data.laneShiftPattern ?? existing.laneShiftPattern,
    })

    if (validation.conflicts.length > 0) {
      throw new Error(
        `Rotation has conflicts: ${validation.conflicts.map((c) => c.message).join(", ")}`,
      )
    }

    const updateData: Partial<CompetitionJudgeRotation> = {
      updatedAt: new Date(),
    }

    if (data.startingHeat !== undefined) {
      updateData.startingHeat = data.startingHeat
    }
    if (data.startingLane !== undefined) {
      updateData.startingLane = data.startingLane
    }
    if (data.heatsCount !== undefined) {
      updateData.heatsCount = data.heatsCount
    }
    if (data.laneShiftPattern !== undefined) {
      updateData.laneShiftPattern = data.laneShiftPattern
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes
    }

    await db
      .update(competitionJudgeRotationsTable)
      .set(updateData)
      .where(eq(competitionJudgeRotationsTable.id, data.rotationId))

    const updated = await db.query.competitionJudgeRotationsTable.findFirst({
      where: eq(competitionJudgeRotationsTable.id, data.rotationId),
    })

    if (!updated) {
      throw new Error("Rotation not found or update failed")
    }

    return { success: true, data: updated }
  })

/**
 * Delete a judge rotation (cohost)
 */
export const cohostDeleteJudgeRotationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteRotationSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")

    await deleteRotationInternal(data.rotationId)
    return { success: true }
  })

/**
 * Update event defaults for judge rotations (cohost)
 */
export const cohostUpdateEventDefaultsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateEventDefaultsSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const updateData: {
      defaultHeatsCount?: number | null
      defaultLaneShiftPattern?: string | null
      minHeatBuffer?: number | null
      updatedAt: Date
    } = {
      updatedAt: new Date(),
    }

    if (data.defaultHeatsCount !== undefined) {
      updateData.defaultHeatsCount = data.defaultHeatsCount
    }
    if (data.defaultLaneShiftPattern !== undefined) {
      updateData.defaultLaneShiftPattern = data.defaultLaneShiftPattern
    }
    if (data.minHeatBuffer !== undefined) {
      updateData.minHeatBuffer = data.minHeatBuffer
    }

    await db
      .update(trackWorkoutsTable)
      .set(updateData)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    return { success: true }
  })

/**
 * Batch create multiple rotations for the same volunteer (cohost)
 */
export const cohostBatchCreateRotationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => batchCreateRotationsSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Validate that all foreign keys exist
    const [trackWorkout, membership, competition] = await Promise.all([
      db.query.trackWorkoutsTable.findFirst({
        where: (table, { eq }) => eq(table.id, data.trackWorkoutId),
      }),
      db.query.teamMembershipTable.findFirst({
        where: (table, { eq }) => eq(table.id, data.membershipId),
      }),
      db.query.competitionsTable.findFirst({
        where: (table, { eq }) => eq(table.id, data.competitionId),
      }),
    ])

    if (!trackWorkout) throw new Error("Event not found")
    if (!membership) throw new Error("Judge membership not found")
    if (!competition) throw new Error("Competition not found")

    // Validate all rotations first (fail-fast)
    const validationPromises = data.rotations.map((rotation) =>
      validateRotationConflictsInternal({
        trackWorkoutId: data.trackWorkoutId,
        membershipId: data.membershipId,
        startingHeat: rotation.startingHeat,
        startingLane: rotation.startingLane,
        heatsCount: rotation.heatsCount,
        laneShiftPattern: data.laneShiftPattern,
      }),
    )

    const validationResults = await Promise.all(validationPromises)
    const allConflicts = validationResults.flatMap((result) => result.conflicts)

    if (allConflicts.length > 0) {
      throw new Error(
        `Rotations have conflicts: ${allConflicts.map((c) => c.message).join(", ")}`,
      )
    }

    // Check for conflicts BETWEEN the new rotations
    for (let i = 0; i < data.rotations.length; i++) {
      for (let j = i + 1; j < data.rotations.length; j++) {
        const rot1 = data.rotations[i]
        const rot2 = data.rotations[j]
        if (!rot1 || !rot2) continue

        const rot1End = rot1.startingHeat + rot1.heatsCount - 1
        const rot2End = rot2.startingHeat + rot2.heatsCount - 1

        if (!(rot1End < rot2.startingHeat || rot2End < rot1.startingHeat)) {
          throw new Error(
            `Rotations ${i + 1} and ${j + 1} have overlapping heat ranges and may conflict`,
          )
        }
      }
    }

    // Create rotations in sequence
    const createdRotations: CompetitionJudgeRotation[] = []

    for (const rotation of data.rotations) {
      const created = await createRotationInternal({
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
        membershipId: data.membershipId,
        startingHeat: rotation.startingHeat,
        startingLane: rotation.startingLane,
        heatsCount: rotation.heatsCount,
        laneShiftPattern: data.laneShiftPattern,
        notes: rotation.notes,
      })
      createdRotations.push(created)
    }

    return {
      success: true,
      data: {
        rotationIds: createdRotations.map((r) => r.id),
        rotations: createdRotations,
      },
    }
  })

/**
 * Replace all rotations for a volunteer with a new set (cohost).
 * Deletes existing rotations, then creates new ones.
 */
export const cohostBatchUpdateVolunteerRotationsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    batchUpdateVolunteerRotationsSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Validate that all foreign keys exist
    const [trackWorkout, membership, competition] = await Promise.all([
      db.query.trackWorkoutsTable.findFirst({
        where: (table, { eq }) => eq(table.id, data.trackWorkoutId),
      }),
      db.query.teamMembershipTable.findFirst({
        where: (table, { eq }) => eq(table.id, data.membershipId),
      }),
      db.query.competitionsTable.findFirst({
        where: (table, { eq }) => eq(table.id, data.competitionId),
      }),
    ])

    if (!trackWorkout) throw new Error("Event not found")
    if (!membership) throw new Error("Judge membership not found")
    if (!competition) throw new Error("Competition not found")

    // Validate all NEW rotations (excluding existing for this membership)
    const validationPromises = data.rotations.map((rotation) =>
      validateRotationConflictsInternal(
        {
          trackWorkoutId: data.trackWorkoutId,
          membershipId: data.membershipId,
          startingHeat: rotation.startingHeat,
          startingLane: rotation.startingLane,
          heatsCount: rotation.heatsCount,
          laneShiftPattern: data.laneShiftPattern,
        },
        { excludeAllForMembership: true },
      ),
    )

    const validationResults = await Promise.all(validationPromises)

    // Check for conflicts BETWEEN the new rotations
    for (let i = 0; i < data.rotations.length; i++) {
      for (let j = i + 1; j < data.rotations.length; j++) {
        const rot1 = data.rotations[i]
        const rot2 = data.rotations[j]
        if (!rot1 || !rot2) continue

        const rot1End = rot1.startingHeat + rot1.heatsCount - 1
        const rot2End = rot2.startingHeat + rot2.heatsCount - 1

        if (!(rot1End < rot2.startingHeat || rot2End < rot1.startingHeat)) {
          throw new Error(
            `Rotations ${i + 1} and ${j + 1} have overlapping heat ranges and may conflict`,
          )
        }
      }
    }

    const allConflicts = validationResults.flatMap((result) => result.conflicts)

    if (allConflicts.length > 0) {
      throw new Error(
        `Rotations have conflicts: ${allConflicts.map((c) => c.message).join(", ")}`,
      )
    }

    // Delete existing rotations for this volunteer+event
    const existingRotations = await db
      .select({ id: competitionJudgeRotationsTable.id })
      .from(competitionJudgeRotationsTable)
      .where(
        and(
          eq(
            competitionJudgeRotationsTable.trackWorkoutId,
            data.trackWorkoutId,
          ),
          eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
        ),
      )

    if (existingRotations.length > 0) {
      const existingIds = existingRotations.map((r) => r.id)
      await db.transaction(async (tx) => {
        await tx
          .update(judgeHeatAssignmentsTable)
          .set({ rotationId: null })
          .where(inArray(judgeHeatAssignmentsTable.rotationId, existingIds))

        await tx
          .delete(competitionJudgeRotationsTable)
          .where(inArray(competitionJudgeRotationsTable.id, existingIds))
      })
    }

    // Create new rotations in sequence
    const createdRotations: CompetitionJudgeRotation[] = []

    for (const rotation of data.rotations) {
      const created = await createRotationInternal({
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
        membershipId: data.membershipId,
        startingHeat: rotation.startingHeat,
        startingLane: rotation.startingLane,
        heatsCount: rotation.heatsCount,
        laneShiftPattern: data.laneShiftPattern,
        notes: rotation.notes,
      })
      createdRotations.push(created)
    }

    return {
      success: true,
      data: {
        rotationIds: createdRotations.map((r) => r.id),
        rotations: createdRotations,
      },
    }
  })

/**
 * Delete all rotations for a specific volunteer in an event (cohost)
 */
export const cohostDeleteVolunteerRotationsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    deleteVolunteerRotationsSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")

    const db = getDb()

    const rotationsToDelete = await db
      .select({ id: competitionJudgeRotationsTable.id })
      .from(competitionJudgeRotationsTable)
      .where(
        and(
          eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
          eq(
            competitionJudgeRotationsTable.trackWorkoutId,
            data.trackWorkoutId,
          ),
        ),
      )

    if (rotationsToDelete.length > 0) {
      const rotationIds = rotationsToDelete.map((r) => r.id)

      await db.transaction(async (tx) => {
        await tx
          .update(judgeHeatAssignmentsTable)
          .set({ rotationId: null })
          .where(inArray(judgeHeatAssignmentsTable.rotationId, rotationIds))

        await tx
          .delete(competitionJudgeRotationsTable)
          .where(inArray(competitionJudgeRotationsTable.id, rotationIds))
      })
    }

    return {
      success: true,
      data: { deletedCount: rotationsToDelete.length },
    }
  })

/**
 * Batch delete multiple rotations by their IDs (cohost)
 */
export const cohostBatchDeleteRotationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => batchDeleteRotationsSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Verify all rotations belong to this competition before deleting
    const rotations = await db.query.competitionJudgeRotationsTable.findMany({
      where: (table, { inArray }) => inArray(table.id, data.rotationIds),
    })

    for (const rotation of rotations) {
      if (rotation.competitionId !== data.competitionId) {
        throw new Error("Rotation does not belong to this competition")
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(judgeHeatAssignmentsTable)
        .set({ rotationId: null })
        .where(inArray(judgeHeatAssignmentsTable.rotationId, data.rotationIds))

      await tx
        .delete(competitionJudgeRotationsTable)
        .where(inArray(competitionJudgeRotationsTable.id, data.rotationIds))
    })

    return {
      success: true,
      data: { deletedCount: data.rotationIds.length },
    }
  })

// ============================================================================
// Assignment Mutation Functions (from judge-assignment-fns)
// ============================================================================

/**
 * Publish rotations as a new version (cohost)
 */
export const cohostPublishRotationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => publishRotationsSchema.parse(data))
  .handler(async ({ data }): Promise<JudgeAssignmentVersion> => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")

    const db = getDb()

    // Get event info to find maxLanes
    const result = await db
      .select({
        competitionId: programmingTracksTable.competitionId,
        venues: competitionVenuesTable,
      })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .innerJoin(
        competitionsTable,
        eq(programmingTracksTable.competitionId, competitionsTable.id),
      )
      .innerJoin(
        competitionVenuesTable,
        eq(competitionsTable.id, competitionVenuesTable.competitionId),
      )
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    if (result.length === 0) {
      throw new Error("Event or competition not found")
    }

    const maxLanes = result.reduce(
      (max: number, row) => Math.max(max, row.venues.laneCount),
      3,
    )

    // Get next version number
    const versions = await db.query.judgeAssignmentVersionsTable.findMany({
      where: eq(
        judgeAssignmentVersionsTable.trackWorkoutId,
        data.trackWorkoutId,
      ),
      orderBy: desc(judgeAssignmentVersionsTable.version),
    })
    const nextVersion =
      versions.length > 0 ? (versions[0]?.version ?? 0) + 1 : 1

    // Materialize all rotations
    const materializedAssignments = await materializeRotations(
      data.trackWorkoutId,
      maxLanes,
    )

    const { createJudgeAssignmentVersionId } = await import("@/db/schema")
    const newVersionId = createJudgeAssignmentVersionId()

    const newVersion = await db.transaction(async (tx) => {
      // Deactivate previous versions
      await tx
        .update(judgeAssignmentVersionsTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          eq(judgeAssignmentVersionsTable.trackWorkoutId, data.trackWorkoutId),
        )

      // Create new version
      await tx.insert(judgeAssignmentVersionsTable).values({
        id: newVersionId,
        trackWorkoutId: data.trackWorkoutId,
        version: nextVersion,
        publishedBy: data.publishedBy,
        notes: data.notes ?? null,
        isActive: true,
      })

      const version = await tx.query.judgeAssignmentVersionsTable.findFirst({
        where: eq(judgeAssignmentVersionsTable.id, newVersionId),
      })

      if (!version) {
        throw new Error("Failed to create version")
      }

      // Bulk insert all assignments
      if (materializedAssignments.length > 0) {
        await tx.insert(judgeHeatAssignmentsTable).values(
          materializedAssignments.map((a) => ({
            heatId: a.heatId,
            membershipId: a.membershipId,
            rotationId: a.rotationId,
            laneNumber: a.laneNumber,
            position: a.position,
            versionId: version.id,
            isManualOverride: false,
          })),
        )
      }

      return version
    })

    return newVersion
  })

/**
 * Rollback to a different version (cohost)
 */
export const cohostRollbackToVersionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rollbackToVersionSchema.parse(data))
  .handler(async ({ data }): Promise<JudgeAssignmentVersion> => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")

    const db = getDb()

    const targetVersion = await db.query.judgeAssignmentVersionsTable.findFirst(
      {
        where: eq(judgeAssignmentVersionsTable.id, data.versionId),
      },
    )

    if (!targetVersion) {
      throw new Error("Version not found")
    }

    const updatedVersion = await db.transaction(async (tx) => {
      // Deactivate all versions for this event
      await tx
        .update(judgeAssignmentVersionsTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          eq(
            judgeAssignmentVersionsTable.trackWorkoutId,
            targetVersion.trackWorkoutId,
          ),
        )

      // Activate the target version
      await tx
        .update(judgeAssignmentVersionsTable)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(judgeAssignmentVersionsTable.id, data.versionId))

      const version = await tx.query.judgeAssignmentVersionsTable.findFirst({
        where: eq(judgeAssignmentVersionsTable.id, data.versionId),
      })

      if (!version) {
        throw new Error("Failed to activate version")
      }

      return version
    })

    return updatedVersion
  })

/**
 * Adjust rotations to only cover lanes with athletes (cohost).
 * Splits rotations as needed to skip unoccupied lanes.
 */
export const cohostAdjustRotationsForOccupiedLanesFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    adjustRotationsForOccupiedLanesSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Get heats for expansion
    const heatsRaw = await db
      .select({
        heatNumber: competitionHeatsTable.heatNumber,
        venueLaneCount: competitionVenuesTable.laneCount,
      })
      .from(competitionHeatsTable)
      .leftJoin(
        competitionVenuesTable,
        eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
      )
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    const heats = heatsRaw.map((h) => ({
      heatNumber: h.heatNumber,
      laneCount: h.venueLaneCount ?? 10,
    }))

    // Convert occupiedLanesByHeat to a Map for easier lookup
    const occupiedMap = new Map<number, Set<number>>()
    for (const [heatStr, lanes] of Object.entries(data.occupiedLanesByHeat)) {
      occupiedMap.set(Number(heatStr), new Set(lanes))
    }

    let deletedCount = 0
    let createdCount = 0
    let unchangedCount = 0

    for (const rotationId of data.rotationIds) {
      const rotation = await db.query.competitionJudgeRotationsTable.findFirst({
        where: (table, { eq }) => eq(table.id, rotationId),
      })

      if (!rotation) continue

      if (
        rotation.trackWorkoutId !== data.trackWorkoutId ||
        rotation.competitionId !== data.competitionId
      ) {
        throw new Error("Rotation does not belong to this event")
      }

      const assignments = expandRotationToAssignments(rotation, heats)

      const occupiedAssignments = assignments.filter((a) => {
        const occupied = occupiedMap.get(a.heatNumber)
        return occupied?.has(a.laneNumber)
      })

      if (occupiedAssignments.length === assignments.length) {
        unchangedCount++
        continue
      }

      if (occupiedAssignments.length === 0) {
        await deleteRotationInternal(rotationId)
        deletedCount++
        continue
      }

      // Group contiguous heats into new rotations
      occupiedAssignments.sort((a, b) => a.heatNumber - b.heatNumber)

      const newRotations: Array<{
        startingHeat: number
        startingLane: number
        heatsCount: number
      }> = []

      let currentRun: typeof occupiedAssignments = []

      for (const assignment of occupiedAssignments) {
        if (currentRun.length === 0) {
          currentRun.push(assignment)
        } else {
          const lastAssignment = currentRun[currentRun.length - 1]!
          if (assignment.heatNumber === lastAssignment.heatNumber + 1) {
            currentRun.push(assignment)
          } else {
            newRotations.push({
              startingHeat: currentRun[0]!.heatNumber,
              startingLane: currentRun[0]!.laneNumber,
              heatsCount: currentRun.length,
            })
            currentRun = [assignment]
          }
        }
      }

      if (currentRun.length > 0) {
        newRotations.push({
          startingHeat: currentRun[0]!.heatNumber,
          startingLane: currentRun[0]!.laneNumber,
          heatsCount: currentRun.length,
        })
      }

      // Create new rotations before deleting old one
      for (const newRot of newRotations) {
        await createRotationInternal({
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          membershipId: rotation.membershipId,
          startingHeat: newRot.startingHeat,
          startingLane: newRot.startingLane,
          heatsCount: newRot.heatsCount,
          laneShiftPattern: rotation.laneShiftPattern,
          notes: rotation.notes ?? undefined,
        })
        createdCount++
      }

      await deleteRotationInternal(rotationId)
      deletedCount++
    }

    return {
      success: true,
      data: { deletedCount, createdCount, unchangedCount },
    }
  })
