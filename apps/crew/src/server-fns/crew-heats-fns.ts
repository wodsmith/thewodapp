import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { createCompetitionHeatId } from "@/db/schemas/common"
import {
  competitionHeatsTable,
  competitionVenuesTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import { programmingTracksTable, trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { workouts } from "@/db/schemas/workouts"
import { logEntityCreated, logInfo } from "@/lib/logging"
import { requireCrewEventManagerAccess } from "@/server/crew-auth.server"

// ============================================================================
// Types
// ============================================================================

export interface CrewHeatsTrackWorkout {
  id: string
  label: string
  trackOrder: number
}

export interface CrewHeatRow {
  id: string
  heatNumber: number
  scheduledTime: Date | null
  durationMinutes: number | null
  venueId: string | null
  venueName: string | null
  /** Lane count of the heat's location, surfaced for display. */
  venueLaneCount: number | null
  divisionId: string | null
  divisionLabel: string | null
  notes: string | null
  schedulePublishedAt: Date | null
}

export interface CrewVenueOption {
  id: string
  name: string
  laneCount: number
}

export interface CrewHeatsPageData {
  trackWorkouts: CrewHeatsTrackWorkout[]
  heatsByTrackWorkoutId: Record<string, CrewHeatRow[]>
  venues: CrewVenueOption[]
}

// ============================================================================
// Input schemas
// ============================================================================

const getCrewHeatsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

// ============================================================================
// Loader function
// ============================================================================

export const getCrewHeatsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewHeatsPageInputSchema.parse(data))
  .handler(async ({ data }): Promise<CrewHeatsPageData> => {
    const db = getDb()

    const [event] = await db
      .select({
        id: competitionsTable.id,
        organizingTeamId: competitionsTable.organizingTeamId,
        competitionTeamId: competitionsTable.competitionTeamId,
      })
      .from(crewEventSettingsTable)
      .innerJoin(
        competitionsTable,
        eq(crewEventSettingsTable.competitionId, competitionsTable.id),
      )
      .where(eq(crewEventSettingsTable.competitionId, data.eventId))
      .limit(1)

    if (!event) {
      throw new Error("Crew event not found")
    }

    await requireCrewEventManagerAccess(event, "Crew heats")

    const [trackWorkoutRows, heatRows, venueRows] = await Promise.all([
      db
        .select({
          id: trackWorkoutsTable.id,
          label: workouts.name,
          trackOrder: trackWorkoutsTable.trackOrder,
        })
        .from(trackWorkoutsTable)
        .innerJoin(
          programmingTracksTable,
          eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
        )
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(programmingTracksTable.competitionId, data.eventId))
        .orderBy(asc(trackWorkoutsTable.trackOrder)),

      db
        .select()
        .from(competitionHeatsTable)
        .where(eq(competitionHeatsTable.competitionId, data.eventId))
        .orderBy(
          asc(competitionHeatsTable.trackWorkoutId),
          asc(competitionHeatsTable.heatNumber),
        ),

      db
        .select({
          id: competitionVenuesTable.id,
          name: competitionVenuesTable.name,
          laneCount: competitionVenuesTable.laneCount,
        })
        .from(competitionVenuesTable)
        .where(eq(competitionVenuesTable.competitionId, data.eventId))
        .orderBy(asc(competitionVenuesTable.sortOrder)),
    ])

    const trackWorkouts: CrewHeatsTrackWorkout[] = trackWorkoutRows.map((row) => ({
      id: row.id,
      label: row.label,
      trackOrder: Number(row.trackOrder),
    }))

    // Heats are scoped to this event's venues, so venueRows already covers any
    // venue a heat can reference — reuse it for name + lane count instead of a
    // second query. Divisions still need a batch lookup.
    const divisionIds = [...new Set(heatRows.map((h) => h.divisionId).filter((id): id is string => id !== null))]

    const divisionDetails =
      divisionIds.length > 0
        ? await db
            .select({ id: scalingLevelsTable.id, label: scalingLevelsTable.label })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, divisionIds))
        : []

    const venueMap = new Map(venueRows.map((v) => [v.id, v]))
    const divisionMap = new Map(divisionDetails.map((d) => [d.id, d.label]))

    const heatsByTrackWorkoutId: Record<string, CrewHeatRow[]> = {}
    for (const heat of heatRows) {
      const rows = (heatsByTrackWorkoutId[heat.trackWorkoutId] ??= [])
      rows.push({
        id: heat.id,
        heatNumber: heat.heatNumber,
        scheduledTime: heat.scheduledTime,
        durationMinutes: heat.durationMinutes,
        venueId: heat.venueId,
        venueName: heat.venueId ? (venueMap.get(heat.venueId)?.name ?? null) : null,
        venueLaneCount: heat.venueId
          ? (venueMap.get(heat.venueId)?.laneCount ?? null)
          : null,
        divisionId: heat.divisionId,
        divisionLabel: heat.divisionId ? (divisionMap.get(heat.divisionId) ?? null) : null,
        notes: heat.notes,
        schedulePublishedAt: heat.schedulePublishedAt,
      })
    }

    return {
      trackWorkouts,
      heatsByTrackWorkoutId,
      venues: venueRows,
    }
  })

