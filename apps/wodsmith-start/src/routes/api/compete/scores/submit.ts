/**
 * Athlete Score Submit API
 *
 * POST /api/compete/scores/submit
 * Submit or update the authenticated athlete's score for a competition event.
 * Requires bearer or cookie authentication.
 *
 * Body: {
 *   competitionId: string
 *   trackWorkoutId: string
 *   score: string
 *   status: "scored" | "cap"
 *   secondaryScore?: string
 *   tiebreakScore?: string
 * }
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { programmingTracksTable, trackWorkoutsTable } from "@/db/schemas/programming"
import { scoresTable } from "@/db/schemas/scores"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import { workouts } from "@/db/schemas/workouts"
import {
  computeSortKey,
  encodeScore,
  getDefaultScoreType,
  parseScore,
  type ScoreType,
  STATUS_ORDER,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import { corsHeaders, getSessionFromBearerOrCookie } from "@/utils/bearer-auth"

const submitScoreSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  score: z.string().min(1, "Score is required"),
  status: z.enum(["scored", "cap"]),
  secondaryScore: z.string().optional(),
  tiebreakScore: z.string().optional(),
})

async function checkSubmissionWindow(competitionId: string, trackWorkoutId: string) {
  const db = getDb()

  const [competition] = await db
    .select({ competitionType: competitionsTable.competitionType })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition || competition.competitionType !== "online") {
    return { isOpen: false, reason: "Not an online competition" }
  }

  const [event] = await db
    .select({
      submissionOpensAt: competitionEventsTable.submissionOpensAt,
      submissionClosesAt: competitionEventsTable.submissionClosesAt,
    })
    .from(competitionEventsTable)
    .where(
      and(
        eq(competitionEventsTable.competitionId, competitionId),
        eq(competitionEventsTable.trackWorkoutId, trackWorkoutId),
      ),
    )
    .limit(1)

  if (!event?.submissionOpensAt || !event?.submissionClosesAt) {
    return { isOpen: false, reason: "Submission window not configured" }
  }

  const now = new Date()
  if (now < new Date(event.submissionOpensAt)) {
    return { isOpen: false, reason: "Submission window has not opened yet" }
  }
  if (now > new Date(event.submissionClosesAt)) {
    return { isOpen: false, reason: "Submission window has closed" }
  }

  return { isOpen: true, reason: undefined }
}

export const Route = createFileRoute("/api/compete/scores/submit")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("Origin")
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        })
      },

      POST: async ({ request }: { request: Request }) => {
        const origin = request.headers.get("Origin")
        const headers = { "Content-Type": "application/json", ...corsHeaders(origin) }

        const session = await getSessionFromBearerOrCookie(request)
        if (!session?.userId) {
          return json({ error: "Unauthorized" }, { status: 401, headers })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ error: "Invalid JSON body" }, { status: 400, headers })
        }

        const parsed = submitScoreSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400, headers },
          )
        }

        const data = parsed.data
        const db = getDb()
        const userId = session.userId

        try {
          // Check registration
          const [registration] = await db
            .select({
              id: competitionRegistrationsTable.id,
              divisionId: competitionRegistrationsTable.divisionId,
            })
            .from(competitionRegistrationsTable)
            .where(
              and(
                eq(competitionRegistrationsTable.eventId, data.competitionId),
                eq(competitionRegistrationsTable.userId, userId),
                ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
              ),
            )
            .limit(1)

          if (!registration) {
            return json(
              { error: "You are not registered for this competition" },
              { status: 403, headers },
            )
          }

          // Check submission window
          const windowStatus = await checkSubmissionWindow(
            data.competitionId,
            data.trackWorkoutId,
          )

          if (!windowStatus.isOpen) {
            return json(
              { error: windowStatus.reason ?? "Submission window is not open" },
              { status: 422, headers },
            )
          }

          // Get track workout info
          const [trackWorkout] = await db
            .select({ workoutId: trackWorkoutsTable.workoutId, trackId: trackWorkoutsTable.trackId })
            .from(trackWorkoutsTable)
            .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
            .limit(1)

          if (!trackWorkout) {
            return json({ error: "Event not found" }, { status: 404, headers })
          }

          const [workout] = await db
            .select({
              scheme: workouts.scheme,
              scoreType: workouts.scoreType,
              tiebreakScheme: workouts.tiebreakScheme,
              timeCap: workouts.timeCap,
            })
            .from(workouts)
            .where(eq(workouts.id, trackWorkout.workoutId))
            .limit(1)

          if (!workout) {
            return json({ error: "Workout not found" }, { status: 404, headers })
          }

          const scheme = workout.scheme as WorkoutScheme
          const scoreType = (workout.scoreType as ScoreType) || getDefaultScoreType(scheme)

          // Validate score
          const parseResult = parseScore(data.score, scheme)
          if (!parseResult.isValid) {
            return json(
              { error: `Invalid score format: ${parseResult.error || "Please check your entry"}` },
              { status: 422, headers },
            )
          }

          let encodedValue: number | null = encodeScore(data.score, scheme)

          if (data.status === "cap" && scheme === "time-with-cap" && workout.timeCap) {
            encodedValue = workout.timeCap * 1000
          }

          let secondaryValue: number | null = null
          if (data.secondaryScore && data.status === "cap") {
            const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
            if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
          }

          let tiebreakValue: number | null = null
          if (data.tiebreakScore && workout.tiebreakScheme) {
            tiebreakValue = encodeScore(data.tiebreakScore, workout.tiebreakScheme as WorkoutScheme)
          }

          const timeCapMs = workout.timeCap ? workout.timeCap * 1000 : null

          const sortKey =
            encodedValue !== null
              ? computeSortKey({ value: encodedValue, status: data.status, scheme, scoreType })
              : null

          // Get team from track
          const [track] = await db
            .select({ ownerTeamId: programmingTracksTable.ownerTeamId })
            .from(programmingTracksTable)
            .where(eq(programmingTracksTable.id, trackWorkout.trackId))
            .limit(1)

          if (!track?.ownerTeamId) {
            return json({ error: "Could not determine team ownership" }, { status: 500, headers })
          }

          const statusOrder = data.status === "cap" ? STATUS_ORDER.cap : STATUS_ORDER.scored

          await db
            .insert(scoresTable)
            .values({
              userId,
              teamId: track.ownerTeamId,
              workoutId: trackWorkout.workoutId,
              competitionEventId: data.trackWorkoutId,
              scheme,
              scoreType,
              scoreValue: encodedValue,
              status: data.status,
              statusOrder,
              sortKey: sortKey ? sortKeyToString(sortKey) : null,
              tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
              tiebreakValue,
              timeCapMs,
              secondaryValue,
              scalingLevelId: registration.divisionId,
              asRx: true,
              recordedAt: new Date(),
            })
            .onDuplicateKeyUpdate({
              set: {
                scoreValue: encodedValue,
                status: data.status,
                statusOrder,
                sortKey: sortKey ? sortKeyToString(sortKey) : null,
                tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
                tiebreakValue,
                timeCapMs,
                secondaryValue,
                scalingLevelId: registration.divisionId,
                updatedAt: new Date(),
              },
            })

          const [finalScore] = await db
            .select({ id: scoresTable.id })
            .from(scoresTable)
            .where(
              and(
                eq(scoresTable.competitionEventId, data.trackWorkoutId),
                eq(scoresTable.userId, userId),
              ),
            )
            .limit(1)

          if (!finalScore) {
            return json({ error: "Failed to save score" }, { status: 500, headers })
          }

          return json(
            { success: true, scoreId: finalScore.id, message: "Score submitted successfully" },
            { headers },
          )
        } catch (err) {
          console.error("[API] /api/compete/scores/submit error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
