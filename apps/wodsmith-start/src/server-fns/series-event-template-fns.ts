/**
 * Series Event Template Server Functions
 *
 * CRUD for series-level event templates stored on a dedicated programming track.
 * Template events are regular track_workouts on a "series-template" track,
 * referenced by templateTrackId in the series settings JSON.
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  createEventJudgingSheetId,
  createEventResourceId,
  createProgrammingTrackId,
  createTrackWorkoutId,
  createWorkoutScalingDescriptionId,
} from "@/db/schemas/common"
import {
  competitionGroupsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { eventJudgingSheetsTable } from "@/db/schemas/judging-sheets"
import { eventResourcesTable } from "@/db/schemas/event-resources"
import {
  PROGRAMMING_TRACK_TYPE,
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import {
  workoutScalingDescriptionsTable,
} from "@/db/schemas/scaling"
import {
  seriesDivisionMappingsTable,
  seriesEventMappingsTable,
} from "@/db/schemas/series"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
  SCORE_TYPE_VALUES,
  WORKOUT_SCHEME_VALUES,
  workouts,
} from "@/db/schemas/workouts"
import {
  parseSeriesSettings,
  stringifySeriesSettings,
} from "@/types/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface SeriesTemplateEvent {
  id: string
  trackId: string
  workoutId: string
  trackOrder: number
  parentEventId: string | null
  notes: string | null
  pointsMultiplier: number | null
  createdAt: Date
  updatedAt: Date
  workout: {
    id: string
    name: string
    description: string | null
    scheme: string | null
    scoreType: string | null
    timeCap: number | null
  }
  /** Convenience: trackOrder (for display as event number) */
  order: number
  /** Convenience: workout.name */
  name: string
  /** Convenience: workout.scoreType */
  scoreType: string | null
}

// ============================================================================
// Helpers
// ============================================================================

/** Enrich a raw track_workout + workout join result with convenience fields */
function toSeriesTemplateEvent(raw: {
  id: string
  trackId: string
  workoutId: string
  trackOrder: number
  parentEventId: string | null
  notes: string | null
  pointsMultiplier: number | null
  createdAt: Date
  updatedAt: Date
  workout: {
    id: string
    name: string
    description: string | null
    scheme: string | null
    scoreType: string | null
    timeCap: number | null
  }
}): SeriesTemplateEvent {
  return {
    ...raw,
    order: Number(raw.trackOrder),
    name: raw.workout.name,
    scoreType: raw.workout.scoreType,
  }
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the series template track and its events (track_workouts with workouts).
 */
export const getSeriesTemplateEventsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      templateTrack: { id: string; name: string } | null
      events: SeriesTemplateEvent[]
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      // Load group
      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) throw new Error("Series group not found")

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateTrackId = seriesSettings?.templateTrackId

      if (!templateTrackId) {
        return { templateTrack: null, events: [] }
      }

      // Load template track
      const [track] = await db
        .select({
          id: programmingTracksTable.id,
          name: programmingTracksTable.name,
        })
        .from(programmingTracksTable)
        .where(eq(programmingTracksTable.id, templateTrackId))

      if (!track) {
        return { templateTrack: null, events: [] }
      }

      // Load all track_workouts with their workouts, ordered by trackOrder
      const trackWorkouts = await db
        .select({
          id: trackWorkoutsTable.id,
          trackId: trackWorkoutsTable.trackId,
          workoutId: trackWorkoutsTable.workoutId,
          trackOrder: trackWorkoutsTable.trackOrder,
          parentEventId: trackWorkoutsTable.parentEventId,
          notes: trackWorkoutsTable.notes,
          pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
          createdAt: trackWorkoutsTable.createdAt,
          updatedAt: trackWorkoutsTable.updatedAt,
          workout: {
            id: workouts.id,
            name: workouts.name,
            description: workouts.description,
            scheme: workouts.scheme,
            scoreType: workouts.scoreType,
            timeCap: workouts.timeCap,
          },
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.trackId, templateTrackId))
        .orderBy(asc(trackWorkoutsTable.trackOrder))

      return {
        templateTrack: track,
        events: trackWorkouts.map(toSeriesTemplateEvent),
      }
    },
  )

/**
 * Get a single series template event by its trackWorkoutId.
 */
export const getSeriesTemplateEventByIdFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        trackWorkoutId: z.string().min(1),
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ event: SeriesTemplateEvent | null }> => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    // Load group to verify auth
    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.ACCESS_DASHBOARD,
    )

    // Load track workout with workout details
    const [trackWorkout] = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        createdAt: trackWorkoutsTable.createdAt,
        updatedAt: trackWorkoutsTable.updatedAt,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    if (!trackWorkout) return { event: null }

    return { event: toSeriesTemplateEvent(trackWorkout) }
  })

/**
 * Create the series template programming track.
 * Stores the trackId in the competition_groups.settings JSON.
 */
export const createSeriesTemplateTrackFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ trackId: string }> => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    // Load group
    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const seriesSettings = parseSeriesSettings(group.settings)

    // If template track already exists, return it
    if (seriesSettings?.templateTrackId) {
      return { trackId: seriesSettings.templateTrackId }
    }

    const trackId = createProgrammingTrackId()

    await db.transaction(async (tx) => {
      // Create the programming track
      await tx.insert(programmingTracksTable).values({
        id: trackId,
        name: "Series Template",
        type: "series-template",
        ownerTeamId: group.organizingTeamId,
        competitionId: null,
        isPublic: 0,
      })

      // Update settings with templateTrackId
      const newSettings = stringifySeriesSettings({
        ...seriesSettings,
        templateTrackId: trackId,
      })
      await tx
        .update(competitionGroupsTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(competitionGroupsTable.id, data.groupId))
    })

    return { trackId }
  })

/**
 * Get competitions in a series group with their event counts.
 * Lightweight query for populating "copy from competition" UI.
 */
export const getSeriesCompetitionsForTemplateFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      competitions: Array<{ id: string; name: string; eventCount: number }>
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      // Load group to verify auth
      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) throw new Error("Series group not found")

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )

      const comps = await db
        .select({
          id: competitionsTable.id,
          name: competitionsTable.name,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.groupId, data.groupId))

      // For each competition, count events
      const result: Array<{ id: string; name: string; eventCount: number }> = []
      for (const comp of comps) {
        const [track] = await db
          .select({ id: programmingTracksTable.id })
          .from(programmingTracksTable)
          .where(eq(programmingTracksTable.competitionId, comp.id))

        let eventCount = 0
        if (track) {
          const events = await db
            .select({ id: trackWorkoutsTable.id })
            .from(trackWorkoutsTable)
            .where(eq(trackWorkoutsTable.trackId, track.id))
          eventCount = events.length
        }
        result.push({ id: comp.id, name: comp.name, eventCount })
      }
      return { competitions: result }
    },
  )

/**
 * Copy events from a competition into the series template track.
 * Creates new workout + track_workout rows on the template track
 * for each event in the source competition.
 */
