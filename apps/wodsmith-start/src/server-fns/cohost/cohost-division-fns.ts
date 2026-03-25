/**
 * Cohost Division Server Functions
 * Mirrors competition-divisions-fns.ts with cohost auth.
 * Provides READ access to divisions and scaling groups for the cohost dashboard.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionDivisionsTable,
} from "@/db/schemas/commerce"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Types
// ============================================================================

export interface CohostDivisionWithCounts {
  id: string
  label: string
  position: number
  registrationCount: number
  description: string | null
  feeCents: number | null
  maxSpots: number | null
  teamSize: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const cohostDivisionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostScalingGroupInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  scalingGroupId: z.string().min(1, "Scaling Group ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

function parseCompetitionSettings(settings: string | null): {
  divisions?: { scalingGroupId?: string }
} | null {
  if (!settings) return null
  try {
    return JSON.parse(settings)
  } catch {
    return null
  }
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get divisions with registration counts (cohost view)
 */
export const cohostGetDivisionsWithCountsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostDivisionsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    const db = getDb()

    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    const settings = parseCompetitionSettings(competition.settings)
    const scalingGroupId = settings?.divisions?.scalingGroupId ?? null

    if (!scalingGroupId) {
      return { scalingGroupId: null, scalingGroupTitle: null, divisions: [] }
    }

    const [scalingGroup] = await db
      .select({ title: scalingGroupsTable.title })
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.id, scalingGroupId))

    const divisions = await db
      .select({
        id: scalingLevelsTable.id,
        label: scalingLevelsTable.label,
        position: scalingLevelsTable.position,
        description: competitionDivisionsTable.description,
        feeCents: competitionDivisionsTable.feeCents,
        maxSpots: competitionDivisionsTable.maxSpots,
        teamSize: scalingLevelsTable.teamSize,
        registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as unsigned)`,
      })
      .from(scalingLevelsTable)
      .leftJoin(
        competitionDivisionsTable,
        and(
          eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
          eq(competitionDivisionsTable.competitionId, data.competitionId),
        ),
      )
      .leftJoin(
        competitionRegistrationsTable,
        and(
          eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
      .groupBy(
        scalingLevelsTable.id,
        scalingLevelsTable.teamSize,
        competitionDivisionsTable.description,
        competitionDivisionsTable.feeCents,
        competitionDivisionsTable.maxSpots,
      )
      .orderBy(scalingLevelsTable.position)

    return {
      scalingGroupId,
      scalingGroupTitle: scalingGroup?.title ?? null,
      defaultMaxSpotsPerDivision: competition.defaultMaxSpotsPerDivision,
      divisions: divisions.map((d) => ({
        ...d,
        description: d.description ?? null,
        feeCents: d.feeCents ?? competition.defaultRegistrationFeeCents ?? null,
        maxSpots: d.maxSpots ?? null,
      })) as CohostDivisionWithCounts[],
    }
  })

/**
 * Get a scaling group with its levels (cohost view)
 */
export const cohostGetScalingGroupWithLevelsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => cohostScalingGroupInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    const db = getDb()

    const scalingGroup = await db.query.scalingGroupsTable.findFirst({
      where: eq(scalingGroupsTable.id, data.scalingGroupId),
      with: {
        scalingLevels: {
          orderBy: (table, { asc }) => [asc(table.position)],
        },
      },
    })

    return scalingGroup
  })
