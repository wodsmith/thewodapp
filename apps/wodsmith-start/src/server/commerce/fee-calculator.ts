/**
 * Fee Calculator for TanStack Start
 * Handles competition registration fee calculation and revenue statistics.
 */
import { and, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMMERCE_PURCHASE_STATUS,
  commercePurchaseTable,
  competitionDivisionFeesTable,
  competitionsTable,
  FINANCIAL_EVENT_TYPE,
  financialEventTable,
  scalingLevelsTable,
} from "@/db/schema"

/**
 * Fee configuration for calculating competition fees
 */
export interface FeeConfiguration {
  /** Platform percentage in basis points (250 = 2.5%) */
  platformPercentageBasisPoints: number
  /** Platform fixed fee in cents (200 = $2.00) */
  platformFixedCents: number
  /** Stripe percentage in basis points (290 = 2.9%) */
  stripePercentageBasisPoints: number
  /** Stripe fixed fee in cents (30 = $0.30) */
  stripeFixedCents: number
  /** If true, Stripe fees are passed to customer instead of absorbed by organizer */
  passStripeFeesToCustomer: boolean
  /** If true, platform fees are passed to customer instead of absorbed by organizer (default: true) */
  passPlatformFeesToCustomer: boolean
}

/**
 * Complete fee breakdown for a competition registration
 */
export interface FeeBreakdown {
  /** Base registration fee set by organizer (in cents) */
  registrationFeeCents: number
  /** Platform fee charged by Wodsmith (in cents) */
  platformFeeCents: number
  /** Stripe processing fee (in cents) */
  stripeFeeCents: number
  /** Total amount charged to customer (in cents) */
  totalChargeCents: number
  /** Net amount organizer receives after all fees (in cents) */
  organizerNetCents: number
  /** Whether Stripe fees were passed to customer */
  stripeFeesPassedToCustomer: boolean
  /** Whether platform fees were passed to customer */
  platformFeesPassedToCustomer: boolean
}

/**
 * Get registration fee for a specific competition division
 *
 * Resolution order:
 * 1. Division-specific fee (from competition_division_fees table)
 * 2. Competition default fee (from competitions.defaultRegistrationFeeCents)
 * 3. $0 (free)
 */
export async function getRegistrationFee(
  competitionId: string,
  divisionId: string,
): Promise<number> {
  const db = getDb()

  // Check for division-specific fee first
  const divisionFee = await db.query.competitionDivisionFeesTable.findFirst({
    where: and(
      eq(competitionDivisionFeesTable.competitionId, competitionId),
      eq(competitionDivisionFeesTable.divisionId, divisionId),
    ),
  })

  if (divisionFee) {
    return divisionFee.feeCents
  }

  // Fall back to competition default
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
  })

  if (!competition) {
    throw new Error(
      `Competition not found: ${competitionId}. Cannot retrieve registration fee.`,
    )
  }

  return competition.defaultRegistrationFeeCents ?? 0
}

/**
 * Revenue stats for a competition with fee breakdowns.
 *
 * `totalOrganizerNetCents` and `byDivision[].organizerNetCents` are the
 * pre-refund net (sum of per-purchase organizerNetCents). Refunds are surfaced
 * separately so the page can show a "Refunds" line/column and adjust the
 * displayed Net = organizerNetCents − refundedCents without losing the
 * pre-refund value used elsewhere in the dashboard.
 */
export interface CompetitionRevenueStats {
  /** Total gross revenue collected from customers (in cents) */
  totalGrossCents: number
  /** Total platform fees (Wodsmith revenue) */
  totalPlatformFeeCents: number
  /** Total Stripe processing fees */
  totalStripeFeeCents: number
  /** Total net revenue for organizer after all fees, BEFORE refunds */
  totalOrganizerNetCents: number
  /**
   * Total cents refunded to athletes across this competition. Sourced from
   * REFUND_INITIATED financial events; stored in cents as a positive number
   * (events themselves are negative).
   */
  totalRefundedCents: number
  /** Number of completed purchases */
  purchaseCount: number
  /** Breakdown by division */
  byDivision: Array<{
    divisionId: string
    divisionLabel: string
    purchaseCount: number
    /** Registration fee per athlete (ticket price) in cents */
    registrationFeeCents: number
    grossCents: number
    platformFeeCents: number
    stripeFeeCents: number
    organizerNetCents: number
    /** Cents refunded for purchases in this division (positive). */
    refundedCents: number
  }>
}

/**
 * Pure inputs for `aggregateRevenueStats`. Extracted so the rollup logic can
 * be tested without going through Drizzle.
 */
export interface RevenueStatsInput {
  purchases: Array<{
    purchaseId: string
    divisionId: string | null
    totalCents: number
    platformFeeCents: number
    stripeFeeCents: number
    organizerNetCents: number
  }>
  /**
   * REFUND_INITIATED financial events. `amountCents` is signed (negative for
   * refunds, per the financial_events sign convention) — this function
   * tolerates either sign and rolls up the absolute value.
   */
  refundEvents: Array<{
    purchaseId: string
    amountCents: number
  }>
  divisionLabels: Map<string, string>
  divisionFees: Map<string, number>
  defaultFeeCents: number
}

/**
 * Roll up purchases + refund events into a competition-level revenue stats
 * shape, including per-division refund attribution.
 *
 * Refund events whose purchaseId isn't in `purchases` are ignored — they
 * cannot be attributed to a division and would otherwise either crash or
 * pollute an "Unknown" bucket.
 */
