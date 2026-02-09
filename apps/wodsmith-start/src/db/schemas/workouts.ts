import type { InferSelectModel } from "drizzle-orm"
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
import { teamTable } from "./teams"
import { userTable } from "./users"

// Score status for competition results
export const SCORE_STATUS_VALUES = [
	"scored",
	"dns",
	"dnf",
	"cap",
	"dq",
	"withdrawn",
] as const
export type ScoreStatus = (typeof SCORE_STATUS_VALUES)[number]

// Movement types
export const MOVEMENT_TYPE_VALUES = [
	"weightlifting",
	"gymnastic",
	"monostructural",
] as const

// Workout scheme values - source of truth for all workout scheme enums
export const WORKOUT_SCHEME_VALUES = [
	"time",
	"time-with-cap",
	"pass-fail",
	"rounds-reps",
	"reps",
	"emom",
	"load",
	"calories",
	"meters",
	"feet",
	"points",
] as const
export type WorkoutScheme = (typeof WORKOUT_SCHEME_VALUES)[number]

// Score type values
export const SCORE_TYPE_VALUES = [
	"min",
	"max",
	"sum",
	"average",
	"first",
	"last",
] as const
export type ScoreType = (typeof SCORE_TYPE_VALUES)[number]

// Tiebreak scheme values
export const TIEBREAK_SCHEME_VALUES = ["time", "reps"] as const
export type TiebreakScheme = (typeof TIEBREAK_SCHEME_VALUES)[number]

// Note: Secondary scheme values removed - when time-capped, score is always reps

// Movements table
export const movements = mysqlTable("movements", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	type: varchar("type", {
		length: 255,
		enum: ["weightlifting", "gymnastic", "monostructural"],
	}).notNull(),
})

// Tags table
export const tags = mysqlTable("spicy_tags", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull().unique(),
})

// Workouts table - using third argument for self-referencing foreign key
export const workouts = mysqlTable(
	"workouts",
	{
		...commonColumns,
		id: varchar("id", { length: 255 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		description: varchar("description", { length: 255 }).notNull(),
		scope: varchar("scope", {
			length: 255,
			enum: ["private", "public"],
		})
			.default("private")
			.notNull(),
		scheme: varchar("scheme", {
			length: 255,
			enum: WORKOUT_SCHEME_VALUES,
		}).notNull(),
		scoreType: varchar("score_type", {
			length: 255,
			enum: SCORE_TYPE_VALUES,
		}),
		repsPerRound: int("reps_per_round"),
		roundsToScore: int("rounds_to_score").default(1),
		teamId: varchar("team_id", { length: 255 }),
		sugarId: varchar("sugar_id", { length: 255 }),
		tiebreakScheme: varchar("tiebreak_scheme", { length: 255, enum: TIEBREAK_SCHEME_VALUES }),
		timeCap: int("time_cap"), // Time cap in seconds (for time-with-cap workouts)
		// Note: secondaryScheme removed - when capped, score is always reps
		sourceTrackId: varchar("source_track_id", { length: 255 }),
		sourceWorkoutId: varchar("source_workout_id", { length: 255 }),
		scalingGroupId: varchar("scaling_group_id", { length: 255 }), // Optional scaling group for this workout
	},
	(workouts) => ({
		scalingGroupIdx: index("workouts_scaling_group_idx").on(
			workouts.scalingGroupId,
		),
		teamIdx: index("workouts_team_idx").on(workouts.teamId),
		sourceTrackIdx: index("workouts_source_track_idx").on(
			workouts.sourceTrackId,
		),
		sourceWorkoutIdx: index("workouts_source_workout_idx").on(
			workouts.sourceWorkoutId,
		),
	}),
)

// Workout Tags junction table
export const workoutTags = mysqlTable("workout_tags", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	workoutId: varchar("workout_id", { length: 255 }).notNull(),
	tagId: varchar("tag_id", { length: 255 }).notNull(),
})

// Workout Movements junction table
export const workoutMovements = mysqlTable("workout_movements", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	workoutId: varchar("workout_id", { length: 255 }),
	movementId: varchar("movement_id", { length: 255 }),
})

