/**
 * Submission Verification Server Functions
 *
 * Server functions for organizers to view and verify athlete video submissions
 * for online competition events.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import {
  scoreRoundsTable,
  scoresTable,
  scoreVerificationLogsTable,
} from "@/db/schemas/scores"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import { workouts } from "@/db/schemas/workouts"
import { getEvlog } from "@/lib/evlog"
import { logInfo } from "@/lib/logging"
import {
  computeSortKey,
  decodeScore,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  type ScoreType,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireSubmissionReviewAccess } from "@/utils/team-auth"

// ============================================================================
// Helpers
// ============================================================================

/**
 * Verify a track workout belongs to a competition.
 * First checks `competition_events` (events with submission windows configured).
 * Falls back to `track_workouts` → `programming_tracks` for sub-events or
 * events without submission windows.
 */
async function verifyEventBelongsToCompetition(
  db: ReturnType<typeof getDb>,
  competitionId: string,
  trackWorkoutId: string,
): Promise<{
  submissionOpensAt: string | null
  submissionClosesAt: string | null
}> {
  // Try competition_events first (has submission window data)
  const [competitionEvent] = await db
    .select({
      id: competitionEventsTable.id,
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

  if (competitionEvent) {
    return {
      submissionOpensAt: competitionEvent.submissionOpensAt,
      submissionClosesAt: competitionEvent.submissionClosesAt,
    }
  }

  // Fall back: verify via track_workouts → programming_tracks → competitions
  const [trackEvent] = await db
    .select({ id: trackWorkoutsTable.id })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .where(
      and(
        eq(trackWorkoutsTable.id, trackWorkoutId),
        eq(programmingTracksTable.competitionId, competitionId),
      ),
    )
    .limit(1)

  if (!trackEvent) {
    throw new Error("Event not found in this competition")
  }

  return { submissionOpensAt: null, submissionClosesAt: null }
}

// ============================================================================
// Types
// ============================================================================

export interface VerificationInfo {
  status: "verified" | "adjusted" | "invalid" | null
  verifiedAt: Date | null
  verifiedByName: string | null
  penaltyType: "minor" | "major" | null
  penaltyPercentage: number | null
  noRepCount: number | null
}

export interface SubmissionDetail {
  id: string
  athlete: {
    userId: string
    firstName: string
    lastName: string
    email: string
    avatar: string | null
    divisionId: string | null
    divisionLabel: string
    teamName: string | null
    registrationId: string
  }
  score: {
    displayValue: string
    rawValue: number | null
    status: string
    tiebreakValue: string | null
    secondaryValue: number | null
  }
  verification: VerificationInfo
  videoUrl: string | null
  submittedAt: Date
  notes: string | null
}

export interface EventDetails {
  id: string
  trackOrder: number
  workout: {
    id: string
    name: string
    description: string
    scheme: string
    scoreType: string | null
    timeCap: number | null
    roundsToScore: number | null
    repsPerRound: number | null
    tiebreakScheme: string | null
  }
  submissionWindow: {
    opensAt: string | null
    closesAt: string | null
  }
}

export interface SubmissionListItem {
  id: string
  athleteName: string
  teamName: string | null
  divisionLabel: string
  hasVideo: boolean
  scoreDisplay: string
  status: string
}

// ============================================================================
// Input Schemas
// ============================================================================

const getSubmissionDetailInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  scoreId: z.string().min(1),
})

const getEventSubmissionsInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
})

const getEventDetailsForVerificationInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
})

const getVerificationLogsInputSchema = z.object({
  scoreId: z.string().min(1),
  competitionId: z.string().min(1),
})

export interface VerificationLogEntry {
  id: string
  action: string
  performedByName: string
  performedAt: Date
  originalScoreValue: number | null
  originalStatus: string | null
  newScoreValue: number | null
  newStatus: string | null
  scheme: string | null
  penaltyType: string | null
  penaltyPercentage: number | null
  noRepCount: number | null
}

const verifySubmissionScoreInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  scoreId: z.string().min(1),
  action: z.enum(["verify", "adjust", "invalid"]),
  // Required only when action === "adjust"
  adjustedScore: z.string().optional(),
  adjustedRoundScores: z
    .array(
      z.object({
        roundNumber: z.number().int().min(1),
        score: z.string().min(1),
      }),
    )
    .optional(),
  adjustedScoreStatus: z.enum(["scored", "cap"]).optional(),
  secondaryScore: z.string().optional(),
  tieBreakScore: z.string().optional(),
  reviewerNotes: z.string().optional(),
  // Penalty fields (for "adjust" action with penalty)
  penaltyType: z.enum(["minor", "major"]).optional(),
  penaltyPercentage: z.number().min(0).max(100).optional(),
  noRepCount: z.number().int().min(0).optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Verify or adjust a submitted competition score
 */
