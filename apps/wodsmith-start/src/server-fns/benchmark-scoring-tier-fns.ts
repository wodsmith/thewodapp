import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { competitionCan } from "@/lib/competitions/capabilities"
import { BenchmarkConfigError } from "@/lib/scoring/algorithms"
import {
  benchmarkBatterySettingsInputSchema,
  benchmarkCategoriesInputSchema,
  benchmarkRatingBandsSchema,
  benchmarkTestCreateInputSchema,
  benchmarkTestUpdateInputSchema,
} from "@/schemas/benchmark.schema"
import {
  benchmarkTierThresholdInputSchema,
  createBenchmarkTest,
  deleteBenchmarkTest,
  loadBenchmarkEventTestOptions,
  loadBenchmarkScoringTierSummary,
  saveBenchmarkTierThresholds,
  updateBenchmarkBatterySettings,
  updateBenchmarkCategories,
  updateBenchmarkRatingBands,
  updateBenchmarkTest,
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

const updateBenchmarkRatingBandsInputSchema =
  benchmarkCompetitionIdSchema.extend({
    ratingBands: benchmarkRatingBandsSchema,
  })

const updateBenchmarkCategoriesInputSchema =
  benchmarkCompetitionIdSchema.extend({
    categories: benchmarkCategoriesInputSchema,
  })

const createBenchmarkTestInputSchema = benchmarkCompetitionIdSchema.extend({
  test: benchmarkTestCreateInputSchema,
  linkTrackWorkoutId: z.string().min(1).nullable().optional(),
})

const updateBenchmarkTestInputSchema = benchmarkCompetitionIdSchema.extend({
  testId: z.string().min(1),
  updates: benchmarkTestUpdateInputSchema,
})

const deleteBenchmarkTestInputSchema = benchmarkCompetitionIdSchema.extend({
  testId: z.string().min(1),
})

const updateBenchmarkBatterySettingsInputSchema =
  benchmarkCompetitionIdSchema.extend({
    settings: benchmarkBatterySettingsInputSchema,
  })

async function requireBenchmarkScoringAccess(competitionId: string) {
  const session = await getSessionFromCookie()
  if (!session?.userId) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
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
    throw new Error("NOT_FOUND: Competition not found")
  }

  if (!competitionCan(competition.competitionType, "benchmarkScoringTiers")) {
    throw new Error(
      "FORBIDDEN: Benchmark scoring tiers are only available for benchmark competitions",
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
    try {
      return {
        status: "ready" as const,
        summary: await loadBenchmarkScoringTierSummary({
          db,
          competitionId: competition.id,
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

/**
 * Benchmark tests, battery config, and events for the organizer event editor.
 * Lenient: returns null options when the battery isn't set up yet.
 */
export const getBenchmarkEventTestOptionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => benchmarkCompetitionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    return {
      options: await loadBenchmarkEventTestOptions({
        db,
        competitionId: competition.id,
      }),
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
    })
  })

export const updateBenchmarkRatingBandsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateBenchmarkRatingBandsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await updateBenchmarkRatingBands({
      db,
      competitionId: competition.id,
      ratingBands: data.ratingBands,
    })

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
    })
  })

export const updateBenchmarkCategoriesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateBenchmarkCategoriesInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await updateBenchmarkCategories({
      db,
      competitionId: competition.id,
      categories: data.categories,
    })

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
    })
  })

export const createBenchmarkTestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createBenchmarkTestInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    const { testId } = await createBenchmarkTest({
      db,
      competitionId: competition.id,
      test: data.test,
      linkTrackWorkoutId: data.linkTrackWorkoutId,
    })

    return {
      testId,
      summary: await loadBenchmarkScoringTierSummary({
        db,
        competitionId: competition.id,
      }),
    }
  })

export const updateBenchmarkTestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateBenchmarkTestInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await updateBenchmarkTest({
      db,
      competitionId: competition.id,
      testId: data.testId,
      updates: data.updates,
    })

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
    })
  })

export const deleteBenchmarkTestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteBenchmarkTestInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await deleteBenchmarkTest({
      db,
      competitionId: competition.id,
      testId: data.testId,
    })

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
    })
  })

export const updateBenchmarkBatterySettingsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    updateBenchmarkBatterySettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    const { db, competition } = await requireBenchmarkScoringAccess(
      data.competitionId,
    )

    await updateBenchmarkBatterySettings({
      db,
      competitionId: competition.id,
      settings: data.settings,
    })

    return loadBenchmarkScoringTierSummary({
      db,
      competitionId: competition.id,
    })
  })
