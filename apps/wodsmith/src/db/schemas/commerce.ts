import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createCommerceProductId,
	createCommercePurchaseId,
	createCompetitionDivisionFeeId,
} from "./common"
import { competitionsTable } from "./competitions"
import { scalingLevelsTable } from "./scaling"
import { userTable } from "./users"

// Commerce product types
export const COMMERCE_PRODUCT_TYPE = {
	COMPETITION_REGISTRATION: "COMPETITION_REGISTRATION",
	ADDON: "ADDON",
} as const

export type CommerceProductType =
	(typeof COMMERCE_PRODUCT_TYPE)[keyof typeof COMMERCE_PRODUCT_TYPE]

// Commerce purchase status
export const COMMERCE_PURCHASE_STATUS = {
	PENDING: "PENDING",
	COMPLETED: "COMPLETED",
	FAILED: "FAILED",
	CANCELLED: "CANCELLED",
} as const

export type CommercePurchaseStatus =
	(typeof COMMERCE_PURCHASE_STATUS)[keyof typeof COMMERCE_PURCHASE_STATUS]

// Commerce payment status for registrations
export const COMMERCE_PAYMENT_STATUS = {
	FREE: "FREE",
	PENDING_PAYMENT: "PENDING_PAYMENT",
	PAID: "PAID",
	FAILED: "FAILED",
} as const

export type CommercePaymentStatus =
	(typeof COMMERCE_PAYMENT_STATUS)[keyof typeof COMMERCE_PAYMENT_STATUS]

/**
 * Commerce Product Table
 * Represents purchasable products (competition registrations, add-ons, etc.)
 */
export const commerceProductTable = sqliteTable(
	"commerce_product",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCommerceProductId())
			.notNull(),
		// Product display name (e.g., "Competition Registration - Summer Throwdown 2025")
		name: text({ length: 255 }).notNull(),
		// Product type for categorization
		type: text({ length: 50 }).$type<CommerceProductType>().notNull(),
		// Reference to the resource (e.g., competitionId for registration products)
		resourceId: text().notNull(),
		// Base price in cents
		priceCents: integer().notNull(),
	},
	(table) => [
		// Prevent duplicate products for the same resource
		uniqueIndex("commerce_product_resource_idx").on(
			table.type,
			table.resourceId,
		),
	],
)

/**
 * Commerce Purchase Table
 * Records all purchase transactions
 */
export const commercePurchaseTable = sqliteTable(
	"commerce_purchase",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCommercePurchaseId())
			.notNull(),
		// The user making the purchase
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		// The product being purchased
		productId: text()
			.notNull()
			.references(() => commerceProductTable.id, { onDelete: "cascade" }),
		// Purchase status
		status: text({ length: 20 }).$type<CommercePurchaseStatus>().notNull(),

		// Context for competition registrations (stored directly for efficient queries)
		competitionId: text(),
		divisionId: text(),

		// Amounts (all in cents)
		totalCents: integer().notNull(), // Amount charged to customer
		platformFeeCents: integer().notNull(), // Wodsmith revenue
		stripeFeeCents: integer().notNull(), // Stripe's fee
		organizerNetCents: integer().notNull(), // What organizer receives

		// Stripe references (using Checkout Sessions)
		stripeCheckoutSessionId: text(), // Checkout Session ID
		stripePaymentIntentId: text(), // Set after checkout completes (from session.payment_intent)

		// Extensibility (JSON for team registration data, etc.)
		metadata: text({ length: 10000 }), // JSON

		// Completion timestamp
		completedAt: integer({ mode: "timestamp" }),
	},
	(table) => [
		index("commerce_purchase_user_idx").on(table.userId),
		index("commerce_purchase_product_idx").on(table.productId),
		index("commerce_purchase_status_idx").on(table.status),
		index("commerce_purchase_stripe_session_idx").on(
			table.stripeCheckoutSessionId,
		),
		index("commerce_purchase_competition_idx").on(table.competitionId),
	],
)

/**
 * Competition Divisions Table
 * Stores per-division configuration for competitions including fees and descriptions
 * (e.g., Individual RX: $200 - "Athletes who can perform movements as prescribed")
 */
export const competitionDivisionsTable = sqliteTable(
	"competition_divisions",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionDivisionFeeId())
			.notNull(),
		// The competition this division config applies to
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// The division (scaling level) this config applies to
		divisionId: text()
			.notNull()
			.references(() => scalingLevelsTable.id, { onDelete: "cascade" }),
		// Fee in cents (e.g., 20000 = $200, 35000 = $350)
		feeCents: integer().notNull(),
		// Markdown description explaining who this division is for
		description: text({ length: 2000 }),
	},
	(table) => [
		// Each division can only have one config per competition
		uniqueIndex("competition_divisions_unique_idx").on(
			table.competitionId,
			table.divisionId,
		),
		index("competition_divisions_competition_idx").on(table.competitionId),
	],
)

// Backward compatibility alias
export const competitionDivisionFeesTable = competitionDivisionsTable

// Type exports
export type CommerceProduct = InferSelectModel<typeof commerceProductTable>
export type CommercePurchase = InferSelectModel<typeof commercePurchaseTable>
export type CompetitionDivision = InferSelectModel<
	typeof competitionDivisionsTable
>
// Backward compatibility alias
export type CompetitionDivisionFee = CompetitionDivision

// Relations
export const commerceProductRelations = relations(
	commerceProductTable,
	({ many }) => ({
		purchases: many(commercePurchaseTable),
	}),
)

export const commercePurchaseRelations = relations(
	commercePurchaseTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [commercePurchaseTable.userId],
			references: [userTable.id],
		}),
		product: one(commerceProductTable, {
			fields: [commercePurchaseTable.productId],
			references: [commerceProductTable.id],
		}),
	}),
)

export const competitionDivisionsRelations = relations(
	competitionDivisionsTable,
	({ one }) => ({
		competition: one(competitionsTable, {
			fields: [competitionDivisionsTable.competitionId],
			references: [competitionsTable.id],
		}),
		division: one(scalingLevelsTable, {
			fields: [competitionDivisionsTable.divisionId],
			references: [scalingLevelsTable.id],
		}),
	}),
)

// Backward compatibility alias
export const competitionDivisionFeesRelations = competitionDivisionsRelations
