/**
 * Scores Schema
 *
 * A new unified scoring system that replaces the results + sets tables.
 * Designed for efficient sorting and querying.
 */

import { createId } from "@paralleldrive/cuid2"
import { relations } from "drizzle-orm"
import {
  boolean,
  datetime,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"
import { scalingLevelsTable } from "./scaling"
import { teamTable } from "./teams"
import { userTable } from "./users"
import { workouts } from "./workouts"

// ID generators
export const createScoreId = () => `score_${createId()}`
export const createScoreRoundId = () => `scrd_${createId()}`
export const createScoreVerificationLogId = () => `svlog_${createId()}`

// Score status values for the new scores table
// This is a subset focused on competition/scoring context
const SCORE_STATUS_NEW_VALUES = ["scored", "cap", "dq", "withdrawn"] as const
export type ScoreStatusNew = (typeof SCORE_STATUS_NEW_VALUES)[number]

/**
 * Core scores table
 *
 * Stores workout results with encoded integer values for efficient sorting.
 * Replaces the old results + sets tables.
 */
export const scoresTable = mysqlTable(
  "scores",
  {
    ...commonColumns,
    id: varchar({ length: 255 }).primaryKey().$defaultFn(createScoreId),

    // Ownership
    userId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),

    // What was scored
    workoutId: varchar({ length: 255 }).notNull(),
    // References trackWorkoutsTable.id (NOT competitionEventsTable.id) despite
    // the name. The column predates the event/workout split; all insert sites
    // write the trackWorkoutId here. NULL for personal logs.
    competitionEventId: varchar({ length: 255 }),
    scheduledWorkoutInstanceId: varchar({ length: 255 }),

    // Score classification
    scheme: varchar({ length: 255 }).notNull(),
    scoreType: varchar({ length: 255 }).notNull().default("max"),

    // Primary score (encoded as integer based on scheme)
    // Time: milliseconds, Rounds+Reps: rounds*100000+reps, Load: grams, Distance: mm
    scoreValue: int(),

    // Tiebreak
    tiebreakScheme: varchar({ length: 255 }),
    tiebreakValue: int(),

    // Time cap handling (for time-with-cap workouts)
    timeCapMs: int(),
    // Note: secondaryScheme removed - when capped, score is always reps
    secondaryValue: int(), // reps completed if capped

    // Status & sorting
    status: varchar({ length: 255 }).notNull().default("scored"),
    statusOrder: int().notNull().default(0), // 0=scored, 1=cap, 2=dq, 3=withdrawn
    // Compound sort key: encodes status + normalized score for single-column sorting
    sortKey: varchar({ length: 255 }),

    // Scaling
    scalingLevelId: varchar({ length: 255 }),
    asRx: boolean().notNull().default(false),

    // Metadata
    notes: text(),
    // When the workout was performed (Unix timestamp ms)
    recordedAt: datetime().notNull(),

    // Verification (organizer review for online competitions)
    // null = unreviewed, "verified" = confirmed, "adjusted" = overridden, "invalid" = zeroed
    verificationStatus: varchar({ length: 20 }),
    verifiedAt: datetime(),
    verifiedByUserId: varchar({ length: 255 }),

    // Penalty classification (denormalized from verification log for leaderboard/athlete display)
    // null = no penalty, "minor" | "major"
    penaltyType: varchar("penalty_type", { length: 20 }),
    // The percentage deduction applied (0-100)
    penaltyPercentage: int("penalty_percentage"),
    // Total no-rep count from review notes
    noRepCount: int("no_rep_count"),
  },
  (table) => [
    // User's scores, ordered by date
    index("idx_scores_user").on(table.userId, table.recordedAt),
    // Leaderboard queries: workout + team, sorted by status and score
    index("idx_scores_workout").on(
      table.workoutId,
      table.teamId,
      table.statusOrder,
      table.sortKey,
    ),
    // Competition leaderboards
    index("idx_scores_competition").on(
      table.competitionEventId,
      table.statusOrder,
      table.sortKey,
    ),
    // Scheduled workout lookup
    index("idx_scores_scheduled").on(table.scheduledWorkoutInstanceId),
    // Unique constraint for competition scores (one score per user per event)
    uniqueIndex("idx_scores_competition_user_unique").on(
      table.competitionEventId,
      table.userId,
    ),
  ],
)

