/**
 * Commerce Server Functions for TanStack Start
 * Fee configuration and division fee management
 *
 * Note: Registration payment functions are in registration-fns.ts
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  COMMERCE_PURCHASE_STATUS,
  commercePurchaseTable,
  competitionDivisionsTable,
  competitionDivisionFeesTable,
  competitionGroupsTable,
  competitionsTable,
  scalingLevelsTable,
  TEAM_PERMISSIONS,
  teamTable,
} from "@/db/schema"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getCompetitionRevenueStats } from "@/server/commerce/fee-calculator"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"

// Re-export type for consumers
export type { CompetitionRevenueStats } from "@/server/commerce/fee-calculator"

// ============================================================================
// Series Revenue Types
// ============================================================================

export interface SeriesRevenueStats {
  totalGrossCents: number
  totalOrganizerNetCents: number
  totalStripeFeeCents: number
  totalPlatformFeeCents: number
  totalPurchaseCount: number
  byCompetition: Array<{
    competitionId: string
    competitionName: string
    startDate: string
    grossCents: number
    organizerNetCents: number
    purchaseCount: number
    byDivision: Array<{
      divisionId: string
      divisionLabel: string
      purchaseCount: number
      registrationFeeCents: number
      grossCents: number
      platformFeeCents: number
      stripeFeeCents: number
      organizerNetCents: number
    }>
  }>
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if user has permission for a team (or is a site admin)
 */
async function hasTeamPermission(
  teamId: string,
  permission: string,
): Promise<boolean> {
  const session = await getSessionFromCookie()
  if (!session?.userId) return false

  // Site admins have all permissions
  if (session.user?.role === ROLES_ENUM.ADMIN) return true

  const team = session.teams?.find((t) => t.id === teamId)
  if (!team) return false

  return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
  teamId: string,
  permission: string,
): Promise<void> {
  const hasPermission = await hasTeamPermission(teamId, permission)
  if (!hasPermission) {
    throw new Error(`Missing required permission: ${permission}`)
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionDivisionFeesInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const getSeriesRevenueStatsInputSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
})

const exportSeriesRevenueCsvInputSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
})

const getCompetitionRevenueStatsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const updateCompetitionFeeConfigInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  defaultRegistrationFeeCents: z.number().int().min(0).optional(),
  platformFeePercentage: z.number().min(0).max(100).nullable().optional(),
  platformFeeFixed: z.number().int().min(0).nullable().optional(),
  passStripeFeesToCustomer: z.boolean().optional(),
  passPlatformFeesToCustomer: z.boolean().optional(),
})

const updateDivisionFeeInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  feeCents: z.number().int().min(0).nullable(), // null = remove override
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all division fees for a competition (for admin/display)
 */
export const getCompetitionDivisionFeesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCompetitionDivisionFeesInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Query fees without relation to avoid Drizzle relation resolution issues
    const fees = await db.query.competitionDivisionsTable.findMany({
      where: eq(competitionDivisionsTable.competitionId, data.competitionId),
    })

    // Get division labels separately if there are fees
    const divisionIds = fees.map((f) => f.divisionId)
    const divisions =
      divisionIds.length > 0
        ? await db.query.scalingLevelsTable.findMany({
            where: (table, { inArray }) => inArray(table.id, divisionIds),
          })
        : []

    const divisionMap = new Map(divisions.map((d) => [d.id, d.label]))

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    return {
      defaultFeeCents: competition?.defaultRegistrationFeeCents ?? 0,
      divisionFees: fees.map((f) => ({
        divisionId: f.divisionId,
        divisionLabel: divisionMap.get(f.divisionId),
        feeCents: f.feeCents,
      })),
    }
  })

/**
 * Update competition-level fee configuration
 */
export const updateCompetitionFeeConfigFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateCompetitionFeeConfigInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    // Verify user has permission to manage this competition
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    // Check permission
    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Update competition
    await db
      .update(competitionsTable)
      .set({
        defaultRegistrationFeeCents: input.defaultRegistrationFeeCents,
        platformFeePercentage: input.platformFeePercentage,
        platformFeeFixed: input.platformFeeFixed,
        passStripeFeesToCustomer: input.passStripeFeesToCustomer,
        passPlatformFeesToCustomer: input.passPlatformFeesToCustomer,
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, input.competitionId))

    return { success: true }
  })

/**
 * Get revenue stats for a competition
 */
export const getCompetitionRevenueStatsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCompetitionRevenueStatsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const stats = await getCompetitionRevenueStats(data.competitionId)
    return { stats }
  })

/**
 * Get organizing team's Stripe status for a competition
 */
export const getOrganizerStripeStatusFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ organizingTeamId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, data.organizingTeamId),
      columns: {
        slug: true,
        stripeAccountStatus: true,
      },
    })

    if (!team?.slug) {
      return { stripeStatus: null }
    }

    return {
      stripeStatus: {
        isConnected: team.stripeAccountStatus === "VERIFIED",
        teamSlug: team.slug,
      },
    }
  })

/**
 * Update or remove a division-specific fee
 */
export const updateDivisionFeeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateDivisionFeeInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    // Verify permission
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    if (input.feeCents === null) {
      // Remove override
      await db
        .delete(competitionDivisionsTable)
        .where(
          and(
            eq(competitionDivisionsTable.competitionId, input.competitionId),
            eq(competitionDivisionsTable.divisionId, input.divisionId),
          ),
        )
    } else {
      // Upsert fee
      const existing = await db.query.competitionDivisionsTable.findFirst({
        where: and(
          eq(competitionDivisionsTable.competitionId, input.competitionId),
          eq(competitionDivisionsTable.divisionId, input.divisionId),
        ),
      })

      if (existing) {
        await db
          .update(competitionDivisionsTable)
          .set({ feeCents: input.feeCents, updatedAt: new Date() })
          .where(eq(competitionDivisionsTable.id, existing.id))
      } else {
        await db.insert(competitionDivisionsTable).values({
          competitionId: input.competitionId,
          divisionId: input.divisionId,
          feeCents: input.feeCents,
        })
      }
    }

    return { success: true }
  })

/**
 * Get aggregated revenue stats for a competition series/group
 */
export const getSeriesRevenueStatsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getSeriesRevenueStatsInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<SeriesRevenueStats> => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Unauthorized")

    const db = getDb()

    // Fetch group and verify access
    const group = await db.query.competitionGroupsTable.findFirst({
      where: eq(competitionGroupsTable.id, data.groupId),
    })
    if (!group) throw new Error("Series not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Query 1: Get all competitions in the group
    const competitions = await db
      .select({
        id: competitionsTable.id,
        name: competitionsTable.name,
        startDate: competitionsTable.startDate,
        defaultRegistrationFeeCents:
          competitionsTable.defaultRegistrationFeeCents,
      })
      .from(competitionsTable)
      .where(eq(competitionsTable.groupId, data.groupId))

    if (competitions.length === 0) {
      return {
        totalGrossCents: 0,
        totalOrganizerNetCents: 0,
        totalStripeFeeCents: 0,
        totalPlatformFeeCents: 0,
        totalPurchaseCount: 0,
        byCompetition: [],
      }
    }

    const competitionIds = competitions.map((c) => c.id)

    // Query 2: Aggregated purchases grouped by competitionId and divisionId
    const aggregatedRows = await db
      .select({
        competitionId: commercePurchaseTable.competitionId,
        divisionId: commercePurchaseTable.divisionId,
        purchaseCount: sql<string>`COUNT(*)`,
        grossCents: sql<string>`SUM(${commercePurchaseTable.totalCents})`,
        platformFeeCents: sql<string>`SUM(${commercePurchaseTable.platformFeeCents})`,
        stripeFeeCents: sql<string>`SUM(${commercePurchaseTable.stripeFeeCents})`,
        organizerNetCents: sql<string>`SUM(${commercePurchaseTable.organizerNetCents})`,
      })
      .from(commercePurchaseTable)
      .where(
        and(
          inArray(commercePurchaseTable.competitionId, competitionIds),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
        ),
      )
      .groupBy(
        commercePurchaseTable.competitionId,
        commercePurchaseTable.divisionId,
      )

    // Collect all division IDs for label lookup
    const divisionIds = [
      ...new Set(
        aggregatedRows
          .map((r) => r.divisionId)
          .filter((id): id is string => id !== null),
      ),
    ]

    // Query 3: Division labels
    const divisions =
      divisionIds.length > 0
        ? await db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
            })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, divisionIds))
        : []

    // Query 4: Division fee configs for ticket price display
    const divisionFeeConfigs =
      divisionIds.length > 0
        ? await db
            .select({
              competitionId: competitionDivisionFeesTable.competitionId,
              divisionId: competitionDivisionFeesTable.divisionId,
              feeCents: competitionDivisionFeesTable.feeCents,
            })
            .from(competitionDivisionFeesTable)
            .where(
              inArray(
                competitionDivisionFeesTable.competitionId,
                competitionIds,
              ),
            )
        : []

    const divisionLabelMap = new Map(divisions.map((d) => [d.id, d.label]))
    // Map of "competitionId:divisionId" -> feeCents
    const divisionFeeMap = new Map(
      divisionFeeConfigs.map((f) => [
        `${f.competitionId}:${f.divisionId}`,
        f.feeCents,
      ]),
    )
    const competitionMap = new Map(competitions.map((c) => [c.id, c]))

    // Group aggregated rows by competitionId
    const byCompetitionMap = new Map<
      string,
      {
        competitionId: string
        competitionName: string
        startDate: string
        grossCents: number
        organizerNetCents: number
        purchaseCount: number
        byDivision: Array<{
          divisionId: string
          divisionLabel: string
          purchaseCount: number
          registrationFeeCents: number
          grossCents: number
          platformFeeCents: number
          stripeFeeCents: number
          organizerNetCents: number
        }>
      }
    >()

    for (const row of aggregatedRows) {
      if (!row.competitionId) continue
      const comp = competitionMap.get(row.competitionId)
      if (!comp) continue

      const divisionId = row.divisionId ?? "unknown"
      const registrationFeeCents =
        divisionFeeMap.get(`${row.competitionId}:${divisionId}`) ??
        comp.defaultRegistrationFeeCents ??
        0

      const divisionEntry = {
        divisionId,
        divisionLabel: divisionLabelMap.get(divisionId) ?? "Unknown",
        purchaseCount: Number(row.purchaseCount),
        registrationFeeCents,
        grossCents: Number(row.grossCents),
        platformFeeCents: Number(row.platformFeeCents),
        stripeFeeCents: Number(row.stripeFeeCents),
        organizerNetCents: Number(row.organizerNetCents),
      }

      const existing = byCompetitionMap.get(row.competitionId)
      if (existing) {
        existing.grossCents += divisionEntry.grossCents
        existing.organizerNetCents += divisionEntry.organizerNetCents
        existing.purchaseCount += divisionEntry.purchaseCount
        existing.byDivision.push(divisionEntry)
      } else {
        byCompetitionMap.set(row.competitionId, {
          competitionId: row.competitionId,
          competitionName: comp.name,
          startDate: comp.startDate,
          grossCents: divisionEntry.grossCents,
          organizerNetCents: divisionEntry.organizerNetCents,
          purchaseCount: divisionEntry.purchaseCount,
          byDivision: [divisionEntry],
        })
      }
    }

    // Sort by startDate ASC
    const byCompetition = Array.from(byCompetitionMap.values()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    )

    // Compute series-level totals
    let totalGrossCents = 0
    let totalOrganizerNetCents = 0
    let totalStripeFeeCents = 0
    let totalPlatformFeeCents = 0
    let totalPurchaseCount = 0

    for (const row of aggregatedRows) {
      totalGrossCents += Number(row.grossCents)
      totalOrganizerNetCents += Number(row.organizerNetCents)
      totalStripeFeeCents += Number(row.stripeFeeCents)
      totalPlatformFeeCents += Number(row.platformFeeCents)
      totalPurchaseCount += Number(row.purchaseCount)
    }

    return {
      totalGrossCents,
      totalOrganizerNetCents,
      totalStripeFeeCents,
      totalPlatformFeeCents,
      totalPurchaseCount,
      byCompetition,
    }
  })

