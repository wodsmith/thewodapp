/**
 * Scores Schema
 *
 * A new unified scoring system that replaces the results + sets tables.
 * Designed for efficient sorting and querying.
 */

import { createId } from "@paralleldrive/cuid2"
import { relations } from "drizzle-orm"
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { commonColumns } from "./common"
import { scalingLevelsTable } from "./scaling"
import { teamTable } from "./teams"
import { userTable } from "./users"
import {
	workouts,
	WORKOUT_SCHEME_VALUES,
	SCORE_TYPE_VALUES,
	TIEBREAK_SCHEME_VALUES,
} from "./workouts"

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
export const scoresTable = sqliteTable(
	"scores",
	{
		...commonColumns,
		id: text("id").primaryKey().$defaultFn(createScoreId),

		// Ownership
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id),
		teamId: text("team_id")
			.notNull()
			.references(() => teamTable.id),

		// What was scored
		workoutId: text("workout_id")
			.notNull()
			.references(() => workouts.id),
		competitionEventId: text("competition_event_id"), // NULL for personal logs
		scheduledWorkoutInstanceId: text("scheduled_workout_instance_id"),

		// Score classification
		scheme: text("scheme", { enum: WORKOUT_SCHEME_VALUES }).notNull(),
		scoreType: text("score_type", { enum: SCORE_TYPE_VALUES })
			.notNull()
			.default("max"),

		// Primary score (encoded as integer based on scheme)
		// Time: milliseconds, Rounds+Reps: rounds*100000+reps, Load: grams, Distance: mm
		scoreValue: integer("score_value"),

		// Tiebreak
		tiebreakScheme: text("tiebreak_scheme", { enum: TIEBREAK_SCHEME_VALUES }),
		tiebreakValue: integer("tiebreak_value"),

		// Time cap handling (for time-with-cap workouts)
		timeCapMs: integer("time_cap_ms"),
		// Note: secondaryScheme removed - when capped, score is always reps
		secondaryValue: integer("secondary_value"), // reps completed if capped

		// Status & sorting
		status: text("status", { enum: SCORE_STATUS_NEW_VALUES })
			.notNull()
			.default("scored"),
		statusOrder: integer("status_order").notNull().default(0), // 0=scored, 1=cap, 2=dq, 3=withdrawn
		// Compound sort key: encodes status + normalized score for single-column sorting
		// Stored as text since SQLite doesn't natively support BIGINT
		sortKey: text("sort_key"),

		// Scaling
		scalingLevelId: text("scaling_level_id").references(
			() => scalingLevelsTable.id,
		),
		asRx: integer("as_rx", { mode: "boolean" }).notNull().default(false),

		// Metadata
		notes: text("notes"),
		// When the workout was performed (Unix timestamp ms)
		recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
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
export const scoreRoundsTable = sqliteTable(
	"score_rounds",
	{
		id: text("id").primaryKey().$defaultFn(createScoreRoundId),
		scoreId: text("score_id")
			.notNull()
			.references(() => scoresTable.id, { onDelete: "cascade" }),

		// Round ordering (1-indexed)
		roundNumber: integer("round_number").notNull(),

		// The value for this round (encoded based on parent score's scheme)
		value: integer("value").notNull(),

		// Optional: different scheme per round (rare, but possible)
		schemeOverride: text("scheme_override", { enum: WORKOUT_SCHEME_VALUES }),

		// Status for this specific round
		status: text("status", { enum: SCORE_STATUS_NEW_VALUES }),

		// For time-capped rounds
		secondaryValue: integer("secondary_value"),

		// Metadata
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
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
