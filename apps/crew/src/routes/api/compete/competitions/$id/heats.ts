/**
 * Competition Heats Schedule API
 *
 * GET /api/compete/competitions/:id/heats
 * Returns published heat schedule grouped by event.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import { getDb } from "@/db"
import {
  competitionHeatsTable,
  competitionVenuesTable,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { workouts } from "@/db/schemas/workouts"
import { corsHeaders } from "@/utils/bearer-auth"

export const Route = createFileRoute("/api/compete/competitions/$id/heats")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("Origin")
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        })
      },

      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const origin = request.headers.get("Origin")
        const headers = corsHeaders(origin)

        try {
          const db = getDb()
          const { id: competitionId } = params

          const heats = await db
            .select()
            .from(competitionHeatsTable)
            .where(
              and(
                eq(competitionHeatsTable.competitionId, competitionId),
                isNotNull(competitionHeatsTable.schedulePublishedAt),
              ),
            )
            .orderBy(
              asc(competitionHeatsTable.scheduledTime),
              asc(competitionHeatsTable.heatNumber),
            )

          if (heats.length === 0) {
            return json({ events: [] }, { headers })
          }

          const venueIds = [
            ...new Set(
              heats
                .map((h) => h.venueId)
                .filter((id): id is string => id !== null),
            ),
          ]
          const divisionIds = [
            ...new Set(
              heats
                .map((h) => h.divisionId)
                .filter((id): id is string => id !== null),
            ),
          ]
          const trackWorkoutIds = [...new Set(heats.map((h) => h.trackWorkoutId))]

          const venues =
            venueIds.length > 0
              ? await db
                  .select({ id: competitionVenuesTable.id, name: competitionVenuesTable.name })
                  .from(competitionVenuesTable)
                  .where(inArray(competitionVenuesTable.id, venueIds))
              : []

          const divisions =
            divisionIds.length > 0
              ? await db
                  .select({ id: scalingLevelsTable.id, label: scalingLevelsTable.label })
                  .from(scalingLevelsTable)
                  .where(inArray(scalingLevelsTable.id, divisionIds))
              : []

          const trackWorkoutRows = await db
            .select({
              id: trackWorkoutsTable.id,
              workoutId: trackWorkoutsTable.workoutId,
              trackOrder: trackWorkoutsTable.trackOrder,
              workoutName: workouts.name,
            })
            .from(trackWorkoutsTable)
            .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
            .where(inArray(trackWorkoutsTable.id, trackWorkoutIds))

          const venueMap = new Map(venues.map((v) => [v.id, v]))
          const divisionMap = new Map(divisions.map((d) => [d.id, d]))
          const trackWorkoutMap = new Map(trackWorkoutRows.map((tw) => [tw.id, tw]))

          type EventGroup = {
            trackWorkoutId: string
            eventName: string
            trackOrder: number
            heats: Array<{
              id: string
              heatNumber: number
              scheduledTime: Date | null
              durationMinutes: number | null
              venue: { id: string; name: string } | null
              division: { id: string; label: string } | null
            }>
          }

          const eventMap = new Map<string, EventGroup>()

          for (const heat of heats) {
            const tw = trackWorkoutMap.get(heat.trackWorkoutId)
            if (!tw) continue

            let event = eventMap.get(heat.trackWorkoutId)
            if (!event) {
              event = {
                trackWorkoutId: heat.trackWorkoutId,
                eventName: tw.workoutName,
                trackOrder: tw.trackOrder,
                heats: [],
              }
              eventMap.set(heat.trackWorkoutId, event)
            }

            event.heats.push({
              id: heat.id,
              heatNumber: heat.heatNumber,
              scheduledTime: heat.scheduledTime,
              durationMinutes: heat.durationMinutes,
              venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
              division: heat.divisionId ? (divisionMap.get(heat.divisionId) ?? null) : null,
            })
          }

          const events = Array.from(eventMap.values()).sort(
            (a, b) => a.trackOrder - b.trackOrder,
          )

          return json({ events }, { headers })
        } catch (err) {
          console.error("[API] /api/compete/competitions/:id/heats error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