/**
 * Score rounds table
 *
 * Stores individual rounds/sets within a score.
 * For multi-round workouts like "10x3 Back Squat" or "3 rounds for time".
 */
export const scoreRoundsTable = mysqlTable(
  "score_rounds",
  {
    id: varchar({ length: 255 }).primaryKey().$defaultFn(createScoreRoundId),
    scoreId: varchar({ length: 255 }).notNull(),

    // Round ordering (1-indexed)
    roundNumber: int().notNull(),

    // The value for this round (encoded based on parent score's scheme)
    value: int().notNull(),

    // Optional: different scheme per round (rare, but possible)
    schemeOverride: varchar({ length: 255 }),

    // Status for this specific round
    status: varchar({ length: 255 }),

    // For time-capped rounds
    secondaryValue: int(),

    // Metadata
    notes: text(),
    createdAt: datetime()
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Lookup rounds for a score
    index("idx_score_rounds_score").on(table.scoreId, table.roundNumber),
    // Unique constraint on score + round number
    uniqueIndex("idx_score_rounds_unique").on(table.scoreId, table.roundNumber),
  ],
)

// Relations
export const scoresRelations = relations(scoresTable, ({ one, many }) => ({
  user: one(userTable, {
    fields: [scoresTable.userId],
    references: [userTable.id],
  }),
  team: one(teamTable, {
    fields: [scoresTable.teamId],
    references: [teamTable.id],
  }),
  workout: one(workouts, {
    fields: [scoresTable.workoutId],
    references: [workouts.id],
  }),
  scalingLevel: one(scalingLevelsTable, {
    fields: [scoresTable.scalingLevelId],
    references: [scalingLevelsTable.id],
  }),
  rounds: many(scoreRoundsTable),
}))

export const scoreRoundsRelations = relations(scoreRoundsTable, ({ one }) => ({
  score: one(scoresTable, {
    fields: [scoreRoundsTable.scoreId],
    references: [scoresTable.id],
  }),
}))

/**
 * Score verification log table
 *
 * Append-only audit trail of every organizer verify/adjust action on a score.
 * For "adjusted" entries, captures the original values before overwrite so
 * the athlete's claimed score is never permanently lost.
 */
export const scoreVerificationLogsTable = mysqlTable(
  "score_verification_logs",
  {
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(createScoreVerificationLogId),

    // The score that was acted on
    scoreId: varchar({ length: 255 }).notNull(),

    // Competition context (denormalized for easy querying, null for non-competition scores)
    competitionId: varchar({ length: 255 }),
    trackWorkoutId: varchar({ length: 255 }),

    // The athlete who owns the score
    athleteUserId: varchar({ length: 255 }).notNull(),

    // What the organizer did
    action: varchar({ length: 20 }).notNull(), // "verified" | "adjusted" | "invalid"

    // Values before adjustment (null for "verified" action)
    originalScoreValue: int(),
    originalStatus: varchar({ length: 50 }),
    originalSecondaryValue: int(),
    originalTiebreakValue: int(),

    // Values after adjustment (null for "verified" action)
    newScoreValue: int(),
    newStatus: varchar({ length: 50 }),
    newSecondaryValue: int(),
    newTiebreakValue: int(),

    // Penalty audit trail (snapshot at time of action)
    penaltyType: varchar("penalty_type", { length: 20 }),
    penaltyPercentage: int("penalty_percentage"),
    noRepCount: int("no_rep_count"),

    // Who did it and when
    performedByUserId: varchar({ length: 255 }).notNull(),
    performedAt: datetime().notNull(),
  },
  (table) => [
    // Look up all log entries for a score
    index("idx_svlog_score").on(table.scoreId),
    // Look up all actions by an organizer
    index("idx_svlog_performer").on(table.performedByUserId, table.performedAt),
  ],
)

export const scoreVerificationLogsRelations = relations(
  scoreVerificationLogsTable,
  ({ one }) => ({
    score: one(scoresTable, {
      fields: [scoreVerificationLogsTable.scoreId],
      references: [scoresTable.id],
    }),
    performedBy: one(userTable, {
      fields: [scoreVerificationLogsTable.performedByUserId],
      references: [userTable.id],
    }),
  }),
)

// Type exports
export type Score = typeof scoresTable.$inferSelect
export type ScoreInsert = typeof scoresTable.$inferInsert
export type ScoreRound = typeof scoreRoundsTable.$inferSelect
export type ScoreRoundInsert = typeof scoreRoundsTable.$inferInsert
