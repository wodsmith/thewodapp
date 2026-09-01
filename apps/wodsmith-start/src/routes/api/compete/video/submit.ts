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
import {
  createVideoSubmissionId,
  videoSubmissionsTable,
} from "@/db/schemas/video-submissions"
import { competitionCan } from "@/lib/competitions/capabilities"
import { isBenchmarkCompetition } from "@/server/benchmark-submissions"
import {
  CompetitionResultError,
  divisionScopeFromId,
  recordCompetitionResult,
} from "@/server/competition-results"
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

async function checkVideoSubmissionWindow(
  competitionId: string,
  trackWorkoutId: string,
) {
  const db = getDb()

  const [competition] = await db
    .select({
      competitionType: competitionsTable.competitionType,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) return { allowed: false, reason: "Competition not found" }

  if (!competitionCan(competition.competitionType, "videoSubmissions")) {
    return {
      allowed: false,
      reason: "Video submissions are only for online competitions",
    }
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
        const headers = {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        }

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
          if (await isBenchmarkCompetition(data.competitionId)) {
            return json(
              {
                error:
                  "Benchmark submissions must use the benchmark submission flow",
              },
              { status: 422, headers },
            )
          }

          // Check registration — scope to the submitted division so partner +
          // individual registrations don't collide when the same workout is
          // shared across divisions.
          const regConditions = [
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            eq(competitionRegistrationsTable.userId, userId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
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
              {
                error:
                  "You must be registered for this competition to submit a video",
              },
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
              {
                error: windowCheck.reason ?? "Cannot submit video at this time",
              },
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
              .set({
                videoUrl: data.videoUrl,
                notes: data.notes ?? null,
                submittedAt: now,
                updatedAt: now,
              })
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
            try {
              await recordCompetitionResult({
                db,
                command: {
                  type: "record",
                  source: "video-submission",
                  actorUserId: userId,
                  athleteUserId: userId,
                  trackWorkoutId: data.trackWorkoutId,
                  divisionScope: divisionScopeFromId(registration.divisionId),
                  recordedAt: now,
                  claim: {
                    score: data.score,
                    status: data.scoreStatus ?? "scored",
                    secondaryScore: data.secondaryScore,
                    tiebreakScore: data.tiebreakScore,
                  },
                },
              })
            } catch (error) {
              if (!(error instanceof CompetitionResultError)) throw error
              return json(
                { error: error.message },
                {
                  status:
                    error.code === "programmed_workout_not_found" ? 404 : 422,
                  headers,
                },
              )
            }
          }

          return json(
            { success: true, submissionId, isUpdate: !!existingSubmission },
            { headers },
          )
        } catch (err) {
          console.error("[API] /api/compete/video/submit error:", err)
          return json(
            { error: "Internal server error" },
            { status: 500, headers },
          )
        }
      },
    },
  },
})
