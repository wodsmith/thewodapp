import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	datetime,
	index,
	int,
	mysqlTable,
	tinyint,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import {
	commonColumns,
	createProductCouponId,
	createProductCouponRedemptionId,
} from "./common"
import { commercePurchaseTable } from "./commerce"
import { userTable } from "./users"

/**
 * Product Coupons Table
 * Discount codes for competition registrations and other products
 */
export const productCouponsTable = mysqlTable(
	"product_coupons",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createProductCouponId())
			.notNull(),
		code: varchar({ length: 100 }).notNull(),
		type: varchar({ length: 50 }).notNull().default("competition"),
		productId: varchar({ length: 255 }).notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		createdBy: varchar({ length: 255 }).notNull(),
		amountOffCents: int().notNull(),
		maxRedemptions: int(),
		currentRedemptions: int().notNull().default(0),
		expiresAt: datetime(),
		isActive: tinyint().notNull().default(1),
	},
	(table) => [
		uniqueIndex("product_coupons_code_idx").on(table.code),
		index("product_coupons_team_product_idx").on(table.teamId, table.productId),
		index("product_coupons_product_active_idx").on(
			table.productId,
			table.isActive,
		),
	],
)

/**
 * Product Coupon Redemptions Table
 * Records each use of a coupon code
 */
export const productCouponRedemptionsTable = mysqlTable(
	"product_coupon_redemptions",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createProductCouponRedemptionId())
			.notNull(),
		couponId: varchar({ length: 255 }).notNull(),
		userId: varchar({ length: 255 }).notNull(),
		purchaseId: varchar({ length: 255 }),
		competitionId: varchar({ length: 255 }),
		amountOffCents: int().notNull(),
		stripeCouponId: varchar({ length: 255 }),
		redeemedAt: datetime().notNull(),
	},
	(table) => [
		index("product_coupon_redemptions_coupon_idx").on(table.couponId),
		index("product_coupon_redemptions_user_idx").on(table.userId),
		index("product_coupon_redemptions_purchase_idx").on(table.purchaseId),
	],
)

// Type exports
export type ProductCoupon = InferSelectModel<typeof productCouponsTable>
export type ProductCouponRedemption = InferSelectModel<
	typeof productCouponRedemptionsTable
>

// Relations
export const productCouponsRelations = relations(
	productCouponsTable,
	({ many }) => ({
		redemptions: many(productCouponRedemptionsTable),
	}),
)

export const productCouponRedemptionsRelations = relations(
	productCouponRedemptionsTable,
	({ one }) => ({
		coupon: one(productCouponsTable, {
			fields: [productCouponRedemptionsTable.couponId],
			references: [productCouponsTable.id],
		}),
		user: one(userTable, {
			fields: [productCouponRedemptionsTable.userId],
			references: [userTable.id],
		}),
		purchase: one(commercePurchaseTable, {
			fields: [productCouponRedemptionsTable.purchaseId],
			references: [commercePurchaseTable.id],
		}),
	}),
)
