/**
 * Video Submissions Schema
 *
 * Stores athlete video submissions for online competition events.
 * Athletes can submit a video URL for their workout performance.
 */

import { createId } from "@paralleldrive/cuid2"
import { relations } from "drizzle-orm"
import {
	datetime,
	index,
	mysqlTable,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"
import { competitionRegistrationsTable } from "./competitions"
import { userTable } from "./users"

// ID generator
export const createVideoSubmissionId = () => `vsub_${createId()}`

/**
 * Video Submissions Table
 *
 * Stores video submissions from athletes for online competition events.
 * Each athlete can only have one video submission per event.
 */
export const videoSubmissionsTable = mysqlTable(
	"video_submissions",
	{
		...commonColumns,
		id: varchar({ length: 255 }).primaryKey().$defaultFn(createVideoSubmissionId),

		// The registration this submission belongs to
		registrationId: varchar({ length: 255 })
			.notNull(),

		// The competition event (track workout) this submission is for
		// Uses trackWorkoutId to match the competitionEventsTable pattern
		trackWorkoutId: varchar({ length: 255 }).notNull(),

		// The user who submitted the video
		userId: varchar({ length: 255 })
			.notNull(),

		// The video URL (typically YouTube, but can be other platforms)
		videoUrl: varchar({ length: 2000 }).notNull(),

		// Optional notes from the athlete
		notes: varchar({ length: 1000 }),

		// When the video was submitted
		submittedAt: datetime().notNull(),
	},
	(table) => [
		// One video submission per registration per event
		uniqueIndex("video_submissions_reg_event_idx").on(
			table.registrationId,
			table.trackWorkoutId,
		),
		// Lookup by user
		index("video_submissions_user_idx").on(table.userId),
		// Lookup by event
		index("video_submissions_event_idx").on(table.trackWorkoutId),
		// Lookup by registration
		index("video_submissions_registration_idx").on(table.registrationId),
	],
)

// Relations
export const videoSubmissionsRelations = relations(
	videoSubmissionsTable,
	({ one }) => ({
		registration: one(competitionRegistrationsTable, {
			fields: [videoSubmissionsTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
		user: one(userTable, {
			fields: [videoSubmissionsTable.userId],
			references: [userTable.id],
		}),
	}),
)

// Type exports
export type VideoSubmission = typeof videoSubmissionsTable.$inferSelect
export type VideoSubmissionInsert = typeof videoSubmissionsTable.$inferInsert