export const verifySubmissionScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    verifySubmissionScoreInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; verificationStatus: string }> => {
      const db = getDb()

      const session = await getSessionFromCookie()
      if (!session?.userId) {
        throw new Error("Not authenticated")
      }

      await requireSubmissionReviewAccess(data.competitionId)

      getEvlog()?.set({
        action:
          data.action === "verify"
            ? "verify_submission"
            : data.action === "adjust"
              ? "adjust_submission"
              : "reject_submission",
        verification: {
          competitionId: data.competitionId,
          scoreId: data.scoreId,
          trackWorkoutId: data.trackWorkoutId,
        },
      })

      // Verify the event belongs to this competition
      await verifyEventBelongsToCompetition(
        db,
        data.competitionId,
        data.trackWorkoutId,
      )

      // Load the score (including current values for audit log)
      const [score] = await db
        .select({
          id: scoresTable.id,
          userId: scoresTable.userId,
          scheme: scoresTable.scheme,
          scoreType: scoresTable.scoreType,
          tiebreakScheme: scoresTable.tiebreakScheme,
          timeCapMs: scoresTable.timeCapMs,
          scoreValue: scoresTable.scoreValue,
          status: scoresTable.status,
          secondaryValue: scoresTable.secondaryValue,
          tiebreakValue: scoresTable.tiebreakValue,
        })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.id, data.scoreId),
            eq(scoresTable.competitionEventId, data.trackWorkoutId),
          ),
        )
        .limit(1)

      if (!score) {
        throw new Error("Score not found")
      }

      // Look up the registration for this user in this competition
      // so we can scope video submission updates correctly
      const [registration] = await db
        .select({ id: competitionRegistrationsTable.id })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            eq(competitionRegistrationsTable.userId, score.userId),
          ),
        )
        .limit(1)

      const now = new Date()

      if (data.action === "verify") {
        await db.transaction(async (tx) => {
          await tx
            .update(scoresTable)
            .set({
              verificationStatus: "verified",
              verifiedAt: now,
              verifiedByUserId: session.userId,
              penaltyType: null,
              penaltyPercentage: null,
              noRepCount: null,
              updatedAt: now,
            })
            .where(eq(scoresTable.id, data.scoreId))

          await tx.insert(scoreVerificationLogsTable).values({
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            athleteUserId: score.userId,
            action: "verified",
            performedByUserId: session.userId,
            performedAt: now,
          })

          // Update the corresponding video submission's review status
          if (registration) {
            await tx
              .update(videoSubmissionsTable)
              .set({
                reviewStatus: "verified",
                statusUpdatedAt: now,
                reviewedAt: now,
                reviewedBy: session.userId,
                reviewerNotes: data.reviewerNotes || null,
              })
              .where(
                and(
                  eq(videoSubmissionsTable.registrationId, registration.id),
                  eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
                ),
              )
          }
        })

        logInfo({
          message: "[Score] Organizer verified score",
          attributes: {
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            verifiedByUserId: session.userId,
          },
        })

        return { success: true, verificationStatus: "verified" }
      }

      // action === "invalid" — zero the workout score
      if (data.action === "invalid") {
        // Compute sort key for an invalidated score (ranks last)
        // Use null value so it sorts last within status group regardless of direction
        const scheme = score.scheme as WorkoutScheme
        const zeroSortKey = computeSortKey({
          value: null,
          status: "scored",
          scheme,
          scoreType: (score.scoreType as "max" | "min") ?? "max",
        })

        await db.transaction(async (tx) => {
          await tx
            .update(scoresTable)
            .set({
              scoreValue: 0,
              secondaryValue: null,
              tiebreakValue: null,
              status: "scored",
              statusOrder: 0,
              sortKey: zeroSortKey ? sortKeyToString(zeroSortKey) : null,
              verificationStatus: "invalid",
              verifiedAt: now,
              verifiedByUserId: session.userId,
              penaltyType: null,
              penaltyPercentage: null,
              noRepCount: data.noRepCount ?? null,
              updatedAt: now,
            })
            .where(eq(scoresTable.id, data.scoreId))

          await tx.insert(scoreVerificationLogsTable).values({
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            athleteUserId: score.userId,
            action: "invalid",
            originalScoreValue: score.scoreValue,
            originalStatus: score.status,
            originalSecondaryValue: score.secondaryValue,
            originalTiebreakValue: score.tiebreakValue,
            newScoreValue: 0,
            newStatus: "scored",
            noRepCount: data.noRepCount ?? null,
            performedByUserId: session.userId,
            performedAt: now,
          })

          if (registration) {
            await tx
              .update(videoSubmissionsTable)
              .set({
                reviewStatus: "invalid",
                statusUpdatedAt: now,
                reviewedAt: now,
                reviewedBy: session.userId,
                reviewerNotes: data.reviewerNotes || null,
              })
              .where(
                and(
                  eq(videoSubmissionsTable.registrationId, registration.id),
                  eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
                ),
              )
          }
        })

        logInfo({
          message: "[Score] Organizer marked score invalid",
          attributes: {
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            verifiedByUserId: session.userId,
            originalScoreValue: score.scoreValue,
          },
        })

        return { success: true, verificationStatus: "invalid" }
      }

      // action === "adjust"
      const hasAdjustedRoundScores =
        !!data.adjustedRoundScores && data.adjustedRoundScores.length > 0

      if (
        (!data.adjustedScore && !hasAdjustedRoundScores) ||
        !data.adjustedScoreStatus
      ) {
        throw new Error(
          "adjustedScore (or adjustedRoundScores) and adjustedScoreStatus are required for adjust action",
        )
      }

      // Normalize multi-round payload: sort by roundNumber and reject
      // duplicates so the per-round rewrite below can't silently drop or
      // double-count a round. Order-sensitive scoreTypes (first/last) also
      // depend on this being sorted ascending.
      if (data.adjustedRoundScores && hasAdjustedRoundScores) {
        const sorted = [...data.adjustedRoundScores].sort(
          (a, b) => a.roundNumber - b.roundNumber,
        )
        const seen = new Set<number>()
        for (const round of sorted) {
          if (seen.has(round.roundNumber)) {
            throw new Error(
              "adjustedRoundScores must contain unique roundNumber values",
            )
          }
          seen.add(round.roundNumber)
        }
        data.adjustedRoundScores = sorted
      }

      const scheme = score.scheme as WorkoutScheme
      let newStatus = data.adjustedScoreStatus
      const resolvedScoreType =
        (score.scoreType as ScoreType | null) ?? getDefaultScoreType(scheme)

      // Pull existing rounds so we can either thread the previously-derived
      // cap count through the sort key (no per-round inputs supplied) or
      // delete them before re-inserting fresh ones (per-round inputs
      // supplied — see followups doc #3 / #4).
      const existingRounds = await db
        .select({
          status: scoreRoundsTable.status,
        })
        .from(scoreRoundsTable)
        .where(eq(scoreRoundsTable.scoreId, data.scoreId))

      const isMultiRound = hasAdjustedRoundScores || existingRounds.length > 1

      let encodedValue: number | null = null
      let encodedAdjustedRounds: number[] = []
      const roundStatuses: Array<"scored" | "cap"> = []
      let cappedRoundCount = 0

      if (hasAdjustedRoundScores && data.adjustedRoundScores) {
        // Multi-round adjust with per-round inputs: encode each round and
        // derive cap status server-side, mirroring submitVideoFn /
        // saveCompetitionScoreFn so the parent total + tiebreaker stay
        // consistent.
        const roundInputs = data.adjustedRoundScores.map((rs) => ({
          raw: rs.score,
        }))
        const result = encodeRounds(roundInputs, scheme, resolvedScoreType)
        // `encodeRounds` silently drops rounds that fail to encode, which
        // would misalign roundStatuses with the per-round rows we rewrite
        // below. Reject here so the caller fixes the input.
        if (result.rounds.length !== data.adjustedRoundScores.length) {
          throw new Error(
            "Every round in adjustedRoundScores must be a valid score",
          )
        }
        encodedValue = result.aggregated
        encodedAdjustedRounds = result.rounds

        if (scheme === "time-with-cap" && score.timeCapMs) {
          const capMs = score.timeCapMs
          for (const roundValue of result.rounds) {
            const isCapped = roundValue >= capMs
            roundStatuses.push(isCapped ? "cap" : "scored")
            if (isCapped) cappedRoundCount++
          }
          // Server derivation wins over the client-declared status.
          newStatus = cappedRoundCount > 0 ? "cap" : "scored"
        }
      } else if (data.adjustedScore) {
        // Legacy single-value path (single-round, or multi-round penalty
        // direct override that doesn't restate per-round values).
        if (!isMultiRound && newStatus === "cap" && score.timeCapMs) {
          encodedValue = score.timeCapMs
        } else {
          encodedValue = encodeScore(data.adjustedScore, scheme)
        }
        cappedRoundCount = existingRounds.filter(
          (r) => r.status === "cap",
        ).length
      }

      // Parse secondary value (reps at cap). Only meaningful for the
      // single-value path — when per-round inputs are supplied the
      // breakdown encodes any cap penalty already.
      let secondaryValue: number | null = null
      if (
        !hasAdjustedRoundScores &&
        data.secondaryScore &&
        newStatus === "cap"
      ) {
        const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
        if (!Number.isNaN(parsed) && parsed >= 0) {
          secondaryValue = parsed
        }
      }

      // Encode tiebreak if provided
      let tiebreakValue: number | null = null
      if (data.tieBreakScore && score.tiebreakScheme) {
        try {
          tiebreakValue = encodeScore(
            data.tieBreakScore,
            score.tiebreakScheme as WorkoutScheme,
          )
        } catch {
          // Ignore tiebreak encoding errors
        }
      }

      // Compute sort key
      const statusOrder = newStatus === "cap" ? 1 : 0
      const sortKey =
        encodedValue !== null
          ? computeSortKey({
              value: encodedValue,
              status: newStatus,
              scheme,
              scoreType: resolvedScoreType,
              cappedRoundCount: isMultiRound ? cappedRoundCount : undefined,
              timeCap:
                newStatus === "cap" &&
                score.timeCapMs &&
                secondaryValue !== null
                  ? { ms: score.timeCapMs, secondaryValue }
                  : undefined,
              tiebreak:
                tiebreakValue !== null && score.tiebreakScheme
                  ? {
                      scheme: score.tiebreakScheme as "time" | "reps",
                      value: tiebreakValue,
                    }
                  : undefined,
            })
          : null

      if (isMultiRound) {
        logInfo({
          message: hasAdjustedRoundScores
            ? "[Score] Multi-round adjust applied with per-round inputs — rounds rewritten"
            : "[Score] Multi-round adjust applied — parent total updated, round breakdown preserved as-is and may diverge",
          attributes: {
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            verifiedByUserId: session.userId,
            roundCount: hasAdjustedRoundScores
              ? (data.adjustedRoundScores?.length ?? 0)
              : existingRounds.length,
            cappedRoundCount,
            newStatus,
            encodedValue,
          },
        })
      }

      // Determine review status for video submission based on penalty
      const videoReviewStatus = data.penaltyType ? "penalized" : "adjusted"

      await db.transaction(async (tx) => {
        await tx
          .update(scoresTable)
          .set({
            scoreValue: encodedValue,
            status: newStatus,
            statusOrder,
            sortKey: sortKey ? sortKeyToString(sortKey) : null,
            secondaryValue,
            tiebreakValue,
            verificationStatus: "adjusted",
            verifiedAt: now,
            verifiedByUserId: session.userId,
            penaltyType: data.penaltyType ?? null,
            penaltyPercentage: data.penaltyPercentage ?? null,
            noRepCount: data.noRepCount ?? null,
            updatedAt: now,
          })
          .where(eq(scoresTable.id, data.scoreId))

        // Per-round inputs supplied → rewrite the round breakdown.
        // Delete + insert (rather than update) so the leaderboard
        // cap-count tiebreaker stays consistent with the new parent total
        // even if the organizer changed the number of rounds.
        if (hasAdjustedRoundScores && data.adjustedRoundScores) {
          await tx
            .delete(scoreRoundsTable)
            .where(eq(scoreRoundsTable.scoreId, data.scoreId))

          // Reuse the already-encoded round values from `encodeRounds` so
          // roundStatuses (also derived from that output) lines up with the
          // rows we write. The length guard above guarantees 1:1 alignment
          // with data.adjustedRoundScores.
          const roundsToInsert = data.adjustedRoundScores.map(
            (round, index) => ({
              scoreId: data.scoreId,
              roundNumber: round.roundNumber,
              value: encodedAdjustedRounds[index] ?? 0,
              status: roundStatuses[index] ?? null,
            }),
          )

          await tx.insert(scoreRoundsTable).values(roundsToInsert)
        }

        await tx.insert(scoreVerificationLogsTable).values({
          scoreId: data.scoreId,
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          athleteUserId: score.userId,
          action: "adjusted",
          originalScoreValue: score.scoreValue,
          originalStatus: score.status,
          originalSecondaryValue: score.secondaryValue,
          originalTiebreakValue: score.tiebreakValue,
          newScoreValue: encodedValue,
          newStatus,
          newSecondaryValue: secondaryValue,
          newTiebreakValue: tiebreakValue,
          penaltyType: data.penaltyType ?? null,
          penaltyPercentage: data.penaltyPercentage ?? null,
          noRepCount: data.noRepCount ?? null,
          performedByUserId: session.userId,
          performedAt: now,
        })

        // Update the corresponding video submission's review status
        if (registration) {
          await tx
            .update(videoSubmissionsTable)
            .set({
              reviewStatus: videoReviewStatus,
              statusUpdatedAt: now,
              reviewedAt: now,
              reviewedBy: session.userId,
              reviewerNotes: data.reviewerNotes || null,
            })
            .where(
              and(
                eq(videoSubmissionsTable.registrationId, registration.id),
                eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
              ),
            )
        }
      })

      logInfo({
        message: "[Score] Organizer adjusted score",
        attributes: {
          scoreId: data.scoreId,
          competitionId: data.competitionId,
          verifiedByUserId: session.userId,
          newStatus,
          encodedValue,
        },
      })

      return { success: true, verificationStatus: "adjusted" }
    },
  )

const enterSubmissionScoreInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  videoSubmissionId: z.string().min(1),
  score: z.string().optional(),
  roundScores: z
    .array(
      z.object({
        roundNumber: z.number().int().min(1),
        score: z.string().min(1),
      }),
    )
    .optional(),
  scoreStatus: z.enum(["scored", "cap"]).optional(),
  secondaryScore: z.string().optional(),
  tieBreakScore: z.string().optional(),
  reviewerNotes: z.string().optional(),
  noRepCount: z.number().int().min(0).optional(),
})

/**
 * Create a `scores` row for a video submission that doesn't yet have one.
 *
 * Mirrors the score-encoding/sort-key logic of `submitVideoFn` but for the
 * organizer/volunteer review surface — used when the athlete uploaded a video
 * without filling in the score field (possible for submissions made before the
 * "score required" check landed in PR #401, or via clients that bypass it).
 *
 * Refuses to overwrite an existing score for the same user + event so that
 * accidental double-submission doesn't clobber an existing record (the adjust
 * action on `verifySubmissionScoreFn` handles updates).
 */
export const enterSubmissionScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    enterSubmissionScoreInputSchema.parse(data),
  )
  .handler(
    async ({ data }): Promise<{ success: boolean; scoreId: string }> => {
      const session = await getSessionFromCookie()
      if (!session?.userId) {
        throw new Error("Not authenticated")
      }

      await requireSubmissionReviewAccess(data.competitionId)

      const db = getDb()

      await verifyEventBelongsToCompetition(
        db,
        data.competitionId,
        data.trackWorkoutId,
      )

      const [submission] = await db
        .select({
          id: videoSubmissionsTable.id,
          registrationId: videoSubmissionsTable.registrationId,
          trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
        })
        .from(videoSubmissionsTable)
        .where(eq(videoSubmissionsTable.id, data.videoSubmissionId))
        .limit(1)

      if (!submission || submission.trackWorkoutId !== data.trackWorkoutId) {
        throw new Error("Video submission not found for this event")
      }

      const [registration] = await db
        .select({
          id: competitionRegistrationsTable.id,
          userId: competitionRegistrationsTable.userId,
          captainUserId: competitionRegistrationsTable.captainUserId,
          divisionId: competitionRegistrationsTable.divisionId,
          eventId: competitionRegistrationsTable.eventId,
        })
        .from(competitionRegistrationsTable)
        .where(eq(competitionRegistrationsTable.id, submission.registrationId))
        .limit(1)

      if (!registration || registration.eventId !== data.competitionId) {
        throw new Error("Registration not found for this competition")
      }

      // Score is owned by the captain (or the lone individual athlete).
      const scoreUserId = registration.captainUserId ?? registration.userId

      // Bail if a score already exists — this fn is for first-time entry only.
      const [existingScore] = await db
        .select({ id: scoresTable.id })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.competitionEventId, data.trackWorkoutId),
            eq(scoresTable.userId, scoreUserId),
          ),
        )
        .limit(1)

      if (existingScore) {
        throw new Error(
          "A score already exists for this submission. Use the adjust action to change it.",
        )
      }

      const [trackWorkout] = await db
        .select({
          id: trackWorkoutsTable.id,
          trackId: trackWorkoutsTable.trackId,
          workoutId: workouts.id,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
          roundsToScore: workouts.roundsToScore,
          tiebreakScheme: workouts.tiebreakScheme,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (!trackWorkout) {
        throw new Error("Workout not found for this event")
      }

      const [track] = await db
        .select({ ownerTeamId: programmingTracksTable.ownerTeamId })
        .from(programmingTracksTable)
        .where(eq(programmingTracksTable.id, trackWorkout.trackId))
        .limit(1)

      if (!track?.ownerTeamId) {
        throw new Error("Could not determine team ownership")
      }
      const ownerTeamId = track.ownerTeamId

      const scheme = trackWorkout.scheme as WorkoutScheme
      const resolvedScoreType =
        (trackWorkout.scoreType as ScoreType | null) ??
        getDefaultScoreType(scheme)

      const hasRoundScores =
        !!data.roundScores && data.roundScores.length > 0

      if (!data.score && !hasRoundScores) {
        throw new Error("A score (or roundScores) is required")
      }

      let encodedValue: number | null = null
      let encodedRounds: number[] = []
      const roundStatuses: Array<"scored" | "cap"> = []
      let cappedRoundCount = 0
      let status: "scored" | "cap" = data.scoreStatus ?? "scored"
      let secondaryValue: number | null = null
      const timeCapMs = trackWorkout.timeCap ? trackWorkout.timeCap * 1000 : null

      if (hasRoundScores && data.roundScores) {
        const sorted = [...data.roundScores].sort(
          (a, b) => a.roundNumber - b.roundNumber,
        )
        const seen = new Set<number>()
        for (const round of sorted) {
          if (seen.has(round.roundNumber)) {
            throw new Error("roundScores must contain unique roundNumber values")
          }
          seen.add(round.roundNumber)
        }
        const result = encodeRounds(
          sorted.map((rs) => ({ raw: rs.score })),
          scheme,
          resolvedScoreType,
        )
        if (result.rounds.length !== sorted.length) {
          throw new Error("Every round in roundScores must be a valid score")
        }
        encodedValue = result.aggregated
        encodedRounds = result.rounds
        data.roundScores = sorted

        if (scheme === "time-with-cap" && timeCapMs) {
          for (const roundValue of encodedRounds) {
            const isCapped = roundValue >= timeCapMs
            roundStatuses.push(isCapped ? "cap" : "scored")
            if (isCapped) cappedRoundCount++
          }
          status = cappedRoundCount > 0 ? "cap" : "scored"
        }
      } else if (data.score) {
        if (scheme === "time-with-cap" && status === "cap" && timeCapMs) {
          encodedValue = timeCapMs
          if (data.secondaryScore) {
            const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
            if (!Number.isNaN(parsed) && parsed >= 0) {
              secondaryValue = parsed
            }
          }
        } else {
          encodedValue = encodeScore(data.score, scheme)
          if (
            scheme === "time-with-cap" &&
            timeCapMs &&
            encodedValue !== null &&
            encodedValue >= timeCapMs
          ) {
            status = "cap"
            encodedValue = timeCapMs
            if (data.secondaryScore) {
              const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                secondaryValue = parsed
              }
            }
          }
        }
      }

      let tiebreakValue: number | null = null
      if (data.tieBreakScore && trackWorkout.tiebreakScheme) {
        try {
          tiebreakValue = encodeScore(
            data.tieBreakScore,
            trackWorkout.tiebreakScheme as WorkoutScheme,
          )
        } catch {
          // Ignore tiebreak encoding errors
        }
      }

      const isMultiRound = encodedRounds.length > 1
      const sortKey =
        encodedValue !== null
          ? computeSortKey({
              value: encodedValue,
              status,
              scheme,
              scoreType: resolvedScoreType,
              cappedRoundCount: isMultiRound ? cappedRoundCount : undefined,
              timeCap:
                status === "cap" && timeCapMs && secondaryValue !== null
                  ? { ms: timeCapMs, secondaryValue }
                  : undefined,
              tiebreak:
                tiebreakValue !== null && trackWorkout.tiebreakScheme
                  ? {
                      scheme: trackWorkout.tiebreakScheme as "time" | "reps",
                      value: tiebreakValue,
                    }
                  : undefined,
            })
          : null

      const now = new Date()

      const newScoreId = await db.transaction(async (tx) => {
        const insertValues: typeof scoresTable.$inferInsert = {
          userId: scoreUserId,
          teamId: ownerTeamId,
          workoutId: trackWorkout.workoutId,
          competitionEventId: data.trackWorkoutId,
          scheme,
          scoreType: resolvedScoreType,
          scoreValue: encodedValue,
          status,
          statusOrder: status === "cap" ? 1 : 0,
          sortKey: sortKey ? sortKeyToString(sortKey) : null,
          tiebreakScheme:
            (trackWorkout.tiebreakScheme as TiebreakScheme | null) ?? null,
          tiebreakValue,
          timeCapMs,
          secondaryValue,
          scalingLevelId: registration.divisionId,
          asRx: true,
          recordedAt: now,
          verificationStatus: "adjusted",
          verifiedAt: now,
          verifiedByUserId: session.userId,
          noRepCount: data.noRepCount ?? null,
        }
        await tx.insert(scoresTable).values(insertValues)

        // The id is generated by `$defaultFn(createScoreId)` so re-fetch it
        // by the natural key (user + event). The pre-insert "no existing
        // score" check above guarantees this lookup returns the row we just
        // wrote rather than a stale one.
        const [inserted] = await tx
          .select({ id: scoresTable.id })
          .from(scoresTable)
          .where(
            and(
              eq(scoresTable.competitionEventId, data.trackWorkoutId),
              eq(scoresTable.userId, scoreUserId),
            ),
          )
          .limit(1)

        if (!inserted) {
          throw new Error("Failed to fetch inserted score")
        }

        const insertedId = inserted.id

        if (encodedRounds.length > 0 && data.roundScores) {
          await tx.insert(scoreRoundsTable).values(
            data.roundScores.map((round, index) => ({
              scoreId: insertedId,
              roundNumber: round.roundNumber,
              value: encodedRounds[index] ?? 0,
              status: roundStatuses[index] ?? null,
            })),
          )
        }

        await tx.insert(scoreVerificationLogsTable).values({
          scoreId: insertedId,
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          athleteUserId: scoreUserId,
          // First-time entry uses the "adjusted" action with null original
          // values so the audit trail still distinguishes it from a real edit.
          action: "adjusted",
          originalScoreValue: null,
          originalStatus: null,
          originalSecondaryValue: null,
          originalTiebreakValue: null,
          newScoreValue: encodedValue,
          newStatus: status,
          newSecondaryValue: secondaryValue,
          newTiebreakValue: tiebreakValue,
          noRepCount: data.noRepCount ?? null,
          performedByUserId: session.userId,
          performedAt: now,
        })

        await tx
          .update(videoSubmissionsTable)
          .set({
            reviewStatus: "adjusted",
            statusUpdatedAt: now,
            reviewedAt: now,
            reviewedBy: session.userId,
            reviewerNotes: data.reviewerNotes || null,
          })
          .where(
            and(
              eq(videoSubmissionsTable.registrationId, registration.id),
              eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
            ),
          )

        return insertedId
      })

      logInfo({
        message: "[Score] Organizer entered initial score for missing submission",
        attributes: {
          scoreId: newScoreId,
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          videoSubmissionId: data.videoSubmissionId,
          performedByUserId: session.userId,
          status,
          encodedValue,
        },
      })

      return { success: true, scoreId: newScoreId }
    },
  )

