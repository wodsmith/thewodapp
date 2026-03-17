/**
 * Series Leaderboard Server Functions
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  getSeriesLeaderboard,
  type SeriesLeaderboardEntry,
} from "@/server/series-leaderboard"
import type { ScoringConfig } from "@/types/scoring"

// Re-export types for frontend use
export type { SeriesLeaderboardEntry }

export interface SeriesLeaderboardResponse {
  entries: SeriesLeaderboardEntry[]
  scoringConfig: ScoringConfig
  seriesEvents: Array<{ workoutId: string; name: string; scheme: string }>
  availableDivisions: Array<{ id: string; label: string }>
}

export const getSeriesLeaderboardFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        divisionId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SeriesLeaderboardResponse> => {
    return getSeriesLeaderboard(data)
  })