export function aggregateRevenueStats(
  input: RevenueStatsInput,
): CompetitionRevenueStats {
  const purchaseIdToDivision = new Map<string, string>()
  for (const p of input.purchases) {
    purchaseIdToDivision.set(p.purchaseId, p.divisionId ?? "unknown")
  }

  // Sum refund cents per division (and overall). Skip events for unknown
  // purchases; they have no division to attribute to.
  let totalRefundedCents = 0
  const refundedByDivision = new Map<string, number>()
  for (const event of input.refundEvents) {
    const divisionId = purchaseIdToDivision.get(event.purchaseId)
    if (!divisionId) continue
    const cents = Math.abs(event.amountCents)
    totalRefundedCents += cents
    refundedByDivision.set(
      divisionId,
      (refundedByDivision.get(divisionId) ?? 0) + cents,
    )
  }

  let totalGrossCents = 0
  let totalPlatformFeeCents = 0
  let totalStripeFeeCents = 0
  let totalOrganizerNetCents = 0

  const divisionAggregates = new Map<
    string,
    {
      purchaseCount: number
      grossCents: number
      platformFeeCents: number
      stripeFeeCents: number
      organizerNetCents: number
    }
  >()

  for (const purchase of input.purchases) {
    totalGrossCents += purchase.totalCents
    totalPlatformFeeCents += purchase.platformFeeCents
    totalStripeFeeCents += purchase.stripeFeeCents
    totalOrganizerNetCents += purchase.organizerNetCents

    const divisionId = purchase.divisionId ?? "unknown"
    const existing = divisionAggregates.get(divisionId) ?? {
      purchaseCount: 0,
      grossCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: 0,
      organizerNetCents: 0,
    }

    divisionAggregates.set(divisionId, {
      purchaseCount: existing.purchaseCount + 1,
      grossCents: existing.grossCents + purchase.totalCents,
      platformFeeCents: existing.platformFeeCents + purchase.platformFeeCents,
      stripeFeeCents: existing.stripeFeeCents + purchase.stripeFeeCents,
      organizerNetCents:
        existing.organizerNetCents + purchase.organizerNetCents,
    })
  }

  const byDivision = Array.from(divisionAggregates.entries()).map(
    ([divisionId, stats]) => ({
      divisionId,
      divisionLabel: input.divisionLabels.get(divisionId) ?? "Unknown",
      registrationFeeCents:
        input.divisionFees.get(divisionId) ?? input.defaultFeeCents,
      ...stats,
      refundedCents: refundedByDivision.get(divisionId) ?? 0,
    }),
  )

  return {
    totalGrossCents,
    totalPlatformFeeCents,
    totalStripeFeeCents,
    totalOrganizerNetCents,
    totalRefundedCents,
    purchaseCount: input.purchases.length,
    byDivision,
  }
}

/**
 * Get revenue stats for a competition
 * Aggregates all completed purchases with fee breakdowns and per-division
 * refunds (REFUND_INITIATED financial events).
 */
export async function getCompetitionRevenueStats(
  competitionId: string,
): Promise<CompetitionRevenueStats> {
  const db = getDb()

  // Get all completed purchases for this competition
  const purchases = await db
    .select({
      purchaseId: commercePurchaseTable.id,
      divisionId: commercePurchaseTable.divisionId,
      totalCents: commercePurchaseTable.totalCents,
      platformFeeCents: commercePurchaseTable.platformFeeCents,
      stripeFeeCents: commercePurchaseTable.stripeFeeCents,
      organizerNetCents: commercePurchaseTable.organizerNetCents,
    })
    .from(commercePurchaseTable)
    .where(
      and(
        eq(commercePurchaseTable.competitionId, competitionId),
        eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
      ),
    )

  // Get division labels and fees
  const divisionIds = [
    ...new Set(purchases.map((p) => p.divisionId).filter(Boolean)),
  ]
  const divisions =
    divisionIds.length > 0
      ? await db
          .select({
            id: scalingLevelsTable.id,
            label: scalingLevelsTable.label,
          })
          .from(scalingLevelsTable)
          .where(sql`${scalingLevelsTable.id} IN ${divisionIds}`)
      : []

  // Get division fees for ticket prices
  const divisionFees =
    divisionIds.length > 0
      ? await db
          .select({
            divisionId: competitionDivisionFeesTable.divisionId,
            feeCents: competitionDivisionFeesTable.feeCents,
          })
          .from(competitionDivisionFeesTable)
          .where(
            and(
              eq(competitionDivisionFeesTable.competitionId, competitionId),
              sql`${competitionDivisionFeesTable.divisionId} IN ${divisionIds}`,
            ),
          )
      : []

  // Get refund events (REFUND_INITIATED) for the purchases in this comp.
  // We use REFUND_INITIATED rather than REFUND_COMPLETED so the page reflects
  // refunds the moment the organizer kicks them off, not after Stripe's
  // settlement webhook lands. Both rows are eventually written; counting
  // INITIATED avoids double-counting once COMPLETED arrives.
  const purchaseIds = purchases.map((p) => p.purchaseId)
  const refundEvents =
    purchaseIds.length > 0
      ? await db
          .select({
            purchaseId: financialEventTable.purchaseId,
            amountCents: financialEventTable.amountCents,
          })
          .from(financialEventTable)
          .where(
            and(
              inArray(financialEventTable.purchaseId, purchaseIds),
              eq(
                financialEventTable.eventType,
                FINANCIAL_EVENT_TYPE.REFUND_INITIATED,
              ),
            ),
          )
      : []

  // Get competition default fee as fallback for divisions without specific fees
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
    columns: { defaultRegistrationFeeCents: true },
  })
  const defaultFeeCents = competition?.defaultRegistrationFeeCents ?? 0

  return aggregateRevenueStats({
    purchases,
    refundEvents,
    divisionLabels: new Map(divisions.map((d) => [d.id, d.label])),
    divisionFees: new Map(divisionFees.map((f) => [f.divisionId, f.feeCents])),
    defaultFeeCents,
  })
}