export const copyEventsFromCompetitionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        sourceCompetitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ copiedCount: number }> => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const seriesSettings = parseSeriesSettings(group.settings)
    const templateTrackId = seriesSettings?.templateTrackId
    if (!templateTrackId) {
      throw new Error("No template track — create one first")
    }

    // Validate source competition belongs to this series group
    const [sourceComp] = await db
      .select({ id: competitionsTable.id, groupId: competitionsTable.groupId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.sourceCompetitionId))

    if (!sourceComp) throw new Error("Source competition not found")
    if (sourceComp.groupId !== data.groupId) {
      throw new Error("Source competition does not belong to this series")
    }

    // Load source competition's track
    const [sourceTrack] = await db
      .select({ id: programmingTracksTable.id })
      .from(programmingTracksTable)
      .where(eq(programmingTracksTable.competitionId, data.sourceCompetitionId))

    if (!sourceTrack) throw new Error("Source competition has no programming track")

    // Load source events with workouts
    const sourceEvents = await db
      .select({
        id: trackWorkoutsTable.id,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        notes: trackWorkoutsTable.notes,
        workoutId: trackWorkoutsTable.workoutId,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
        workoutScoreType: workouts.scoreType,
        workoutTimeCap: workouts.timeCap,
        workoutRepsPerRound: workouts.repsPerRound,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.trackId, sourceTrack.id))
      .orderBy(asc(trackWorkoutsTable.trackOrder))

    if (sourceEvents.length === 0) return { copiedCount: 0 }

    // Map old parent IDs to new parent IDs for sub-event linking
    const parentIdMap = new Map<string, string>()
    let copiedCount = 0

    // Copy parents first, then children
    const parents = sourceEvents.filter((e) => !e.parentEventId)
    const children = sourceEvents.filter((e) => e.parentEventId)

    await db.transaction(async (tx) => {
      for (const event of [...parents, ...children]) {
        const newWorkoutId = `workout_${createId()}`
        const newTrackWorkoutId = createTrackWorkoutId()

        await tx.insert(workouts).values({
          id: newWorkoutId,
          name: event.workoutName,
          description: event.workoutDescription,
          scheme: event.workoutScheme,
          scoreType: event.workoutScoreType,
          timeCap: event.workoutTimeCap,
          repsPerRound: event.workoutRepsPerRound,
          teamId: group.organizingTeamId,
          scope: "private",
        })

        const newParentId = event.parentEventId
          ? parentIdMap.get(event.parentEventId) ?? null
          : null

        await tx.insert(trackWorkoutsTable).values({
          id: newTrackWorkoutId,
          trackId: templateTrackId,
          workoutId: newWorkoutId,
          parentEventId: newParentId,
          trackOrder: event.trackOrder,
          pointsMultiplier: event.pointsMultiplier,
          notes: event.notes,
        })

        // Track parent mapping for children
        if (!event.parentEventId) {
          parentIdMap.set(event.id, newTrackWorkoutId)
        }

        copiedCount++
      }
    })

    return { copiedCount }
  })

/**
 * Add a new event to the series template track.
 * Creates a workout row and a track_workout row on the template track.
 */
export const addEventToSeriesTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        trackId: z.string().min(1),
        workout: z.object({
          name: z.string().min(1).max(200),
          description: z.string().max(5000).optional(),
          scheme: z.enum(WORKOUT_SCHEME_VALUES).optional(),
          scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
          scoreSortOrder: z.string().optional(),
        }),
        parentEventId: z.string().min(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    // Load group to verify auth
    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Validate parentEventId if provided
    if (data.parentEventId) {
      const [parentEvent] = await db
        .select({
          id: trackWorkoutsTable.id,
          parentEventId: trackWorkoutsTable.parentEventId,
        })
        .from(trackWorkoutsTable)
        .where(
          and(
            eq(trackWorkoutsTable.id, data.parentEventId),
            eq(trackWorkoutsTable.trackId, data.trackId),
          ),
        )
        .limit(1)

      if (!parentEvent) {
        throw new Error("Parent event not found on this track")
      }
      if (parentEvent.parentEventId) {
        throw new Error("Cannot nest sub-events more than one level deep")
      }
    }

    // Calculate trackOrder
    let trackOrder: number

    if (data.parentEventId) {
      // Sub-event: get parent order, then find max child order
      const [parent] = await db
        .select({ trackOrder: trackWorkoutsTable.trackOrder })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.id, data.parentEventId))
        .limit(1)

      if (!parent) throw new Error("Parent event not found")
      const parentOrder = Math.floor(Number(parent.trackOrder))

      const siblings = await db
        .select({ trackOrder: trackWorkoutsTable.trackOrder })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.parentEventId, data.parentEventId))

      if (siblings.length === 0) {
        trackOrder = parentOrder + 0.01
      } else {
        const maxChildOrder = Math.max(
          ...siblings.map((s) => Number(s.trackOrder)),
        )
        trackOrder = Number((maxChildOrder + 0.01).toFixed(2))
      }
    } else {
      // Top-level event: get max trackOrder on the track, add 1
      const existingEvents = await db
        .select({ trackOrder: trackWorkoutsTable.trackOrder })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.trackId, data.trackId))

      if (existingEvents.length === 0) {
        trackOrder = 1
      } else {
        const maxOrder = Math.max(
          ...existingEvents.map((e) => Number(e.trackOrder)),
        )
        trackOrder = Math.floor(maxOrder) + 1
      }
    }

    // Create the workout
    const workoutId = `workout_${createId()}`
    const trackWorkoutId = createTrackWorkoutId()

    await db.transaction(async (tx) => {
      await tx.insert(workouts).values({
        id: workoutId,
        name: data.workout.name,
        description: data.workout.description ?? "",
        scheme: (data.workout.scheme ?? "time") as (typeof workouts.$inferInsert)["scheme"],
        scoreType: (data.workout.scoreType ?? null) as (typeof workouts.$inferInsert)["scoreType"],
        teamId: group.organizingTeamId,
        scope: "private",
      })

      await tx.insert(trackWorkoutsTable).values({
        id: trackWorkoutId,
        trackId: data.trackId,
        workoutId,
        trackOrder,
        pointsMultiplier: 100,
        parentEventId: data.parentEventId ?? null,
      })
    })

    // Return the created event with workout details
    const [created] = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        createdAt: trackWorkoutsTable.createdAt,
        updatedAt: trackWorkoutsTable.updatedAt,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, trackWorkoutId))

    return { event: toSeriesTemplateEvent(created) }
  })

/**
 * Update a series template event (workout fields and/or track_workout fields).
 */
export const updateSeriesTemplateEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        trackWorkoutId: z.string().min(1),
        groupId: z.string().min(1),
        workout: z
          .object({
            name: z.string().min(1).max(200).optional(),
            description: z.string().max(5000).optional(),
            scheme: z.enum(WORKOUT_SCHEME_VALUES).optional(),
            scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
            scoreSortOrder: z.string().optional(),
            timeCap: z.number().int().min(1).nullable().optional(),
            reps: z.number().int().min(1).nullable().optional(),
          })
          .optional(),
        pointsMultiplier: z.number().int().min(1).optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    // Load group to verify auth
    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Load the track workout to get workoutId
    const [trackWorkout] = await db
      .select({
        id: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
      })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    if (!trackWorkout) throw new Error("Template event not found")

    // Update workout fields if provided
    if (data.workout) {
      const workoutUpdate: Record<string, unknown> = {
        updatedAt: new Date(),
      }
      if (data.workout.name !== undefined)
        workoutUpdate.name = data.workout.name
      if (data.workout.description !== undefined)
        workoutUpdate.description = data.workout.description
      if (data.workout.scheme !== undefined)
        workoutUpdate.scheme = data.workout.scheme
      if (data.workout.scoreType !== undefined)
        workoutUpdate.scoreType = data.workout.scoreType
      if (data.workout.timeCap !== undefined)
        workoutUpdate.timeCap = data.workout.timeCap
      if (data.workout.reps !== undefined)
        workoutUpdate.repsPerRound = data.workout.reps

      await db
        .update(workouts)
        .set(workoutUpdate)
        .where(eq(workouts.id, trackWorkout.workoutId))
    }

    // Update track_workout fields if provided
    const trackWorkoutUpdate: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    if (data.pointsMultiplier !== undefined)
      trackWorkoutUpdate.pointsMultiplier = data.pointsMultiplier
    if (data.notes !== undefined) trackWorkoutUpdate.notes = data.notes

    await db
      .update(trackWorkoutsTable)
      .set(trackWorkoutUpdate)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    // Return updated event
    const [updated] = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        createdAt: trackWorkoutsTable.createdAt,
        updatedAt: trackWorkoutsTable.updatedAt,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    return { event: toSeriesTemplateEvent(updated) }
  })

/**
 * Delete a series template event.
 * Cleans up series_event_mappings, child track_workouts (if parent), and the workout.
 */
