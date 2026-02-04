import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, mysqlTable, varchar, uniqueIndex } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"
import { createId } from "@paralleldrive/cuid2"
import {
	competitionsTable,
	competitionEventsTable,
	competitionRegistrationsTable,
} from "./competitions"
import { userTable } from "./users"

// ID generator for submission window notifications
export const createSubmissionWindowNotificationId = () =>
	`swnotif_${createId()}`

// Notification types for submission windows
export const SUBMISSION_WINDOW_NOTIFICATION_TYPES = {
	/** Notification sent when submission window opens */
	WINDOW_OPENS: "window_opens",
	/** Reminder sent 24 hours before window closes */
	WINDOW_CLOSES_24H: "window_closes_24h",
	/** Reminder sent 1 hour before window closes */
	WINDOW_CLOSES_1H: "window_closes_1h",
	/** Reminder sent 15 minutes before window closes (last chance) */
	WINDOW_CLOSES_15M: "window_closes_15m",
	/** Notification sent after window has closed */
	WINDOW_CLOSED: "window_closed",
} as const

export type SubmissionWindowNotificationType =
	(typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES)[keyof typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES]

/**
 * Submission Window Notifications Table
 * Tracks which notifications have been sent to avoid duplicates.
 * Each notification is uniquely identified by:
 * - competitionEventId (the specific event/workout)
 * - registrationId (the athlete's registration)
 * - type (the notification trigger type)
 */
export const submissionWindowNotificationsTable = mysqlTable(
	"submission_window_notifications",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createSubmissionWindowNotificationId())
			.notNull(),
		// The competition this notification is for
		competitionId: varchar({ length: 255 })
			.notNull(),
		// The specific event (workout) with the submission window
		competitionEventId: varchar({ length: 255 })
			.notNull(),
		// The athlete's registration
		registrationId: varchar({ length: 255 })
			.notNull(),
		// The user who received the notification
		userId: varchar({ length: 255 })
			.notNull(),
		// Type of notification
		type: varchar({ length: 255 }).$type<SubmissionWindowNotificationType>().notNull(),
		// Email address the notification was sent to (for logging/debugging)
		sentToEmail: varchar({ length: 255 }),
	},
	(table) => [
		// Index for finding notifications by competition
		index("submission_window_notif_competition_idx").on(table.competitionId),
		// Index for finding notifications by event
		index("submission_window_notif_event_idx").on(table.competitionEventId),
		// Index for finding notifications by user
		index("submission_window_notif_user_idx").on(table.userId),
		// Unique constraint: one notification per type per event per registration
		// This prevents duplicate notifications
		uniqueIndex("submission_window_notif_unique_idx").on(
			table.competitionEventId,
			table.registrationId,
			table.type,
		),
	],
)

// Type exports
export type SubmissionWindowNotification = InferSelectModel<
	typeof submissionWindowNotificationsTable
>

// Relations
export const submissionWindowNotificationsRelations = relations(
	submissionWindowNotificationsTable,
	({ one }) => ({
		competition: one(competitionsTable, {
			fields: [submissionWindowNotificationsTable.competitionId],
			references: [competitionsTable.id],
		}),
		competitionEvent: one(competitionEventsTable, {
			fields: [submissionWindowNotificationsTable.competitionEventId],
			references: [competitionEventsTable.id],
		}),
		registration: one(competitionRegistrationsTable, {
			fields: [submissionWindowNotificationsTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
		user: one(userTable, {
			fields: [submissionWindowNotificationsTable.userId],
			references: [userTable.id],
		}),
	}),
)
