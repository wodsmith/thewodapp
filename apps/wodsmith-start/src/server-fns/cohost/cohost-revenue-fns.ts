/**
 * Cohost Revenue Server Functions
 * Mirrors revenue stats from commerce-fns.ts with cohost auth.
 * Requires "canViewRevenue" permission.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { requireCohostPermission } from "@/utils/cohost-auth"
import { getCompetitionRevenueStats } from "@/server/commerce/fee-calculator"

// Re-export type for consumers
export type { CompetitionRevenueStats } from "@/server/commerce/fee-calculator"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetRevenueStatsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get revenue stats for a competition (cohost — requires canViewRevenue)
 */
export const cohostGetRevenueStatsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetRevenueStatsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canViewRevenue")

    const stats = await getCompetitionRevenueStats(data.competitionId)
    return { stats }
  })
