/**
 * Crew Workout Shell Server Functions for TanStack Start
 *
 * A "workout shell" is a minimal workout (title + description only) that Crew
 * organizers create so heats can be attached to a named workout. Crew does NOT
 * model movements, scoring, or scaling on these shells — the underlying
 * `workouts` row is populated with sensible defaults (private scope, "time"
 * scheme) purely to satisfy NOT-NULL columns.
 *
 * Storage chain for a shell:
 *   programmingTracksTable (one per competition, get-or-create)
 *     → workouts (name + description, defaulted scheme/scope/teamId)
 *       → trackWorkoutsTable (links track → workout, owns trackOrder)
 * The trackWorkout id is what `competitionHeatsTable.trackWorkoutId` references.
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { createProgrammingTrackId } from "@/db/schemas/common"
import {
  competitionHeatsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import {
  PROGRAMMING_TRACK_TYPE,
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts } from "@/db/schemas/workouts"
import {
  addRequestContextAttribute,
  logEntityCreated,
  logEntityDeleted,
} from "@/lib/logging"
import {
  type CrewManageableEvent,
  requireCrewEventManagerAccess,
} from "@/server/crew-auth.server"

// ============================================================================
// Types
// ============================================================================

export interface CrewWorkoutShell {
  /** trackWorkout id — the value heats reference via trackWorkoutId */
  trackWorkoutId: string
  /** underlying workouts.id */
  workoutId: string
  name: string
  description: string
  trackOrder: number
  heatCount: number
}

// ============================================================================
// Input schemas
// ============================================================================

const eventIdSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const createWorkoutShellInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  name: z.string().trim().min(1, "Workout title is required").max(200),
  description: z.string().trim().max(5000).default(""),
})

const updateWorkoutShellInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  workoutId: z.string().min(1, "Workout ID is required"),
  name: z.string().trim().min(1, "Workout title is required").max(200),
  description: z.string().trim().max(5000).default(""),
})

const deleteWorkoutShellInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

// ============================================================================
// Helpers
// ============================================================================

interface ResolvedCrewEvent extends CrewManageableEvent {
  id: string
  name: string
}

/**
 * Load the Crew event + its competition and assert the caller can manage it.
 * Mirrors the access gate used by the heats loader so workout-shell mutations
 * stay scoped to the organizing/competition team (or a site admin).
 */
async function requireManageableCrewEvent(
  eventId: string,
): Promise<ResolvedCrewEvent> {
  const db = getDb()

  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  await requireCrewEventManagerAccess(event, "Crew workouts")

  return event
}

/**
 * Get the competition's programming track, creating it on first use. A fresh
 * Crew event has no track until the first workout shell is added.
 */
async function getOrCreateCompetitionTrack(event: ResolvedCrewEvent) {
  const db = getDb()

  const existing = await db.query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.competitionId, event.id),
  })
  if (existing) return existing

  const trackId = createProgrammingTrackId()
  await db.insert(programmingTracksTable).values({
    id: trackId,
    name: `${event.name} - Events`,
    description: `Competition events for ${event.name}`,
    type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
    ownerTeamId: event.organizingTeamId,
    competitionId: event.id,
    isPublic: 0,
  })

  const created = await db.query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.id, trackId),
  })
  if (!created) {
    throw new Error("Failed to create programming track for competition")
  }
  return created
}

/** Next integer trackOrder for a track (1-based). */
async function getNextTrackOrder(trackId: string): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ trackOrder: trackWorkoutsTable.trackOrder })
    .from(trackWorkoutsTable)
    .where(eq(trackWorkoutsTable.trackId, trackId))

  if (rows.length === 0) return 1
  return Math.floor(Math.max(...rows.map((r) => Number(r.trackOrder)))) + 1
}

// ============================================================================
// Server functions
// ============================================================================

/**
 * List a Crew event's workout shells (title + description) with heat counts.
 * Returns an empty list when the event has no programming track yet.
 */