// Results base table (consolidated)
export const results = mysqlTable(
	"results",
	{
		...commonColumns,
		id: varchar("id", { length: 255 }).primaryKey(),
		userId: varchar("user_id", { length: 255 }).notNull(),
		date: datetime("date").notNull(),
		workoutId: varchar("workout_id", { length: 255 }), // Optional, for WOD results
		type: varchar("type", {
			length: 255,
			enum: ["wod", "strength", "monostructural"],
		}).notNull(),
		notes: varchar("notes", { length: 255 }),
		// Will be set as foreign key reference in main schema file
		programmingTrackId: varchar("programming_track_id", { length: 255 }),
		// References to scheduled workout instances (team-based)
		scheduledWorkoutInstanceId: varchar("scheduled_workout_instance_id", { length: 255 }),

		// WOD specific results
		scale: varchar("scale", { length: 255, enum: ["rx", "scaled", "rx+"] }), // Deprecated - will be removed after migration
		scalingLevelId: varchar("scaling_level_id", { length: 255 }), // New: References scaling_levels.id
		asRx: boolean("as_rx").default(false).notNull(), // New: true if performed as prescribed at that level
		wodScore: varchar("wod_score", { length: 255 }), // e.g., "3:15", "10 rounds + 5 reps"

		// Strength specific results
		setCount: int("set_count"),

		// Monostructural specific results
		distance: int("distance"),
		time: int("time"),

		// Competition-specific fields
		competitionEventId: varchar("competition_event_id", { length: 255 }), // References trackWorkoutsTable.id
		competitionRegistrationId: varchar("competition_registration_id", { length: 255 }), // References competitionRegistrationsTable.id
		scoreStatus: varchar("score_status", { length: 255, enum: SCORE_STATUS_VALUES }), // DNS, DNF, CAP, etc.
		tieBreakScore: varchar("tie_break_score", { length: 255 }), // Raw tie-break value (e.g., "120" for reps or seconds)
		secondaryScore: varchar("secondary_score", { length: 255 }), // For time-capped workouts: score achieved when capped (e.g., rounds+reps)
		enteredBy: varchar("entered_by", { length: 255 }),
	},
	(table) => [
		index("results_scaling_level_idx").on(table.scalingLevelId),
		index("results_workout_scaling_idx").on(
			table.workoutId,
			table.scalingLevelId,
		),
		index("results_leaderboard_idx").on(
			table.workoutId,
			table.scalingLevelId,
			table.wodScore,
		),
		index("results_user_idx").on(table.userId),
		index("results_date_idx").on(table.date),
		index("results_workout_idx").on(table.workoutId),
		// Competition queries: find all results for a competition event by division
		index("results_competition_event_idx").on(
			table.competitionEventId,
			table.scalingLevelId,
		),
		// Unique constraint: one result per user per competition event
		uniqueIndex("results_competition_unique_idx").on(
			table.competitionEventId,
			table.userId,
		),
	],
)

// Sets table (unified for all result types)
export const sets = mysqlTable("sets", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	resultId: varchar("result_id", { length: 255 }).notNull(),
	setNumber: int("set_number").notNull(),
	notes: varchar("notes", { length: 255 }),

	// Generic set data - only one of these will typically be populated
	reps: int("reps"),
	weight: int("weight"),
	status: varchar("status", { length: 255, enum: ["pass", "fail"] }),
	distance: int("distance"),
	time: int("time"),
	score: int("score"), // For sets within a WOD (e.g., rounds completed in an AMRAP)
})

// Relations
export const workoutRelations = relations(workouts, ({ many, one }) => ({
	tags: many(workoutTags),
	movements: many(workoutMovements),
	results: many(results),
	team: one(teamTable, {
		fields: [workouts.teamId],
		references: [teamTable.id],
		relationName: "workouts",
	}),
	sourceWorkout: one(workouts, {
		fields: [workouts.sourceWorkoutId],
		references: [workouts.id],
		relationName: "workoutRemixes",
	}),
	remixes: many(workouts, {
		relationName: "workoutRemixes",
	}),
}))

export const workoutTagRelations = relations(workoutTags, ({ one }) => ({
	workout: one(workouts, {
		fields: [workoutTags.workoutId],
		references: [workouts.id],
	}),
	tag: one(tags, {
		fields: [workoutTags.tagId],
		references: [tags.id],
	}),
}))

export const workoutMovementRelations = relations(
	workoutMovements,
	({ one }) => ({
		workout: one(workouts, {
			fields: [workoutMovements.workoutId],
			references: [workouts.id],
		}),
		movement: one(movements, {
			fields: [workoutMovements.movementId],
			references: [movements.id],
		}),
	}),
)

export const resultRelations = relations(results, ({ many, one }) => ({
	sets: many(sets),
	workout: one(workouts, {
		fields: [results.workoutId],
		references: [workouts.id],
	}),
	user: one(userTable, {
		fields: [results.userId],
		references: [userTable.id],
		relationName: "results",
	}),
}))

export const setRelations = relations(sets, ({ one }) => ({
	result: one(results, {
		fields: [sets.resultId],
		references: [results.id],
	}),
}))

export const tagRelations = relations(tags, ({ many }) => ({
	workoutTags: many(workoutTags),
}))

export const movementRelations = relations(movements, ({ many }) => ({
	workoutMovements: many(workoutMovements),
}))

// Type exports
export type Workout = InferSelectModel<typeof workouts>
export type Movement = InferSelectModel<typeof movements>
export type Tag = InferSelectModel<typeof tags>
export type WorkoutTag = InferSelectModel<typeof workoutTags>
export type Result = InferSelectModel<typeof results>
export type Set = InferSelectModel<typeof sets>
export type WorkoutMovement = InferSelectModel<typeof workoutMovements>
