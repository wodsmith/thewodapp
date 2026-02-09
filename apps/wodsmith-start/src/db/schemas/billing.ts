import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, varchar, datetime } from "drizzle-orm/mysql-core"
import {
	commonColumns,
	createCreditTransactionId,
	createPurchasedItemId,
} from "./common"
import { userTable } from "./users"

// Credit transaction types
export const CREDIT_TRANSACTION_TYPE = {
	PURCHASE: "PURCHASE",
	USAGE: "USAGE",
	MONTHLY_REFRESH: "MONTHLY_REFRESH",
} as const

export const creditTransactionTypeTuple = Object.values(
	CREDIT_TRANSACTION_TYPE,
) as [string, ...string[]]

export const creditTransactionTable = mysqlTable(
	"credit_transactions",
	{
		...commonColumns,
		id: varchar({
			length: 255,
		})
			.primaryKey()
			.$defaultFn(() => createCreditTransactionId())
			.notNull(),
		userId: varchar({
			length: 255,
		}).notNull(),
		amount: int().notNull(),
		// Track how many credits are still available from this transaction
		remainingAmount: int().default(0).notNull(),
		type: varchar({
			length: 255,
			enum: creditTransactionTypeTuple,
		}).notNull(),
		description: varchar({
			length: 255,
		}).notNull(),
		expirationDate: datetime(),
		expirationDateProcessedAt: datetime(),
		paymentIntentId: varchar({
			length: 255,
		}),
	},
	(table) => [
		index("credit_transaction_user_id_idx").on(table.userId),
		index("credit_transaction_type_idx").on(table.type),
		index("credit_transaction_created_at_idx").on(table.createdAt),
		index("credit_transaction_expiration_date_idx").on(table.expirationDate),
		index("credit_transaction_payment_intent_id_idx").on(table.paymentIntentId),
	],
)

// Define item types that can be purchased
export const PURCHASABLE_ITEM_TYPE = {
	COMPONENT: "COMPONENT",
	// Add more types in the future (e.g., TEMPLATE, PLUGIN, etc.)
} as const

export const purchasableItemTypeTuple = Object.values(
	PURCHASABLE_ITEM_TYPE,
) as [string, ...string[]]

export const purchasedItemsTable = mysqlTable(
	"purchased_items",
	{
		...commonColumns,
		id: varchar({
			length: 255,
		})
			.primaryKey()
			.$defaultFn(() => createPurchasedItemId())
			.notNull(),
		userId: varchar({
			length: 255,
		}).notNull(),
		// The type of item (e.g., COMPONENT, TEMPLATE, etc.)
		itemType: varchar({
			length: 255,
			enum: purchasableItemTypeTuple,
		}).notNull(),
		// The ID of the item within its type (e.g., componentId)
		itemId: varchar({
			length: 255,
		}).notNull(),
		purchasedAt: datetime()
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		index("purchased_item_user_id_idx").on(table.userId),
		index("purchased_item_type_idx").on(table.itemType),
		// Composite index for checking if a user owns a specific item of a specific type
		index("purchased_item_user_item_idx").on(
			table.userId,
			table.itemType,
			table.itemId,
		),
	],
)

// Relations
export const creditTransactionRelations = relations(
	creditTransactionTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [creditTransactionTable.userId],
			references: [userTable.id],
			relationName: "creditTransactions",
		}),
	}),
)

export const purchasedItemsRelations = relations(
	purchasedItemsTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [purchasedItemsTable.userId],
			references: [userTable.id],
			relationName: "purchasedItems",
		}),
	}),
)

// Type exports
export type CreditTransaction = InferSelectModel<typeof creditTransactionTable>
export type PurchasedItem = InferSelectModel<typeof purchasedItemsTable>
