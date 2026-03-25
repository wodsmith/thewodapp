/**
 * Cohost Division Results Server Functions
 * Mirrors division-results-fns.ts with cohost auth.
 * Allows cohosts to view and publish/unpublish division results.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { requireCohostPermission } from "@/utils/cohost-auth"
import type {
  AllEventsResultsStatusResponse,
  DivisionResultStatus,
  EventDivisionResultsStatusResponse,
} from "@/server-fns/division-results-fns"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetDivisionResultsStatusInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  eventId: z.string().min(1, "Event ID is required").optional(),
})

const cohostPublishDivisionResultsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  publish: z.boolean(),
})

const cohostPublishAllDivisionResultsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
  publish: z.boolean(),
})

// ============================================================================
// Helper Functions
// ============================================================================

interface DivisionResultsSchema {
  [eventId: string]: {
    [divisionId: string]: {
      publishedAt: number | null
    }
  }
}

function parseCompetitionSettings(settings: string | null): {
  divisions?: { scalingGroupId?: string }
  divisionResults?: DivisionResultsSchema
  [key: string]: unknown
} | null {
  if (!settings) return null
  try {
    return JSON.parse(settings)
  } catch {
    return null
  }
}

function stringifyCompetitionSettings(
  settings: {
    divisions?: { scalingGroupId?: string }
    divisionResults?: DivisionResultsSchema
    [key: string]: unknown
  } | null,
): string | null {
  if (!settings) return null
  try {
    return JSON.stringify(settings)
  } catch {
    return null
  }
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get division results publishing status (cohost view)
 */
export const cohostGetDivisionResultsStatusFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    cohostGetDivisionResultsStatusInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<
      EventDivisionResultsStatusResponse | AllEventsResultsStatusResponse
    > => {
      await requireCohostPermission(data.competitionTeamId, "results")
      const db = getDb()

      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!competition) {
        throw new Error("Competition not found")
      }

      const settings = parseCompetitionSettings(competition.settings)
      const scalingGroupId = settings?.divisions?.scalingGroupId

      if (!scalingGroupId) {
        if (data.eventId) {
          return {
            eventId: data.eventId,
            eventName: "",
            divisions: [],
            publishedCount: 0,
            totalCount: 0,
          }
        }
        return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
      }

      const divisions = await db
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
          position: scalingLevelsTable.position,
        })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

      if (divisions.length === 0) {
        if (data.eventId) {
          return {
            eventId: data.eventId,
            eventName: "",
            divisions: [],
            publishedCount: 0,
            totalCount: 0,
          }
        }
        return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
      }

      const divisionIds = divisions.map((d) => d.id)
      const registrationCounts = await db
        .select({
          divisionId: competitionRegistrationsTable.divisionId,
          count: sql<number>`cast(count(*) as unsigned)`,
        })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            inArray(competitionRegistrationsTable.divisionId, divisionIds),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        )
        .groupBy(competitionRegistrationsTable.divisionId)

      const registrationCountMap = new Map<string, number>()
      for (const row of registrationCounts) {
        if (row.divisionId) {
          registrationCountMap.set(row.divisionId, row.count)
        }
      }

      const [track] = await db
        .select({ id: programmingTracksTable.id })
        .from(programmingTracksTable)
        .where(eq(programmingTracksTable.competitionId, data.competitionId))

      if (!track) {
        if (data.eventId) {
          return {
            eventId: data.eventId,
            eventName: "",
            divisions: [],
            publishedCount: 0,
            totalCount: 0,
          }
        }
        return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
      }

      const events = await db
        .select({
          id: trackWorkoutsTable.id,
          trackOrder: trackWorkoutsTable.trackOrder,
          workoutId: trackWorkoutsTable.workoutId,
          workoutName: workoutsTable.name,
        })
        .from(trackWorkoutsTable)
        .leftJoin(
          workoutsTable,
          eq(trackWorkoutsTable.workoutId, workoutsTable.id),
        )
        .where(eq(trackWorkoutsTable.trackId, track.id))
        .orderBy(trackWorkoutsTable.trackOrder)

      const targetEvents = data.eventId
        ? events.filter((e) => e.id === data.eventId)
        : events

      if (targetEvents.length === 0) {
        if (data.eventId) {
          return {
            eventId: data.eventId,
            eventName: "",
            divisions: [],
            publishedCount: 0,
            totalCount: 0,
          }
        }
        return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
      }

      const registrations = await db
        .select({
          id: competitionRegistrationsTable.id,
          userId: competitionRegistrationsTable.userId,
          divisionId: competitionRegistrationsTable.divisionId,
        })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        )

      const eventIds = targetEvents.map((e) => e.id)
      const allScores =
        eventIds.length > 0
          ? await db
              .select({
                userId: scoresTable.userId,
                competitionEventId: scoresTable.competitionEventId,
              })
              .from(scoresTable)
              .where(
                and(
                  inArray(scoresTable.competitionEventId, eventIds),
                  isNotNull(scoresTable.scoreValue),
                ),
              )
          : []

      const eventScoreMap = new Map<string, Set<string>>()
      for (const score of allScores) {
        if (score.competitionEventId) {
          const existing =
            eventScoreMap.get(score.competitionEventId) ?? new Set()
          existing.add(score.userId)
          eventScoreMap.set(score.competitionEventId, existing)
        }
      }

      const divisionResults = settings?.divisionResults ?? {}

      const eventResponses: EventDivisionResultsStatusResponse[] = []

      for (const event of targetEvents) {
        const eventDivisionResults = divisionResults[event.id] ?? {}
        const scoredUsers = eventScoreMap.get(event.id) ?? new Set()

        const divisionStatuses: DivisionResultStatus[] = divisions.map((d) => {
          const divisionRegCount = registrationCountMap.get(d.id) ?? 0

          let scoredCount = 0
          let missingCount = 0
          for (const reg of registrations) {
            if (reg.divisionId === d.id) {
              if (scoredUsers.has(reg.userId)) {
                scoredCount++
              } else {
                missingCount++
              }
            }
          }

          const publishedInfo = eventDivisionResults[d.id]

          return {
            divisionId: d.id,
            label: d.label,
            position: d.position,
            registrationCount: divisionRegCount,
            scoredCount,
            missingScoreCount: missingCount,
            resultsPublishedAt: publishedInfo?.publishedAt
              ? new Date(publishedInfo.publishedAt)
              : null,
            isPublished: !!publishedInfo?.publishedAt,
          }
        })

        const sortedDivisions = divisionStatuses.sort(
          (a, b) => a.position - b.position,
        )
        const publishedCount = sortedDivisions.filter(
          (d) => d.isPublished,
        ).length

        eventResponses.push({
          eventId: event.id,
          eventName: event.workoutName ?? `Event ${event.trackOrder}`,
          divisions: sortedDivisions,
          publishedCount,
          totalCount: sortedDivisions.length,
        })
      }

      if (data.eventId && eventResponses.length === 1) {
        return eventResponses[0]
      }

      const totalPublished = eventResponses.reduce(
        (sum, e) => sum + e.publishedCount,
        0,
      )
      const totalCombinations = eventResponses.reduce(
        (sum, e) => sum + e.totalCount,
        0,
      )

      return {
        events: eventResponses,
        totalPublishedCount: totalPublished,
        totalCombinations,
      }
    },
  )

