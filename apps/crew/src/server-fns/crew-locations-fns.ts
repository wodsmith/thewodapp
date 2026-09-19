/**
 * Crew Location (Venue) Server Functions for TanStack Start
 *
 * A "location" is a `competitionVenuesTable` row scoped to a Crew event. Each
 * location has a NAME and a LANE COUNT — the lane count determines how many
 * lanes a heat at that location has. Crew does NOT assign athletes to individual
 * lanes; lane count is purely a property of the location surfaced at the heat
 * level via the heat's `venueId`.
 *
 * These mutations reuse the underlying venue table but apply Crew's own access
 * gate (requireCrewEventManagerAccess) rather than the organizer team-permission
 * or cohost gates used elsewhere, so they stay scoped to the organizing /
 * competition team (or a site admin) like the rest of Crew's setup flow.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { createCompetitionVenueId } from "@/db/schemas/common"
import {
  competitionHeatsTable,
  competitionsTable,
  competitionVenuesTable,
} from "@/db/schemas/competitions"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
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

export interface CrewLocation {
  id: string
  name: string
  laneCount: number
  transitionMinutes: number
  isDefault: boolean
  /** Number of heats currently assigned to this location. */
  heatCount: number
}

// ============================================================================
// Input schemas
// ============================================================================

const LANE_COUNT_MIN = 1
const LANE_COUNT_MAX = 100
const DEFAULT_LANE_COUNT = 3
const DEFAULT_TRANSITION_MINUTES = 2
const TRANSITION_MINUTES_MIN = 0
const TRANSITION_MINUTES_MAX = 120

const eventIdSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const createLocationInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  name: z.string().trim().min(1, "Location name is required").max(100),
  laneCount: z
    .number()
    .int()
    .min(LANE_COUNT_MIN)
    .max(LANE_COUNT_MAX)
    .default(DEFAULT_LANE_COUNT),
  transitionMinutes: z
    .number()
    .int()
    .min(TRANSITION_MINUTES_MIN)
    .max(TRANSITION_MINUTES_MAX)
    .default(DEFAULT_TRANSITION_MINUTES),
})

const updateLocationInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  locationId: z.string().min(1, "Location ID is required"),
  name: z.string().trim().min(1, "Location name is required").max(100),
  laneCount: z.number().int().min(LANE_COUNT_MIN).max(LANE_COUNT_MAX),
  transitionMinutes: z
    .number()
    .int()
    .min(TRANSITION_MINUTES_MIN)
    .max(TRANSITION_MINUTES_MAX),
})

const setDefaultLocationInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  locationId: z.string().min(1, "Location ID is required"),
})

const deleteLocationInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  locationId: z.string().min(1, "Location ID is required"),
})

// ============================================================================
// Helpers
// ============================================================================

interface ResolvedCrewEvent extends CrewManageableEvent {
  id: string
}

/**
 * Load the Crew event + its competition and assert the caller can manage it.
 * Mirrors the access gate used by the heats and workout-shell loaders so
 * location mutations stay scoped to the organizing/competition team (or a site
 * admin).
 */
async function requireManageableCrewEvent(
  eventId: string,
): Promise<ResolvedCrewEvent> {
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
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  await requireCrewEventManagerAccess(event, "Crew locations")

  return event
}

// ============================================================================
// Server functions
// ============================================================================

/**
 * List a Crew event's locations (name + lane count) with heat counts, ordered
 * by sortOrder.
 */
export const getCrewLocationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => eventIdSchema.parse(data))
  .handler(async ({ data }): Promise<{ locations: CrewLocation[] }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    const [locationRows, heatRows] = await Promise.all([
      db
        .select({
          id: competitionVenuesTable.id,
          name: competitionVenuesTable.name,
          laneCount: competitionVenuesTable.laneCount,
          transitionMinutes: competitionVenuesTable.transitionMinutes,
          isDefault: competitionVenuesTable.isDefault,
        })
        .from(competitionVenuesTable)
        .where(eq(competitionVenuesTable.competitionId, event.id))
        .orderBy(asc(competitionVenuesTable.sortOrder)),
      db
        .select({ venueId: competitionHeatsTable.venueId })
        .from(competitionHeatsTable)
        .where(eq(competitionHeatsTable.competitionId, event.id)),
    ])

    const heatCountByVenue = new Map<string, number>()
    for (const heat of heatRows) {
      if (!heat.venueId) continue
      heatCountByVenue.set(
        heat.venueId,
        (heatCountByVenue.get(heat.venueId) ?? 0) + 1,
      )
    }

    return {
      locations: locationRows.map((row, index) => ({
        id: row.id,
        name: row.name,
        laneCount: row.laneCount,
        transitionMinutes: row.transitionMinutes,
        // The fallback keeps pre-migration or manually imported venue data
        // usable even if no row was explicitly marked as the default.
        isDefault:
          row.isDefault ||
          (!locationRows.some((location) => location.isDefault) && index === 0),
        heatCount: heatCountByVenue.get(row.id) ?? 0,
      })),
    }
  })

