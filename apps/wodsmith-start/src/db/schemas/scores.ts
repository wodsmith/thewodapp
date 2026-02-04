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
		id: varchar("id", { length: 255 }).primaryKey().$defaultFn(createScoreId),

		// Ownership
		userId: varchar("user_id", { length: 255 }).notNull(),
		teamId: varchar("team_id", { length: 255 }).notNull(),

		// What was scored
		workoutId: varchar("workout_id", { length: 255 }).notNull(),
		competitionEventId: varchar("competition_event_id", { length: 255 }), // NULL for personal logs
		scheduledWorkoutInstanceId: varchar("scheduled_workout_instance_id", { length: 255 }),

		// Score classification
		scheme: varchar("scheme", { length: 255 }).notNull(),
		scoreType: varchar("score_type", { length: 255 })
			.notNull()
			.default("max"),

		// Primary score (encoded as integer based on scheme)
		// Time: milliseconds, Rounds+Reps: rounds*100000+reps, Load: grams, Distance: mm
		scoreValue: int("score_value"),

		// Tiebreak
		tiebreakScheme: varchar("tiebreak_scheme", { length: 255 }),
		tiebreakValue: int("tiebreak_value"),

		// Time cap handling (for time-with-cap workouts)
		timeCapMs: int("time_cap_ms"),
		// Note: secondaryScheme removed - when capped, score is always reps
		secondaryValue: int("secondary_value"), // reps completed if capped

		// Status & sorting
		status: varchar("status", { length: 255 })
			.notNull()
			.default("scored"),
		statusOrder: int("status_order").notNull().default(0), // 0=scored, 1=cap, 2=dq, 3=withdrawn
		// Compound sort key: encodes status + normalized score for single-column sorting
		sortKey: varchar("sort_key", { length: 255 }),

		// Scaling
		scalingLevelId: varchar("scaling_level_id", { length: 255 }),
		asRx: boolean("as_rx").notNull().default(false),

		// Metadata
		notes: varchar("notes", { length: 255 }),
		// When the workout was performed (Unix timestamp ms)
		recordedAt: datetime("recorded_at").notNull(),
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
		id: varchar("id", { length: 255 }).primaryKey().$defaultFn(createScoreRoundId),
		scoreId: varchar("score_id", { length: 255 }).notNull(),

		// Round ordering (1-indexed)
		roundNumber: int("round_number").notNull(),

		// The value for this round (encoded based on parent score's scheme)
		value: int("value").notNull(),

		// Optional: different scheme per round (rare, but possible)
		schemeOverride: varchar("scheme_override", { length: 255 }),

		// Status for this specific round
		status: varchar("status", { length: 255 }),

		// For time-capped rounds
		secondaryValue: int("secondary_value"),

		// Metadata
		notes: varchar("notes", { length: 255 }),
		createdAt: datetime("created_at")
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

// Type exports
export type Score = typeof scoresTable.$inferSelect
export type ScoreInsert = typeof scoresTable.$inferInsert
export type ScoreRound = typeof scoreRoundsTable.$inferSelect
export type ScoreRoundInsert = typeof scoreRoundsTable.$inferInsert