/**
 * Get a single submission detail for verification
 */
export const getSubmissionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getSubmissionDetailInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      submission: SubmissionDetail | null
      event: EventDetails
    }> => {
      const db = getDb()

      const session = await getSessionFromCookie()
      if (!session?.userId) {
        throw new Error("Not authenticated")
      }

      await requireSubmissionReviewAccess(data.competitionId)

      // Verify the event belongs to this competition
      const eventWindow = await verifyEventBelongsToCompetition(
        db,
        data.competitionId,
        data.trackWorkoutId,
      )

      // Get the score with user info
      const [score] = await db
        .select({
          id: scoresTable.id,
          userId: scoresTable.userId,
          scoreValue: scoresTable.scoreValue,
          status: scoresTable.status,
          scheme: scoresTable.scheme,
          tiebreakValue: scoresTable.tiebreakValue,
          tiebreakScheme: scoresTable.tiebreakScheme,
          secondaryValue: scoresTable.secondaryValue,
          notes: scoresTable.notes,
          recordedAt: scoresTable.recordedAt,
          scalingLevelId: scoresTable.scalingLevelId,
          verificationStatus: scoresTable.verificationStatus,
          verifiedAt: scoresTable.verifiedAt,
          verifiedByUserId: scoresTable.verifiedByUserId,
          penaltyType: scoresTable.penaltyType,
          penaltyPercentage: scoresTable.penaltyPercentage,
          noRepCount: scoresTable.noRepCount,
        })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.id, data.scoreId),
            eq(scoresTable.competitionEventId, data.trackWorkoutId),
          ),
        )
        .limit(1)

      // Get the event details
      const [trackWorkout] = await db
        .select({
          id: trackWorkoutsTable.id,
          trackOrder: trackWorkoutsTable.trackOrder,
          workoutId: workouts.id,
          workoutName: workouts.name,
          workoutDescription: workouts.description,
          workoutScheme: workouts.scheme,
          workoutScoreType: workouts.scoreType,
          workoutTimeCap: workouts.timeCap,
          workoutRoundsToScore: workouts.roundsToScore,
          workoutRepsPerRound: workouts.repsPerRound,
          workoutTiebreakScheme: workouts.tiebreakScheme,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (!trackWorkout) {
        throw new Error("Event not found")
      }

      const event: EventDetails = {
        id: trackWorkout.id,
        trackOrder: trackWorkout.trackOrder,
        workout: {
          id: trackWorkout.workoutId,
          name: trackWorkout.workoutName,
          description: trackWorkout.workoutDescription,
          scheme: trackWorkout.workoutScheme,
          scoreType: trackWorkout.workoutScoreType,
          timeCap: trackWorkout.workoutTimeCap,
          roundsToScore: trackWorkout.workoutRoundsToScore,
          repsPerRound: trackWorkout.workoutRepsPerRound,
          tiebreakScheme: trackWorkout.workoutTiebreakScheme,
        },
        submissionWindow: {
          opensAt: eventWindow.submissionOpensAt,
          closesAt: eventWindow.submissionClosesAt,
        },
      }

      if (!score) {
        return { submission: null, event }
      }

      // Get user info
      const [user] = await db
        .select({
          id: userTable.id,
          firstName: userTable.firstName,
          lastName: userTable.lastName,
          email: userTable.email,
          avatar: userTable.avatar,
        })
        .from(userTable)
        .where(eq(userTable.id, score.userId))
        .limit(1)

      if (!user) {
        return { submission: null, event }
      }

      // Get division info
      let divisionLabel = "Open"
      if (score.scalingLevelId) {
        const [division] = await db
          .select({ label: scalingLevelsTable.label })
          .from(scalingLevelsTable)
          .where(eq(scalingLevelsTable.id, score.scalingLevelId))
          .limit(1)
        if (division) {
          divisionLabel = division.label
        }
      }

      // Get registration info (for team name)
      const [registration] = await db
        .select({
          id: competitionRegistrationsTable.id,
          teamName: competitionRegistrationsTable.teamName,
        })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            eq(competitionRegistrationsTable.userId, score.userId),
          ),
        )
        .limit(1)

      // Get video submission from video_submissions table
      let videoUrl: string | null = null
      if (registration) {
        const [videoSubmission] = await db
          .select({ videoUrl: videoSubmissionsTable.videoUrl })
          .from(videoSubmissionsTable)
          .where(
            and(
              eq(videoSubmissionsTable.registrationId, registration.id),
              eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
            ),
          )
          .limit(1)
        if (videoSubmission) {
          videoUrl = videoSubmission.videoUrl
        }
      }

      // Get verifier name if verified/adjusted
      let verifiedByName: string | null = null
      if (score.verifiedByUserId) {
        const [verifier] = await db
          .select({
            firstName: userTable.firstName,
            lastName: userTable.lastName,
          })
          .from(userTable)
          .where(eq(userTable.id, score.verifiedByUserId))
          .limit(1)
        if (verifier) {
          verifiedByName =
            `${verifier.firstName || ""} ${verifier.lastName || ""}`.trim() ||
            null
        }
      }

      // Decode score for display
      let displayValue = ""
      if (score.scoreValue !== null) {
        displayValue = decodeScore(
          score.scoreValue,
          score.scheme as WorkoutScheme,
          { compact: false },
        )
      }

      // Decode tiebreak if present
      let tiebreakDisplay: string | null = null
      if (score.tiebreakValue !== null && score.tiebreakScheme) {
        tiebreakDisplay = decodeScore(
          score.tiebreakValue,
          score.tiebreakScheme as WorkoutScheme,
          { compact: false },
        )
      }

      const submission: SubmissionDetail = {
        id: score.id,
        athlete: {
          userId: user.id,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          avatar: user.avatar,
          divisionId: score.scalingLevelId,
          divisionLabel,
          teamName: registration?.teamName ?? null,
          registrationId: registration?.id ?? "",
        },
        score: {
          displayValue,
          rawValue: score.scoreValue,
          status: score.status,
          tiebreakValue: tiebreakDisplay,
          secondaryValue: score.secondaryValue,
        },
        verification: {
          status:
            (score.verificationStatus as "verified" | "adjusted" | "invalid") ??
            null,
          verifiedAt: score.verifiedAt ?? null,
          verifiedByName,
          penaltyType: (score.penaltyType as "minor" | "major") ?? null,
          penaltyPercentage: score.penaltyPercentage ?? null,
          noRepCount: score.noRepCount ?? null,
        },
        videoUrl,
        submittedAt: score.recordedAt,
        notes: score.notes,
      }

      return { submission, event }
    },
  )

