/**
 * Cohost Workout Server Functions
 * Mirrors competition-workouts-fns.ts with cohost auth.
 * Provides GET + UPDATE operations for competition workouts and events.
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  createProgrammingTrackId,
  createTagId,
  createTrackWorkoutId,
  createWorkoutScalingDescriptionId,
} from "@/db/schemas/common"
import {
  competitionsTable,
} from "@/db/schemas/competitions"
import {
  PROGRAMMING_TRACK_TYPE,
  programmingTracksTable,
  type TrackWorkout,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import {
  scalingLevelsTable,
  workoutScalingDescriptionsTable,
} from "@/db/schemas/scaling"
import {
  movements,
  SCORE_TYPE_VALUES,
  TIEBREAK_SCHEME_VALUES,
  tags,
  WORKOUT_SCHEME_VALUES,
  type Workout,
  workoutMovements,
  workouts,
  workoutTags,
} from "@/db/schemas/workouts"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Types
// ============================================================================

export interface CohostDivisionDescription {
  divisionId: string
  divisionLabel: string
  description: string | null
  position: number
}

export interface CohostCompetitionWorkout {
  id: string
  trackId: string
  workoutId: string
  trackOrder: number
  parentEventId: string | null
  notes: string | null
  pointsMultiplier: number | null
  heatStatus: TrackWorkout["heatStatus"]
  eventStatus: TrackWorkout["eventStatus"]
  sponsorId: string | null
  createdAt: Date
  updatedAt: Date
  workout: {
    id: string
    name: string
    description: string | null
    scheme: Workout["scheme"]
    scoreType: Workout["scoreType"]
    roundsToScore: number | null
    repsPerRound: number | null
    tiebreakScheme: Workout["tiebreakScheme"]
    timeCap: number | null
    tags?: Array<{ id: string; name: string }>
    movements?: Array<{ id: string; name: string; type: string }>
  }
  divisionDescriptions?: CohostDivisionDescription[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetWorkoutsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostGetEventInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const cohostGetDivisionDescriptionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  workoutId: z.string().min(1, "Workout ID is required"),
  divisionIds: z.array(z.string()),
})

const cohostGetBatchDivisionDescriptionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  workoutIds: z.array(z.string()).min(1, "At least one workout ID is required"),
  divisionIds: z.array(z.string()),
})

const cohostUpdateWorkoutInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  trackOrder: z.number().min(0).optional(),
  pointsMultiplier: z.number().int().min(1).optional(),
  notes: z.string().max(1000).nullable().optional(),
  heatStatus: z.enum(["draft", "published"]).optional(),
  eventStatus: z.enum(["draft", "published"]).optional(),
})

const cohostSaveEventInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  workoutId: z.string().min(1, "Workout ID is required"),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional(),
  scheme: z.enum(WORKOUT_SCHEME_VALUES),
  scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
  roundsToScore: z.number().int().min(1).nullable().optional(),
  tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
  timeCap: z.number().int().min(1).nullable().optional(),
  movementIds: z.array(z.string()).optional(),
  pointsMultiplier: z.number().int().min(1).optional(),
  notes: z.string().max(1000).nullable().optional(),
  sponsorId: z.string().nullable().optional(),
  divisionDescriptions: z
    .array(
      z.object({
        divisionId: z.string().min(1, "Division ID is required"),
        description: z.string().max(2000).nullable(),
      }),
    )
    .optional(),
})

const cohostReorderEventsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  updates: z
    .array(
      z.object({
        trackWorkoutId: z.string().min(1),
        trackOrder: z.number().min(0),
      }),
    )
    .min(1, "At least one update required"),
})

const cohostCreateWorkoutInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  name: z.string().min(1, "Name is required").max(200),
  scheme: z.enum(WORKOUT_SCHEME_VALUES),
  scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
  description: z.string().max(5000).optional(),
  roundsToScore: z.number().int().min(1).nullable().optional(),
  repsPerRound: z.number().int().min(1).nullable().optional(),
  tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
  movementIds: z.array(z.string()).optional(),
  sourceWorkoutId: z.string().nullable().optional(),
  parentEventId: z.string().min(1).optional(),
})

const cohostRemoveWorkoutInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

async function getCompetitionTrack(competitionId: string) {
  const db = getDb()
  const track = await db.query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.competitionId, competitionId),
  })
  return track ?? null
}

async function getNextCompetitionEventOrder(
  competitionId: string,
): Promise<number> {
  const db = getDb()
  const track = await getCompetitionTrack(competitionId)
  if (!track) return 1

  const trackWorkouts = await db
    .select({ trackOrder: trackWorkoutsTable.trackOrder })
    .from(trackWorkoutsTable)
    .where(eq(trackWorkoutsTable.trackId, track.id))

  if (trackWorkouts.length === 0) return 1

  const maxOrder = Math.max(
    ...trackWorkouts.map((tw) => Number(tw.trackOrder)),
  )
  return Math.floor(maxOrder) + 1
}

async function getNextSubEventOrder(parentEventId: string): Promise<number> {
  const db = getDb()

  const parent = await db
    .select({ trackOrder: trackWorkoutsTable.trackOrder })
    .from(trackWorkoutsTable)
    .where(eq(trackWorkoutsTable.id, parentEventId))
    .limit(1)

  if (parent.length === 0) throw new Error("Parent event not found")

  const parentOrder = Math.floor(Number(parent[0].trackOrder))

  const siblings = await db
    .select({ trackOrder: trackWorkoutsTable.trackOrder })
    .from(trackWorkoutsTable)
    .where(eq(trackWorkoutsTable.parentEventId, parentEventId))

  if (siblings.length === 0) return parentOrder + 0.01

  const maxChildOrder = Math.max(
    ...siblings.map((s) => Number(s.trackOrder)),
  )
  return Number((maxChildOrder + 0.01).toFixed(2))
}

async function findOrCreateTag(tagName: string) {
  const db = getDb()
  const existingTags = await db
    .select()
    .from(tags)
    .where(eq(tags.name, tagName))
    .limit(1)

  if (existingTags.length > 0 && existingTags[0]) {
    return existingTags[0]
  }

  const tagId = createTagId()
  await db.insert(tags).values({
    id: tagId,
    name: tagName,
    updateCounter: 0,
  })

  const [newTag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1)

  return newTag
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all workouts for a competition (cohost view — all statuses)
 */
