/**
 * Coupon Server Functions
 * CRUD and validation server functions for product coupons
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable, productCouponsTable } from "@/db/schema"
import { FEATURES } from "@/config/features"
import { logInfo, logWarning } from "@/lib/logging"
import { hasFeature } from "@/server/entitlements"
import { validateCoupon } from "@/server/coupons"
import { getEvlog } from "@/lib/evlog"
import { requireVerifiedEmail } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const createCouponInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  amountOffCents: z.number().int().positive("Amount must be greater than 0"),
  code: z.string().trim().min(1).max(100).optional(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
})

const listCouponsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
})

const getCouponByCodeInputSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
})

const deactivateCouponInputSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
})

const validateCouponForCheckoutInputSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Create a new coupon for a competition.
 * Requires team admin/owner role and PRODUCT_COUPONS entitlement.
 */
export const createCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createCouponInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()

    const canManage = session.teams?.find(
      (t) =>
        t.id === input.teamId &&
        (t.role.id === "admin" || t.role.id === "owner"),
    )
    if (!canManage) throw new Error("Unauthorized")

    getEvlog()?.set({ action: "create_coupon", coupon: { competitionId: input.competitionId }, teamId: input.teamId })

    const hasEntitlement = await hasFeature(
      input.teamId,
      FEATURES.PRODUCT_COUPONS,
    )
    if (!hasEntitlement) {
      throw new Error("Your plan does not include the product coupons feature")
    }

    const db = getDb()

    // Verify competition exists and belongs to team
    const competition = await db.query.competitionsTable.findFirst({
      where: and(
        eq(competitionsTable.id, input.competitionId),
        eq(competitionsTable.organizingTeamId, input.teamId),
      ),
    })
    if (!competition) {
      throw new Error("Competition not found or does not belong to your team")
    }

    if (input.amountOffCents <= 0) {
      throw new Error("Amount must be greater than 0")
    }

    // Generate code if not provided
    const code =
      input.code ?? Math.random().toString(36).substring(2, 10).toUpperCase()

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined

    await db.insert(productCouponsTable).values({
      code,
      productId: input.competitionId,
      teamId: input.teamId,
      createdBy: session.user.id,
      amountOffCents: input.amountOffCents,
      maxRedemptions: input.maxRedemptions,
      expiresAt,
      isActive: 1,
    })

    const coupon = await db.query.productCouponsTable.findFirst({
      where: and(
        eq(productCouponsTable.code, code),
        eq(productCouponsTable.productId, input.competitionId),
        eq(productCouponsTable.teamId, input.teamId),
      ),
    })

    logInfo({
      message: "Coupon created",
      attributes: {
        couponId: coupon?.id,
        code,
        competitionId: input.competitionId,
        teamId: input.teamId,
        createdBy: session.user.id,
      },
    })

    return coupon
  })

/**
 * List all coupons for a competition.
 * Requires team admin/owner role.
 */
export const listCouponsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listCouponsInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()

    const canManage = session.teams?.find(
      (t) =>
        t.id === input.teamId &&
        (t.role.id === "admin" || t.role.id === "owner"),
    )
    if (!canManage) throw new Error("Unauthorized")

    const db = getDb()

    const coupons = await db.query.productCouponsTable.findMany({
      where: and(
        eq(productCouponsTable.productId, input.competitionId),
        eq(productCouponsTable.teamId, input.teamId),
      ),
      with: {
        redemptions: true,
      },
    })

    return coupons
  })

/**
 * Get a coupon by code. Public — no auth required.
 * Returns coupon and competition info, plus validity status.
 */
export const getCouponByCodeFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCouponByCodeInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const db = getDb()

    const coupon = await db.query.productCouponsTable.findFirst({
      where: eq(
        sql`LOWER(${productCouponsTable.code})`,
        input.code.toLowerCase(),
      ),
    })

    if (!coupon) {
      return null
    }

    // Check validity
    const now = new Date()
    if (!coupon.isActive) {
      return {
        coupon,
        competition: null,
        invalid: true as const,
        reason: "This coupon is no longer active.",
      }
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return {
        coupon,
        competition: null,
        invalid: true as const,
        reason: "This coupon has expired.",
      }
    }
    if (
      coupon.maxRedemptions != null &&
      coupon.currentRedemptions >= coupon.maxRedemptions
    ) {
      return {
        coupon,
        competition: null,
        invalid: true as const,
        reason: "This coupon has reached its maximum number of uses.",
      }
    }

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, coupon.productId),
    })

    return { coupon, competition, invalid: false as const, reason: null }
  })

/**
 * Deactivate (soft-delete) a coupon.
 * Requires team admin/owner role.
 */
export const deactivateCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deactivateCouponInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()

    const canManage = session.teams?.find(
      (t) =>
        t.id === input.teamId &&
        (t.role.id === "admin" || t.role.id === "owner"),
    )
    if (!canManage) throw new Error("Unauthorized")

    getEvlog()?.set({ action: "deactivate_coupon", coupon: { id: input.couponId }, teamId: input.teamId })

    const db = getDb()

    // Verify coupon belongs to the team
    const coupon = await db.query.productCouponsTable.findFirst({
      where: and(
        eq(productCouponsTable.id, input.couponId),
        eq(productCouponsTable.teamId, input.teamId),
      ),
    })
    if (!coupon) {
      throw new Error("Coupon not found or does not belong to your team")
    }

    await db
      .update(productCouponsTable)
      .set({ isActive: 0 })
      .where(
        and(
          eq(productCouponsTable.id, input.couponId),
          eq(productCouponsTable.teamId, input.teamId),
        ),
      )

    logInfo({
      message: "Coupon deactivated",
      attributes: { couponId: input.couponId, teamId: input.teamId },
    })

    return { success: true }
  })

/**
 * Validate a coupon code for checkout.
 * Requires authentication.
 */
export const validateCouponForCheckoutFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    validateCouponForCheckoutInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()

    const coupon = await validateCoupon(input.code, input.competitionId)

    if (!coupon) {
      logWarning({
        message: "Coupon validation for checkout failed",
        attributes: {
          code: input.code,
          competitionId: input.competitionId,
          userId: session.user.id,
        },
      })
      return { valid: false, coupon: null, amountOffCents: 0 }
    }

    logInfo({
      message: "Coupon validated for checkout",
      attributes: {
        couponId: coupon.id,
        code: input.code,
        competitionId: input.competitionId,
        userId: session.user.id,
        amountOffCents: coupon.amountOffCents,
      },
    })

    return {
      valid: true,
      coupon,
      amountOffCents: coupon.amountOffCents,
    }
  })
