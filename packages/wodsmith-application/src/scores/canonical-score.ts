import { err, ok, type Result } from "../core/result"

export type ScoreAggregation =
  | "min"
  | "max"
  | "sum"
  | "average"
  | "first"
  | "last"

export type CanonicalTiebreak = Readonly<{
  scheme: "time" | "reps"
  value: number
}>

export type CanonicalRound = Readonly<{
  roundNumber: number
  value: number
  outcome: "finished" | "capped"
  repsAtCap?: number
}>

export type CanonicalScore =
  | Readonly<{
      scheme: "time"
      outcome: "finished"
      milliseconds: number
      tiebreak?: CanonicalTiebreak
    }>
  | Readonly<{
      scheme: "time-with-cap"
      outcome: "finished"
      milliseconds: number
      tiebreak?: CanonicalTiebreak
    }>
  | Readonly<{
      scheme: "time-with-cap"
      outcome: "capped"
      capMilliseconds: number
      repsAtCap: number
      tiebreak?: CanonicalTiebreak
    }>
  | Readonly<{
      scheme: "multi-round"
      aggregation: ScoreAggregation
      rounds: readonly CanonicalRound[]
      aggregate: number
      cappedRoundCount: number
    }>
  | Readonly<{
      scheme: "quantity"
      unit: "reps" | "rounds-reps" | "load" | "distance" | "calories"
      value: number
      tiebreak?: CanonicalTiebreak
    }>
  | Readonly<{ scheme: "pass-fail"; passed: boolean }>
  | Readonly<{ scheme: "inactive"; outcome: "dq" | "withdrawn" }>

export type CanonicalScoreInput =
  | Exclude<CanonicalScore, { scheme: "multi-round" }>
  | Readonly<{
      scheme: "multi-round"
      aggregation: ScoreAggregation
      rounds: readonly CanonicalRound[]
    }>

export interface InvalidCanonicalScore {
  readonly kind: "InvalidScore"
  readonly issues: readonly string[]
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function tiebreakIssues(tiebreak: CanonicalTiebreak | undefined): string[] {
  if (!tiebreak) return []
  return isNonNegativeSafeInteger(tiebreak.value)
    ? []
    : ["tiebreak value must be a non-negative safe integer"]
}

function roundedAverage(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  const divisor = BigInt(values.length)
  const quotient = total / divisor
  const remainder = total % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient

  return Number(rounded)
}

function aggregate(
  aggregation: ScoreAggregation,
  values: readonly number[],
): number {
  switch (aggregation) {
    case "min":
      return Math.min(...values)
    case "max":
      return Math.max(...values)
    case "sum":
      return values.reduce((total, value) => total + value, 0)
    case "average":
      return roundedAverage(values)
    case "first":
      return values[0] ?? 0
    case "last":
      return values.at(-1) ?? 0
  }
}

/** Validates a score value and derives every multi-round aggregate field. */
export function canonicalizeScore(
  input: CanonicalScoreInput,
): Result<CanonicalScore, InvalidCanonicalScore> {
  const issues: string[] = []

  switch (input.scheme) {
    case "time":
      if (!isNonNegativeSafeInteger(input.milliseconds))
        issues.push("milliseconds must be a non-negative safe integer")
      issues.push(...tiebreakIssues(input.tiebreak))
      break
    case "time-with-cap":
      if (input.outcome === "finished") {
        if (!isNonNegativeSafeInteger(input.milliseconds))
          issues.push("milliseconds must be a non-negative safe integer")
      } else {
        if (!isNonNegativeSafeInteger(input.capMilliseconds))
          issues.push("cap milliseconds must be a non-negative safe integer")
        if (!isNonNegativeSafeInteger(input.repsAtCap))
          issues.push("reps at cap must be a non-negative safe integer")
      }
      issues.push(...tiebreakIssues(input.tiebreak))
      break
    case "quantity":
      if (!isNonNegativeSafeInteger(input.value))
        issues.push("quantity must be a non-negative safe integer")
      issues.push(...tiebreakIssues(input.tiebreak))
      break
    case "multi-round": {
      if (input.rounds.length === 0)
        issues.push("multi-round scores require at least one round")
      input.rounds.forEach((round, index) => {
        if (round.roundNumber !== index + 1)
          issues.push("round numbers must be contiguous and one-based")
        if (!isNonNegativeSafeInteger(round.value))
          issues.push("round values must be non-negative safe integers")
        if (
          round.outcome === "capped" &&
          !isNonNegativeSafeInteger(round.repsAtCap ?? Number.NaN)
        )
          issues.push("capped rounds require non-negative reps at cap")
        if (round.outcome === "finished" && round.repsAtCap !== undefined)
          issues.push("finished rounds cannot carry reps at cap")
      })
      break
    }
    case "pass-fail":
    case "inactive":
      break
  }

  if (issues.length > 0) return err({ kind: "InvalidScore", issues })
  if (input.scheme !== "multi-round") return ok(input)

  const aggregateValue = aggregate(
    input.aggregation,
    input.rounds.map((round) => round.value),
  )
  if (!isNonNegativeSafeInteger(aggregateValue))
    return err({
      kind: "InvalidScore",
      issues: ["aggregate must be a non-negative safe integer"],
    })

  return ok({
    ...input,
    aggregate: aggregateValue,
    cappedRoundCount: input.rounds.filter((round) => round.outcome === "capped")
      .length,
  })
}
