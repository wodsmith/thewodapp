import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { commonColumns, createDocumentId } from "./common"

export const SUBSCRIPTION_TERMS = [
	"monthly",
	"quarterly",
	"yearly",
	"one-time",
] as const
export type SubscriptionTerm = (typeof SUBSCRIPTION_TERMS)[number]

export const DOCUMENT_CATEGORIES = [
	"infrastructure",
	"saas",
	"services",
	"legal",
	"insurance",
	"other",
] as const
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export const PAYMENT_STATUSES = ["paid", "unpaid", "overdue"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const documentsTable = sqliteTable("documents", {
	id: text().primaryKey().$defaultFn(createDocumentId),
	/** Original file name as uploaded */
	fileName: text().notNull(),
	/** Key used to store the file in R2 */
	r2Key: text().notNull(),
	/** Vendor or company that issued the invoice */
	vendor: text().notNull(),
	/** Optional description of the document */
	description: text(),
	/** Amount in cents (e.g., 9999 = $99.99) */
	amountCents: integer(),
	/** ISO 4217 currency code */
	currency: text().default("USD").notNull(),
	/** Billing frequency */
	subscriptionTerm: text().$type<SubscriptionTerm>(),
	/** Document category for organization */
	category: text().$type<DocumentCategory>(),
	/** Date the invoice was issued */
	invoiceDate: text(),
	/** Date the payment is due */
	dueDate: text(),
	/** Payment status */
	status: text().$type<PaymentStatus>().default("unpaid").notNull(),
	/** MIME type of the uploaded file */
	contentType: text(),
	/** File size in bytes */
	fileSize: integer(),
	...commonColumns,
})

export type Document = typeof documentsTable.$inferSelect
export type NewDocument = typeof documentsTable.$inferInsert
