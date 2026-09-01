import type {
  ScoreType,
  TiebreakScheme,
  WorkoutScheme,
} from "@/db/schemas/workouts"
import {
  aggregateValues,
  encodeScore,
  parseScore,
  sortKeyToString,
} from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  resolveWorkoutResultScoreType,
} from "@/server/workout-results/kernel"
import { type CompetitionResultClaim, CompetitionResultError } from "./domain"

export interface ProgrammedWorkoutDefinition {
  workoutId: string
  scheme: string
  scoreType: string | null
  roundsToScore: number | null
  timeCap: number | null
  tiebreakScheme: string | null
}

export interface CompetitionResultRevision {
  scheme: WorkoutScheme
  scoreType: ScoreType
  scoreValue: number | null
  status: "scored" | "cap" | "dq" | "withdrawn"
  statusOrder: number
  sortKey: string | null
  tiebreakScheme: TiebreakScheme | null
  tiebreakValue: number | null
  timeCapMs: number | null
  secondaryValue: number | null
  rounds: Array<{
    roundNumber: number
    value: number
    status: "scored" | "cap"
    secondaryValue: number | null
  }>
}

function persistedStatus(
  status: CompetitionResultClaim["status"],
): CompetitionResultRevision["status"] {
  switch (status) {
    case "cap":
    case "dq":
    case "scored":
      return status
    case "dns":
    case "dnf":
    case "withdrawn":
      return "withdrawn"
  }
}

function parseSecondaryScore(
  raw: string | null | undefined,
  context: string,
): number | null {
  if (raw == null || raw.trim() === "") return null
  const normalized = raw.trim()
  if (!/^\d+$/.test(normalized)) {
    throw new CompetitionResultError(
      "invalid_cap",
      `${context} must be a non-negative whole number`,
    )
  }
  return Number(normalized)
}

function scoreText(
  round: { score: string; parts?: [string, string] },
  scheme: WorkoutScheme,
): string {
  return scheme === "rounds-reps" && round.parts
    ? `${round.parts[0]}+${round.parts[1]}`
    : round.score
}

/**
 * Pure competition-result decision. The caller must supply the authoritative
 * programmed workout loaded by the command service, never client metadata.
 */
export function decideCompetitionResult(
  claim: CompetitionResultClaim,
  workout: ProgrammedWorkoutDefinition,
): CompetitionResultRevision {
  const scheme = workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(scheme, workout.scoreType)
  const timeCapMs = workout.timeCap ? workout.timeCap * 1000 : null
  const terminalStatus = persistedStatus(claim.status)
  const roundClaims = claim.roundScores?.length ? claim.roundScores : null
  let status = terminalStatus
  let scoreValue: number | null = null
  let secondaryValue: number | null = null
  let cappedRoundCount = 0
  const rounds: CompetitionResultRevision["rounds"] = []

  if (roundClaims) {
    if (workout.roundsToScore && roundClaims.length !== workout.roundsToScore) {
      throw new CompetitionResultError(
        "incomplete_rounds",
        `Expected ${workout.roundsToScore} round scores, received ${roundClaims.length}`,
      )
    }

    for (const [index, round] of roundClaims.entries()) {
      const raw = scoreText(round, scheme)
      const parsed = parseScore(raw, scheme)
      if (!parsed.isValid) {
        throw new CompetitionResultError(
          "invalid_round_score",
          `Round ${index + 1}: ${parsed.error || "invalid score"}`,
        )
      }

      const roundStatus = round.status ?? "scored"
      let value = encodeScore(raw, scheme)
      if (value === null) {
        throw new CompetitionResultError(
          "invalid_round_score",
          `Round ${index + 1}: invalid score`,
        )
      }

      const roundSecondaryValue = parseSecondaryScore(
        round.secondaryScore,
        `Round ${index + 1} secondary score`,
      )
      if (roundStatus === "cap") {
        if (scheme !== "time-with-cap" || timeCapMs === null) {
          throw new CompetitionResultError(
            "invalid_cap",
            `Round ${index + 1} cannot be capped for this workout`,
          )
        }
        value = timeCapMs
        cappedRoundCount++
      } else if (roundSecondaryValue !== null) {
        throw new CompetitionResultError(
          "invalid_cap",
          `Round ${index + 1} secondary score requires capped status`,
        )
      }

      rounds.push({
        roundNumber: index + 1,
        value,
        status: roundStatus,
        secondaryValue: roundSecondaryValue,
      })
    }

    scoreValue = aggregateValues(
      rounds.map((round) => round.value),
      scoreType,
    )
    if (status !== "dq" && status !== "withdrawn") {
      status = cappedRoundCount > 0 ? "cap" : "scored"
    }
  } else {
    const rawScore = claim.score?.trim() ?? ""
    if (rawScore) {
      const parsed = parseScore(rawScore, scheme)
      if (!parsed.isValid) {
        throw new CompetitionResultError(
          "invalid_score",
          `Invalid score format: ${parsed.error || "Please check your entry"}`,
        )
      }
      scoreValue = encodeScore(rawScore, scheme)
    } else if (status === "scored") {
      throw new CompetitionResultError("invalid_score", "Score is required")
    }

    secondaryValue = parseSecondaryScore(
      claim.secondaryScore,
      "Secondary score",
    )
    if (status === "cap") {
      if (scheme !== "time-with-cap" || timeCapMs === null) {
        throw new CompetitionResultError(
          "invalid_cap",
          "This workout does not support a time cap",
        )
      }
      scoreValue = timeCapMs
    } else if (secondaryValue !== null) {
      throw new CompetitionResultError(
        "invalid_cap",
        "Secondary score requires capped status",
      )
    }
  }

  let tiebreakValue: number | null = null
  if (claim.tiebreakScore?.trim()) {
    if (!workout.tiebreakScheme) {
      throw new CompetitionResultError(
        "invalid_tiebreak",
        "This workout does not support a tiebreak",
      )
    }
    tiebreakValue = encodeScore(
      claim.tiebreakScore,
      workout.tiebreakScheme as WorkoutScheme,
    )
    if (tiebreakValue === null) {
      throw new CompetitionResultError(
        "invalid_tiebreak",
        "Invalid tiebreak score format",
      )
    }
  }

  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    cappedRoundCount,
    timeCap:
      !roundClaims && status === "cap" && secondaryValue !== null
        ? { ms: timeCapMs ?? 0, secondaryValue }
        : undefined,
    tiebreak:
      tiebreakValue !== null && workout.tiebreakScheme
        ? {
            scheme: workout.tiebreakScheme as TiebreakScheme,
            value: tiebreakValue,
          }
        : undefined,
  })

  return {
    scheme,
    scoreType,
    scoreValue,
    status,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
    tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme | null) ?? null,
    tiebreakValue,
    timeCapMs,
    secondaryValue,
    rounds,
  }
}