/**
 * Get all submissions for an event (for navigation and list view)
 */
export const getEventSubmissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getEventSubmissionsInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ submissions: SubmissionListItem[] }> => {
    const db = getDb()

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireSubmissionReviewAccess(data.competitionId)

    // Verify the event belongs to this competition
    await verifyEventBelongsToCompetition(
      db,
      data.competitionId,
      data.trackWorkoutId,
    )

    // Get all scores for this event
    const scores = await db
      .select({
        id: scoresTable.id,
        userId: scoresTable.userId,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        scheme: scoresTable.scheme,
        scalingLevelId: scoresTable.scalingLevelId,
        verificationStatus: scoresTable.verificationStatus,
      })
      .from(scoresTable)
      .where(eq(scoresTable.competitionEventId, data.trackWorkoutId))

    if (scores.length === 0) {
      return { submissions: [] }
    }

    // Get user info for all scores
    const userIds = scores.map((s) => s.userId)
    const users = await autochunk({ items: userIds }, async (chunk) =>
      db
        .select({
          id: userTable.id,
          firstName: userTable.firstName,
          lastName: userTable.lastName,
        })
        .from(userTable)
        .where(inArray(userTable.id, chunk)),
    )
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Get division info for all scores
    const divisionIds = scores
      .map((s) => s.scalingLevelId)
      .filter((id): id is string => id !== null)
    const divisions =
      divisionIds.length > 0
        ? await autochunk({ items: [...new Set(divisionIds)] }, async (chunk) =>
            db
              .select({
                id: scalingLevelsTable.id,
                label: scalingLevelsTable.label,
              })
              .from(scalingLevelsTable)
              .where(inArray(scalingLevelsTable.id, chunk)),
          )
        : []
    const divisionMap = new Map(divisions.map((d) => [d.id, d]))

    // Get registration info (for team names)
    const registrations = await autochunk({ items: userIds }, async (chunk) =>
      db
        .select({
          userId: competitionRegistrationsTable.userId,
          teamName: competitionRegistrationsTable.teamName,
        })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            inArray(competitionRegistrationsTable.userId, chunk),
          ),
        ),
    )
    const registrationMap = new Map(registrations.map((r) => [r.userId, r]))

    // Get video submissions for this event
    const videoSubmissions = await db
      .select({ userId: videoSubmissionsTable.userId })
      .from(videoSubmissionsTable)
      .where(eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId))
    const usersWithVideo = new Set(videoSubmissions.map((vs) => vs.userId))

    // Build submission list
    const submissions: SubmissionListItem[] = scores.map((score) => {
      const user = userMap.get(score.userId)
      const division = score.scalingLevelId
        ? divisionMap.get(score.scalingLevelId)
        : null
      const registration = registrationMap.get(score.userId)

      // Decode score for display
      let scoreDisplay = ""
      if (score.scoreValue !== null) {
        scoreDisplay = decodeScore(
          score.scoreValue,
          score.scheme as WorkoutScheme,
          { compact: true },
        )
      }

      // Derive status from verificationStatus
      const reviewStatus =
        score.verificationStatus === "verified" ||
        score.verificationStatus === "adjusted" ||
        score.verificationStatus === "invalid"
          ? "reviewed"
          : "pending"

      return {
        id: score.id,
        athleteName: user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown"
          : "Unknown",
        teamName: registration?.teamName ?? null,
        divisionLabel: division?.label ?? "Open",
        hasVideo: usersWithVideo.has(score.userId),
        scoreDisplay,
        status: reviewStatus,
      }
    })

    // Sort by athlete name
    submissions.sort((a, b) => a.athleteName.localeCompare(b.athleteName))

    return { submissions }
  })

