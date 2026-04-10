/**
 * Event Division Mapping Server Functions
 *
 * CRUD for mapping competition events (track_workouts) to divisions (scaling_levels).
 * When mappings exist for a competition, only mapped event↔division pairs are active.
 * When no mappings exist, all events apply to all divisions (backwards compatible).
 */

import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { eventDivisionMappingsTable } from "@/db/schemas/event-division-mappings"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { competitionDivisionsTable } from "@/db/schemas/commerce"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { workouts } from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface EventDivisionMappingData {
  /** All events for this competition */
  events: Array<{
    trackWorkoutId: string
    eventName: string
    trackOrder: number
    parentEventId: string | null
  }>
  /** All divisions for this competition */
  divisions: Array<{
    divisionId: string
    label: string
    teamSize: number
    position: number
  }>
  /** Current mappings: Set of "trackWorkoutId:divisionId" keys */
  mappings: Array<{
    trackWorkoutId: string
    divisionId: string
  }>
  /** Whether this competition has any event-division mappings configured */
  hasMappings: boolean
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all event-division mappings for a competition.
 * Returns events, divisions, and current mapping state.
 */
export const getEventDivisionMappingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<EventDivisionMappingData> => {
    const session = await getSessionFromCookie()
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Get competition to verify ownership
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })
    if (!competition) {
      throw new Error("Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.ACCESS_DASHBOARD,
    )

    // Get the competition's programming track
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.competitionId, data.competitionId),
    })

    let events: EventDivisionMappingData["events"] = []
    if (track) {
      // Get all track workouts (events) for this competition
      const trackWorkouts = await db
        .select({
          trackWorkoutId: trackWorkoutsTable.id,
          eventName: workouts.name,
          trackOrder: trackWorkoutsTable.trackOrder,
          parentEventId: trackWorkoutsTable.parentEventId,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.trackId, track.id))
        .orderBy(trackWorkoutsTable.trackOrder)

      events = trackWorkouts.map((tw) => ({
        trackWorkoutId: tw.trackWorkoutId,
        eventName: tw.eventName,
        trackOrder: tw.trackOrder,
        parentEventId: tw.parentEventId,
      }))
    }

    // Get competition divisions from competition_divisions table joined to
    // scaling_levels for label/metadata. This ensures divisionId values match
    // what registrations use (competition_divisions.divisionId), not a
    // potentially different scaling group in settings.
    const compDivisions = await db
      .select({
        divisionId: competitionDivisionsTable.divisionId,
        label: scalingLevelsTable.label,
        teamSize: scalingLevelsTable.teamSize,
        position: scalingLevelsTable.position,
      })
      .from(competitionDivisionsTable)
      .innerJoin(
        scalingLevelsTable,
        eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
      )
      .where(eq(competitionDivisionsTable.competitionId, data.competitionId))
      .orderBy(scalingLevelsTable.position)

    const divisions: EventDivisionMappingData["divisions"] = compDivisions

    // Get existing mappings, filtering out stale rows that no longer match
    // current events or divisions (e.g. after programming track changes)
    const existingMappings = await db
      .select({
        trackWorkoutId: eventDivisionMappingsTable.trackWorkoutId,
        divisionId: eventDivisionMappingsTable.divisionId,
      })
      .from(eventDivisionMappingsTable)
      .where(eq(eventDivisionMappingsTable.competitionId, data.competitionId))

    const validEventIds = new Set(events.map((e) => e.trackWorkoutId))
    const validDivisionIds = new Set(divisions.map((d) => d.divisionId))
    const mappings = existingMappings.filter(
      (m) => validEventIds.has(m.trackWorkoutId) && validDivisionIds.has(m.divisionId),
    )

    return {
      events,
      divisions,
      mappings,
      hasMappings: mappings.length > 0,
    }
  })

/**
 * Save event-division mappings for a competition.
 * Full-replace: deletes all existing mappings and inserts new ones atomically.
 */
export const saveEventDivisionMappingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string(),
        mappings: z.array(
          z.object({
            trackWorkoutId: z.string(),
            divisionId: z.string(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Get competition to verify ownership
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })
    if (!competition) {
      throw new Error("Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Validate submitted IDs belong to this competition (no FK enforcement in PlanetScale)
    if (data.mappings.length > 0) {
      const track = await db.query.programmingTracksTable.findFirst({
        where: eq(programmingTracksTable.competitionId, data.competitionId),
      })
      const validEventIds = new Set<string>()
      if (track) {
        const trackWorkouts = await db
          .select({ id: trackWorkoutsTable.id })
          .from(trackWorkoutsTable)
          .where(eq(trackWorkoutsTable.trackId, track.id))
        for (const tw of trackWorkouts) validEventIds.add(tw.id)
      }

      const compDivisions = await db
        .select({ divisionId: competitionDivisionsTable.divisionId })
        .from(competitionDivisionsTable)
        .where(eq(competitionDivisionsTable.competitionId, data.competitionId))
      const validDivisionIds = new Set(compDivisions.map((d) => d.divisionId))

      for (const m of data.mappings) {
        if (!validEventIds.has(m.trackWorkoutId) || !validDivisionIds.has(m.divisionId)) {
          throw new Error("Invalid mapping: event or division does not belong to this competition")
        }
      }
    }

    // Full-replace atomically
    await db.transaction(async (tx) => {
      // Delete all existing mappings for this competition
      await tx
        .delete(eventDivisionMappingsTable)
        .where(eq(eventDivisionMappingsTable.competitionId, data.competitionId))

      // Insert new mappings (if any)
      if (data.mappings.length > 0) {
        await tx.insert(eventDivisionMappingsTable).values(
          data.mappings.map((m) => ({
            competitionId: data.competitionId,
            trackWorkoutId: m.trackWorkoutId,
            divisionId: m.divisionId,
          })),
        )
      }
    })

    return { success: true, count: data.mappings.length }
  })

/**
 * Get event-division mappings for a competition (public-facing).
 * Used by athlete pages to filter which events are visible per division.
 * Returns just the mapping data, no auth required beyond valid competition.
 */
export const getPublicEventDivisionMappingsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string(),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      mappings: Array<{ trackWorkoutId: string; divisionId: string }>
      hasMappings: boolean
    }> => {
      const db = getDb()

      try {
        const mappings = await db
          .select({
            trackWorkoutId: eventDivisionMappingsTable.trackWorkoutId,
            divisionId: eventDivisionMappingsTable.divisionId,
          })
          .from(eventDivisionMappingsTable)
          .where(
            eq(eventDivisionMappingsTable.competitionId, data.competitionId),
          )

        return {
          mappings,
          hasMappings: mappings.length > 0,
        }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string | number }).code === "ER_NO_SUCH_TABLE"
        ) {
          return { mappings: [], hasMappings: false }
        }
        throw error
      }
    },
  )
