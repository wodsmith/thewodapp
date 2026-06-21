import { getSortDirection } from "@/lib/scoring/sort/direction"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"
import type { EventPointsResult, EventScoreInput } from "./index"

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
  let bestTier = 0

  for (const threshold of thresholds) {
    const meetsThreshold =
      sortDirection === "asc"
        ? score.value <= threshold.value
        : score.value >= threshold.value

    if (meetsThreshold) {
      bestTier = Math.max(bestTier, threshold.tier)
    }
  }

  return bestTier > 0 ? bestTier : 0.5
}

export function calculateAbsoluteTierEventPoints(
  eventId: string,
  scores: EventScoreInput[],
  scheme: WorkoutScheme,
  context: AbsoluteTierScoringContext | undefined,
): Map<string, EventPointsResult> {
  if (!context) {
    throw new BenchmarkConfigError(
      "absolute_tier scoring requires preloaded threshold context",
    )
  }

  const table = context.tableByEventId.get(eventId)
  if (!table) {
    throw new BenchmarkConfigError(
      `Missing absolute-tier threshold table for event ${eventId}`,
    )
  }

  const scored = scores.map((score, index) => ({
    score,
    index,
    tier: calculateAbsoluteTier(score, table, scheme),
  }))

  scored.sort((a, b) => {
    if (a.tier !== b.tier) {
      return b.tier - a.tier
    }
    return a.index - b.index
  })

  const results = new Map<string, EventPointsResult>()
  let currentRank = 1
  let previousTier: number | null = null

  for (let i = 0; i < scored.length; i++) {
    const { score, tier } = scored[i]
    if (previousTier !== null && tier !== previousTier) {
      currentRank = i + 1
    }

    results.set(score.userId, {
      userId: score.userId,
      points: tier,
      rank: currentRank,
    })
    previousTier = tier
  }

  return results
}
