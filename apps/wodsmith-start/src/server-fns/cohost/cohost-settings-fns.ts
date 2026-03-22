/**
 * Cohost Settings Server Functions
 * Mirrors capacity settings from competition-divisions-fns.ts with cohost auth.
 * Write operations are gated by specific permissions:
 *   - Capacity: "canEditCapacity"
 *   - Scoring: "canEditScoring"
 *   - Rotation: "canEditRotation"
 *
 * Note: Rotation and scoring config updates are in cohost-competition-fns.ts.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionDivisionsTable,
  competitionsTable,
  scalingLevelsTable,
} from "@/db/schema"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetCapacitySettingsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostUpdateCapacitySettingsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  defaultMaxSpotsPerDivision: z.number().int().min(1).nullable().optional(),
  maxTotalRegistrations: z.number().int().min(1).nullable().optional(),
})

const cohostUpdateDivisionCapacityInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  maxSpots: z.number().int().min(1).nullable(),
})

const cohostGetScoringSettingsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostGetRotationDefaultsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get capacity settings for a competition (cohost view)
 */
export const cohostGetCapacitySettingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetCapacitySettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    return {
      defaultMaxSpotsPerDivision:
        competition.defaultMaxSpotsPerDivision ?? null,
      maxTotalRegistrations: competition.maxTotalRegistrations ?? null,
    }
  })

/**
 * Update capacity settings (cohost — requires canEditCapacity)
 */
export const cohostUpdateCapacitySettingsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostUpdateCapacitySettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canEditCapacity")
    const db = getDb()

    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (data.defaultMaxSpotsPerDivision !== undefined) {
      updateData.defaultMaxSpotsPerDivision = data.defaultMaxSpotsPerDivision
    }
    if (data.maxTotalRegistrations !== undefined) {
      updateData.maxTotalRegistrations = data.maxTotalRegistrations
    }

    await db
      .update(competitionsTable)
      .set(updateData)
      .where(eq(competitionsTable.id, data.competitionId))

    return { success: true }
  })

/**
 * Update division-specific capacity (cohost — requires canEditCapacity)
 */
export const cohostUpdateDivisionCapacityFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostUpdateDivisionCapacityInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "canEditCapacity")
    const db = getDb()

    // Verify division exists
    const [division] = await db
      .select()
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, data.divisionId))

    if (!division) {
      throw new Error("Division not found")
    }

    // Check if division config exists
    const existing = await db.query.competitionDivisionsTable.findFirst({
      where: and(
        eq(competitionDivisionsTable.competitionId, data.competitionId),
        eq(competitionDivisionsTable.divisionId, data.divisionId),
      ),
    })

    if (existing) {
      await db
        .update(competitionDivisionsTable)
        .set({ maxSpots: data.maxSpots, updatedAt: new Date() })
        .where(eq(competitionDivisionsTable.id, existing.id))
    } else {
      // Get competition default fee for new division config
      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, data.competitionId),
      })
      const defaultFee = competition?.defaultRegistrationFeeCents ?? 0

      await db.insert(competitionDivisionsTable).values({
        competitionId: data.competitionId,
        divisionId: data.divisionId,
        feeCents: defaultFee,
        maxSpots: data.maxSpots,
      })
    }

    return { success: true }
  })

/**
 * Get scoring settings from competition settings JSON (cohost view)
 */
export const cohostGetScoringSettingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetScoringSettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { settings: true },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    let scoringConfig = null
    if (competition.settings) {
      try {
        const parsed = JSON.parse(competition.settings)
        scoringConfig = parsed.scoringConfig ?? null
      } catch {
        // Ignore parse errors
      }
    }

    return { scoringConfig }
  })

/**
 * Get rotation defaults for a competition (cohost view)
 */
export const cohostGetRotationDefaultsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetRotationDefaultsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: {
        defaultHeatsPerRotation: true,
        defaultLaneShiftPattern: true,
      },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    return {
      defaultHeatsPerRotation: competition.defaultHeatsPerRotation,
      defaultLaneShiftPattern: competition.defaultLaneShiftPattern,
    }
  })
