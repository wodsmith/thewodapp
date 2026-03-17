/**
 * Read-only PlanetScale schema subset for the ledger app.
 *
 * These are standalone copies of table definitions from wodsmith-start,
 * used only for SELECT queries. No relations are defined.
 */

import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import {
	datetime,
	index,
	int,
	mysqlTable,
	text,
	varchar,
} from "drizzle-orm/mysql-core"

// ---------------------------------------------------------------------------
// Common columns (mirrors apps/wodsmith-start/src/db/schemas/common.ts)
// ---------------------------------------------------------------------------
const commonColumns = {
	createdAt: datetime()
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: datetime()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
		.notNull(),
	updateCounter: int()
		.default(0)
		.$onUpdate(() => sql`update_counter + 1`),
}

// ---------------------------------------------------------------------------
// Financial event types
// ---------------------------------------------------------------------------
export const FINANCIAL_EVENT_TYPE = {
	PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
	PAYMENT_FAILED: "PAYMENT_FAILED",
	REFUND_INITIATED: "REFUND_INITIATED",
	REFUND_COMPLETED: "REFUND_COMPLETED",
	REFUND_FAILED: "REFUND_FAILED",
	DISPUTE_OPENED: "DISPUTE_OPENED",
	DISPUTE_WON: "DISPUTE_WON",
	DISPUTE_LOST: "DISPUTE_LOST",
	PAYOUT_INITIATED: "PAYOUT_INITIATED",
	PAYOUT_COMPLETED: "PAYOUT_COMPLETED",
	PAYOUT_FAILED: "PAYOUT_FAILED",
	MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
} as const

export type FinancialEventType =
	(typeof FINANCIAL_EVENT_TYPE)[keyof typeof FINANCIAL_EVENT_TYPE]

// ---------------------------------------------------------------------------
// financial_events table
// ---------------------------------------------------------------------------
export const financialEventTable = mysqlTable(
	"financial_events",
	{
		...commonColumns,
		id: varchar({ length: 255 }).primaryKey().notNull(),
		purchaseId: varchar({ length: 255 }).notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		eventType: varchar({ length: 50 }).$type<FinancialEventType>().notNull(),
		amountCents: int().notNull(),
		currency: varchar({ length: 10 }).notNull().default("usd"),
		stripePaymentIntentId: varchar({ length: 255 }),
		stripeRefundId: varchar({ length: 255 }),
		stripeDisputeId: varchar({ length: 255 }),
		reason: text(),
		metadata: text(),
		actorId: varchar({ length: 255 }),
		stripeEventTimestamp: datetime(),
	},
	(table) => [
		index("financial_event_purchase_idx").on(table.purchaseId),
		index("financial_event_team_idx").on(table.teamId),
		index("financial_event_type_idx").on(table.eventType),
		index("financial_event_stripe_pi_idx").on(table.stripePaymentIntentId),
		index("financial_event_stripe_refund_idx").on(table.stripeRefundId),
		index("financial_event_stripe_dispute_idx").on(table.stripeDisputeId),
	],
)

export type FinancialEvent = InferSelectModel<typeof financialEventTable>

// ---------------------------------------------------------------------------
// commerce_purchases table (subset of columns needed for ledger queries)
// ---------------------------------------------------------------------------
export const commercePurchaseTable = mysqlTable(
	"commerce_purchases",
	{
		...commonColumns,
		id: varchar({ length: 255 }).primaryKey().notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		totalCents: int().notNull(),
		status: varchar({ length: 20 }).notNull(),
		competitionId: varchar({ length: 255 }),
		stripePaymentIntentId: varchar({ length: 255 }),
		completedAt: datetime(),
	},
	(table) => [
		index("commerce_purchase_competition_idx").on(table.competitionId),
		index("commerce_purchase_stripe_pi_idx").on(table.stripePaymentIntentId),
	],
)

export type CommercePurchase = InferSelectModel<typeof commercePurchaseTable>

// ---------------------------------------------------------------------------
// teams table (subset of columns needed for ledger queries)
// ---------------------------------------------------------------------------
export const teamTable = mysqlTable("teams", {
	...commonColumns,
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
})

export type Team = InferSelectModel<typeof teamTable>
