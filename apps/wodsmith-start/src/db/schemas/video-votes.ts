/**
 * Video Votes Schema
 *
 * Stores public votes (upvote/downvote) on video submissions
 * for online competition community engagement.
 * Downvotes require a reason (e.g., suspected no-rep, video quality).
 */

import { relations } from "drizzle-orm"
import {
  datetime,
  index,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { ulid } from "ulid"
import { commonColumns } from "./common"
import { userTable } from "./users"
import { videoSubmissionsTable } from "./video-submissions"

// ID generator
export const createVideoVoteId = () => `vvote_${ulid()}`

/**
 * Downvote reason categories
 */
export const downvoteReasons = [
  "suspected_no_rep",
  "video_quality",
  "wrong_movement",
  "incomplete_workout",
  "other",
] as const
export type DownvoteReason = (typeof downvoteReasons)[number]

/**
 * Human-readable labels for downvote reason categories
 */
export const DOWNVOTE_REASON_LABELS: Record<DownvoteReason, string> = {
  suspected_no_rep: "Suspected no-rep",
  video_quality: "Video quality issues",
  wrong_movement: "Wrong movement standard",
  incomplete_workout: "Incomplete workout",
  other: "Other",
}

/**
 * Video Votes Table
 *
 * Each user can cast one vote (up or down) per video submission.
 */
export const videoVotesTable = mysqlTable(
  "video_votes",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(createVideoVoteId),

    // The video submission being voted on
    videoSubmissionId: varchar({ length: 255 }).notNull(),

    // The user casting the vote
    userId: varchar({ length: 255 }).notNull(),

    // Vote type: "upvote" or "downvote"
    voteType: varchar("vote_type", { length: 20 }).notNull(),

    // Required for downvotes — reason category
    reason: varchar({ length: 50 }),

    // Optional free-text detail for downvotes
    reasonDetail: text("reason_detail"),

    // When the vote was cast
    votedAt: datetime().notNull(),
  },
  (table) => [
    // One vote per user per submission
    uniqueIndex("video_votes_user_submission_idx").on(
      table.userId,
      table.videoSubmissionId,
    ),
    // Lookup votes by submission
    index("video_votes_submission_idx").on(table.videoSubmissionId),
    // Lookup votes by user
    index("video_votes_user_idx").on(table.userId),
  ],
)

// Relations
export const videoVotesRelations = relations(videoVotesTable, ({ one }) => ({
  videoSubmission: one(videoSubmissionsTable, {
    fields: [videoVotesTable.videoSubmissionId],
    references: [videoSubmissionsTable.id],
  }),
  user: one(userTable, {
    fields: [videoVotesTable.userId],
    references: [userTable.id],
  }),
}))

// Type exports
export type VideoVote = typeof videoVotesTable.$inferSelect
export type VideoVoteInsert = typeof videoVotesTable.$inferInsert
