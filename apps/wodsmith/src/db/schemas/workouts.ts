import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { commonColumns } from "./common"
import { programmingTracksTable } from "./programming"
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

// Secondary scheme values (same as workout scheme minus time-with-cap)
export const SECONDARY_SCHEME_VALUES = [
	"time",
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
export type SecondaryScheme = (typeof SECONDARY_SCHEME_VALUES)[number]

// Movements table
export const movements = sqliteTable("movements", {
	...commonColumns,
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	type: text("type", {
		enum: ["weightlifting", "gymnastic", "monostructural"],
	}).notNull(),
})

// Tags table
export const tags = sqliteTable("spicy_tags", {
	...commonColumns,
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
})

// Workouts table - using third argument for self-referencing foreign key
export const workouts = sqliteTable(
	"workouts",
	{
		...commonColumns,
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description").notNull(),
		scope: text("scope", {
			enum: ["private", "public"],
		})
			.default("private")
			.notNull(),
		scheme: text("scheme", {
			enum: WORKOUT_SCHEME_VALUES,
		}).notNull(),
		scoreType: text("score_type", {
			enum: SCORE_TYPE_VALUES,
		}),
		repsPerRound: integer("reps_per_round"),
		roundsToScore: integer("rounds_to_score").default(1),
		teamId: text("team_id").references(() => teamTable.id, {
			onDelete: "set null",
		}),
		sugarId: text("sugar_id"),
		tiebreakScheme: text("tiebreak_scheme", { enum: TIEBREAK_SCHEME_VALUES }),
		timeCap: integer("time_cap"), // Time cap in seconds (for time-with-cap workouts)
		secondaryScheme: text("secondary_scheme", {
			enum: SECONDARY_SCHEME_VALUES,
		}),
		sourceTrackId: text("source_track_id").references(
			() => programmingTracksTable.id,
			{
				onDelete: "set null",
			},
		),
		sourceWorkoutId: text("source_workout_id"),
		scalingGroupId: text("scaling_group_id"), // Optional scaling group for this workout
	},
	(workouts) => ({
		scalingGroupIdx: index("workouts_scaling_group_idx").on(
			workouts.scalingGroupId,
		),
		teamIdx: index("workouts_team_idx").on(workouts.teamId),
		sourceTrackIdx: index("workouts_source_track_idx").on(
			workouts.sourceTrackId,
		),
		sourceWorkoutSelfRef: foreignKey({
			columns: [workouts.sourceWorkoutId],
			foreignColumns: [workouts.id],
			name: "workouts_source_workout_id_fkey",
		}).onDelete("set null"),
	}),
)

// Workout Tags junction table
export const workoutTags = sqliteTable("workout_tags", {
	...commonColumns,
	id: text("id").primaryKey(),
	workoutId: text("workout_id")
		.references(() => workouts.id, {
			onDelete: "cascade",
		})
		.notNull(),
	tagId: text("tag_id")
		.references(() => tags.id, {
			onDelete: "cascade",
		})
		.notNull(),
})

// Workout Movements junction table
export const workoutMovements = sqliteTable("workout_movements", {
	...commonColumns,
	id: text("id").primaryKey(),
	workoutId: text("workout_id").references(() => workouts.id, {
		onDelete: "cascade",
	}),
	movementId: text("movement_id").references(() => movements.id, {
		onDelete: "cascade",
	}),
})

// Results base table (consolidated)
export const results = sqliteTable(
	"results",
	{
		...commonColumns,
		id: text("id").primaryKey(),
		userId: text("user_id")
			.references(() => userTable.id, {
				onDelete: "cascade",
			})
			.notNull(),
		date: integer("date", { mode: "timestamp" }).notNull(),
		workoutId: text("workout_id").references(() => workouts.id, {
			onDelete: "set null",
		}), // Optional, for WOD results
		type: text("type", {
			enum: ["wod", "strength", "monostructural"],
		}).notNull(),
		notes: text("notes"),
		// Will be set as foreign key reference in main schema file
		programmingTrackId: text("programming_track_id"),
		// References to scheduled workout instances (team-based)
		scheduledWorkoutInstanceId: text("scheduled_workout_instance_id"),

		// WOD specific results
		scale: text("scale", { enum: ["rx", "scaled", "rx+"] }), // Deprecated - will be removed after migration
		scalingLevelId: text("scaling_level_id"), // New: References scaling_levels.id
		asRx: integer("as_rx", { mode: "boolean" }).default(false).notNull(), // New: true if performed as prescribed at that level
		wodScore: text("wod_score"), // e.g., "3:15", "10 rounds + 5 reps"

		// Strength specific results
		setCount: integer("set_count"),

		// Monostructural specific results
		distance: integer("distance"),
		time: integer("time"),

		// Competition-specific fields
		competitionEventId: text("competition_event_id"), // References trackWorkoutsTable.id
		competitionRegistrationId: text("competition_registration_id"), // References competitionRegistrationsTable.id
		scoreStatus: text("score_status", { enum: SCORE_STATUS_VALUES }), // DNS, DNF, CAP, etc.
		tieBreakScore: text("tie_break_score"), // Raw tie-break value (e.g., "120" for reps or seconds)
		secondaryScore: text("secondary_score"), // For time-capped workouts: score achieved when capped (e.g., rounds+reps)
		enteredBy: text("entered_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
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
export const sets = sqliteTable("sets", {
	...commonColumns,
	id: text("id").primaryKey(),
	resultId: text("result_id")
		.references(() => results.id, {
			onDelete: "cascade",
		})
		.notNull(),
	setNumber: integer("set_number").notNull(),
	notes: text("notes"),

	// Generic set data - only one of these will typically be populated
	reps: integer("reps"),
	weight: integer("weight"),
	status: text("status", { enum: ["pass", "fail"] }),
	distance: integer("distance"),
	time: integer("time"),
	score: integer("score"), // For sets within a WOD (e.g., rounds completed in an AMRAP)
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
