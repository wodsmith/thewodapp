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
import { programmingTracksTable, trackWorkoutsTable } from "@/db/schemas/programming"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import {
  SCORE_STATUS_VALUES,
  type ScoreStatus,
  type ScoreType,
  type TiebreakScheme,
  type WorkoutScheme,
  workouts,
} from "@/db/schemas/workouts"
import {
  computeSortKey,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  type WorkoutScheme as ScoringWorkoutScheme,
  STATUS_ORDER,
  sortKeyToString,
} from "@/lib/scoring"
import { corsHeaders, getSessionFromBearerOrCookie } from "@/utils/bearer-auth"

const roundScoreSchema = z.object({
  score: z.string(),
  parts: z.tuple([z.string(), z.string()]).optional(),
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

function mapToNewStatus(status: ScoreStatus): "scored" | "cap" | "dq" | "withdrawn" {
  switch (status) {
    case "scored": return "scored"
    case "cap": return "cap"
    case "dq": return "dq"
    case "withdrawn":
    case "dns":
    case "dnf": return "withdrawn"
    default: return "scored"
  }
}

function getStatusOrder(status: ScoreStatus): number {
  switch (status) {
    case "scored": return STATUS_ORDER.scored
    case "cap": return STATUS_ORDER.cap
    case "dq": return STATUS_ORDER.dq
    case "withdrawn":
    case "dns":
    case "dnf": return STATUS_ORDER.withdrawn
    default: return STATUS_ORDER.scored
  }
}

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

        const parsed = judgeScoreSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400, headers },
          )
        }

        const data = parsed.data

        // Check organizer team membership from parsed data
        const isTeamMember = session.teams?.some((t) => t.id === data.organizingTeamId)
        const isSiteAdmin = session.user?.role === "admin"

        if (!isTeamMember && !isSiteAdmin) {
          return json({ error: "Not authorized for this team" }, { status: 403, headers })
        }

        const db = getDb()

        try {
          // Get workout info if not provided
          let workoutInfo = data.workout
          if (!workoutInfo) {
            const [workoutRow] = await db
              .select({
                scheme: workouts.scheme,
                scoreType: workouts.scoreType,
                tiebreakScheme: workouts.tiebreakScheme,
                timeCap: workouts.timeCap,
                repsPerRound: workouts.repsPerRound,
                roundsToScore: workouts.roundsToScore,
              })
              .from(workouts)
              .where(eq(workouts.id, data.workoutId))
              .limit(1)

            if (!workoutRow) {
              return json({ error: "Workout not found" }, { status: 404, headers })
            }
            workoutInfo = workoutRow
          }

          // Check submission window
          const [competition] = await db
            .select({ competitionType: competitionsTable.competitionType })
            .from(competitionsTable)
            .where(eq(competitionsTable.id, data.competitionId))
            .limit(1)

          if (competition?.competitionType === "online") {
            const [event] = await db
              .select({
                submissionOpensAt: competitionEventsTable.submissionOpensAt,
                submissionClosesAt: competitionEventsTable.submissionClosesAt,
              })
              .from(competitionEventsTable)
              .where(
                and(
                  eq(competitionEventsTable.competitionId, data.competitionId),
                  eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
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

          const scheme = workoutInfo.scheme as ScoringWorkoutScheme
          const scoreType = (workoutInfo.scoreType as ScoreType) || getDefaultScoreType(scheme)
          const workoutTiebreakScheme = (workoutInfo.tiebreakScheme as TiebreakScheme) ?? null

          let encodedValue: number | null = null

          if (data.roundScores && data.roundScores.length > 0) {
            const roundInputs = data.roundScores.map((rs) => ({ raw: rs.score }))
            const result = encodeRounds(roundInputs, scheme, scoreType)
            encodedValue = result.aggregated
          } else if (data.score?.trim()) {
            encodedValue = encodeScore(data.score, scheme)
          }

          const newStatus = mapToNewStatus(data.scoreStatus)

          if (newStatus === "cap" && scheme === "time-with-cap" && workoutInfo.timeCap) {
            encodedValue = workoutInfo.timeCap * 1000
          }

          let secondaryValue: number | null = null
          if (data.secondaryScore && newStatus === "cap") {
            const p = Number.parseInt(data.secondaryScore.trim(), 10)
            if (!Number.isNaN(p) && p >= 0) secondaryValue = p
          }

          let tiebreakValue: number | null = null
          if (data.tieBreakScore && workoutInfo.tiebreakScheme) {
            try {
              tiebreakValue = encodeScore(data.tieBreakScore, workoutInfo.tiebreakScheme as ScoringWorkoutScheme)
            } catch {
              // ignore tiebreak encoding errors
            }
          }

          const timeCapMs = workoutInfo.timeCap ? workoutInfo.timeCap * 1000 : null

          const sortKey =
            encodedValue !== null
              ? computeSortKey({
                  value: encodedValue,
                  status: newStatus,
                  scheme,
                  scoreType,
                  timeCap:
                    newStatus === "cap" && timeCapMs && secondaryValue !== null
                      ? { ms: timeCapMs, secondaryValue }
                      : undefined,
                  tiebreak:
                    tiebreakValue !== null && workoutInfo.tiebreakScheme
                      ? { scheme: workoutInfo.tiebreakScheme as "time" | "reps", value: tiebreakValue }
                      : undefined,
                })
              : null

          const scoreId = await db.transaction(async (tx) => {
            await tx
              .insert(scoresTable)
              .values({
                userId: data.userId,
                teamId: data.organizingTeamId,
                workoutId: data.workoutId,
                competitionEventId: data.trackWorkoutId,
                scheme,
                scoreType,
                scoreValue: encodedValue,
                status: newStatus,
                statusOrder: getStatusOrder(data.scoreStatus),
                sortKey: sortKey ? sortKeyToString(sortKey) : null,
                tiebreakScheme: workoutTiebreakScheme,
                tiebreakValue,
                timeCapMs,
                secondaryValue,
                scalingLevelId: data.divisionId,
                asRx: true,
                recordedAt: new Date(),
              })
              .onDuplicateKeyUpdate({
                set: {
                  scoreValue: encodedValue,
                  status: newStatus,
                  statusOrder: getStatusOrder(data.scoreStatus),
                  sortKey: sortKey ? sortKeyToString(sortKey) : null,
                  tiebreakScheme: workoutTiebreakScheme,
                  tiebreakValue,
                  timeCapMs,
                  secondaryValue,
                  scalingLevelId: data.divisionId,
                  updatedAt: new Date(),
                },
              })

            const [finalScore] = await tx
              .select({ id: scoresTable.id })
              .from(scoresTable)
              .where(
                and(
                  eq(scoresTable.competitionEventId, data.trackWorkoutId),
                  eq(scoresTable.userId, data.userId),
                ),
              )
              .limit(1)

            if (!finalScore) throw new Error("Failed to retrieve score after upsert")

            const id = finalScore.id

            if (data.roundScores && data.roundScores.length > 0) {
              await tx.delete(scoreRoundsTable).where(eq(scoreRoundsTable.scoreId, id))

              const roundsToInsert = data.roundScores.map((round, index) => {
                let roundValue: number

                if (scheme === "rounds-reps") {
                  const roundsNum = Number.parseInt(round.parts?.[0] ?? round.score, 10) || 0
                  const reps = Number.parseInt(round.parts?.[1] ?? "0", 10) || 0
                  roundValue = roundsNum * 100000 + reps
                } else {
                  roundValue = encodeScore(round.score, scheme) ?? 0
                }

                return { scoreId: id, roundNumber: index + 1, value: roundValue, status: null }
              })

              await tx.insert(scoreRoundsTable).values(roundsToInsert)
            }

            return id
          })

          return json({ success: true, data: { resultId: scoreId, isNew: true } }, { headers })
        } catch (err) {
          console.error("[API] /api/compete/scores/judge error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