export const deleteSeriesTemplateEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        trackWorkoutId: z.string().min(1),
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    // Load group to verify auth
    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Load the track workout
    const [trackWorkout] = await db
      .select({
        id: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
        parentEventId: trackWorkoutsTable.parentEventId,
        trackId: trackWorkoutsTable.trackId,
      })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    if (!trackWorkout) throw new Error("Template event not found")

    await db.transaction(async (tx) => {
      // Delete series_event_mappings referencing this template event
      await tx
        .delete(seriesEventMappingsTable)
        .where(
          and(
            eq(seriesEventMappingsTable.groupId, data.groupId),
            eq(seriesEventMappingsTable.templateEventId, data.trackWorkoutId),
          ),
        )

      // If this is a parent event, also delete children and their mappings
      const children = await tx
        .select({
          id: trackWorkoutsTable.id,
          workoutId: trackWorkoutsTable.workoutId,
        })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.parentEventId, data.trackWorkoutId))

      if (children.length > 0) {
        const childIds = children.map((c) => c.id)
        const childWorkoutIds = children.map((c) => c.workoutId)

        // Delete child mappings
        await tx
          .delete(seriesEventMappingsTable)
          .where(
            and(
              eq(seriesEventMappingsTable.groupId, data.groupId),
              inArray(seriesEventMappingsTable.templateEventId, childIds),
            ),
          )

        // Delete child track_workouts
        await tx
          .delete(trackWorkoutsTable)
          .where(inArray(trackWorkoutsTable.id, childIds))

        // Delete child workouts
        await tx
          .delete(workouts)
          .where(inArray(workouts.id, childWorkoutIds))
      }

      // Delete the track_workout
      await tx
        .delete(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

      // Delete the workout
      await tx
        .delete(workouts)
        .where(eq(workouts.id, trackWorkout.workoutId))

      // Reorder remaining siblings if this was a sub-event
      if (trackWorkout.parentEventId) {
        const remainingSiblings = await tx
          .select({
            id: trackWorkoutsTable.id,
            trackOrder: trackWorkoutsTable.trackOrder,
          })
          .from(trackWorkoutsTable)
          .where(
            eq(trackWorkoutsTable.parentEventId, trackWorkout.parentEventId),
          )
          .orderBy(asc(trackWorkoutsTable.trackOrder))

        const [parentRow] = await tx
          .select({ trackOrder: trackWorkoutsTable.trackOrder })
          .from(trackWorkoutsTable)
          .where(eq(trackWorkoutsTable.id, trackWorkout.parentEventId))
          .limit(1)

        if (parentRow) {
          const parentOrder = Math.floor(Number(parentRow.trackOrder))
          for (let i = 0; i < remainingSiblings.length; i++) {
            const newOrder = Number((parentOrder + 0.01 * (i + 1)).toFixed(2))
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

/**
 * Reorder series template events.
 * Handles parent-child ordering: parents get integer orders, children get decimal sub-orders.
 */
export const reorderSeriesTemplateEventsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        trackId: z.string().min(1),
        groupId: z.string().min(1),
        orderedEventIds: z.array(z.string().min(1)).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    // Load group to verify auth
    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Validate all IDs belong to this track
    const existingEvents = await db
      .select({
        id: trackWorkoutsTable.id,
        parentEventId: trackWorkoutsTable.parentEventId,
      })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.trackId, data.trackId))

    const existingIds = new Set(existingEvents.map((e) => e.id))
    for (const id of data.orderedEventIds) {
      if (!existingIds.has(id)) {
        throw new Error(`Event ${id} does not belong to this track`)
      }
    }

    // Build parent lookup
    const parentLookup = new Map(
      existingEvents.map((e) => [e.id, e.parentEventId]),
    )

    // Assign orders: top-level events get integer positions,
    // children are moved with their parent and get decimal sub-positions
    await db.transaction(async (tx) => {
      let currentOrder = 1
      const updatedIds = new Set<string>()

      for (const eventId of data.orderedEventIds) {
        const parentId = parentLookup.get(eventId)

        if (parentId) {
          // This is a child event — skip it here; it will be handled under its parent
          continue
        }

        // Top-level event: assign integer order
        await tx
          .update(trackWorkoutsTable)
          .set({ trackOrder: currentOrder, updatedAt: new Date() })
          .where(eq(trackWorkoutsTable.id, eventId))
        updatedIds.add(eventId)

        // Find and reorder children of this parent (in orderedEventIds order)
        const childIds = data.orderedEventIds.filter(
          (id) => parentLookup.get(id) === eventId,
        )
        for (let i = 0; i < childIds.length; i++) {
          const childOrder = Number((currentOrder + 0.01 * (i + 1)).toFixed(2))
          await tx
            .update(trackWorkoutsTable)
            .set({ trackOrder: childOrder, updatedAt: new Date() })
            .where(eq(trackWorkoutsTable.id, childIds[i]))
          updatedIds.add(childIds[i])
        }

        currentOrder++
      }

      // Handle any children not explicitly in orderedEventIds (auto-move with parent)
      for (const event of existingEvents) {
        if (event.parentEventId && !updatedIds.has(event.id)) {
          // Find parent's new order
          const parentEvents = await tx
            .select({ trackOrder: trackWorkoutsTable.trackOrder })
            .from(trackWorkoutsTable)
            .where(eq(trackWorkoutsTable.id, event.parentEventId))
            .limit(1)

          if (parentEvents.length > 0) {
            const parentOrder = Math.floor(Number(parentEvents[0].trackOrder))
            // Get existing siblings that were already placed
            const siblings = await tx
              .select({
                id: trackWorkoutsTable.id,
                trackOrder: trackWorkoutsTable.trackOrder,
              })
              .from(trackWorkoutsTable)
              .where(eq(trackWorkoutsTable.parentEventId, event.parentEventId))
              .orderBy(asc(trackWorkoutsTable.trackOrder))

            const siblingIndex = siblings.findIndex((s) => s.id === event.id)
            const childOrder = Number(
              (parentOrder + 0.01 * (siblingIndex + 1)).toFixed(2),
            )
            await tx
              .update(trackWorkoutsTable)
              .set({ trackOrder: childOrder, updatedAt: new Date() })
              .where(eq(trackWorkoutsTable.id, event.id))
          }
        }
      }
    })

    return { success: true }
  })

// ============================================================================
// Event Mapping Types
// ============================================================================

export interface SeriesEventMappingData {
  competition: { id: string; name: string }
  events: Array<{
    id: string
    name: string
    scoreType: string | null
    parentEventId: string | null
    trackOrder: number
  }>
  mappings: Array<{
    competitionEventId: string
    competitionEventName: string
    templateEventId: string | null
    confidence: "exact" | "fuzzy" | "none"
    saved: boolean
  }>
}

// ============================================================================
// Event Mapping Auto-Map Algorithm
// ============================================================================

/**
 * Normalize an event/workout name for comparison.
 * Strips noise, normalizes abbreviations, lowercases.
 */
function normalizeEventName(name: string): string {
  let n = name.toLowerCase().trim()
  // Remove parenthesized suffixes
  n = n.replace(/\s*\([^)]*\)\s*/g, " ")
  // Normalize common prefixes: "event 1:", "event 1 -", "wod 1:", etc.
  n = n.replace(/^(event|wod|workout)\s*\d+\s*[:\-–—]\s*/i, "")
  // Strip common filler words
  n = n.replace(/\b(the|and|&|of)\b/g, "")
  // Collapse whitespace
  n = n.replace(/\s+/g, " ").trim()
  return n
}

/**
 * Create a sort-stable key from an event name for order-independent matching.
 */
function sortedEventKey(name: string): string {
  return normalizeEventName(name).split(" ").sort().join(" ")
}

/**
 * Auto-map competition events to series template events by workout name.
 * Two-pass: exact case-insensitive, then normalized token matching.
 */
function autoMapEvents(
  compEvents: Array<{ trackWorkoutId: string; workoutName: string }>,
  templateEvents: Array<{ trackWorkoutId: string; workoutName: string }>,
): Array<{
  competitionEventId: string
  competitionEventName: string
  templateEventId: string | null
  confidence: "exact" | "fuzzy" | "none"
  saved: boolean
}> {
  const templateKeys = templateEvents.map((te) => ({
    ...te,
    normalized: normalizeEventName(te.workoutName),
    sorted: sortedEventKey(te.workoutName),
  }))

  // Track which template events have been claimed to avoid duplicates
  const claimedTemplateIds = new Set<string>()

  return compEvents.map((compEvent) => {
    const compLower = compEvent.workoutName.toLowerCase().trim()

    // 1. Exact match (case-insensitive)
    const exactMatch = templateKeys.find(
      (te) =>
        te.workoutName.toLowerCase().trim() === compLower &&
        !claimedTemplateIds.has(te.trackWorkoutId),
    )
    if (exactMatch) {
      claimedTemplateIds.add(exactMatch.trackWorkoutId)
      return {
        competitionEventId: compEvent.trackWorkoutId,
        competitionEventName: compEvent.workoutName,
        templateEventId: exactMatch.trackWorkoutId,
        confidence: "exact" as const,
        saved: false,
      }
    }

    // 2. Normalized match
    const compNormalized = normalizeEventName(compEvent.workoutName)
    const normalizedMatch = templateKeys.find(
      (te) =>
        te.normalized === compNormalized &&
        !claimedTemplateIds.has(te.trackWorkoutId),
    )
    if (normalizedMatch) {
      claimedTemplateIds.add(normalizedMatch.trackWorkoutId)
      return {
        competitionEventId: compEvent.trackWorkoutId,
        competitionEventName: compEvent.workoutName,
        templateEventId: normalizedMatch.trackWorkoutId,
        confidence: "fuzzy" as const,
        saved: false,
      }
    }

    // 3. Sorted-token match
    const compSorted = sortedEventKey(compEvent.workoutName)
    const sortedMatch = templateKeys.find(
      (te) =>
        te.sorted === compSorted &&
        !claimedTemplateIds.has(te.trackWorkoutId),
    )
    if (sortedMatch) {
      claimedTemplateIds.add(sortedMatch.trackWorkoutId)
      return {
        competitionEventId: compEvent.trackWorkoutId,
        competitionEventName: compEvent.workoutName,
        templateEventId: sortedMatch.trackWorkoutId,
        confidence: "fuzzy" as const,
        saved: false,
      }
    }

    // 4. No match
    return {
      competitionEventId: compEvent.trackWorkoutId,
      competitionEventName: compEvent.workoutName,
      templateEventId: null,
      confidence: "none" as const,
      saved: false,
    }
  })
}

