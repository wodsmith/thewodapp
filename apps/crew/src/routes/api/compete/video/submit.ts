/**
 * Video Submission API
 *
 * POST /api/compete/video/submit
 * Submit or update a video for an online competition event.
 * Requires bearer or cookie authentication.
 *
 * Body: {
 *   trackWorkoutId: string
 *   competitionId: string
 *   videoUrl: string
 *   notes?: string
 *   score?: string
 *   scoreStatus?: "scored" | "cap"
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
import { createVideoSubmissionId, videoSubmissionsTable } from "@/db/schemas/video-submissions"
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

const submitVideoSchema = z.object({
  trackWorkoutId: z.string().min(1),
  competitionId: z.string().min(1),
  divisionId: z.string().optional(),
  videoUrl: z.string().url().max(2000),
  notes: z.string().max(1000).optional(),
  score: z.string().optional(),
  scoreStatus: z.enum(["scored", "cap"]).optional(),
  secondaryScore: z.string().optional(),
  tiebreakScore: z.string().optional(),
})

async function checkVideoSubmissionWindow(competitionId: string, trackWorkoutId: string) {
  const db = getDb()

  const [competition] = await db
    .select({ competitionType: competitionsTable.competitionType })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) return { allowed: false, reason: "Competition not found" }

  if (competition.competitionType !== "online") {
    return { allowed: false, reason: "Video submissions are only for online competitions" }
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

  if (!event || !event.submissionOpensAt || !event.submissionClosesAt) {
    return { allowed: true }
  }

  const now = new Date()
  if (now < new Date(event.submissionOpensAt)) {
    return { allowed: false, reason: "Submission window has not opened yet" }
  }
  if (now > new Date(event.submissionClosesAt)) {
    return { allowed: false, reason: "Submission window has closed" }
  }

  return { allowed: true }
}

export const Route = createFileRoute("/api/compete/video/submit")({
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

        const parsed = submitVideoSchema.safeParse(body)
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
          // Check registration — scope to the submitted division so partner +
          // individual registrations don't collide when the same workout is
          // shared across divisions.
          const regConditions = [
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            eq(competitionRegistrationsTable.userId, userId),
            ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
          ]
          if (data.divisionId) {
            regConditions.push(
              eq(competitionRegistrationsTable.divisionId, data.divisionId),
            )
          }

          const registrations = await db
            .select({
              id: competitionRegistrationsTable.id,
              divisionId: competitionRegistrationsTable.divisionId,
            })
            .from(competitionRegistrationsTable)
            .where(and(...regConditions))
            .limit(2)

          if (registrations.length > 1) {
            return json(
              {
                error:
                  "You are registered in multiple divisions for this competition. Please specify divisionId.",
              },
              { status: 422, headers },
            )
          }

          const registration = registrations[0]

          if (!registration) {
            return json(
              { error: "You must be registered for this competition to submit a video" },
              { status: 403, headers },
            )
          }

          // Check submission window
          const windowCheck = await checkVideoSubmissionWindow(
            data.competitionId,
            data.trackWorkoutId,
          )
          if (!windowCheck.allowed) {
            return json(
              { error: windowCheck.reason ?? "Cannot submit video at this time" },
              { status: 422, headers },
            )
          }

          // Check for existing submission
          const [existingSubmission] = await db
            .select({ id: videoSubmissionsTable.id })
            .from(videoSubmissionsTable)
            .where(
              and(
                eq(videoSubmissionsTable.registrationId, registration.id),
                eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
              ),
            )
            .limit(1)

          const now = new Date()
          let submissionId: string

          if (existingSubmission) {
            await db
              .update(videoSubmissionsTable)
              .set({ videoUrl: data.videoUrl, notes: data.notes ?? null, submittedAt: now, updatedAt: now })
              .where(eq(videoSubmissionsTable.id, existingSubmission.id))
            submissionId = existingSubmission.id
          } else {
            const id = createVideoSubmissionId()
            await db.insert(videoSubmissionsTable).values({
              id,
              registrationId: registration.id,
              trackWorkoutId: data.trackWorkoutId,
              userId,
              videoUrl: data.videoUrl,
              notes: data.notes ?? null,
              submittedAt: now,
            })
            submissionId = id
          }

          // Save claimed score if provided
          if (data.score) {
            const [workoutRow] = await db
              .select({
                workoutId: workouts.id,
                scheme: workouts.scheme,
                scoreType: workouts.scoreType,
                timeCap: workouts.timeCap,
                tiebreakScheme: workouts.tiebreakScheme,
                trackId: trackWorkoutsTable.trackId,
              })
              .from(trackWorkoutsTable)
              .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
              .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
              .limit(1)

            if (!workoutRow) {
              return json({ error: "Workout not found" }, { status: 404, headers })
            }

            const scheme = workoutRow.scheme as WorkoutScheme
            const scoreType = (workoutRow.scoreType as ScoreType) || getDefaultScoreType(scheme)

            const parseResult = parseScore(data.score, scheme)
            if (!parseResult.isValid) {
              return json(
                { error: `Invalid score format: ${parseResult.error || "Please check your entry"}` },
                { status: 422, headers },
              )
            }

            let encodedValue: number | null = encodeScore(data.score, scheme)
            let status: "scored" | "cap" = data.scoreStatus ?? "scored"
            let secondaryValue: number | null = null

            if (scheme === "time-with-cap" && workoutRow.timeCap && encodedValue !== null) {
              const capMs = workoutRow.timeCap * 1000
              if (encodedValue >= capMs) {
                status = "cap"
                encodedValue = capMs
                if (data.secondaryScore) {
                  const p = Number.parseInt(data.secondaryScore.trim(), 10)
                  if (!Number.isNaN(p) && p >= 0) secondaryValue = p
                }
              }
            } else if (status === "cap" && data.secondaryScore) {
              const p = Number.parseInt(data.secondaryScore.trim(), 10)
              if (!Number.isNaN(p) && p >= 0) secondaryValue = p
            }

            let tiebreakValue: number | null = null
            if (data.tiebreakScore && workoutRow.tiebreakScheme) {
              tiebreakValue = encodeScore(data.tiebreakScore, workoutRow.tiebreakScheme as WorkoutScheme)
            }

            const timeCapMs = workoutRow.timeCap ? workoutRow.timeCap * 1000 : null

            const sortKey =
              encodedValue !== null
                ? computeSortKey({
                    value: encodedValue,
                    status,
                    scheme,
                    scoreType,
                    timeCap:
                      status === "cap" && secondaryValue !== null
                        ? { ms: timeCapMs ?? 0, secondaryValue }
                        : undefined,
                    tiebreak:
                      tiebreakValue !== null && workoutRow.tiebreakScheme
                        ? { scheme: workoutRow.tiebreakScheme as "time" | "reps", value: tiebreakValue }
                        : undefined,
                  })
                : null

            const [track] = await db
              .select({ ownerTeamId: programmingTracksTable.ownerTeamId })
              .from(programmingTracksTable)
              .where(eq(programmingTracksTable.id, workoutRow.trackId))
              .limit(1)

            if (!track?.ownerTeamId) {
              return json({ error: "Could not determine team ownership" }, { status: 500, headers })
            }

            const statusOrder = status === "cap" ? STATUS_ORDER.cap : STATUS_ORDER.scored

            await db
              .insert(scoresTable)
              .values({
                userId,
                teamId: track.ownerTeamId,
                workoutId: workoutRow.workoutId,
                competitionEventId: data.trackWorkoutId,
                scheme,
                scoreType,
                scoreValue: encodedValue,
                status,
                statusOrder,
                sortKey: sortKey ? sortKeyToString(sortKey) : null,
                tiebreakScheme: (workoutRow.tiebreakScheme as TiebreakScheme) ?? null,
                tiebreakValue,
                timeCapMs,
                secondaryValue,
                scalingLevelId: registration.divisionId,
                asRx: true,
                recordedAt: now,
              })
              .onDuplicateKeyUpdate({
                set: {
                  scoreValue: encodedValue,
                  status,
                  statusOrder,
                  sortKey: sortKey ? sortKeyToString(sortKey) : null,
                  tiebreakScheme: (workoutRow.tiebreakScheme as TiebreakScheme) ?? null,
                  tiebreakValue,
                  timeCapMs,
                  secondaryValue,
                  scalingLevelId: registration.divisionId,
                  updatedAt: now,
                },
              })
          }

          return json(
            { success: true, submissionId, isUpdate: !!existingSubmission },
            { headers },
          )
        } catch (err) {
          console.error("[API] /api/compete/video/submit error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
