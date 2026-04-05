/**
 * Cohost Competition Events Server Functions
 * Mirrors competition-event-fns.ts with cohost auth.
 * Provides GET/CREATE/UPDATE/DELETE for competition event submission windows.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { requireCohostCompetitionOwnership, requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetEventsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostUpsertEventsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  events: z
    .array(
      z.object({
        trackWorkoutId: z.string().min(1, "Track workout ID is required"),
        submissionOpensAt: z.string().nullable().optional(),
        submissionClosesAt: z.string().nullable().optional(),
      }),
    )
    .min(1, "At least one event required"),
})

const cohostDeleteEventInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all competition events (cohost view)
 */
export const cohostGetCompetitionEventsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostGetEventsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const events = await db
      .select({
        id: competitionEventsTable.id,
        competitionId: competitionEventsTable.competitionId,
        trackWorkoutId: competitionEventsTable.trackWorkoutId,
        submissionOpensAt: competitionEventsTable.submissionOpensAt,
        submissionClosesAt: competitionEventsTable.submissionClosesAt,
        createdAt: competitionEventsTable.createdAt,
        updatedAt: competitionEventsTable.updatedAt,
      })
      .from(competitionEventsTable)
      .where(eq(competitionEventsTable.competitionId, data.competitionId))

    return { events }
  })

/**
 * Bulk upsert competition events with submission windows (cohost)
 */
export const cohostUpsertCompetitionEventsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => cohostUpsertEventsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    // Verify competition exists and the competitionTeamId matches
    const competition = await db
      .select({ id: competitionsTable.id })
      .from(competitionsTable)
      .where(
        and(
          eq(competitionsTable.id, data.competitionId),
          eq(competitionsTable.competitionTeamId, data.competitionTeamId),
        ),
      )
      .limit(1)

    if (competition.length === 0) {
      throw new Error("Competition not found or access denied")
    }

    await db.transaction(async (tx) => {
      for (const event of data.events) {
        await tx
          .insert(competitionEventsTable)
          .values({
            competitionId: data.competitionId,
            trackWorkoutId: event.trackWorkoutId,
            submissionOpensAt: event.submissionOpensAt ?? null,
            submissionClosesAt: event.submissionClosesAt ?? null,
          })
          .onDuplicateKeyUpdate({
            set: {
              submissionOpensAt: event.submissionOpensAt ?? null,
              submissionClosesAt: event.submissionClosesAt ?? null,
              updatedAt: new Date(),
            },
          })
      }
    })

    return { success: true, upsertedCount: data.events.length }
  })

/**
 * Delete a competition event (cohost)
 */
export const cohostDeleteCompetitionEventFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => cohostDeleteEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    const db = getDb()

    // Verify event exists and belongs to a competition with matching competitionTeamId
    const event = await db
      .select({
        eventId: competitionEventsTable.id,
        competitionId: competitionEventsTable.competitionId,
      })
      .from(competitionEventsTable)
      .innerJoin(
        competitionsTable,
        eq(competitionEventsTable.competitionId, competitionsTable.id),
      )
      .where(
        and(
          eq(competitionEventsTable.id, data.eventId),
          eq(competitionsTable.competitionTeamId, data.competitionTeamId),
        ),
      )
      .limit(1)

    if (event.length === 0) {
      throw new Error("Event not found or access denied")
    }

    await db
      .delete(competitionEventsTable)
      .where(eq(competitionEventsTable.id, data.eventId))

    return { success: true }
  })