export const cohostGetWorkoutsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostGetWorkoutsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const track = await getCompetitionTrack(data.competitionId)
    if (!track) {
      return { workouts: [] }
    }

    const trackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
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

    return { workouts: trackWorkouts as CohostCompetitionWorkout[] }
  })

/**
 * Get a single competition event by trackWorkoutId (cohost view)
 */
export const cohostGetEventFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostGetEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const trackWorkout = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
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
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    if (trackWorkout.length === 0) {
      return { event: null }
    }

    const event = trackWorkout[0]

    // Fetch tags
    const workoutTagsData = await db
      .select({ tagId: tags.id, tagName: tags.name })
      .from(workoutTags)
      .innerJoin(tags, eq(workoutTags.tagId, tags.id))
      .where(eq(workoutTags.workoutId, event.workoutId))

    // Fetch movements
    const workoutMovementsData = await db
      .select({
        movementId: movements.id,
        movementName: movements.name,
        movementType: movements.type,
      })
      .from(workoutMovements)
      .innerJoin(movements, eq(workoutMovements.movementId, movements.id))
      .where(eq(workoutMovements.workoutId, event.workoutId))

    const eventWithDetails: CohostCompetitionWorkout = {
      ...event,
      workout: {
        ...event.workout,
        tags: workoutTagsData.map((t) => ({ id: t.tagId, name: t.tagName })),
        movements: workoutMovementsData.map((m) => ({
          id: m.movementId,
          name: m.movementName,
          type: m.movementType,
        })),
      },
    }

    return { event: eventWithDetails }
  })

