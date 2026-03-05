import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	datetime,
	index,
	mysqlTable,
	text,
	int,
	varchar,
} from "drizzle-orm/mysql-core"
import { ulid } from "ulid"
import { commonColumns } from "./common"
import { commercePurchaseTable } from "./commerce"
import { teamTable } from "./teams"
import { userTable } from "./users"

// Financial event types
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

// ID generator
export const createFinancialEventId = () => `fevt_${ulid()}`

/**
 * Financial Event Log Table
 *
 * Append-only log of all financial state changes. Rows are never updated or deleted.
 * Every financial event produces exactly one row.
 *
 * Sign convention: positive amountCents = money in, negative = money out.
 */
export const financialEventTable = mysqlTable(
	"financial_events",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createFinancialEventId())
			.notNull(),
		// The purchase this event relates to
		purchaseId: varchar({ length: 255 }).notNull(),
		// Organizer's team (for multi-tenant filtering)
		teamId: varchar({ length: 255 }).notNull(),
		// Event classification
		eventType: varchar({ length: 50 }).$type<FinancialEventType>().notNull(),
		// Amount in cents (positive = money in, negative = money out)
		amountCents: int().notNull(),
		currency: varchar({ length: 10 }).notNull().default("usd"),
		// Stripe references
		stripePaymentIntentId: varchar({ length: 255 }),
		stripeRefundId: varchar({ length: 255 }),
		stripeDisputeId: varchar({ length: 255 }),
		// Context
		reason: text(),
		metadata: text(), // JSON — fee breakdown, backfill flag, etc.
		actorId: varchar({ length: 255 }), // user who triggered (null for webhooks)
		// Stripe event timestamp (when Stripe recorded the event)
		stripeEventTimestamp: datetime(),
	},
	(table) => [
		index("financial_event_purchase_idx").on(table.purchaseId),
		index("financial_event_team_idx").on(table.teamId),
		index("financial_event_type_idx").on(table.eventType),
		index("financial_event_stripe_pi_idx").on(table.stripePaymentIntentId),
		index("financial_event_stripe_dispute_idx").on(table.stripeDisputeId),
	],
)

// Type exports
export type FinancialEvent = InferSelectModel<typeof financialEventTable>

// Relations
export const financialEventRelations = relations(
	financialEventTable,
	({ one }) => ({
		purchase: one(commercePurchaseTable, {
			fields: [financialEventTable.purchaseId],
			references: [commercePurchaseTable.id],
		}),
		team: one(teamTable, {
			fields: [financialEventTable.teamId],
			references: [teamTable.id],
		}),
		actor: one(userTable, {
			fields: [financialEventTable.actorId],
			references: [userTable.id],
		}),
	}),
)
