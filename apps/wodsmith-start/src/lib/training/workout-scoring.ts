import {
  aggregateValues,
  formatScoreForList,
  isCountBasedScheme,
  parseScore,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  resolveWorkoutResultScoreType,
} from "@/lib/scoring/result"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import type { TrainingScoreDetails, TrainingWorkoutScoreInput } from "./types"

const MAX_TRAINING_SCORE = 1_000_000_000_000

function parseTrainingWorkoutValue(
  raw: string,
  scheme: WorkoutScheme,
  input: TrainingWorkoutScoreInput,
): number {
  const text = raw.trim()
  if (isCountBasedScheme(scheme) && !/^\d+$/.test(text))
    throw new Error("Enter a whole number without letters or decimal places")
  if (scheme === "rounds-reps" && !/^\d+(?:\s*[+.]\s*\d+)?$/.test(text))
    throw new Error("Enter complete rounds or rounds+reps, such as 5+12")
  if (
    ["load", "meters", "feet"].includes(scheme) &&
    !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)
  )
    throw new Error("Enter a number and choose its unit")
  const parsed = parseScore(text, scheme, {
    unit:
      scheme === "load"
        ? input.unit === "lb"
          ? "lbs"
          : "kg"
        : (input.distanceUnit ?? (scheme === "feet" ? "ft" : "m")),
  })
  if (
    !parsed.isValid ||
    parsed.encoded == null ||
    !Number.isSafeInteger(parsed.encoded) ||
    parsed.encoded < 0 ||
    parsed.encoded > MAX_TRAINING_SCORE
  )
    throw new Error(parsed.error ?? "Enter a valid score")
  return parsed.encoded
}

export function normalizeTrainingWorkoutResult(
  workout: NormalizedWorkoutSave,
  input: TrainingWorkoutScoreInput,
): { scoreValue: number; displayScore: string; details: TrainingScoreDetails } {
  const scoreType = resolveWorkoutResultScoreType(
    workout.scheme,
    workout.scoreType,
  )
  const timeCapMs =
    workout.timeCapSeconds === null ? null : workout.timeCapSeconds * 1000
  const multi = workout.roundsToScore > 1
  if (multi && input.roundScores?.length !== workout.roundsToScore)
    throw new Error(`Enter all ${workout.roundsToScore} round scores`)
  if (!multi && input.roundScores?.length)
    throw new Error("This workout records one score")
  if (multi && (input.status === "cap" || input.secondaryScore?.trim()))
    throw new Error("Set the cap status and reps for each round")
  const claims = multi
    ? (input.roundScores ?? [])
    : [
        {
          score: input.score,
          status: input.status,
          secondaryScore: input.secondaryScore,
        },
      ]
  const rounds = claims.map((claim, index) => {
    const status = claim.status ?? "scored"
    if (status === "cap") {
      if (workout.scheme !== "time-with-cap" || timeCapMs === null)
        throw new Error("This workout does not support a time cap")
      if (
        !claim.secondaryScore?.trim() ||
        !/^\d+$/.test(claim.secondaryScore.trim())
      )
        throw new Error("Enter whole reps completed at the cap, including zero")
      const secondaryValue = parseTrainingWorkoutValue(
        claim.secondaryScore,
        "reps",
        input,
      )
      if (timeCapMs > MAX_TRAINING_SCORE)
        throw new Error("Time cap exceeds the supported score range")
      return {
        roundNumber: index + 1,
        value: timeCapMs,
        status,
        secondaryValue,
      }
    }
    if (claim.secondaryScore?.trim())
      throw new Error("Reps at the cap require capped status")
    const value = parseTrainingWorkoutValue(claim.score, workout.scheme, input)
    if (
      workout.scheme === "time-with-cap" &&
      timeCapMs !== null &&
      value > timeCapMs
    )
      throw new Error(
        "Finish time exceeds the cap. Select capped if you did not finish.",
      )
    return { roundNumber: index + 1, value, status, secondaryValue: null }
  })
  const scoreValue = aggregateValues(
    rounds.map((round) => round.value),
    scoreType,
  )
  if (
    scoreValue === null ||
    !Number.isSafeInteger(scoreValue) ||
    scoreValue < 0 ||
    scoreValue > MAX_TRAINING_SCORE
  )
    throw new Error("Score exceeds the supported range")
  const capped = rounds.filter((round) => round.status === "cap")
  const status = capped.length ? ("cap" as const) : ("scored" as const)
  const secondaryValue = capped.length
    ? capped.reduce((total, round) => total + (round.secondaryValue ?? 0), 0)
    : null
  if (secondaryValue !== null && secondaryValue > MAX_TRAINING_SCORE)
    throw new Error("Capped rep total exceeds the supported range")
  let tiebreakValue: number | null = null
  if (input.tiebreakScore?.trim()) {
    if (!workout.tiebreakScheme) throw new Error("This workout has no tiebreak")
    tiebreakValue = parseTrainingWorkoutValue(
      input.tiebreakScore,
      workout.tiebreakScheme,
      input,
    )
  }
  const timeCap =
    status === "cap"
      ? { ms: timeCapMs ?? 0, secondaryValue: secondaryValue ?? 0 }
      : undefined
  const tiebreak =
    workout.tiebreakScheme && tiebreakValue !== null
      ? { scheme: workout.tiebreakScheme, value: tiebreakValue }
      : undefined
  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme: workout.scheme,
    scoreType,
    cappedRoundCount: multi ? capped.length : 0,
    timeCap,
    tiebreak,
  })
  if (scoring.sortKey === null) throw new Error("Could not rank this score")
  const unit =
    workout.scheme === "meters" || workout.scheme === "feet"
      ? (input.distanceUnit ?? (workout.scheme === "feet" ? "ft" : "m"))
      : input.unit
  const details: TrainingScoreDetails = {
    scheme: workout.scheme,
    scoreType,
    status,
    scoreValue,
    secondaryValue,
    timeCapMs,
    tiebreakScheme: workout.tiebreakScheme,
    tiebreakValue,
    rounds: multi ? rounds : [],
    sortKey: sortKeyToString(scoring.sortKey),
    unit,
    input: {
      score: input.score,
      unit: input.unit,
      status: input.status,
      secondaryScore: input.secondaryScore,
      roundScores: input.roundScores,
      tiebreakScore: input.tiebreakScore,
      distanceUnit: input.distanceUnit,
    },
  }
  let displayScore = formatScoreForList(
    {
      scheme: workout.scheme,
      scoreType,
      value: scoreValue,
      status,
      timeCap,
      tiebreak,
    },
    {
      includeUnit: true,
      weightUnit: input.unit === "lb" ? "lbs" : "kg",
      distanceUnit:
        input.distanceUnit ?? (workout.scheme === "feet" ? "ft" : "m"),
    },
  )
  if (multi && workout.scheme === "pass-fail" && scoreType === "sum")
    displayScore = `${scoreValue}/${rounds.length} passed`
  if (displayScore.length > 100) throw new Error("Formatted score is too long")
  return { scoreValue, displayScore, details }
}
