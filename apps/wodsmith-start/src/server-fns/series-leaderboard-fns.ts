/**
 * Series Leaderboard Server Functions
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  getSeriesDivisionHealth,
  getSeriesLeaderboard,
  type SeriesDivisionHealth,
  type SeriesLeaderboardEntry,
} from "@/server/series-leaderboard"
import type { ScoringConfig } from "@/types/scoring"

// Re-export types for frontend use
export type { SeriesLeaderboardEntry, SeriesDivisionHealth }

export interface SeriesLeaderboardResponse {
  entries: SeriesLeaderboardEntry[]
  scoringConfig: ScoringConfig
  seriesEvents: Array<{ workoutId: string; name: string; scheme: string }>
  divisionHealth: SeriesDivisionHealth[]
  availableDivisions: Array<{ id: string; label: string }>
  primaryScalingGroupId: string | null
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

export const getSeriesDivisionHealthFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        canonicalScalingGroupId: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      health: SeriesDivisionHealth[]
      primaryScalingGroupId: string | null
    }> => {
      return getSeriesDivisionHealth(data)
    },
  )