/**
 * Get division descriptions for a workout (cohost view)
 */
export const cohostGetWorkoutDivisionDescriptionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    cohostGetDivisionDescriptionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)

    if (data.divisionIds.length === 0) {
      return { descriptions: [] }
    }

    const db = getDb()

    const divisions = await db
      .select({
        divisionId: scalingLevelsTable.id,
        divisionLabel: scalingLevelsTable.label,
        position: scalingLevelsTable.position,
      })
      .from(scalingLevelsTable)
      .where(inArray(scalingLevelsTable.id, data.divisionIds))

    const descriptions = await db
      .select({
        scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
        description: workoutScalingDescriptionsTable.description,
      })
      .from(workoutScalingDescriptionsTable)
      .where(
        and(
          eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
          inArray(
            workoutScalingDescriptionsTable.scalingLevelId,
            data.divisionIds,
          ),
        ),
      )

    const descriptionMap = new Map(
      descriptions.map((d) => [d.scalingLevelId, d.description] as const),
    )

    const result: CohostDivisionDescription[] = divisions.map((division) => ({
      divisionId: division.divisionId,
      divisionLabel: division.divisionLabel,
      description: descriptionMap.get(division.divisionId) ?? null,
      position: division.position,
    }))

    return { descriptions: result }
  })

/**
 * Batch get division descriptions for multiple workouts (cohost view)
 */
export const cohostGetBatchDivisionDescriptionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    cohostGetBatchDivisionDescriptionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)

    if (data.divisionIds.length === 0 || data.workoutIds.length === 0) {
      return {
        descriptionsByWorkout: {} as Record<string, CohostDivisionDescription[]>,
      }
    }

    const db = getDb()

    const divisions = await db
      .select({
        divisionId: scalingLevelsTable.id,
        divisionLabel: scalingLevelsTable.label,
        position: scalingLevelsTable.position,
      })
      .from(scalingLevelsTable)
      .where(inArray(scalingLevelsTable.id, data.divisionIds))

    const allDescriptions = await db
      .select({
        workoutId: workoutScalingDescriptionsTable.workoutId,
        scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
        description: workoutScalingDescriptionsTable.description,
      })
      .from(workoutScalingDescriptionsTable)
      .where(
        and(
          inArray(workoutScalingDescriptionsTable.workoutId, data.workoutIds),
          inArray(
            workoutScalingDescriptionsTable.scalingLevelId,
            data.divisionIds,
          ),
        ),
      )

    const descMap = new Map<string, Map<string, string | null>>()
    for (const d of allDescriptions) {
      if (!descMap.has(d.workoutId)) {
        descMap.set(d.workoutId, new Map())
      }
      descMap.get(d.workoutId)!.set(d.scalingLevelId, d.description)
    }

    const descriptionsByWorkout: Record<string, CohostDivisionDescription[]> =
      {}
    for (const workoutId of data.workoutIds) {
      const workoutDescMap = descMap.get(workoutId)
      descriptionsByWorkout[workoutId] = divisions.map((division) => ({
        divisionId: division.divisionId,
        divisionLabel: division.divisionLabel,
        description: workoutDescMap?.get(division.divisionId) ?? null,
        position: division.position,
      }))
    }

    return { descriptionsByWorkout }
  })

/**
 * Update a competition workout (cohost — status, notes, multiplier)
 */