/**
 * Get event details for verification page header
 */
export const getEventDetailsForVerificationFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getEventDetailsForVerificationInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ event: EventDetails | null }> => {
    const db = getDb()

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireSubmissionReviewAccess(data.competitionId)

    // Verify the event belongs to this competition and get submission window
    let eventWindow: {
      submissionOpensAt: string | null
      submissionClosesAt: string | null
    }
    try {
      eventWindow = await verifyEventBelongsToCompetition(
        db,
        data.competitionId,
        data.trackWorkoutId,
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Event not found in this competition"
      ) {
        return { event: null }
      }
      throw error
    }

    // Get the track workout with workout details
    const [trackWorkout] = await db
      .select({
        id: trackWorkoutsTable.id,
        trackOrder: trackWorkoutsTable.trackOrder,
        workoutId: workouts.id,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
        workoutScoreType: workouts.scoreType,
        workoutTimeCap: workouts.timeCap,
        workoutRoundsToScore: workouts.roundsToScore,
        workoutRepsPerRound: workouts.repsPerRound,
        workoutTiebreakScheme: workouts.tiebreakScheme,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    if (!trackWorkout) {
      return { event: null }
    }

    return {
      event: {
        id: trackWorkout.id,
        trackOrder: trackWorkout.trackOrder,
        workout: {
          id: trackWorkout.workoutId,
          name: trackWorkout.workoutName,
          description: trackWorkout.workoutDescription,
          scheme: trackWorkout.workoutScheme,
          scoreType: trackWorkout.workoutScoreType,
          timeCap: trackWorkout.workoutTimeCap,
          roundsToScore: trackWorkout.workoutRoundsToScore,
          repsPerRound: trackWorkout.workoutRepsPerRound,
          tiebreakScheme: trackWorkout.workoutTiebreakScheme,
        },
        submissionWindow: {
          opensAt: eventWindow.submissionOpensAt,
          closesAt: eventWindow.submissionClosesAt,
        },
      },
    }
  })

/**
 * Get verification audit logs for a score
 */
export const getVerificationLogsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getVerificationLogsInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ logs: VerificationLogEntry[] }> => {
    const db = getDb()

    // Verify organizer permission
    await requireSubmissionReviewAccess(data.competitionId)

    // Get logs for this score, newest first
    const logs = await db
      .select({
        id: scoreVerificationLogsTable.id,
        action: scoreVerificationLogsTable.action,
        performedByUserId: scoreVerificationLogsTable.performedByUserId,
        performedAt: scoreVerificationLogsTable.performedAt,
        originalScoreValue: scoreVerificationLogsTable.originalScoreValue,
        originalStatus: scoreVerificationLogsTable.originalStatus,
        newScoreValue: scoreVerificationLogsTable.newScoreValue,
        newStatus: scoreVerificationLogsTable.newStatus,
        trackWorkoutId: scoreVerificationLogsTable.trackWorkoutId,
        penaltyType: scoreVerificationLogsTable.penaltyType,
        penaltyPercentage: scoreVerificationLogsTable.penaltyPercentage,
        noRepCount: scoreVerificationLogsTable.noRepCount,
      })
      .from(scoreVerificationLogsTable)
      .where(
        and(
          eq(scoreVerificationLogsTable.scoreId, data.scoreId),
          eq(scoreVerificationLogsTable.competitionId, data.competitionId),
        ),
      )
      .orderBy(desc(scoreVerificationLogsTable.performedAt))

    if (logs.length === 0) {
      return { logs: [] }
    }

    // Get performer names
    const performerIds = [...new Set(logs.map((l) => l.performedByUserId))]
    const performers = await autochunk({ items: performerIds }, async (chunk) =>
      db
        .select({
          id: userTable.id,
          firstName: userTable.firstName,
          lastName: userTable.lastName,
        })
        .from(userTable)
        .where(inArray(userTable.id, chunk)),
    )
    const performerMap = new Map(performers.map((p) => [p.id, p]))

    // Get workout scheme for score decoding
    let scheme: string | null = null
    if (logs[0]?.trackWorkoutId) {
      const [tw] = await db
        .select({ scheme: workouts.scheme })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.id, logs[0].trackWorkoutId))
        .limit(1)
      scheme = tw?.scheme ?? null
    }

    return {
      logs: logs.map((log) => {
        const performer = performerMap.get(log.performedByUserId)
        const name = performer
          ? `${performer.firstName || ""} ${performer.lastName || ""}`.trim() ||
            "Unknown"
          : "Unknown"

        return {
          id: log.id,
          action: log.action,
          performedByName: name,
          performedAt: log.performedAt,
          originalScoreValue: log.originalScoreValue,
          originalStatus: log.originalStatus,
          newScoreValue: log.newScoreValue,
          newStatus: log.newStatus,
          scheme,
          penaltyType: log.penaltyType,
          penaltyPercentage: log.penaltyPercentage,
          noRepCount: log.noRepCount,
        }
      }),
    }
  })