/**
 * Create a location for the event. The new location is appended at the end of
 * the sort order. Lane count defaults to 3 and is clamped to [1, 100].
 */
export const createCrewLocationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createLocationInputSchema.parse(data))
  .handler(async ({ data }): Promise<CrewLocation> => {
    const event = await requireManageableCrewEvent(data.eventId)
    addRequestContextAttribute("competitionId", event.id)
    const db = getDb()

    const existing = await db
      .select({ id: competitionVenuesTable.id })
      .from(competitionVenuesTable)
      .where(eq(competitionVenuesTable.competitionId, event.id))

    const locationId = createCompetitionVenueId()
    const isDefault = existing.length === 0
    await db.transaction(async (tx) => {
      await tx.insert(competitionVenuesTable).values({
        id: locationId,
        competitionId: event.id,
        name: data.name,
        laneCount: data.laneCount,
        transitionMinutes: data.transitionMinutes,
        isDefault,
        sortOrder: existing.length,
      })
    })

    addRequestContextAttribute("venueId", locationId)
    logEntityCreated({
      entity: "crewLocation",
      id: locationId,
      parentEntity: "competition",
      parentId: event.id,
      attributes: {
        name: data.name,
        laneCount: data.laneCount,
        transitionMinutes: data.transitionMinutes,
        isDefault,
      },
    })

    return {
      id: locationId,
      name: data.name,
      laneCount: data.laneCount,
      transitionMinutes: data.transitionMinutes,
      isDefault,
      heatCount: 0,
    }
  })

/**
 * Update a location's name and lane count. Verifies the location belongs to
 * this event before writing so one event cannot edit another's.
 */
export const updateCrewLocationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateLocationInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    const [location] = await db
      .select({ id: competitionVenuesTable.id })
      .from(competitionVenuesTable)
      .where(
        and(
          eq(competitionVenuesTable.id, data.locationId),
          eq(competitionVenuesTable.competitionId, event.id),
        ),
      )
      .limit(1)

    if (!location) {
      throw new Error("Location not found for this event")
    }

    await db
      .update(competitionVenuesTable)
      .set({
        name: data.name,
        laneCount: data.laneCount,
        transitionMinutes: data.transitionMinutes,
        updatedAt: new Date(),
      })
      .where(eq(competitionVenuesTable.id, data.locationId))

    return { success: true }
  })

/**
 * Make one event location the default used by new heat schedules. Clearing and
 * setting happen in one transaction so the event never commits two defaults.
 */
export const setDefaultCrewLocationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setDefaultLocationInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    const [location] = await db
      .select({ id: competitionVenuesTable.id })
      .from(competitionVenuesTable)
      .where(
        and(
          eq(competitionVenuesTable.id, data.locationId),
          eq(competitionVenuesTable.competitionId, event.id),
        ),
      )
      .limit(1)

    if (!location) {
      throw new Error("Location not found for this event")
    }

    await db.transaction(async (tx) => {
      await tx
        .update(competitionVenuesTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(competitionVenuesTable.competitionId, event.id))
      await tx
        .update(competitionVenuesTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(competitionVenuesTable.id, data.locationId))
    })

    return { success: true }
  })

/**
 * Delete a location. Heats that reference it are NOT deleted — their `venueId`
 * is nulled out first so no heat is left pointing at a missing location (the
 * heat keeps its number/time and simply shows no location until reassigned).
 * The two writes run in a transaction so a delete never half-applies.
 */
export const deleteCrewLocationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteLocationInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const event = await requireManageableCrewEvent(data.eventId)
    const db = getDb()

    const [location] = await db
      .select({
        id: competitionVenuesTable.id,
        isDefault: competitionVenuesTable.isDefault,
      })
      .from(competitionVenuesTable)
      .where(
        and(
          eq(competitionVenuesTable.id, data.locationId),
          eq(competitionVenuesTable.competitionId, event.id),
        ),
      )
      .limit(1)

    if (!location) {
      throw new Error("Location not found for this event")
    }

    const [replacement] = location.isDefault
      ? await db
          .select({ id: competitionVenuesTable.id })
          .from(competitionVenuesTable)
          .where(
            and(
              eq(competitionVenuesTable.competitionId, event.id),
              ne(competitionVenuesTable.id, data.locationId),
            ),
          )
          .orderBy(asc(competitionVenuesTable.sortOrder))
      : []

    await db.transaction(async (tx) => {
      // Detach heats from the location before removing it so none are orphaned
      // with a dangling venueId. Scoped to this event for safety.
      await tx
        .update(competitionHeatsTable)
        .set({ venueId: null, updatedAt: new Date() })
        .where(
          and(
            eq(competitionHeatsTable.venueId, data.locationId),
            eq(competitionHeatsTable.competitionId, event.id),
          ),
        )

      await tx
        .delete(competitionVenuesTable)
        .where(eq(competitionVenuesTable.id, data.locationId))

      if (replacement) {
        await tx
          .update(competitionVenuesTable)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(competitionVenuesTable.id, replacement.id))
      }
    })

    logEntityDeleted({
      entity: "crewLocation",
      id: data.locationId,
    })

    return { success: true }
  })