export const cohostUpdateWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateWorkoutInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (data.trackOrder !== undefined) updateData.trackOrder = data.trackOrder
    if (data.pointsMultiplier !== undefined)
      updateData.pointsMultiplier = data.pointsMultiplier
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.heatStatus !== undefined) updateData.heatStatus = data.heatStatus
    if (data.eventStatus !== undefined)
      updateData.eventStatus = data.eventStatus

    await db
      .update(trackWorkoutsTable)
      .set(updateData)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    // Cascade eventStatus and heatStatus to child sub-events
    const cascadeData: Record<string, unknown> = {}
    if (data.eventStatus !== undefined)
      cascadeData.eventStatus = data.eventStatus
    if (data.heatStatus !== undefined) cascadeData.heatStatus = data.heatStatus
    if (Object.keys(cascadeData).length > 0) {
      cascadeData.updatedAt = new Date()
      await db
        .update(trackWorkoutsTable)
        .set(cascadeData)
        .where(eq(trackWorkoutsTable.parentEventId, data.trackWorkoutId))
    }

    return { success: true }
  })

/**
 * Save all competition event details in a single operation (cohost)
 */
export const cohostSaveEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cohostSaveEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    // 1. Update workout table
    const workoutUpdateData: Record<string, unknown> = {
      name: data.name,
      updatedAt: new Date(),
    }
    if (data.description !== undefined)
      workoutUpdateData.description = data.description
    if (data.scheme !== undefined) workoutUpdateData.scheme = data.scheme
    if (data.scoreType !== undefined)
      workoutUpdateData.scoreType = data.scoreType
    if (data.roundsToScore !== undefined)
      workoutUpdateData.roundsToScore = data.roundsToScore
    if (data.tiebreakScheme !== undefined)
      workoutUpdateData.tiebreakScheme = data.tiebreakScheme
    if (data.timeCap !== undefined) workoutUpdateData.timeCap = data.timeCap

    await db
      .update(workouts)
      .set(workoutUpdateData)
      .where(eq(workouts.id, data.workoutId))

    // 2. Update movements if provided
    if (data.movementIds !== undefined) {
      await db
        .delete(workoutMovements)
        .where(eq(workoutMovements.workoutId, data.workoutId))

      if (data.movementIds.length > 0) {
        await db.insert(workoutMovements).values(
          data.movementIds.map((movementId) => ({
            id: `workout_movement_${createId()}`,
            workoutId: data.workoutId,
            movementId,
          })),
        )
      }
    }

    // 3. Update track workout (pointsMultiplier, notes, sponsorId)
    const trackWorkoutUpdateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    if (data.pointsMultiplier !== undefined)
      trackWorkoutUpdateData.pointsMultiplier = data.pointsMultiplier
    if (data.notes !== undefined) trackWorkoutUpdateData.notes = data.notes
    if (data.sponsorId !== undefined)
      trackWorkoutUpdateData.sponsorId = data.sponsorId

    await db
      .update(trackWorkoutsTable)
      .set(trackWorkoutUpdateData)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    // 4. Update division descriptions
    if (data.divisionDescriptions && data.divisionDescriptions.length > 0) {
      const toDelete: string[] = []
      const toUpsert: Array<{ divisionId: string; description: string }> = []

      for (const { divisionId, description } of data.divisionDescriptions) {
        if (description === null) {
          toDelete.push(divisionId)
        } else {
          toUpsert.push({ divisionId, description })
        }
      }

      if (toDelete.length > 0) {
        await db
          .delete(workoutScalingDescriptionsTable)
          .where(
            and(
              eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
              inArray(
                workoutScalingDescriptionsTable.scalingLevelId,
                toDelete,
              ),
            ),
          )
      }

      for (const { divisionId, description } of toUpsert) {
        const existing = await db
          .select({ id: workoutScalingDescriptionsTable.id })
          .from(workoutScalingDescriptionsTable)
          .where(
            and(
              eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
              eq(workoutScalingDescriptionsTable.scalingLevelId, divisionId),
            ),
          )
          .limit(1)

        if (existing.length > 0) {
          await db
            .update(workoutScalingDescriptionsTable)
            .set({ description, updatedAt: new Date() })
            .where(eq(workoutScalingDescriptionsTable.id, existing[0]!.id))
        } else {
          await db.insert(workoutScalingDescriptionsTable).values({
            id: createWorkoutScalingDescriptionId(),
            workoutId: data.workoutId,
            scalingLevelId: divisionId,
            description,
          })
        }
      }
    }

    return { success: true }
  })