// ============================================================================
// Delete / Update Verification Log Entries
// ============================================================================

const deleteVerificationLogInputSchema = z.object({
  logId: z.string().min(1),
  competitionId: z.string().min(1),
})

const updateVerificationLogInputSchema = z.object({
  logId: z.string().min(1),
  competitionId: z.string().min(1),
  action: z.string().optional(),
  penaltyType: z.enum(["minor", "major"]).nullable().optional(),
  penaltyPercentage: z.number().min(0).max(100).nullable().optional(),
  noRepCount: z.number().int().min(0).nullable().optional(),
})

/**
 * Delete a verification audit log entry
 */
export const deleteVerificationLogFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    deleteVerificationLogInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const db = getDb()

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireSubmissionReviewAccess(data.competitionId)

    getEvlog()?.set({
      action: "delete_verification_log",
      verification: { competitionId: data.competitionId, logId: data.logId },
    })

    // Verify the log entry belongs to this competition
    const [log] = await db
      .select({ id: scoreVerificationLogsTable.id })
      .from(scoreVerificationLogsTable)
      .where(
        and(
          eq(scoreVerificationLogsTable.id, data.logId),
          eq(scoreVerificationLogsTable.competitionId, data.competitionId),
        ),
      )
      .limit(1)

    if (!log) {
      throw new Error("Log entry not found")
    }

    await db
      .delete(scoreVerificationLogsTable)
      .where(eq(scoreVerificationLogsTable.id, data.logId))

    logInfo({
      message: "[Score] Organizer deleted verification log entry",
      attributes: {
        logId: data.logId,
        competitionId: data.competitionId,
        deletedByUserId: session.userId,
      },
    })

    return { success: true }
  })

