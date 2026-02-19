import type { InferSelectModel } from "drizzle-orm"
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
	id: varchar({ length: 255 }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	type: varchar({
		length: 255,
		enum: ["weightlifting", "gymnastic", "monostructural"],
	}).notNull(),
})

// Tags table
export const tags = mysqlTable("spicy_tags", {
	...commonColumns,
	id: varchar({ length: 255 }).primaryKey(),
	name: varchar({ length: 255 }).notNull().unique(),
})

// Workouts table - using third argument for self-referencing foreign key
export const workouts = mysqlTable(
	"workouts",
	{
		...commonColumns,
		id: varchar({ length: 255 }).primaryKey(),
		name: varchar({ length: 255 }).notNull(),
		description: text().notNull(),
		scope: varchar({
			length: 255,
			enum: ["private", "public"],
		})
			.default("private")
			.notNull(),
		scheme: varchar({
			length: 255,
			enum: WORKOUT_SCHEME_VALUES,
		}).notNull(),
		scoreType: varchar({
			length: 255,
			enum: SCORE_TYPE_VALUES,
		}),
		repsPerRound: int(),
		roundsToScore: int().default(1),
		teamId: varchar({ length: 255 }),
		sugarId: varchar({ length: 255 }),
		tiebreakScheme: varchar({ length: 255, enum: TIEBREAK_SCHEME_VALUES }),
		timeCap: int(), // Time cap in seconds (for time-with-cap workouts)
		// Note: secondaryScheme removed - when capped, score is always reps
		sourceTrackId: varchar({ length: 255 }),
		sourceWorkoutId: varchar({ length: 255 }),
		scalingGroupId: varchar({ length: 255 }), // Optional scaling group for this workout
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
	id: varchar({ length: 255 }).primaryKey(),
	workoutId: varchar({ length: 255 }).notNull(),
	tagId: varchar({ length: 255 }).notNull(),
})

// Workout Movements junction table
export const workoutMovements = mysqlTable("workout_movements", {
	...commonColumns,
	id: varchar({ length: 255 }).primaryKey(),
	workoutId: varchar({ length: 255 }),
	movementId: varchar({ length: 255 }),
})

// Results base table (consolidated)
export const results = mysqlTable(
	"results",
	{
		...commonColumns,
		id: varchar({ length: 255 }).primaryKey(),
		userId: varchar({ length: 255 }).notNull(),
		date: datetime().notNull(),
		workoutId: varchar({ length: 255 }), // Optional, for WOD results
		type: varchar({
			length: 255,
			enum: ["wod", "strength", "monostructural"],
		}).notNull(),
		notes: text(),
		// Will be set as foreign key reference in main schema file
		programmingTrackId: varchar({ length: 255 }),
		// References to scheduled workout instances (team-based)
		scheduledWorkoutInstanceId: varchar({ length: 255 }),

		// WOD specific results
		scale: varchar({ length: 255, enum: ["rx", "scaled", "rx+"] }), // Deprecated - will be removed after migration
		scalingLevelId: varchar({ length: 255 }), // New: References scaling_levels.id
		asRx: boolean().default(false).notNull(), // New: true if performed as prescribed at that level
		wodScore: varchar({ length: 255 }), // e.g., "3:15", "10 rounds + 5 reps"

		// Strength specific results
		setCount: int(),

		// Monostructural specific results
		distance: int(),
		time: int(),

		// Competition-specific fields
		competitionEventId: varchar({ length: 255 }), // References trackWorkoutsTable.id
		competitionRegistrationId: varchar({ length: 255 }), // References competitionRegistrationsTable.id
		scoreStatus: varchar({ length: 255, enum: SCORE_STATUS_VALUES }), // DNS, DNF, CAP, etc.
		tieBreakScore: varchar({ length: 255 }), // Raw tie-break value (e.g., "120" for reps or seconds)
		secondaryScore: varchar({ length: 255 }), // For time-capped workouts: score achieved when capped (e.g., rounds+reps)
		enteredBy: varchar({ length: 255 }),
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
	id: varchar({ length: 255 }).primaryKey(),
	resultId: varchar({ length: 255 }).notNull(),
	setNumber: int().notNull(),
	notes: text(),

	// Generic set data - only one of these will typically be populated
	reps: int(),
	weight: int(),
	status: varchar({ length: 255, enum: ["pass", "fail"] }),
	distance: int(),
	time: int(),
	score: int(), // For sets within a WOD (e.g., rounds completed in an AMRAP)
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