/**
 * Reorder competition events (cohost)
 */
export const cohostReorderEventsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostReorderEventsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const track = await getCompetitionTrack(data.competitionId)
    if (!track) {
      throw new Error("Competition track not found")
    }

    const existingWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        parentEventId: trackWorkoutsTable.parentEventId,
        trackOrder: trackWorkoutsTable.trackOrder,
      })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.trackId, track.id))

    const existingIds = new Set(existingWorkouts.map((w) => w.id))
    for (const update of data.updates) {
      if (!existingIds.has(update.trackWorkoutId)) {
        throw new Error(
          `Track workout ${update.trackWorkoutId} does not belong to this competition`,
        )
      }
    }

    const updatedIds = new Set(data.updates.map((u) => u.trackWorkoutId))

    let updateCount = 0
    for (const update of data.updates) {
      await db
        .update(trackWorkoutsTable)
        .set({ trackOrder: update.trackOrder, updatedAt: new Date() })
        .where(eq(trackWorkoutsTable.id, update.trackWorkoutId))
      updateCount++
    }

    // Auto-move children when a parent is reordered
    for (const update of data.updates) {
      const children = existingWorkouts.filter(
        (w) =>
          w.parentEventId === update.trackWorkoutId && !updatedIds.has(w.id),
      )
      if (children.length === 0) continue

      const sortedChildren = children.sort(
        (a, b) => Number(a.trackOrder) - Number(b.trackOrder),
      )
      const newParentOrder = Math.floor(update.trackOrder)

      for (let i = 0; i < sortedChildren.length; i++) {
        const newOrder = Number((newParentOrder + 0.01 * (i + 1)).toFixed(2))
        await db
          .update(trackWorkoutsTable)
          .set({ trackOrder: newOrder, updatedAt: new Date() })
          .where(eq(trackWorkoutsTable.id, sortedChildren[i].id))
        updateCount++
      }
    }

    return { updateCount }
  })

/**
 * Create a new workout and add it to a competition (cohost)
 */