/**
 * Update a verification audit log entry
 */
export const updateVerificationLogFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateVerificationLogInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const db = getDb()

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireSubmissionReviewAccess(data.competitionId)

    getEvlog()?.set({
      action: "update_verification_log",
      verification: { competitionId: data.competitionId, logId: data.logId },
    })

    // Verify the log entry belongs to this competition and get scoreId + context
    const [log] = await db
      .select({
        id: scoreVerificationLogsTable.id,
        scoreId: scoreVerificationLogsTable.scoreId,
        trackWorkoutId: scoreVerificationLogsTable.trackWorkoutId,
        athleteUserId: scoreVerificationLogsTable.athleteUserId,
        penaltyType: scoreVerificationLogsTable.penaltyType,
      })
      .from(scoreVerificationLogsTable)
      .where(
        and(
          eq(scoreVerificationLogsTable.id, data.logId),
          eq(scoreVerificationLogsTable.competitionId, data.competitionId),
        ),
      )
      .limit(1)

    if (!log) {
      throw new Error("Log entry not found")
    }

    const logUpdates: Record<string, unknown> = {}
    if (data.action !== undefined) logUpdates.action = data.action
    if (data.penaltyType !== undefined)
      logUpdates.penaltyType = data.penaltyType
    if (data.penaltyPercentage !== undefined)
      logUpdates.penaltyPercentage = data.penaltyPercentage
    if (data.noRepCount !== undefined) logUpdates.noRepCount = data.noRepCount

    if (Object.keys(logUpdates).length === 0) {
      return { success: true }
    }

    // Check if penalty fields changed — need to sync to scoresTable
    const hasPenaltyChange =
      data.penaltyType !== undefined ||
      data.penaltyPercentage !== undefined ||
      data.noRepCount !== undefined

    // Detect penaltyType flip (null ↔ non-null) for review status update
    const oldPenaltyType = log.penaltyType
    const newPenaltyType =
      data.penaltyType !== undefined ? data.penaltyType : oldPenaltyType
    const penaltyTypeFlipped =
      data.penaltyType !== undefined &&
      Boolean(oldPenaltyType) !== Boolean(newPenaltyType)

    const now = new Date()

    await db.transaction(async (tx) => {
      // Update the log entry
      await tx
        .update(scoreVerificationLogsTable)
        .set(logUpdates)
        .where(eq(scoreVerificationLogsTable.id, data.logId))

      // Sync penalty fields to the denormalized scoresTable columns
      if (hasPenaltyChange) {
        const scoreUpdates: Record<string, unknown> = { updatedAt: now }
        if (data.penaltyType !== undefined)
          scoreUpdates.penaltyType = data.penaltyType
        if (data.penaltyPercentage !== undefined)
          scoreUpdates.penaltyPercentage = data.penaltyPercentage
        if (data.noRepCount !== undefined)
          scoreUpdates.noRepCount = data.noRepCount

        await tx
          .update(scoresTable)
          .set(scoreUpdates)
          .where(eq(scoresTable.id, log.scoreId))
      }

      // Update video submission reviewStatus when penaltyType flips
      if (penaltyTypeFlipped && log.trackWorkoutId) {
        const [registration] = await tx
          .select({ id: competitionRegistrationsTable.id })
          .from(competitionRegistrationsTable)
          .where(
            and(
              eq(competitionRegistrationsTable.eventId, data.competitionId),
              eq(competitionRegistrationsTable.userId, log.athleteUserId),
            ),
          )
          .limit(1)

        if (registration) {
          const videoReviewStatus = newPenaltyType ? "penalized" : "adjusted"
          await tx
            .update(videoSubmissionsTable)
            .set({
              reviewStatus: videoReviewStatus,
              statusUpdatedAt: now,
            })
            .where(
              and(
                eq(videoSubmissionsTable.registrationId, registration.id),
                eq(videoSubmissionsTable.trackWorkoutId, log.trackWorkoutId),
              ),
            )
        }
      }
    })

    logInfo({
      message: "[Score] Organizer updated verification log entry",
      attributes: {
        logId: data.logId,
        competitionId: data.competitionId,
        updatedByUserId: session.userId,
        updates: logUpdates,
      },
    })

    return { success: true }
  })
