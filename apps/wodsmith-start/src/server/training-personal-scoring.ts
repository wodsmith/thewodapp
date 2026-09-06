import {
  aggregateValues,
  decodeScore,
  isCountBasedScheme,
  parseScore,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  resolveWorkoutResultScoreType,
} from "@/lib/scoring/result"
import type { PersonalLibraryItem } from "@/lib/training/personal-types"

export function normalizePersonalLibraryScore(
  workout: PersonalLibraryItem["workout"],
  input: { score: string; roundScores?: { score: string }[] },
) {
  const scheme = workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(scheme, workout.scoreType)
  const timeCapMs = workout.timeCap ? workout.timeCap * 1000 : null
  const roundInputs = input.roundScores?.length ? input.roundScores : null
  if (
    (workout.roundsToScore ?? 1) > 1 &&
    roundInputs?.length !== workout.roundsToScore
  )
    throw new Error("Enter a score for every prescribed round")
  if (roundInputs && roundInputs.length !== (workout.roundsToScore ?? 1))
    throw new Error("Enter exactly the prescribed number of rounds")
  const values = (roundInputs ?? [{ score: input.score }]).map(
    (round, index) => {
      const cap = /^CAP\s*\+\s*(\d+)$/i.exec(round.score.trim())
      if (cap) {
        if (scheme !== "time-with-cap" || !timeCapMs)
          throw new Error("This workout does not support a time cap")
        const reps = Number(cap[1])
        if (!Number.isSafeInteger(reps) || reps > 2147483647)
          throw new Error("Enter a valid capped rep count")
        return {
          roundNumber: index + 1,
          value: timeCapMs,
          status: "cap" as const,
          secondaryValue: reps,
        }
      }
      const raw = round.score.trim()
      if (isCountBasedScheme(scheme) && !/^\d+$/.test(raw))
        throw new Error(
          "Enter a whole number without letters or decimal places",
        )
      if (scheme === "rounds-reps" && !/^\d+(?:\s*[+.]\s*\d+)?$/.test(raw))
        throw new Error("Enter complete rounds or rounds+reps, such as 5+12")
      const parsed = parseScore(raw, scheme)
      if (
        !parsed.isValid ||
        parsed.encoded == null ||
        !Number.isSafeInteger(parsed.encoded) ||
        parsed.encoded < 0 ||
        parsed.encoded > 2147483647
      )
        throw new Error(parsed.error ?? "Enter a valid score")
      if (scheme === "time-with-cap" && timeCapMs && parsed.encoded > timeCapMs)
        throw new Error(
          "Finish time exceeds the cap. Enter CAP+reps if you did not finish.",
        )
      return {
        roundNumber: index + 1,
        value: parsed.encoded,
        status: "scored" as const,
        secondaryValue: null,
      }
    },
  )
  const scoreValue = roundInputs
    ? aggregateValues(
        values.map((round) => round.value),
        scoreType,
      )
    : values[0].value
  if (
    scoreValue === null ||
    !Number.isSafeInteger(scoreValue) ||
    scoreValue < 0 ||
    scoreValue > 2147483647
  )
    throw new Error("Score exceeds the supported range")
  const capped = values.filter((round) => round.status === "cap")
  const status = capped.length ? ("cap" as const) : ("scored" as const)
  const secondaryValue = capped.length
    ? capped.reduce((total, round) => total + (round.secondaryValue ?? 0), 0)
    : null
  if (secondaryValue !== null && secondaryValue > 2147483647)
    throw new Error("Capped rep total exceeds the supported range")
  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    cappedRoundCount: roundInputs ? capped.length : 0,
    timeCap:
      status === "cap"
        ? { ms: timeCapMs ?? 0, secondaryValue: secondaryValue ?? 0 }
        : undefined,
  })
  return {
    scheme,
    scoreType,
    scoreValue,
    status,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
    timeCapMs,
    secondaryValue,
    rounds: roundInputs ? values : [],
    formatted:
      status === "cap"
        ? `CAP+${secondaryValue}`
        : decodeScore(scoreValue, scheme),
  }
}