// ============================================================================
// Phase 2a: Mapping Functions
// ============================================================================

/**
 * Get the series event template and all competition event mappings.
 * Main data loader for the event mapping configuration page.
 */
export const getSeriesEventMappingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      template: {
        trackId: string
        trackName: string
        events: SeriesTemplateEvent[]
      } | null
      competitionMappings: SeriesEventMappingData[]
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      // Load group
      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) throw new Error("Series group not found")

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateTrackId = seriesSettings?.templateTrackId

      // Load template events if track exists
      let template: {
        trackId: string
        trackName: string
        events: SeriesTemplateEvent[]
      } | null = null

      if (templateTrackId) {
        const [track] = await db
          .select({
            id: programmingTracksTable.id,
            name: programmingTracksTable.name,
          })
          .from(programmingTracksTable)
          .where(eq(programmingTracksTable.id, templateTrackId))

        if (track) {
          const trackWorkouts = await db
            .select({
              id: trackWorkoutsTable.id,
              trackId: trackWorkoutsTable.trackId,
              workoutId: trackWorkoutsTable.workoutId,
              trackOrder: trackWorkoutsTable.trackOrder,
              parentEventId: trackWorkoutsTable.parentEventId,
              notes: trackWorkoutsTable.notes,
              pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
              createdAt: trackWorkoutsTable.createdAt,
              updatedAt: trackWorkoutsTable.updatedAt,
              workout: {
                id: workouts.id,
                name: workouts.name,
                description: workouts.description,
                scheme: workouts.scheme,
                scoreType: workouts.scoreType,
                timeCap: workouts.timeCap,
              },
            })
            .from(trackWorkoutsTable)
            .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
            .where(eq(trackWorkoutsTable.trackId, templateTrackId))
            .orderBy(asc(trackWorkoutsTable.trackOrder))

          template = {
            trackId: track.id,
            trackName: track.name,
            events: trackWorkouts.map(toSeriesTemplateEvent),
          }
        }
      }

      // Load all competitions in this series
      const comps = await db
        .select({
          id: competitionsTable.id,
          name: competitionsTable.name,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.groupId, data.groupId))

      // Load existing mappings
      const existingMappings =
        comps.length > 0
          ? await db
              .select()
              .from(seriesEventMappingsTable)
              .where(eq(seriesEventMappingsTable.groupId, data.groupId))
          : []

      // Build mapping data per competition
      const competitionMappings: SeriesEventMappingData[] = []

      for (const comp of comps) {
        // Load competition's programming track
        const [compTrack] = await db
          .select({ id: programmingTracksTable.id })
          .from(programmingTracksTable)
          .where(eq(programmingTracksTable.competitionId, comp.id))

        if (!compTrack) {
          competitionMappings.push({
            competition: { id: comp.id, name: comp.name },
            events: [],
            mappings: [],
          })
          continue
        }

        // Load competition's track_workouts with workout names and score types
        const compEvents = await db
          .select({
            id: trackWorkoutsTable.id,
            trackOrder: trackWorkoutsTable.trackOrder,
            parentEventId: trackWorkoutsTable.parentEventId,
            workoutName: workouts.name,
            scoreType: workouts.scoreType,
          })
          .from(trackWorkoutsTable)
          .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
          .where(eq(trackWorkoutsTable.trackId, compTrack.id))
          .orderBy(asc(trackWorkoutsTable.trackOrder))

        const events = compEvents.map((e) => ({
          id: e.id,
          name: e.workoutName,
          scoreType: e.scoreType,
          parentEventId: e.parentEventId,
          trackOrder: Number(e.trackOrder),
        }))

        // Check for existing mappings for this competition
        const compExistingMappings = existingMappings.filter(
          (m) => m.competitionId === comp.id,
        )

        if (compExistingMappings.length > 0) {
          // Use existing saved mappings
          const mappings = compEvents.map((e) => {
            const existing = compExistingMappings.find(
              (m) => m.competitionEventId === e.id,
            )
            return {
              competitionEventId: e.id,
              competitionEventName: e.workoutName,
              templateEventId: existing?.templateEventId ?? null,
              confidence: existing
                ? ("exact" as const)
                : ("none" as const),
              saved: !!existing,
            }
          })
          competitionMappings.push({
            competition: { id: comp.id, name: comp.name },
            events,
            mappings,
          })
        } else if (template) {
          // Auto-map using fuzzy matching
          const templateEventItems = template.events.map((te) => ({
            trackWorkoutId: te.id,
            workoutName: te.workout.name,
          }))
          const autoMapped = autoMapEvents(
            compEvents.map((e) => ({
              trackWorkoutId: e.id,
              workoutName: e.workoutName,
            })),
            templateEventItems,
          )
          competitionMappings.push({
            competition: { id: comp.id, name: comp.name },
            events,
            mappings: autoMapped,
          })
        } else {
          // No template, no mappings
          competitionMappings.push({
            competition: { id: comp.id, name: comp.name },
            events,
            mappings: compEvents.map((e) => ({
              competitionEventId: e.id,
              competitionEventName: e.workoutName,
              templateEventId: null,
              confidence: "none" as const,
              saved: false,
            })),
          })
        }
      }

      return { template, competitionMappings }
    },
  )

/**
 * Save all event mappings for a series.
 * Replaces all existing mappings with the provided ones.
 */
