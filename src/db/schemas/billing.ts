import { relations } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
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

export const creditTransactionTable = sqliteTable(
	"credit_transaction",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCreditTransactionId())
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		amount: integer().notNull(),
		// Track how many credits are still available from this transaction
		remainingAmount: integer().default(0).notNull(),
		type: text({
			enum: creditTransactionTypeTuple,
		}).notNull(),
		description: text({
			length: 255,
		}).notNull(),
		expirationDate: integer({
			mode: "timestamp",
		}),
		expirationDateProcessedAt: integer({
			mode: "timestamp",
		}),
		paymentIntentId: text({
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

export const purchasedItemsTable = sqliteTable(
	"purchased_item",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createPurchasedItemId())
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		// The type of item (e.g., COMPONENT, TEMPLATE, etc.)
		itemType: text({
			enum: purchasableItemTypeTuple,
		}).notNull(),
		// The ID of the item within its type (e.g., componentId)
		itemId: text().notNull(),
		purchasedAt: integer({
			mode: "timestamp",
		})
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
