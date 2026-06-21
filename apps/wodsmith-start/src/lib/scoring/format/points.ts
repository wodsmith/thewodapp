import type { ScoringAlgorithm } from "@/types/scoring"

/**
 * Format leaderboard points based on the scoring algorithm axis.
 */
export function formatLeaderboardPoints(
  points: number,
  algorithm: ScoringAlgorithm,
): string {
  if (
    algorithm === "online" ||
    algorithm === "p_score" ||
    algorithm === "absolute_tier"
  ) {
    return String(points)
  }

  if (points < 0) {
    return String(points)
  }

  return `+${points}`
}