export const getCrewWorkoutShellsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => eventIdSchema.parse(data))
  .handler(async ({ data }): Promise<{ workouts: CrewWorkoutShell[] }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.competitionId, event.id),
    })
    if (!track) {
      return { workouts: [] }
    }

    const [shellRows, heatRows] = await Promise.all([
      db
        .select({
          trackWorkoutId: trackWorkoutsTable.id,
          workoutId: workouts.id,
          name: workouts.name,
          description: workouts.description,
          trackOrder: trackWorkoutsTable.trackOrder,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.trackId, track.id))
        .orderBy(asc(trackWorkoutsTable.trackOrder)),
      db
        .select({ trackWorkoutId: competitionHeatsTable.trackWorkoutId })
        .from(competitionHeatsTable)
        .where(eq(competitionHeatsTable.competitionId, event.id)),
    ])

    const heatCountByTrackWorkout = new Map<string, number>()
    for (const heat of heatRows) {
      heatCountByTrackWorkout.set(
        heat.trackWorkoutId,
        (heatCountByTrackWorkout.get(heat.trackWorkoutId) ?? 0) + 1,
      )
    }

    return {
      workouts: shellRows.map((row) => ({
        trackWorkoutId: row.trackWorkoutId,
        workoutId: row.workoutId,
        name: row.name,
        description: row.description,
        trackOrder: Number(row.trackOrder),
        heatCount: heatCountByTrackWorkout.get(row.trackWorkoutId) ?? 0,
      })),
    }
  })

/**
 * Create a workout shell: ensure the competition track, insert a workout row
 * (name + description, defaulted scheme/scope/teamId), and link it via a new
 * trackWorkout at the next order. The three writes run in a transaction so a
 * partial shell never lingers.
 */
export const createCrewWorkoutShellFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createWorkoutShellInputSchema.parse(data))
  .handler(async ({ data }): Promise<CrewWorkoutShell> => {
    const event = await requireManageableCrewEvent(data.eventId)
    addRequestContextAttribute("competitionId", event.id)

    const track = await getOrCreateCompetitionTrack(event)
    const trackOrder = await getNextTrackOrder(track.id)

    const db = getDb()
    const workoutId = `wkt_${createId()}`
    const trackWorkoutId = `trwk_${createId()}`

    await db.transaction(async (tx) => {
      await tx.insert(workouts).values({
        id: workoutId,
        name: data.name,
        description: data.description,
        // Crew shells carry no scoring; defaults satisfy NOT-NULL columns.
        scheme: "time",
        scope: "private",
        teamId: event.organizingTeamId,
      })

      await tx.insert(trackWorkoutsTable).values({
        id: trackWorkoutId,
        trackId: track.id,
        workoutId,
        trackOrder,
        pointsMultiplier: 100,
      })
    })

    addRequestContextAttribute("trackWorkoutId", trackWorkoutId)
    logEntityCreated({
      entity: "crewWorkoutShell",
      id: trackWorkoutId,
      parentEntity: "competition",
      parentId: event.id,
      attributes: { workoutId, trackOrder },
    })

    return {
      trackWorkoutId,
      workoutId,
      name: data.name,
      description: data.description,
      trackOrder,
      heatCount: 0,
    }
  })

/**
 * Update a workout shell's title and description. Verifies the workout belongs
 * to this event's track before writing so one event cannot edit another's.
 */
export const updateCrewWorkoutShellFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateWorkoutShellInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    // Confirm the workout is linked to this event's track.
    const [link] = await db
      .select({ id: trackWorkoutsTable.id })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(
        and(
          eq(trackWorkoutsTable.workoutId, data.workoutId),
          eq(programmingTracksTable.competitionId, event.id),
        ),
      )
      .limit(1)

    if (!link) {
      throw new Error("Workout not found for this event")
    }

    await db
      .update(workouts)
      .set({
        name: data.name,
        description: data.description,
        updatedAt: new Date(),
      })
      .where(eq(workouts.id, data.workoutId))

    return { success: true }
  })

/**
 * Delete a workout shell. Blocks (throws) when the shell still has heats — the
 * organizer must remove the heats first. This is the safer UX: deleting a
 * workout with scheduled heats would silently orphan/destroy schedule data.
 * The trackWorkout link and the underlying workout row are removed together.
 */
export const deleteCrewWorkoutShellFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteWorkoutShellInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    // Resolve the trackWorkout and confirm it belongs to this event's track.
    const [link] = await db
      .select({
        trackWorkoutId: trackWorkoutsTable.id,
        workoutId: trackWorkoutsTable.workoutId,
      })
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

    const heats = await db
      .select({ id: competitionHeatsTable.id })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

    if (heats.length > 0) {
      throw new Error(
        `Remove the ${heats.length} ${heats.length === 1 ? "heat" : "heats"} on this workout before deleting it.`,
      )
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      await tx.delete(workouts).where(eq(workouts.id, link.workoutId))
    })

    logEntityDeleted({
      entity: "crewWorkoutShell",
      id: data.trackWorkoutId,
    })

    return { success: true }
  })
