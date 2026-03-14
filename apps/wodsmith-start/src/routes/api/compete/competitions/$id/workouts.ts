/**
 * Competition Published Workouts API
 *
 * GET /api/compete/competitions/:id/workouts
 * Returns published workouts for a competition with sponsor info.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { programmingTracksTable, trackWorkoutsTable } from "@/db/schemas/programming"
import { sponsorsTable } from "@/db/schemas/sponsors"
import {
  movements,
  workouts,
  workoutMovements,
  workoutTags,
  tags,
} from "@/db/schemas/workouts"
import { corsHeaders } from "@/utils/bearer-auth"

export const Route = createFileRoute("/api/compete/competitions/$id/workouts")({
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

          const track = await db.query.programmingTracksTable.findFirst({
            where: eq(programmingTracksTable.competitionId, competitionId),
          })

          if (!track) {
            return json({ workouts: [] }, { headers })
          }

          const trackWorkoutRows = await db
            .select({
              id: trackWorkoutsTable.id,
              trackId: trackWorkoutsTable.trackId,
              workoutId: trackWorkoutsTable.workoutId,
              trackOrder: trackWorkoutsTable.trackOrder,
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
              sponsorName: sponsorsTable.name,
              sponsorLogoUrl: sponsorsTable.logoUrl,
            })
            .from(trackWorkoutsTable)
            .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
            .leftJoin(
              sponsorsTable,
              eq(trackWorkoutsTable.sponsorId, sponsorsTable.id),
            )
            .where(
              and(
                eq(trackWorkoutsTable.trackId, track.id),
                eq(trackWorkoutsTable.eventStatus, "published"),
              ),
            )
            .orderBy(trackWorkoutsTable.trackOrder)

          if (trackWorkoutRows.length === 0) {
            return json({ workouts: [] }, { headers })
          }

          const workoutIds = trackWorkoutRows.map((tw) => tw.workoutId)

          const allMovements = await db
            .select({
              workoutId: workoutMovements.workoutId,
              movementId: movements.id,
              movementName: movements.name,
            })
            .from(workoutMovements)
            .innerJoin(movements, eq(workoutMovements.movementId, movements.id))
            .where(inArray(workoutMovements.workoutId, workoutIds))

          const allTags = await db
            .select({
              workoutId: workoutTags.workoutId,
              tagId: tags.id,
              tagName: tags.name,
            })
            .from(workoutTags)
            .innerJoin(tags, eq(workoutTags.tagId, tags.id))
            .where(inArray(workoutTags.workoutId, workoutIds))

          const movementsByWorkout = new Map<string, Array<{ id: string; name: string }>>()
          for (const m of allMovements) {
            if (!m.workoutId) continue
            const list = movementsByWorkout.get(m.workoutId) ?? []
            list.push({ id: m.movementId, name: m.movementName })
            movementsByWorkout.set(m.workoutId, list)
          }

          const tagsByWorkout = new Map<string, Array<{ id: string; name: string }>>()
          for (const t of allTags) {
            if (!t.workoutId) continue
            const list = tagsByWorkout.get(t.workoutId) ?? []
            list.push({ id: t.tagId, name: t.tagName })
            tagsByWorkout.set(t.workoutId, list)
          }

          const enrichedWorkouts = trackWorkoutRows.map((tw) => ({
            id: tw.id,
            trackId: tw.trackId,
            workoutId: tw.workoutId,
            trackOrder: tw.trackOrder,
            notes: tw.notes,
            pointsMultiplier: tw.pointsMultiplier,
            heatStatus: tw.heatStatus,
            eventStatus: tw.eventStatus,
            sponsorId: tw.sponsorId,
            createdAt: tw.createdAt,
            updatedAt: tw.updatedAt,
            workout: {
              ...tw.workout,
              movements: movementsByWorkout.get(tw.workoutId) ?? [],
              tags: tagsByWorkout.get(tw.workoutId) ?? [],
            },
            sponsorName: tw.sponsorName ?? null,
            sponsorLogoUrl: tw.sponsorLogoUrl ?? null,
          }))

          return json({ workouts: enrichedWorkouts }, { headers })
        } catch (err) {
          console.error("[API] /api/compete/competitions/:id/workouts error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