export const saveSeriesEventMappingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        mappings: z.array(
          z.object({
            competitionId: z.string().min(1),
            competitionEventId: z.string().min(1),
            templateEventId: z.string().min(1),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Delete all existing mappings and insert new ones atomically
    await db.transaction(async (tx) => {
      await tx
        .delete(seriesEventMappingsTable)
        .where(eq(seriesEventMappingsTable.groupId, data.groupId))

      if (data.mappings.length > 0) {
        await tx.insert(seriesEventMappingsTable).values(
          data.mappings.map((m) => ({
            groupId: data.groupId,
            competitionId: m.competitionId,
            competitionEventId: m.competitionEventId,
            templateEventId: m.templateEventId,
          })),
        )
      }
    })

    return { success: true, mappingCount: data.mappings.length }
  })

/**
 * Auto-map all competition events to the series template events.
 * Does not save — returns proposed mappings for the UI to display.
 */
export const autoMapSeriesEventsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      competitionMappings: SeriesEventMappingData[]
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) throw new Error("Series group not found")

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateTrackId = seriesSettings?.templateTrackId
      if (!templateTrackId) {
        return { competitionMappings: [] }
      }

      // Load series template events
      const templateTrackWorkouts = await db
        .select({
          id: trackWorkoutsTable.id,
          workoutName: workouts.name,
          parentEventId: trackWorkoutsTable.parentEventId,
          trackOrder: trackWorkoutsTable.trackOrder,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.trackId, templateTrackId))
        .orderBy(asc(trackWorkoutsTable.trackOrder))

      const templateEventItems = templateTrackWorkouts.map((te) => ({
        trackWorkoutId: te.id,
        workoutName: te.workoutName,
      }))

      // Load competitions
      const comps = await db
        .select({
          id: competitionsTable.id,
          name: competitionsTable.name,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.groupId, data.groupId))

      // Load existing saved mappings so we don't overwrite them
      const existingMappings = await db
        .select()
        .from(seriesEventMappingsTable)
        .where(eq(seriesEventMappingsTable.groupId, data.groupId))

      const competitionMappings: SeriesEventMappingData[] = []

      for (const comp of comps) {
        // Load competition's programming track
        const [compTrack] = await db
          .select({ id: programmingTracksTable.id })
          .from(programmingTracksTable)
          .where(eq(programmingTracksTable.competitionId, comp.id))

        if (!compTrack) {
          competitionMappings.push({
            competition: { id: comp.id, name: comp.name },
            events: [],
            mappings: [],
          })
          continue
        }

        const compEvents = await db
          .select({
            id: trackWorkoutsTable.id,
            trackOrder: trackWorkoutsTable.trackOrder,
            parentEventId: trackWorkoutsTable.parentEventId,
            workoutName: workouts.name,
            scoreType: workouts.scoreType,
          })
          .from(trackWorkoutsTable)
          .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
          .where(eq(trackWorkoutsTable.trackId, compTrack.id))
          .orderBy(asc(trackWorkoutsTable.trackOrder))

        const events = compEvents.map((e) => ({
          id: e.id,
          name: e.workoutName,
          scoreType: e.scoreType,
          parentEventId: e.parentEventId,
          trackOrder: Number(e.trackOrder),
        }))

        // Check for existing saved mappings for this competition
        const compExistingMappings = existingMappings.filter(
          (m) => m.competitionId === comp.id,
        )
        const existingLookup = new Map(
          compExistingMappings.map((m) => [
            m.competitionEventId,
            m.templateEventId,
          ]),
        )

        // Auto-map only unmapped events; preserve existing mappings
        const autoMapped = autoMapEvents(
          compEvents.map((e) => ({
            trackWorkoutId: e.id,
            workoutName: e.workoutName,
          })),
          templateEventItems,
        )
        const merged = autoMapped.map((m) => {
          const existingTemplateId = existingLookup.get(m.competitionEventId)
          if (existingTemplateId) {
            return {
              ...m,
              templateEventId: existingTemplateId,
              confidence: "exact" as const,
              saved: true,
            }
          }
          return m
        })

        competitionMappings.push({
          competition: { id: comp.id, name: comp.name },
          events,
          mappings: merged,
        })
      }

      return { competitionMappings }
    },
  )

// ============================================================================
// Phase 2b: Initial Sync Function
// ============================================================================

/**
 * Sync template events to mapped competitions.
 * For each mapped template event -> competition pair:
 * - If competition event exists (mapping exists): UPDATE workout and track_workout fields
 * - If no competition event for this template event: CLONE it (create new workout + track_workout)
 * Handles parent-child relationships: syncs parents first, then children.
 * Syncs per-division descriptions via series_division_mappings.
 */
export const syncTemplateEventsToCompetitionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        competitionIds: z.array(z.string().min(1)).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const seriesSettings = parseSeriesSettings(group.settings)
    const templateTrackId = seriesSettings?.templateTrackId
    if (!templateTrackId) {
      return { synced: 0 }
    }

    // Load all template track_workouts with their workouts
    const templateTrackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
          repsPerRound: workouts.repsPerRound,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.trackId, templateTrackId))
      .orderBy(asc(trackWorkoutsTable.trackOrder))

    if (templateTrackWorkouts.length === 0) {
      return { synced: 0 }
    }

    // Load existing event mappings for this group
    const existingMappings = await db
      .select()
      .from(seriesEventMappingsTable)
      .where(eq(seriesEventMappingsTable.groupId, data.groupId))

    // Load division mappings for per-division description sync
    const divisionMappings = await db
      .select()
      .from(seriesDivisionMappingsTable)
      .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

    // Load template per-division descriptions (workout_scaling_descriptions)
    const templateWorkoutIds = templateTrackWorkouts.map((tw) => tw.workout.id)
    const templateDescriptions =
      templateWorkoutIds.length > 0
        ? await db
            .select()
            .from(workoutScalingDescriptionsTable)
            .where(
              inArray(
                workoutScalingDescriptionsTable.workoutId,
                templateWorkoutIds,
              ),
            )
        : []

    // Build lookup: templateWorkoutId -> scalingLevelId -> description
    const templateDescMap = new Map<string, Map<string, string | null>>()
    for (const d of templateDescriptions) {
      if (!templateDescMap.has(d.workoutId)) {
        templateDescMap.set(d.workoutId, new Map())
      }
      templateDescMap.get(d.workoutId)!.set(d.scalingLevelId, d.description)
    }

    // Determine which competitions to sync
    let targetCompIds: string[]
    if (data.competitionIds && data.competitionIds.length > 0) {
      targetCompIds = data.competitionIds
    } else {
      // All competitions that have at least one mapping
      targetCompIds = [
        ...new Set(existingMappings.map((m) => m.competitionId)),
      ]
    }

    if (targetCompIds.length === 0) {
      return { synced: 0 }
    }

    // Load competitions
    const comps = await db
      .select({
        id: competitionsTable.id,
        organizingTeamId: competitionsTable.organizingTeamId,
        name: competitionsTable.name,
      })
      .from(competitionsTable)
      .where(
        and(
          inArray(competitionsTable.id, targetCompIds),
          eq(competitionsTable.organizingTeamId, group.organizingTeamId),
        ),
      )

    // Sort template events: parents first (parentEventId is null), then children
    const parentTemplates = templateTrackWorkouts.filter(
      (tw) => !tw.parentEventId,
    )
    const childTemplates = templateTrackWorkouts.filter(
      (tw) => !!tw.parentEventId,
    )

    let synced = 0

    for (const comp of comps) {
      // Get or create competition's programming track
      let [compTrack] = await db
        .select({ id: programmingTracksTable.id })
        .from(programmingTracksTable)
        .where(eq(programmingTracksTable.competitionId, comp.id))

      if (!compTrack) {
        const newTrackId = createProgrammingTrackId()
        await db.insert(programmingTracksTable).values({
          id: newTrackId,
          name: `${comp.name} - Events`,
          description: `Competition events for ${comp.name}`,
          type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
          ownerTeamId: comp.organizingTeamId,
          competitionId: comp.id,
          isPublic: 0,
        })
        compTrack = { id: newTrackId }
      }

      const compMappings = existingMappings.filter(
        (m) => m.competitionId === comp.id,
      )
      // Build lookup: templateEventId -> competitionEventId
      const templateToCompEvent = new Map(
        compMappings.map((m) => [m.templateEventId, m.competitionEventId]),
      )

      // Division mapping for this competition: seriesDivisionId -> competitionDivisionId
      const compDivMappings = divisionMappings.filter(
        (dm) => dm.competitionId === comp.id,
      )
      const seriesDivToCompDiv = new Map(
        compDivMappings.map((dm) => [
          dm.seriesDivisionId,
          dm.competitionDivisionId,
        ]),
      )

      // Track mapping from template parent trackWorkoutId -> competition parent trackWorkoutId
      // Needed for child events to reference the correct parent
      const templateParentToCompParent = new Map<string, string>()

      // Helper to sync per-division descriptions for a workout
      const syncDivisionDescriptions = async (
        templateWorkoutId: string,
        compWorkoutId: string,
      ) => {
        const templateDescs = templateDescMap.get(templateWorkoutId)
        if (!templateDescs || templateDescs.size === 0) return

        for (const [templateDivId, description] of templateDescs) {
          // Map template division -> competition division
          const compDivId = seriesDivToCompDiv.get(templateDivId)
          if (!compDivId) continue

          // Upsert the description on the competition workout
          const [existing] = await db
            .select({ id: workoutScalingDescriptionsTable.id })
            .from(workoutScalingDescriptionsTable)
            .where(
              and(
                eq(
                  workoutScalingDescriptionsTable.workoutId,
                  compWorkoutId,
                ),
                eq(
                  workoutScalingDescriptionsTable.scalingLevelId,
                  compDivId,
                ),
              ),
            )
            .limit(1)

          if (existing) {
            await db
              .update(workoutScalingDescriptionsTable)
              .set({ description, updatedAt: new Date() })
              .where(eq(workoutScalingDescriptionsTable.id, existing.id))
          } else if (description !== null) {
            await db.insert(workoutScalingDescriptionsTable).values({
              id: createWorkoutScalingDescriptionId(),
              workoutId: compWorkoutId,
              scalingLevelId: compDivId,
              description,
            })
          }
        }
      }

      // Helper to sync a single template event
      const syncEvent = async (
        templateTw: (typeof templateTrackWorkouts)[number],
        compParentEventId: string | null,
      ) => {
        const compEventId = templateToCompEvent.get(templateTw.id)

        if (compEventId) {
          // UPDATE existing competition event
          const [compTw] = await db
            .select({
              id: trackWorkoutsTable.id,
              workoutId: trackWorkoutsTable.workoutId,
            })
            .from(trackWorkoutsTable)
            .where(eq(trackWorkoutsTable.id, compEventId))

          if (compTw) {
            // Update workout fields
            await db
              .update(workouts)
              .set({
                name: templateTw.workout.name,
                description: templateTw.workout.description ?? "",
                scheme: templateTw.workout.scheme,
                scoreType: templateTw.workout.scoreType,
                timeCap: templateTw.workout.timeCap,
                repsPerRound: templateTw.workout.repsPerRound,
                updatedAt: new Date(),
              })
              .where(eq(workouts.id, compTw.workoutId))

            // Update track_workout fields
            const twUpdate: Record<string, unknown> = {
              updatedAt: new Date(),
            }
            if (templateTw.pointsMultiplier !== null) {
              twUpdate.pointsMultiplier = templateTw.pointsMultiplier
            }
            if (templateTw.notes !== undefined) {
              twUpdate.notes = templateTw.notes
            }
            if (compParentEventId !== undefined) {
              twUpdate.parentEventId = compParentEventId
            }
            await db
              .update(trackWorkoutsTable)
              .set(twUpdate)
              .where(eq(trackWorkoutsTable.id, compTw.id))

            // Sync per-division descriptions
            await syncDivisionDescriptions(
              templateTw.workout.id,
              compTw.workoutId,
            )

            // Track parent mapping for children
            templateParentToCompParent.set(templateTw.id, compTw.id)
            synced++
          }
        } else {
          // CLONE: create new workout + track_workout on competition track
          const newWorkoutId = `workout_${createId()}`
          const newTrackWorkoutId = createTrackWorkoutId()

          await db.insert(workouts).values({
            id: newWorkoutId,
            name: templateTw.workout.name,
            description: templateTw.workout.description ?? "",
            scheme: templateTw.workout.scheme,
            scoreType: templateTw.workout.scoreType,
            timeCap: templateTw.workout.timeCap,
            repsPerRound: templateTw.workout.repsPerRound,
            teamId: comp.organizingTeamId,
            scope: "private",
          })

          await db.insert(trackWorkoutsTable).values({
            id: newTrackWorkoutId,
            trackId: compTrack.id,
            workoutId: newWorkoutId,
            trackOrder: Number(templateTw.trackOrder),
            pointsMultiplier: templateTw.pointsMultiplier ?? 100,
            notes: templateTw.notes,
            parentEventId: compParentEventId,
          })

          // Create the event mapping
          await db.insert(seriesEventMappingsTable).values({
            groupId: data.groupId,
            competitionId: comp.id,
            competitionEventId: newTrackWorkoutId,
            templateEventId: templateTw.id,
          })

          // Sync per-division descriptions
          await syncDivisionDescriptions(templateTw.workout.id, newWorkoutId)

          // Track parent mapping for children
          templateParentToCompParent.set(templateTw.id, newTrackWorkoutId)
          synced++
        }
      }

      // Sync parents first
      for (const parentTw of parentTemplates) {
        await syncEvent(parentTw, null)
      }

      // Then sync children, using the parent mapping
      for (const childTw of childTemplates) {
        const compParentId = childTw.parentEventId
          ? templateParentToCompParent.get(childTw.parentEventId) ?? null
          : null
        await syncEvent(childTw, compParentId)
      }
    }

    return { synced }
  })

