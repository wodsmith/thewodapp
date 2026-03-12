/**
 * Coupon Business Logic
 * Server-only functions for coupon validation and redemption
 */

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	type ProductCoupon,
	productCouponRedemptionsTable,
	productCouponsTable,
} from "@/db/schema"
import { logInfo, logWarning } from "@/lib/logging"
import { getStripe } from "@/lib/stripe"

/**
 * Validate a coupon code for a given competition.
 * Checks: active, not expired, under max redemptions, matches product.
 */
export async function validateCoupon(
	code: string,
	competitionId: string,
): Promise<ProductCoupon | null> {
	const db = getDb()
	const now = new Date()

	const coupon = await db.query.productCouponsTable.findFirst({
		where: and(
			eq(sql`LOWER(${productCouponsTable.code})`, code.toLowerCase()),
			eq(productCouponsTable.isActive, 1),
			eq(productCouponsTable.productId, competitionId),
			or(
				isNull(productCouponsTable.expiresAt),
				gt(productCouponsTable.expiresAt, now),
			),
			or(
				isNull(productCouponsTable.maxRedemptions),
				lt(
					productCouponsTable.currentRedemptions,
					productCouponsTable.maxRedemptions,
				),
			),
		),
	})

	if (!coupon) {
		logInfo({
			message: "Coupon validation failed",
			attributes: { code, competitionId },
		})
		return null
	}

	logInfo({
		message: "Coupon validated successfully",
		attributes: { couponId: coupon.id, code, competitionId },
	})

	return coupon
}

/**
 * Record a coupon redemption after successful checkout.
 * Inserts redemption record and increments currentRedemptions atomically.
 */
export async function recordRedemption(params: {
	couponId: string
	userId: string
	purchaseId: string | null
	competitionId: string
	amountOffCents: number
	stripeCouponId?: string
}): Promise<void> {
	const db = getDb()

	await db.insert(productCouponRedemptionsTable).values({
		couponId: params.couponId,
		userId: params.userId,
		purchaseId: params.purchaseId,
		competitionId: params.competitionId,
		amountOffCents: params.amountOffCents,
		stripeCouponId: params.stripeCouponId,
		redeemedAt: new Date(),
	})

	await db
		.update(productCouponsTable)
		.set({
			currentRedemptions: sql`current_redemptions + 1`,
		})
		.where(eq(productCouponsTable.id, params.couponId))

	logInfo({
		message: "Coupon redemption recorded",
		attributes: {
			couponId: params.couponId,
			userId: params.userId,
			purchaseId: params.purchaseId ?? undefined,
			competitionId: params.competitionId,
			amountOffCents: params.amountOffCents,
		},
	})
}

/**
 * Delete a transient Stripe coupon after successful checkout.
 * Logs a warning if deletion fails (non-fatal).
 */
export async function cleanupStripeCoupon(
	stripeCouponId: string,
): Promise<void> {
	try {
		await getStripe().coupons.del(stripeCouponId)
		logInfo({
			message: "Stripe coupon cleaned up",
			attributes: { stripeCouponId },
		})
	} catch (error) {
		logWarning({
			message: "Failed to cleanup Stripe coupon",
			attributes: { stripeCouponId, error: String(error) },
		})
	}
}
