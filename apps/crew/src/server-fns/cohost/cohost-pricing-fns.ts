/**
 * Cohost Pricing Server Functions
 * Mirrors pricing parts of commerce-fns.ts with cohost auth.
 * Requires "pricing" permission for write operations.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionDivisionsTable,
  competitionsTable,
} from "@/db/schema"
import {
  requireCohostCompetitionOwnership,
  requireCohostPermission,
} from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetPricingSettingsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostUpdateDefaultFeeInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  defaultRegistrationFeeCents: z.number().int().min(0),
  platformFeePercentage: z.number().min(0).max(100).nullable().optional(),
  platformFeeFixed: z.number().int().min(0).nullable().optional(),
  passStripeFeesToCustomer: z.boolean().optional(),
  passPlatformFeesToCustomer: z.boolean().optional(),
})

const cohostUpdateDivisionFeeInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  feeCents: z.number().int().min(0).nullable(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get pricing settings for a competition (cohost view)
 */
export const cohostGetPricingSettingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetPricingSettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "pricing")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Get division fee overrides
    const fees = await db.query.competitionDivisionsTable.findMany({
      where: eq(competitionDivisionsTable.competitionId, data.competitionId),
    })

    const divisionIds = fees.map((f) => f.divisionId)
    const divisions =
      divisionIds.length > 0
        ? await db.query.scalingLevelsTable.findMany({
            where: (table, { inArray }) => inArray(table.id, divisionIds),
          })
        : []

    const divisionMap = new Map(divisions.map((d) => [d.id, d.label]))

    return {
      defaultFeeCents: competition.defaultRegistrationFeeCents ?? 0,
      platformFeePercentage: competition.platformFeePercentage ?? null,
      platformFeeFixed: competition.platformFeeFixed ?? null,
      passStripeFeesToCustomer:
        competition.passStripeFeesToCustomer ?? false,
      passPlatformFeesToCustomer:
        competition.passPlatformFeesToCustomer ?? false,
      divisionFees: fees.map((f) => ({
        divisionId: f.divisionId,
        divisionLabel: divisionMap.get(f.divisionId),
        feeCents: f.feeCents,
      })),
    }
  })

/**
 * Update default fee and fee configuration (cohost — requires pricing)
 */
export const cohostUpdateDefaultFeeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateDefaultFeeInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "pricing")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    await db
      .update(competitionsTable)
      .set({
        defaultRegistrationFeeCents: data.defaultRegistrationFeeCents,
        platformFeePercentage: data.platformFeePercentage,
        platformFeeFixed: data.platformFeeFixed,
        passStripeFeesToCustomer: data.passStripeFeesToCustomer,
        passPlatformFeesToCustomer: data.passPlatformFeesToCustomer,
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, data.competitionId))

    return { success: true }
  })

/**
 * Update or remove a division-specific fee override (cohost — requires pricing)
 */
export const cohostUpdateDivisionFeeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateDivisionFeeInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "pricing")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    if (data.feeCents === null) {
      // Remove override
      await db
        .delete(competitionDivisionsTable)
        .where(
          and(
            eq(competitionDivisionsTable.competitionId, data.competitionId),
            eq(competitionDivisionsTable.divisionId, data.divisionId),
          ),
        )
    } else {
      // Upsert fee
      const existing = await db.query.competitionDivisionsTable.findFirst({
        where: and(
          eq(competitionDivisionsTable.competitionId, data.competitionId),
          eq(competitionDivisionsTable.divisionId, data.divisionId),
        ),
      })

      if (existing) {
        await db
          .update(competitionDivisionsTable)
          .set({ feeCents: data.feeCents, updatedAt: new Date() })
          .where(eq(competitionDivisionsTable.id, existing.id))
      } else {
        await db.insert(competitionDivisionsTable).values({
          competitionId: data.competitionId,
          divisionId: data.divisionId,
          feeCents: data.feeCents,
        })
      }
    }

    return { success: true }
  })