// ============================================================================
// Phase 4a/4b: Resource & Judging Sheet Sync
// ============================================================================

/**
 * Sync event resources from a template event to a competition event.
 * Additive only: clones resources that don't already exist (by title match).
 * Returns count of resources synced.
 */
async function syncEventResourcesForMapping(
  db: ReturnType<typeof getDb>,
  templateEventId: string,
  competitionEventId: string,
  _competitionId: string,
): Promise<number> {
  // Load template resources
  const templateResources = await db
    .select()
    .from(eventResourcesTable)
    .where(eq(eventResourcesTable.eventId, templateEventId))

  if (templateResources.length === 0) return 0

  // Load existing competition event resources
  const existingResources = await db
    .select({ title: eventResourcesTable.title })
    .from(eventResourcesTable)
    .where(eq(eventResourcesTable.eventId, competitionEventId))

  const existingTitles = new Set(
    existingResources.map((r) => r.title.toLowerCase().trim()),
  )

  let synced = 0

  for (const resource of templateResources) {
    // Skip if competition event already has a resource with the same title
    if (existingTitles.has(resource.title.toLowerCase().trim())) {
      continue
    }

    await db.insert(eventResourcesTable).values({
      id: createEventResourceId(),
      eventId: competitionEventId,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      sortOrder: resource.sortOrder,
    })

    synced++
  }

  return synced
}

/**
 * Sync judging sheets from a template event to a competition event.
 * Additive only: clones sheets that don't already exist (by title match).
 * R2 files are NOT copied — the new row references the same r2Key and url.
 * Returns count of sheets synced.
 */
async function syncJudgingSheetsForMapping(
  db: ReturnType<typeof getDb>,
  templateEventId: string,
  competitionEventId: string,
  competitionId: string,
  uploadedBy: string,
): Promise<number> {
  // Load template judging sheets
  const templateSheets = await db
    .select()
    .from(eventJudgingSheetsTable)
    .where(eq(eventJudgingSheetsTable.trackWorkoutId, templateEventId))

  if (templateSheets.length === 0) return 0

  // Load existing competition event judging sheets
  const existingSheets = await db
    .select({ title: eventJudgingSheetsTable.title })
    .from(eventJudgingSheetsTable)
    .where(eq(eventJudgingSheetsTable.trackWorkoutId, competitionEventId))

  const existingTitles = new Set(
    existingSheets.map((s) => s.title.toLowerCase().trim()),
  )

  let synced = 0

  for (const sheet of templateSheets) {
    // Skip if competition event already has a sheet with the same title
    if (existingTitles.has(sheet.title.toLowerCase().trim())) {
      continue
    }

    await db.insert(eventJudgingSheetsTable).values({
      id: createEventJudgingSheetId(),
      competitionId,
      trackWorkoutId: competitionEventId,
      title: sheet.title,
      r2Key: sheet.r2Key,
      url: sheet.url,
      originalFilename: sheet.originalFilename,
      fileSize: sheet.fileSize,
      mimeType: sheet.mimeType,
      uploadedBy,
      sortOrder: sheet.sortOrder,
    })

    synced++
  }

  return synced
}

/**
 * Sync resources and/or judging sheets from template events to all mapped competitions.
 * Uses existing series_event_mappings to determine which template event maps to which competition event.
 */
export const syncResourcesAndSheetsToCompetitionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        competitionIds: z.array(z.string().min(1)).optional(),
        syncResources: z.boolean(),
        syncJudgingSheets: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    if (!data.syncResources && !data.syncJudgingSheets) {
      return { resourcesSynced: 0, sheetsSynced: 0 }
    }

    // Load all event mappings for this group
    const allMappings = await db
      .select()
      .from(seriesEventMappingsTable)
      .where(eq(seriesEventMappingsTable.groupId, data.groupId))

    // Filter to target competitions if specified
    const mappings =
      data.competitionIds && data.competitionIds.length > 0
        ? allMappings.filter((m) =>
            data.competitionIds!.includes(m.competitionId),
          )
        : allMappings

    if (mappings.length === 0) {
      return { resourcesSynced: 0, sheetsSynced: 0 }
    }

    let resourcesSynced = 0
    let sheetsSynced = 0

    for (const mapping of mappings) {
      if (data.syncResources) {
        resourcesSynced += await syncEventResourcesForMapping(
          db,
          mapping.templateEventId,
          mapping.competitionEventId,
          mapping.competitionId,
        )
      }

      if (data.syncJudgingSheets) {
        sheetsSynced += await syncJudgingSheetsForMapping(
          db,
          mapping.templateEventId,
          mapping.competitionEventId,
          mapping.competitionId,
          session.userId,
        )
      }
    }

    return { resourcesSynced, sheetsSynced }
  })

// ============================================================================
// Competition Event Series Mapping Status
// ============================================================================

