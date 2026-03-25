/**
 * Cohost Coupon Server Functions
 * Mirrors coupon-fns.ts with cohost auth.
 * Requires "coupons" permission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable, productCouponsTable } from "@/db/schema"
import { FEATURES } from "@/config/features"
import { logInfo } from "@/lib/logging"
import { hasFeature } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostListCouponsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostCreateCouponInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  amountOffCents: z.number().int().positive("Amount must be greater than 0"),
  code: z.string().trim().min(1).max(100).optional(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
})

const cohostDeactivateCouponInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  couponId: z.string().min(1, "Coupon ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * List all coupons for a competition (cohost — requires coupons)
 */
export const cohostListCouponsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostListCouponsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "coupons")
    const db = getDb()

    // Look up the competition to get the organizing team ID for coupon queries
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { organizingTeamId: true },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    const coupons = await db.query.productCouponsTable.findMany({
      where: and(
        eq(productCouponsTable.productId, data.competitionId),
        eq(productCouponsTable.teamId, competition.organizingTeamId),
      ),
      with: {
        redemptions: true,
      },
    })

    return coupons
  })

/**
 * Create a coupon for a competition (cohost — requires coupons)
 */
export const cohostCreateCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostCreateCouponInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "coupons")

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Look up competition for organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { id: true, organizingTeamId: true },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    const teamId = competition.organizingTeamId

    // Check entitlement
    const hasEntitlement = await hasFeature(teamId, FEATURES.PRODUCT_COUPONS)
    if (!hasEntitlement) {
      throw new Error("Your plan does not include the product coupons feature")
    }

    if (data.amountOffCents <= 0) {
      throw new Error("Amount must be greater than 0")
    }

    const code =
      data.code ?? Math.random().toString(36).substring(2, 10).toUpperCase()

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined

    await db.insert(productCouponsTable).values({
      code,
      productId: data.competitionId,
      teamId,
      createdBy: session.userId,
      amountOffCents: data.amountOffCents,
      maxRedemptions: data.maxRedemptions,
      expiresAt,
      isActive: 1,
    })

    const coupon = await db.query.productCouponsTable.findFirst({
      where: and(
        eq(productCouponsTable.code, code),
        eq(productCouponsTable.productId, data.competitionId),
        eq(productCouponsTable.teamId, teamId),
      ),
    })

    logInfo({
      message: "Coupon created by cohost",
      attributes: {
        couponId: coupon?.id,
        code,
        competitionId: data.competitionId,
        teamId,
        createdBy: session.userId,
      },
    })

    return coupon
  })

/**
 * Deactivate a coupon (cohost — requires coupons)
 */
export const cohostDeactivateCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostDeactivateCouponInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "coupons")
    const db = getDb()

    // Verify coupon exists — look up via competition to get team
    const coupon = await db.query.productCouponsTable.findFirst({
      where: eq(productCouponsTable.id, data.couponId),
    })

    if (!coupon) {
      throw new Error("Coupon not found")
    }

    await db
      .update(productCouponsTable)
      .set({ isActive: 0 })
      .where(eq(productCouponsTable.id, data.couponId))

    logInfo({
      message: "Coupon deactivated by cohost",
      attributes: { couponId: data.couponId },
    })

    return { success: true }
  })
