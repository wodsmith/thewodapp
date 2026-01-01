import { createId } from "@paralleldrive/cuid2"
import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { commonColumns } from "./common"
import {
	competitionRegistrationsTable,
	competitionsTable,
} from "./competitions"
import { userTable } from "./users"

// ID generator functions
export const createWaiverId = () => `waiv_${createId()}`
export const createWaiverSignatureId = () => `wsig_${createId()}`

/**
 * Waivers Table
 * Stores waiver documents for competitions. Organizers can create multiple waivers
 * per competition with rich text content (Lexical JSON).
 */
export const waiversTable = sqliteTable(
	"waivers",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createWaiverId())
			.notNull(),
		// The competition this waiver belongs to
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// Waiver title (e.g., "Liability Waiver", "Photo Release")
		title: text({ length: 255 }).notNull(),
		// Rich text content stored as Lexical JSON
		content: text({ length: 50000 }).notNull(),
		// Whether this waiver is required for registration
		required: integer({ mode: "boolean" }).default(true).notNull(),
		// Display order (for showing multiple waivers in sequence)
		position: integer().default(0).notNull(),
	},
	(table) => [
		index("waivers_competition_idx").on(table.competitionId),
		index("waivers_position_idx").on(table.competitionId, table.position),
	],
)

/**
 * Waiver Signatures Table
 * Tracks when athletes sign waivers during registration or invite acceptance.
 */
export const waiverSignaturesTable = sqliteTable(
	"waiver_signatures",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createWaiverSignatureId())
			.notNull(),
		// The waiver being signed
		waiverId: text()
			.notNull()
			.references(() => waiversTable.id, { onDelete: "cascade" }),
		// The user who signed the waiver
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		// The registration this signature is associated with (nullable for captains signing during registration creation)
		registrationId: text().references(() => competitionRegistrationsTable.id, {
			onDelete: "cascade",
		}),
		// When the waiver was signed
		signedAt: integer({ mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		// Optional IP address for audit trail
		ipAddress: text({ length: 45 }), // IPv6 max length
	},
	(table) => [
		index("waiver_signatures_waiver_idx").on(table.waiverId),
		index("waiver_signatures_user_idx").on(table.userId),
		index("waiver_signatures_registration_idx").on(table.registrationId),
		// Composite index to quickly check if a user has signed a specific waiver
		index("waiver_signatures_waiver_user_idx").on(table.waiverId, table.userId),
	],
)

// Type exports
export type Waiver = InferSelectModel<typeof waiversTable>
export type WaiverSignature = InferSelectModel<typeof waiverSignaturesTable>

// Relations
export const waiversRelations = relations(waiversTable, ({ one, many }) => ({
	// The competition this waiver belongs to
	competition: one(competitionsTable, {
		fields: [waiversTable.competitionId],
		references: [competitionsTable.id],
	}),
	// All signatures for this waiver
	signatures: many(waiverSignaturesTable),
}))

export const waiverSignaturesRelations = relations(
	waiverSignaturesTable,
	({ one }) => ({
		// The waiver being signed
		waiver: one(waiversTable, {
			fields: [waiverSignaturesTable.waiverId],
			references: [waiversTable.id],
		}),
		// The user who signed
		user: one(userTable, {
			fields: [waiverSignaturesTable.userId],
			references: [userTable.id],
		}),
		// The registration this signature is associated with
		registration: one(competitionRegistrationsTable, {
			fields: [waiverSignaturesTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
	}),
)