/**
 * Get the series event mapping status for a single competition.
 * Used on the per-competition events page to show which events
 * came from the series template.
 *
 * Lightweight: only returns mapping info, no full event data.
 */
export const getCompetitionEventSeriesMappingStatusFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      hasTemplate: boolean
      seriesName: string | null
      groupId: string | null
      mappings: Array<{
        competitionEventId: string
        templateEventName: string
      }>
    }> => {
      const db = getDb()

      // Find the competition's groupId
      const [comp] = await db
        .select({
          id: competitionsTable.id,
          groupId: competitionsTable.groupId,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!comp || !comp.groupId) {
        return { hasTemplate: false, seriesName: null, groupId: null, mappings: [] }
      }

      // Load the series group
      const [group] = await db
        .select({
          id: competitionGroupsTable.id,
          name: competitionGroupsTable.name,
          settings: competitionGroupsTable.settings,
        })
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, comp.groupId))

      if (!group) {
        return { hasTemplate: false, seriesName: null, groupId: null, mappings: [] }
      }

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateTrackId = seriesSettings?.templateTrackId

      if (!templateTrackId) {
        return {
          hasTemplate: false,
          seriesName: group.name,
          groupId: group.id,
          mappings: [],
        }
      }

      // Load event mappings for this competition
      const mappings = await db
        .select()
        .from(seriesEventMappingsTable)
        .where(
          and(
            eq(seriesEventMappingsTable.groupId, group.id),
            eq(seriesEventMappingsTable.competitionId, data.competitionId),
          ),
        )

      if (mappings.length === 0) {
        return {
          hasTemplate: true,
          seriesName: group.name,
          groupId: group.id,
          mappings: [],
        }
      }

      // Load template event names (track_workouts -> workouts)
      const templateEventIds = mappings.map((m) => m.templateEventId)
      const templateEvents = await db
        .select({
          trackWorkoutId: trackWorkoutsTable.id,
          workoutName: workouts.name,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(inArray(trackWorkoutsTable.id, templateEventIds))

      const templateNameMap = new Map(
        templateEvents.map((te) => [te.trackWorkoutId, te.workoutName]),
      )

      return {
        hasTemplate: true,
        seriesName: group.name,
        groupId: group.id,
        mappings: mappings.map((m) => ({
          competitionEventId: m.competitionEventId,
          templateEventName:
            templateNameMap.get(m.templateEventId) ?? "Unknown",
        })),
      }
    },
  )

// ============================================================================
// Phase 3a: Preview Sync (Dry-Run Diff)
// ============================================================================

export interface SyncEventsPreviewResult {
  competitions: Array<{
    competitionId: string
    competitionName: string
    events: Array<{
      eventName: string
      isNew: boolean
      changes: string[]
    }>
  }>
  totalEvents: number
}

/**
 * Preview what syncTemplateEventsToCompetitions would change WITHOUT making changes.
 * Returns a diff for each competition/event that would be created or updated.
 * Optionally scoped to specific competitions via competitionIds.
 */
export const previewSyncEventsToCompetitionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        competitionIds: z.array(z.string().min(1)).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SyncEventsPreviewResult> => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.ACCESS_DASHBOARD,
    )

    const seriesSettings = parseSeriesSettings(group.settings)
    const templateTrackId = seriesSettings?.templateTrackId
    if (!templateTrackId) {
      return { competitions: [], totalEvents: 0 }
    }

    // Load all template track_workouts with their workouts
    const templateTrackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        parentEventId: trackWorkoutsTable.parentEventId,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
          repsPerRound: workouts.repsPerRound,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.trackId, templateTrackId))
      .orderBy(asc(trackWorkoutsTable.trackOrder))

    if (templateTrackWorkouts.length === 0) {
      return { competitions: [], totalEvents: 0 }
    }

    // Load existing event mappings for this group
    const existingMappings = await db
      .select()
      .from(seriesEventMappingsTable)
      .where(eq(seriesEventMappingsTable.groupId, data.groupId))

    // Determine which competitions to preview
    let targetCompIds: string[]
    if (data.competitionIds && data.competitionIds.length > 0) {
      targetCompIds = data.competitionIds
    } else {
      targetCompIds = [
        ...new Set(existingMappings.map((m) => m.competitionId)),
      ]
    }

    if (targetCompIds.length === 0) {
      return { competitions: [], totalEvents: 0 }
    }

    // Load competition names
    const comps = await db
      .select({ id: competitionsTable.id, name: competitionsTable.name })
      .from(competitionsTable)
      .where(
        and(
          inArray(competitionsTable.id, targetCompIds),
          eq(competitionsTable.organizingTeamId, group.organizingTeamId),
        ),
      )
    const compNameMap = new Map(comps.map((c) => [c.id, c.name]))

    // Batch-load all competition programming tracks
    const compTracks =
      targetCompIds.length > 0
        ? await db
            .select({
              id: programmingTracksTable.id,
              competitionId: programmingTracksTable.competitionId,
            })
            .from(programmingTracksTable)
            .where(
              inArray(programmingTracksTable.competitionId, targetCompIds),
            )
        : []

    // Batch-load all competition track_workouts + workouts for those tracks
    const trackIds = compTracks.map((t) => t.id)
    const allCompTrackWorkouts =
      trackIds.length > 0
        ? await db
            .select({
              id: trackWorkoutsTable.id,
              trackId: trackWorkoutsTable.trackId,
              workoutId: trackWorkoutsTable.workoutId,
              notes: trackWorkoutsTable.notes,
              pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
              workout: {
                id: workouts.id,
                name: workouts.name,
                description: workouts.description,
                scheme: workouts.scheme,
                scoreType: workouts.scoreType,
                timeCap: workouts.timeCap,
                repsPerRound: workouts.repsPerRound,
              },
            })
            .from(trackWorkoutsTable)
            .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
            .where(inArray(trackWorkoutsTable.trackId, trackIds))
        : []

    // Index: trackWorkoutId -> track workout + workout data
    const compTwMap = new Map(allCompTrackWorkouts.map((tw) => [tw.id, tw]))

    // Group mappings by competition
    const mappingsByComp = new Map<string, typeof existingMappings>()
    for (const m of existingMappings) {
      if (!targetCompIds.includes(m.competitionId)) continue
      const arr = mappingsByComp.get(m.competitionId) ?? []
      arr.push(m)
      mappingsByComp.set(m.competitionId, arr)
    }

    const competitions: SyncEventsPreviewResult["competitions"] = []
    let totalEvents = 0

    for (const compId of targetCompIds) {
      const compMappings = mappingsByComp.get(compId) ?? []
      // Build lookup: templateEventId -> competitionEventId
      const templateToCompEvent = new Map(
        compMappings.map((m) => [m.templateEventId, m.competitionEventId]),
      )

      const events: SyncEventsPreviewResult["competitions"][number]["events"] =
        []

      for (const templateTw of templateTrackWorkouts) {
        const compEventId = templateToCompEvent.get(templateTw.id)

        if (compEventId) {
          // Existing mapping — compare fields
          const compTw = compTwMap.get(compEventId)
          if (!compTw) continue

          const changes: string[] = []

          // Workout field comparisons
          if (compTw.workout.name !== templateTw.workout.name) {
            changes.push(
              `name: "${compTw.workout.name}" \u2192 "${templateTw.workout.name}"`,
            )
          }
          if (
            (compTw.workout.description ?? "") !==
            (templateTw.workout.description ?? "")
          ) {
            changes.push("description updated")
          }
          if (compTw.workout.scheme !== templateTw.workout.scheme) {
            changes.push(
              `scheme: ${compTw.workout.scheme ?? "none"} \u2192 ${templateTw.workout.scheme ?? "none"}`,
            )
          }
          if (compTw.workout.scoreType !== templateTw.workout.scoreType) {
            changes.push(
              `scoreType: ${compTw.workout.scoreType ?? "none"} \u2192 ${templateTw.workout.scoreType ?? "none"}`,
            )
          }
          if (compTw.workout.timeCap !== templateTw.workout.timeCap) {
            const fromStr =
              compTw.workout.timeCap != null
                ? `${compTw.workout.timeCap}s`
                : "none"
            const toStr =
              templateTw.workout.timeCap != null
                ? `${templateTw.workout.timeCap}s`
                : "none"
            changes.push(`timeCap: ${fromStr} \u2192 ${toStr}`)
          }
          if (
            compTw.workout.repsPerRound !== templateTw.workout.repsPerRound
          ) {
            const fromStr =
              compTw.workout.repsPerRound != null
                ? String(compTw.workout.repsPerRound)
                : "none"
            const toStr =
              templateTw.workout.repsPerRound != null
                ? String(templateTw.workout.repsPerRound)
                : "none"
            changes.push(`reps: ${fromStr} \u2192 ${toStr}`)
          }

          // Track workout field comparisons
          if (
            templateTw.pointsMultiplier !== null &&
            compTw.pointsMultiplier !== templateTw.pointsMultiplier
          ) {
            changes.push(
              `pointsMultiplier: ${compTw.pointsMultiplier} \u2192 ${templateTw.pointsMultiplier}`,
            )
          }
          if (
            templateTw.notes !== undefined &&
            (compTw.notes ?? null) !== (templateTw.notes ?? null)
          ) {
            changes.push("notes updated")
          }

          if (changes.length > 0) {
            events.push({
              eventName: templateTw.workout.name,
              isNew: false,
              changes,
            })
            totalEvents++
          }
        } else {
          // No mapping — this template event would be cloned as new
          const changes: string[] = []
          changes.push(`scheme: ${templateTw.workout.scheme ?? "time"}`)
          if (templateTw.workout.scoreType) {
            changes.push(`scoreType: ${templateTw.workout.scoreType}`)
          }
          if (templateTw.workout.timeCap) {
            changes.push(`timeCap: ${templateTw.workout.timeCap}s`)
          }
          if (templateTw.pointsMultiplier !== null) {
            changes.push(
              `pointsMultiplier: ${templateTw.pointsMultiplier}`,
            )
          }

          events.push({
            eventName: templateTw.workout.name,
            isNew: true,
            changes:
              changes.length > 0 ? changes : ["new event (default values)"],
          })
          totalEvents++
        }
      }

      if (events.length > 0) {
        competitions.push({
          competitionId: compId,
          competitionName: compNameMap.get(compId) ?? "Unknown Competition",
          events,
        })
      }
    }

    return { competitions, totalEvents }
  })

