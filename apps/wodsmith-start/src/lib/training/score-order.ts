import { compareScores, type Score, sortKeyToString } from "@/lib/scoring"
import { buildWorkoutResultScoring } from "@/lib/scoring/result"
import type { TrainingResult, TrainingScoreDetails } from "./types"

export function trainingResultSortKey(result: TrainingResult): string {
  if (result.details) return result.details.sortKey
  const scheme = result.block.kind
  if (scheme !== "time" && scheme !== "load" && scheme !== "reps") return ""
  const scoring = buildWorkoutResultScoring({
    value: result.scoreValue,
    status: "scored",
    scheme,
    scoreType: scheme === "time" ? "min" : "max",
  })
  return scoring.sortKey === null ? "~" : sortKeyToString(scoring.sortKey)
}

export function compareTrainingResults(
  a: TrainingResult,
  b: TrainingResult,
): number {
  if (a.details && b.details) {
    const toScore = (details: TrainingScoreDetails): Score => {
      return {
        scheme: details.scheme,
        scoreType: details.scoreType,
        status: details.status,
        value: details.scoreValue,
        cappedRoundCount: details.rounds.filter(
          (round) => round.status === "cap",
        ).length,
        timeCap:
          details.status === "cap"
            ? {
                ms: details.timeCapMs ?? 0,
                secondaryValue: details.secondaryValue ?? 0,
              }
            : undefined,
        tiebreak:
          details.tiebreakScheme && details.tiebreakValue !== null
            ? { scheme: details.tiebreakScheme, value: details.tiebreakValue }
            : undefined,
      }
    }
    const compared = compareScores(toScore(a.details), toScore(b.details))
    if (compared !== 0) return compared
    if (a.details.tiebreakScheme && b.details.tiebreakScheme) {
      const missingA = a.details.tiebreakValue === null
      const missingB = b.details.tiebreakValue === null
      if (missingA !== missingB) return missingA ? 1 : -1
    }
    return 0
  }
  const keyA = trainingResultSortKey(a)
  const keyB = trainingResultSortKey(b)
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
}
