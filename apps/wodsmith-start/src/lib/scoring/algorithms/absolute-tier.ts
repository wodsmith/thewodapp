import { getSortDirection } from "@/lib/scoring/sort/direction"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"
import type { EventScoreInput } from "./index"

export class BenchmarkConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BenchmarkConfigError"
  }
}

export interface AbsoluteTierThreshold {
  tier: number
  value: number
}

export interface AbsoluteTierEventTable {
  scoreType: ScoreType
  thresholdsByVariant: ReadonlyMap<string, readonly AbsoluteTierThreshold[]>
  /**
   * Hybrid reps/time tests (scoreModel "hybrid" on a time-with-cap test):
   * thresholds below this tier are reps completed at the cap, thresholds at
   * or above it are finish times. Null/undefined means every threshold lives
   * in the test's primary score dimension.
   */
  hybridFlipTier?: number | null
}

export interface AbsoluteTierScoringContext {
  tableByEventId: ReadonlyMap<string, AbsoluteTierEventTable>
}

const INACTIVE_STATUSES = new Set<EventScoreInput["status"]>([
  "dnf",
  "dns",
  "withdrawn",
])

export function calculateAbsoluteTier(
  score: EventScoreInput,
  table: AbsoluteTierEventTable,
  scheme: WorkoutScheme,
): number {
  if (!score.variant) {
    throw new BenchmarkConfigError(
      `Missing benchmark variant for score by user ${score.userId}`,
    )
  }

  const thresholds = table.thresholdsByVariant.get(score.variant)
  if (!thresholds) {
    throw new BenchmarkConfigError(
      `Missing absolute-tier thresholds for variant ${score.variant}`,
    )
  }

  if (thresholds.length === 0) {
    throw new BenchmarkConfigError(
      `Absolute-tier threshold table for variant ${score.variant} is empty`,
    )
  }

  if (INACTIVE_STATUSES.has(score.status)) {
    return 0
  }

  const sortDirection = getSortDirection(scheme, table.scoreType)
  const hybridFlipTier = table.hybridFlipTier ?? null
  let bestTier = 0

  for (const threshold of thresholds) {
    const meetsThreshold = hybridFlipTier
      ? meetsHybridThreshold(score, threshold, hybridFlipTier)
      : sortDirection === "asc"
        ? // Ascending thresholds are finish times; a capped athlete's value
          // is the cap time, not a finish, so only completed scores qualify.
          score.status === "scored" && score.value <= threshold.value
        : score.value >= threshold.value

    if (meetsThreshold) {
      bestTier = Math.max(bestTier, threshold.tier)
    }
  }

  return bestTier > 0 ? bestTier : 0.5
}

/**
 * Hybrid reps/time thresholds: tiers below the flip are reps completed at the
 * time cap, tiers at or above it are finish times. A finisher has completed
 * every rep, so they clear all rep tiers outright and time tiers by
 * comparison; a capped athlete is measured only by their reps.
 */
function meetsHybridThreshold(
  score: EventScoreInput,
  threshold: AbsoluteTierThreshold,
  hybridFlipTier: number,
): boolean {
  const isTimeThreshold = threshold.tier >= hybridFlipTier

  if (isTimeThreshold) {
    return score.status === "scored" && score.value <= threshold.value
  }

  if (score.status === "scored") {
    return true
  }

  return (score.secondaryValue ?? 0) >= threshold.value
}