// ============================================================================
// Phase 3b: Per-Competition Event Sync Status
// ============================================================================

export interface CompetitionEventSyncStatus {
  competitionId: string
  competitionName: string
  status: "in-sync" | "behind" | "custom" | "unmapped"
  mappedCount: number
  totalTemplateEvents: number
}

/**
 * Get per-competition sync status for events.
 * Used in the competition selection step before syncing.
 */
export const getCompetitionEventSyncStatusFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ competitions: CompetitionEventSyncStatus[] }> => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.ACCESS_DASHBOARD,
    )

    const seriesSettings = parseSeriesSettings(group.settings)
    const templateTrackId = seriesSettings?.templateTrackId

    // Load all competitions in this series
    const comps = await db
      .select({ id: competitionsTable.id, name: competitionsTable.name })
      .from(competitionsTable)
      .where(eq(competitionsTable.groupId, data.groupId))

    if (comps.length === 0) return { competitions: [] }

    // If no template track, all competitions are unmapped
    if (!templateTrackId) {
      return {
        competitions: comps.map((c) => ({
          competitionId: c.id,
          competitionName: c.name,
          status: "unmapped" as const,
          mappedCount: 0,
          totalTemplateEvents: 0,
        })),
      }
    }

    // Load template track_workouts with workouts
    const templateTrackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
          repsPerRound: workouts.repsPerRound,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.trackId, templateTrackId))
      .orderBy(asc(trackWorkoutsTable.trackOrder))

    const totalTemplateEvents = templateTrackWorkouts.length

    // Load all event mappings for this group
    const allMappings = await db
      .select()
      .from(seriesEventMappingsTable)
      .where(eq(seriesEventMappingsTable.groupId, data.groupId))

    // Batch-load all competition programming tracks
    const compIds = comps.map((c) => c.id)
    const compTracks = await db
      .select({
        id: programmingTracksTable.id,
        competitionId: programmingTracksTable.competitionId,
      })
      .from(programmingTracksTable)
      .where(inArray(programmingTracksTable.competitionId, compIds))
    const compTrackMap = new Map(
      compTracks.map((t) => [t.competitionId!, t.id]),
    )

    // Batch-load all competition track_workouts + workouts
    const trackIds = compTracks.map((t) => t.id)
    const allCompTrackWorkouts =
      trackIds.length > 0
        ? await db
            .select({
              id: trackWorkoutsTable.id,
              trackId: trackWorkoutsTable.trackId,
              notes: trackWorkoutsTable.notes,
              pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
              workout: {
                id: workouts.id,
                name: workouts.name,
                description: workouts.description,
                scheme: workouts.scheme,
                scoreType: workouts.scoreType,
                timeCap: workouts.timeCap,
                repsPerRound: workouts.repsPerRound,
              },
            })
            .from(trackWorkoutsTable)
            .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
            .where(inArray(trackWorkoutsTable.trackId, trackIds))
        : []

    // Index: trackWorkoutId -> data
    const compTwMap = new Map(allCompTrackWorkouts.map((tw) => [tw.id, tw]))

    // Index: trackId -> set of trackWorkoutIds (for custom event detection)
    const compTwIdsByTrack = new Map<string, Set<string>>()
    for (const tw of allCompTrackWorkouts) {
      const s = compTwIdsByTrack.get(tw.trackId) ?? new Set()
      s.add(tw.id)
      compTwIdsByTrack.set(tw.trackId, s)
    }

    // Group mappings by competition
    const mappingsByComp = new Map<
      string,
      typeof allMappings
    >()
    for (const m of allMappings) {
      const arr = mappingsByComp.get(m.competitionId) ?? []
      arr.push(m)
      mappingsByComp.set(m.competitionId, arr)
    }

    const results: CompetitionEventSyncStatus[] = []

    for (const comp of comps) {
      const compMappings = mappingsByComp.get(comp.id) ?? []

      if (compMappings.length === 0) {
        results.push({
          competitionId: comp.id,
          competitionName: comp.name,
          status: "unmapped",
          mappedCount: 0,
          totalTemplateEvents,
        })
        continue
      }

      const mappedCount = compMappings.length

      // Check for custom events (competition events not in any mapping)
      const compTrackId = compTrackMap.get(comp.id)
      const mappedCompEventIds = new Set(
        compMappings.map((m) => m.competitionEventId),
      )
      const allCompEventIds = compTrackId
        ? compTwIdsByTrack.get(compTrackId) ?? new Set()
        : new Set<string>()
      const hasCustomEvents = [...allCompEventIds].some(
        (id) => !mappedCompEventIds.has(id),
      )

      // Check if any mapped event is behind (different from template)
      let hasDifferences = false

      // Build lookup: templateEventId -> competitionEventId
      const templateToCompEvent = new Map(
        compMappings.map((m) => [m.templateEventId, m.competitionEventId]),
      )

      for (const templateTw of templateTrackWorkouts) {
        const compEventId = templateToCompEvent.get(templateTw.id)
        if (!compEventId) {
          // Template event not mapped to this competition — behind
          hasDifferences = true
          break
        }

        const compTw = compTwMap.get(compEventId)
        if (!compTw) {
          hasDifferences = true
          break
        }

        // Compare workout fields
        if (
          compTw.workout.name !== templateTw.workout.name ||
          (compTw.workout.description ?? "") !==
            (templateTw.workout.description ?? "") ||
          compTw.workout.scheme !== templateTw.workout.scheme ||
          compTw.workout.scoreType !== templateTw.workout.scoreType ||
          compTw.workout.timeCap !== templateTw.workout.timeCap ||
          compTw.workout.repsPerRound !== templateTw.workout.repsPerRound
        ) {
          hasDifferences = true
          break
        }

        // Compare track workout fields
        if (
          (templateTw.pointsMultiplier !== null &&
            compTw.pointsMultiplier !== templateTw.pointsMultiplier) ||
          (templateTw.notes !== undefined &&
            (compTw.notes ?? null) !== (templateTw.notes ?? null))
        ) {
          hasDifferences = true
          break
        }
      }

      let status: CompetitionEventSyncStatus["status"]
      if (hasCustomEvents) {
        status = "custom"
      } else if (hasDifferences) {
        status = "behind"
      } else {
        status = "in-sync"
      }

      results.push({
        competitionId: comp.id,
        competitionName: comp.name,
        status,
        mappedCount,
        totalTemplateEvents,
      })
    }

    return { competitions: results }
  })