/**
 * Publish or unpublish results for a single event+division (cohost)
 */
export const cohostPublishDivisionResultsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostPublishDivisionResultsInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; publishedAt: Date | null }> => {
      await requireCohostPermission(data.competitionTeamId, "results")
      const db = getDb()

      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!competition) {
        throw new Error("Competition not found")
      }

      const settings = parseCompetitionSettings(competition.settings) ?? {}
      const divisionResults: DivisionResultsSchema =
        settings.divisionResults ?? {}
      const publishedAt = data.publish ? Date.now() : null

      if (!divisionResults[data.eventId]) {
        divisionResults[data.eventId] = {}
      }

      divisionResults[data.eventId][data.divisionId] = { publishedAt }

      const newSettings = stringifyCompetitionSettings({
        ...settings,
        divisionResults,
      })

      await db
        .update(competitionsTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(competitionsTable.id, data.competitionId))

      return {
        success: true,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      }
    },
  )

/**
 * Publish or unpublish results for all divisions for a specific event (cohost)
 */
export const cohostPublishAllDivisionResultsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostPublishAllDivisionResultsInputSchema.parse(data),
  )
  .handler(
    async ({ data }): Promise<{ success: boolean; updatedCount: number }> => {
      await requireCohostPermission(data.competitionTeamId, "results")
      const db = getDb()

      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!competition) {
        throw new Error("Competition not found")
      }

      const settings = parseCompetitionSettings(competition.settings) ?? {}
      const scalingGroupId = settings?.divisions?.scalingGroupId

      if (!scalingGroupId) {
        return { success: true, updatedCount: 0 }
      }

      const divisions = await db
        .select({ id: scalingLevelsTable.id })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

      if (divisions.length === 0) {
        return { success: true, updatedCount: 0 }
      }

      const divisionResults: DivisionResultsSchema =
        settings.divisionResults ?? {}
      const publishedAt = data.publish ? Date.now() : null

      if (!divisionResults[data.eventId]) {
        divisionResults[data.eventId] = {}
      }

      for (const division of divisions) {
        divisionResults[data.eventId][division.id] = { publishedAt }
      }

      const newSettings = stringifyCompetitionSettings({
        ...settings,
        divisionResults,
      })

      await db
        .update(competitionsTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(competitionsTable.id, data.competitionId))

      return { success: true, updatedCount: divisions.length }
    },
  )
