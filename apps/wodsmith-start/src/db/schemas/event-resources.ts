import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, text, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createEventResourceId } from "./common"
import { trackWorkoutsTable } from "./programming"

/**
 * Event Resources table
 *
 * Allows organizers to attach various resources to competition events.
 * Resources can include video links (movement standards, workout flow),
 * text instructions, or any other supporting material.
 *
 * Each event can have multiple resources, ordered by sortOrder.
 */
export const eventResourcesTable = mysqlTable(
	"event_resources",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createEventResourceId())
			.notNull(),
		// Foreign key to track_workout (competition event)
		eventId: varchar({ length: 255 })
			.notNull(),
		// Title is required
		title: varchar({ length: 255 }).notNull(),
		// Description is optional, supports markdown formatting
		description: text(),
		// URL is optional, for video links, external resources, etc.
		url: varchar({ length: 2048 }),
		// Sort order for display (1, 2, 3...)
		sortOrder: int().notNull().default(1),
	},
	(table) => [
		// Index for efficient lookup by event
		index("event_resources_event_idx").on(table.eventId),
		// Composite index for ordered retrieval by event
		index("event_resources_event_order_idx").on(table.eventId, table.sortOrder),
	],
)

// Relations
export const eventResourcesRelations = relations(
	eventResourcesTable,
	({ one }) => ({
		event: one(trackWorkoutsTable, {
			fields: [eventResourcesTable.eventId],
			references: [trackWorkoutsTable.id],
		}),
	}),
)

// Type exports
export type EventResource = InferSelectModel<typeof eventResourcesTable>
export type NewEventResource = typeof eventResourcesTable.$inferInsert
