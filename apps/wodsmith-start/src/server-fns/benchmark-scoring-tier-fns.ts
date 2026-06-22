import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { competitionCan } from "@/lib/competitions/capabilities"
import { BenchmarkConfigError } from "@/lib/scoring/algorithms"
import {
  activateBenchmarkOnlineScoring,
  activateBenchmarkScoring,
  benchmarkTierThresholdInputSchema,
  loadBenchmarkScoringTierSummary,
  saveBenchmarkTierThresholds,
} from "@/server/benchmark-scoring-tiers"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

const benchmarkCompetitionIdSchema = z.object({
  competitionId: z.string().min(1),
})

const saveBenchmarkScoringTiersInputSchema =
  benchmarkCompetitionIdSchema.extend({
    thresholds: z.array(benchmarkTierThresholdInputSchema).min(1),
  })

async function requireBenchmarkScoringAccess(competitionId: string) {
  const session = await getSessionFromCookie()
  if (!session?.userId) {
    throw new Error("Unauthorized")
  }

  const db = getDb()
  const [competition] = await db
    .select({
      id: competitionsTable.id,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionType: competitionsTable.competitionType,
      settings: competitionsTable.settings,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    throw new Error("Competition not found")
  }

  if (!competitionCan(competition.competitionType, "benchmarkScoringTiers")) {
    throw new Error(
      "Benchmark scoring tiers are only available for benchmark competitions",
    )
  }

  await requireTeamPermission(
    competition.organizingTeamId,
    TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
  )

  return { db, competition }
}

export const getBenchmarkScoringTiersFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => benchmarkCompetitionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )
    const scoringConfig = parseScoringConfig(competition.settings)

    try {
      return {
        status: "ready" as const,
        summary: await loadBenchmarkScoringTierSummary({
          db,
          competitionId: competition.id,
          scoringConfig,
        }),
      }
    } catch (error) {
      if (error instanceof BenchmarkConfigError) {
        return {
          status: "setupRequired" as const,
          competitionId: competition.id,
          reason: error.message,
        }
      }
      throw error
    }
  })

export const saveBenchmarkScoringTiersFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    saveBenchmarkScoringTiersInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await saveBenchmarkTierThresholds({
      db,
      competitionId: competition.id,
      thresholds: data.thresholds,
    })

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
      scoringConfig: parseScoringConfig(competition.settings),
    })
  })

export const activateBenchmarkScoringFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => benchmarkCompetitionIdSchema.parse(data))
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await activateBenchmarkScoring({
      db,
      competitionId: competition.id,
    })

    const [updatedCompetition] = await db
      .select({ settings: competitionsTable.settings })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, competition.id))
      .limit(1)

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
      scoringConfig: parseScoringConfig(updatedCompetition?.settings),
    })
  })

export const activateBenchmarkOnlineScoringFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => benchmarkCompetitionIdSchema.parse(data))
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await activateBenchmarkOnlineScoring({
      db,
      competitionId: competition.id,
    })

    const [updatedCompetition] = await db
      .select({ settings: competitionsTable.settings })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, competition.id))
      .limit(1)

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
      scoringConfig: parseScoringConfig(updatedCompetition?.settings),
    })
  })

function parseScoringConfig(settings: string | null) {
  if (!settings) return null
  try {
    return JSON.parse(settings).scoringConfig ?? null
  } catch {
    return null
  }
}