export const cohostCreateWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostCreateWorkoutInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    // Get or create the competition track
    let track = await getCompetitionTrack(data.competitionId)
    if (!track) {
      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, data.competitionId),
      })
      if (!competition) throw new Error("Competition not found")

      const createdTrackId = createProgrammingTrackId()
      await db.insert(programmingTracksTable).values({
        id: createdTrackId,
        name: `${competition.name} - Events`,
        description: `Competition events for ${competition.name}`,
        type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
        ownerTeamId: competition.organizingTeamId,
        competitionId: competition.id,
        isPublic: 0,
      })

      const createdTrack = await db.query.programmingTracksTable.findFirst({
        where: eq(programmingTracksTable.id, createdTrackId),
      })
      if (!createdTrack) {
        throw new Error("Failed to create programming track for competition")
      }
      track = createdTrack
    }

    // Validate parentEventId if provided
    if (data.parentEventId) {
      const parentEvent = await db
        .select({
          id: trackWorkoutsTable.id,
          parentEventId: trackWorkoutsTable.parentEventId,
        })
        .from(trackWorkoutsTable)
        .where(
          and(
            eq(trackWorkoutsTable.id, data.parentEventId),
            eq(trackWorkoutsTable.trackId, track.id),
          ),
        )
        .limit(1)

      if (parentEvent.length === 0) {
        throw new Error("Parent event not found in this competition")
      }
      if (parentEvent[0].parentEventId) {
        throw new Error("Cannot nest sub-events more than one level deep")
      }
    }

    const nextOrder = data.parentEventId
      ? await getNextSubEventOrder(data.parentEventId)
      : await getNextCompetitionEventOrder(data.competitionId)

    // Get organizing team ID for the workout scope
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { organizingTeamId: true },
    })
    if (!competition) throw new Error("Competition not found")

    const workoutId = `workout_${createId()}`
    await db.insert(workouts).values({
      id: workoutId,
      name: data.name,
      scheme: data.scheme as (typeof workouts.$inferInsert)["scheme"],
      scoreType: data.scoreType as (typeof workouts.$inferInsert)["scoreType"],
      description: data.description ?? "",
      teamId: competition.organizingTeamId,
      scope: "private",
      roundsToScore: data.roundsToScore ?? null,
      repsPerRound: data.repsPerRound ?? null,
      tiebreakScheme: data.tiebreakScheme ?? null,
      sourceWorkoutId: data.sourceWorkoutId ?? null,
    })

    // Handle tags
    const finalTagIds: string[] = []
    if (data.tagNames && data.tagNames.length > 0) {
      for (const tagName of data.tagNames) {
        const tag = await findOrCreateTag(tagName)
        if (tag) finalTagIds.push(tag.id)
      }
    }
    if (data.tagIds && data.tagIds.length > 0) {
      const existingIds = data.tagIds.filter((id) => !id.startsWith("new_tag_"))
      finalTagIds.push(...existingIds)
    }
    if (finalTagIds.length > 0) {
      await db.insert(workoutTags).values(
        finalTagIds.map((tagId) => ({
          id: `workout_tag_${createId()}`,
          workoutId,
          tagId,
        })),
      )
    }

    // Insert movements
    if (data.movementIds && data.movementIds.length > 0) {
      await db.insert(workoutMovements).values(
        data.movementIds.map((movementId) => ({
          id: `workout_movement_${createId()}`,
          workoutId,
          movementId,
        })),
      )
    }

    // Add to competition track
    const trackWorkoutId = createTrackWorkoutId()
    await db.insert(trackWorkoutsTable).values({
      id: trackWorkoutId,
      trackId: track.id,
      workoutId,
      trackOrder: nextOrder,
      pointsMultiplier: 100,
      parentEventId: data.parentEventId ?? null,
    })

    return { workoutId, trackWorkoutId }
  })

/**
 * Remove a workout from a competition (cohost)
 */
export const cohostRemoveWorkoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostRemoveWorkoutInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    await db.transaction(async (tx) => {
      // Check for child sub-events and cascade delete
      const children = await tx
        .select({ id: trackWorkoutsTable.id })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.parentEventId, data.trackWorkoutId))

      if (children.length > 0) {
        const childIds = children.map((c) => c.id)
        await tx
          .delete(trackWorkoutsTable)
          .where(inArray(trackWorkoutsTable.id, childIds))
      }

      // Check if this is a sub-event for sibling reorder
      const event = await tx
        .select({ parentEventId: trackWorkoutsTable.parentEventId })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      const parentId = event[0]?.parentEventId

      await tx
        .delete(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

      // Reorder remaining siblings
      if (parentId) {
        const remainingSiblings = await tx
          .select({
            id: trackWorkoutsTable.id,
            trackOrder: trackWorkoutsTable.trackOrder,
          })
          .from(trackWorkoutsTable)
          .where(eq(trackWorkoutsTable.parentEventId, parentId))
          .orderBy(asc(trackWorkoutsTable.trackOrder))

        const parentRow = await tx
          .select({ trackOrder: trackWorkoutsTable.trackOrder })
          .from(trackWorkoutsTable)
          .where(eq(trackWorkoutsTable.id, parentId))
          .limit(1)

        if (parentRow.length > 0) {
          const parentOrder = Math.floor(Number(parentRow[0].trackOrder))
          for (let i = 0; i < remainingSiblings.length; i++) {
            const newOrder = Number(
              (parentOrder + 0.01 * (i + 1)).toFixed(2),
            )
            await tx
              .update(trackWorkoutsTable)
              .set({ trackOrder: newOrder, updatedAt: new Date() })
              .where(eq(trackWorkoutsTable.id, remainingSiblings[i].id))
          }
        }
      }
    })

    return { success: true }
  })