/**
 * Export series revenue as CSV
 * Returns a CSV string with one row per competition-division pair
 */
export const exportSeriesRevenueCsvFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    exportSeriesRevenueCsvInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<string> => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Unauthorized")

    const db = getDb()

    // Fetch group and verify access
    const group = await db.query.competitionGroupsTable.findFirst({
      where: eq(competitionGroupsTable.id, data.groupId),
    })
    if (!group) throw new Error("Series not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Reuse stats function
    const stats = await getSeriesRevenueStatsFn({
      data: { groupId: data.groupId },
    })

    // Helper: cents to dollar string
    const toDollars = (cents: number) => (cents / 100).toFixed(2)

    const header = [
      "Competition Name",
      "Competition Date",
      "Division",
      "Registration Count",
      "Gross Revenue",
      "Stripe Fees",
      "Platform Fees",
      "Net Revenue",
    ].join(",")

    const rows: string[] = [header]

    for (const comp of stats.byCompetition) {
      for (const div of comp.byDivision) {
        rows.push(
          [
            `"${comp.competitionName.replace(/"/g, '""')}"`,
            comp.startDate,
            `"${div.divisionLabel.replace(/"/g, '""')}"`,
            div.purchaseCount,
            toDollars(div.grossCents),
            toDollars(div.stripeFeeCents),
            toDollars(div.platformFeeCents),
            toDollars(div.organizerNetCents),
          ].join(","),
        )
      }
    }

    // Summary row
    rows.push(
      [
        '"TOTAL"',
        "",
        "",
        stats.totalPurchaseCount,
        toDollars(stats.totalGrossCents),
        toDollars(stats.totalStripeFeeCents),
        toDollars(stats.totalPlatformFeeCents),
        toDollars(stats.totalOrganizerNetCents),
      ].join(","),
    )

    return rows.join("\n")
  })
