/**
 * Judge/Organizer Score Entry API
 *
 * POST /api/compete/scores/judge
 * Save a score for any athlete in a competition.
 * Requires bearer or cookie authentication + organizer team membership.
 *
 * Body: {
 *   competitionId: string
 *   organizingTeamId: string
 *   trackWorkoutId: string
 *   workoutId: string
 *   registrationId: string
 *   userId: string           - the athlete's userId
 *   divisionId: string | null
 *   score: string
 *   scoreStatus: "scored" | "cap" | "dq" | "dns" | "dnf" | "withdrawn"
 *   tieBreakScore?: string | null
 *   secondaryScore?: string | null
 *   roundScores?: Array<{ score: string; parts?: [string, string] }>
 *   workout?: { scheme: string; scoreType: string|null; repsPerRound: number|null; roundsToScore: number|null; timeCap: number|null; tiebreakScheme?: string|null }
 * }
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionsTable,
} from "@/db/schemas/competitions"

import { SCORE_STATUS_VALUES } from "@/db/schemas/workouts"
import { competitionCan } from "@/lib/competitions/capabilities"
import {
  CompetitionResultError,
  divisionScopeFromId,
  recordCompetitionResult,
} from "@/server/competition-results"
import { corsHeaders, getSessionFromBearerOrCookie } from "@/utils/bearer-auth"

const roundScoreSchema = z.object({
  score: z.string(),
  parts: z.tuple([z.string(), z.string()]).optional(),
  status: z.enum(["scored", "cap"]).optional(),
  secondaryScore: z.string().nullable().optional(),
})

const workoutInfoSchema = z.object({
  scheme: z.string(),
  scoreType: z.string().nullable(),
  repsPerRound: z.number().nullable(),
  roundsToScore: z.number().nullable(),
  timeCap: z.number().nullable(),
  tiebreakScheme: z.string().nullable().optional(),
})

const judgeScoreSchema = z.object({
  competitionId: z.string().min(1),
  organizingTeamId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  workoutId: z.string().min(1),
  registrationId: z.string().min(1),
  userId: z.string().min(1),
  divisionId: z.string().nullable(),
  score: z.string(),
  scoreStatus: z.enum(SCORE_STATUS_VALUES),
  tieBreakScore: z.string().nullable().optional(),
  secondaryScore: z.string().nullable().optional(),
  roundScores: z.array(roundScoreSchema).optional(),
  workout: workoutInfoSchema.optional(),
})

export const Route = createFileRoute("/api/compete/scores/judge")({
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

        const parsed = judgeScoreSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400, headers },
          )
        }

        const data = parsed.data

        // Check organizer team membership from parsed data
        const isTeamMember = session.teams?.some(
          (t) => t.id === data.organizingTeamId,
        )
        const isSiteAdmin = session.user?.role === "admin"

        if (!isTeamMember && !isSiteAdmin) {
          return json(
            { error: "Not authorized for this team" },
            { status: 403, headers },
          )
        }

        const db = getDb()

        try {
          // Check submission window
          const [competition] = await db
            .select({ competitionType: competitionsTable.competitionType })
            .from(competitionsTable)
            .where(eq(competitionsTable.id, data.competitionId))
            .limit(1)

          if (
            competition &&
            competitionCan(competition.competitionType, "submissionWindows")
          ) {
            const [event] = await db
              .select({
                submissionOpensAt: competitionEventsTable.submissionOpensAt,
                submissionClosesAt: competitionEventsTable.submissionClosesAt,
              })
              .from(competitionEventsTable)
              .where(
                and(
                  eq(competitionEventsTable.competitionId, data.competitionId),
                  eq(
                    competitionEventsTable.trackWorkoutId,
                    data.trackWorkoutId,
                  ),
                ),
              )
              .limit(1)

            if (event?.submissionOpensAt && event?.submissionClosesAt) {
              const now = new Date()
              if (now > new Date(event.submissionClosesAt)) {
                return json(
                  { error: "Score submission not allowed at this time" },
                  { status: 422, headers },
                )
              }
            }
          }

          let receipt: { scoreId: string; isNew: boolean }
          try {
            receipt = await recordCompetitionResult({
              db,
              command: {
                type: "record",
                source: "judge-entry",
                actorUserId: session.userId,
                athleteUserId: data.userId,
                trackWorkoutId: data.trackWorkoutId,
                divisionScope: divisionScopeFromId(data.divisionId),
                expectedWorkoutId: data.workoutId,
                expectedOwnerTeamId: data.organizingTeamId,
                claim: {
                  score: data.score,
                  status: data.scoreStatus,
                  tiebreakScore: data.tieBreakScore,
                  secondaryScore: data.secondaryScore,
                  roundScores: data.roundScores,
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

          return json(
            {
              success: true,
              data: { resultId: receipt.scoreId, isNew: receipt.isNew },
            },
            { headers },
          )
        } catch (err) {
          console.error("[API] /api/compete/scores/judge error:", err)
          return json(
            { error: "Internal server error" },
            { status: 500, headers },
          )
        }
      },
    },
  },
})
