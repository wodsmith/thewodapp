/**
 * Cohost Location/Venue Server Functions
 * Mirrors organizer venue functions from competition-heats-fns for cohost access.
 * Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { getEvlog } from "@/lib/evlog"
import { addressesTable } from "@/db/schemas/addresses"
import {
  competitionHeatsTable,
  competitionVenuesTable,
} from "@/db/schemas/competitions"
import { createCompetitionVenueId } from "@/db/schemas/common"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostBaseSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const getCompetitionVenuesInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const createVenueInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1, "Competition ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  laneCount: z.number().int().min(1).max(100).default(3),
  transitionMinutes: z.number().int().min(0).max(120).default(3),
  sortOrder: z.number().int().min(0).optional(),
  addressId: z.string().min(1).optional(),
})

const updateVenueInputSchema = cohostBaseSchema.extend({
  venueId: z.string().min(1, "Venue ID is required"),
  name: z.string().min(1).max(100).optional(),
  laneCount: z.number().int().min(1).max(100).optional(),
  transitionMinutes: z.number().int().min(0).max(120).optional(),
  sortOrder: z.number().int().min(0).optional(),
  addressId: z.string().min(1).optional(),
})

const deleteVenueInputSchema = cohostBaseSchema.extend({
  venueId: z.string().min(1, "Venue ID is required"),
})

const getVenueHeatCountInputSchema = cohostBaseSchema.extend({
  venueId: z.string().min(1),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all venues for a competition (cohost view)
 */
export const cohostGetCompetitionVenuesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCompetitionVenuesInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "locations")

    const db = getDb()

    const venuesWithAddresses = await db
      .select({
        venue: competitionVenuesTable,
        address: addressesTable,
      })
      .from(competitionVenuesTable)
      .leftJoin(
        addressesTable,
        eq(competitionVenuesTable.addressId, addressesTable.id),
      )
      .where(eq(competitionVenuesTable.competitionId, data.competitionId))
      .orderBy(asc(competitionVenuesTable.sortOrder))

    const venues = venuesWithAddresses.map(({ venue, address }) => ({
      ...venue,
      address,
    }))

    return { venues }
  })

/**
 * Create a new competition venue (cohost)
 */
export const cohostCreateVenueFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createVenueInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "locations")
    getEvlog()?.set({
      action: "cohost_create_venue",
      venue: { competitionId: data.competitionId },
    })

    const db = getDb()

    let sortOrder = data.sortOrder
    if (sortOrder === undefined) {
      const existingVenues = await db
        .select()
        .from(competitionVenuesTable)
        .where(eq(competitionVenuesTable.competitionId, data.competitionId))

      sortOrder = existingVenues.length
    }

    const venueId = createCompetitionVenueId()
    await db.insert(competitionVenuesTable).values({
      id: venueId,
      competitionId: data.competitionId,
      name: data.name,
      laneCount: data.laneCount,
      transitionMinutes: data.transitionMinutes,
      sortOrder,
      addressId: data.addressId ?? null,
    })

    const venue = await db.query.competitionVenuesTable.findFirst({
      where: eq(competitionVenuesTable.id, venueId),
    })

    if (!venue) {
      throw new Error("Failed to create venue")
    }

    return { venue }
  })

/**
 * Update a competition venue (cohost)
 */
export const cohostUpdateVenueFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateVenueInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "locations")
    getEvlog()?.set({
      action: "cohost_update_venue",
      venue: { id: data.venueId },
    })

    const db = getDb()

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.laneCount !== undefined) updateData.laneCount = data.laneCount
    if (data.transitionMinutes !== undefined)
      updateData.transitionMinutes = data.transitionMinutes
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.addressId !== undefined) updateData.addressId = data.addressId

    await db
      .update(competitionVenuesTable)
      .set(updateData)
      .where(eq(competitionVenuesTable.id, data.venueId))

    return { success: true }
  })

/**
 * Delete a competition venue (cohost)
 */
export const cohostDeleteVenueFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteVenueInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "locations")
    getEvlog()?.set({
      action: "cohost_delete_venue",
      venue: { id: data.venueId },
    })

    const db = getDb()

    await db
      .delete(competitionVenuesTable)
      .where(eq(competitionVenuesTable.id, data.venueId))

    return { success: true }
  })

/**
 * Check if a venue has any heats assigned (cohost)
 */
export const cohostGetVenueHeatCountFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getVenueHeatCountInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "locations")

    const db = getDb()

    const heats = await db
      .select({ id: competitionHeatsTable.id })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.venueId, data.venueId))

    return { count: heats.length }
  })