// ============================================================================
// Bulk heat generation (explicit per-heat times)
// ============================================================================

const generateHeatsInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  venueId: z.string().min(1).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
  heats: z
    .array(
      z.object({
        heatNumber: z.number().int().min(1),
        // Explicit per-heat time (already includes any manual override). Null
        // creates a heat without a scheduled time.
        scheduledTime: z.coerce.date().nullable(),
      }),
    )
    .min(1, "At least one heat is required")
    .max(60, "Add at most 60 heats at a time"),
})

/**
 * Create a batch of heats under one workout using EXPLICIT per-heat numbers
 * and times. Unlike bulkCreateHeatsFn (which auto-assigns numbers and spaces
 * times itself), this fn persists exactly what the client computed — the
 * cascade defaults plus any manual per-heat time overrides — so the
 * organizer's adjustments survive. The caller is responsible for the cascade
 * math ([[apps/crew/src/lib/crew/heat-scheduling.ts#buildCascadedLocalTimes]])
 * and for converting wall-clock inputs to UTC in the event timezone.
 *
 * Gated by requireCrewEventManagerAccess and scoped to the event's track so a
 * caller cannot inject heats into another competition's workout.
 */
export const generateHeatsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => generateHeatsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    const [event] = await db
      .select({
        id: competitionsTable.id,
        organizingTeamId: competitionsTable.organizingTeamId,
        competitionTeamId: competitionsTable.competitionTeamId,
      })
      .from(crewEventSettingsTable)
      .innerJoin(
        competitionsTable,
        eq(crewEventSettingsTable.competitionId, competitionsTable.id),
      )
      .where(eq(crewEventSettingsTable.competitionId, data.eventId))
      .limit(1)

    if (!event) {
      throw new Error("Crew event not found")
    }

    await requireCrewEventManagerAccess(event, "Crew heats")

    // Confirm the workout belongs to this event's programming track.
    const [link] = await db
      .select({ id: trackWorkoutsTable.id })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(
        and(
          eq(trackWorkoutsTable.id, data.trackWorkoutId),
          eq(programmingTracksTable.competitionId, event.id),
        ),
      )
      .limit(1)

    if (!link) {
      throw new Error("Workout not found for this event")
    }

    const now = new Date()
    const rows = data.heats.map((heat) => ({
      id: createCompetitionHeatId(),
      competitionId: event.id,
      trackWorkoutId: data.trackWorkoutId,
      heatNumber: heat.heatNumber,
      scheduledTime: heat.scheduledTime ?? null,
      venueId: data.venueId ?? null,
      durationMinutes: data.durationMinutes ?? null,
      divisionId: null,
      notes: null,
      // Auto-publish heats that have a scheduled time, mirroring createHeatFn.
      schedulePublishedAt: heat.scheduledTime ? now : null,
    }))

    await db.insert(competitionHeatsTable).values(rows)

    const createdIds = rows.map((r) => r.id)
    const createdHeats = await db
      .select()
      .from(competitionHeatsTable)
      .where(inArray(competitionHeatsTable.id, createdIds))

    for (const row of rows) {
      logEntityCreated({
        entity: "heat",
        id: row.id,
        parentEntity: "competition",
        parentId: event.id,
        attributes: {
          trackWorkoutId: data.trackWorkoutId,
          heatNumber: row.heatNumber,
        },
      })
    }
    logInfo({
      message: "[Heat] Generated heats with explicit times",
      attributes: {
        competitionId: event.id,
        trackWorkoutId: data.trackWorkoutId,
        heatCount: rows.length,
      },
    })

    return { heats: createdHeats }
  })
