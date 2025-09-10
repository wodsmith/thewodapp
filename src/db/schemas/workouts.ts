import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { commonColumns } from "./common"
import { teamTable } from "./teams"
import { userTable } from "./users"
import { programmingTracksTable } from "./programming"

// Movement types
export const MOVEMENT_TYPE_VALUES = [
	"weightlifting",
	"gymnastic",
	"monostructural",
] as const

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

// Workouts table
export const workouts = sqliteTable("workouts", {
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
		enum: [
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
		],
	}).notNull(),
	repsPerRound: integer("reps_per_round"),
	roundsToScore: integer("rounds_to_score").default(1),
	teamId: text("team_id").references(() => teamTable.id),
	sugarId: text("sugar_id"),
	tiebreakScheme: text("tiebreak_scheme", { enum: ["time", "reps"] }),
	secondaryScheme: text("secondary_scheme", {
		enum: [
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
		],
	}),
	sourceTrackId: text("source_track_id").references(
		() => programmingTracksTable.id,
	),
	sourceWorkoutId: text("source_workout_id").references(() => workouts.id),
})

// Workout Tags junction table
export const workoutTags = sqliteTable("workout_tags", {
	...commonColumns,
	id: text("id").primaryKey(),
	workoutId: text("workout_id")
		.references(() => workouts.id)
		.notNull(),
	tagId: text("tag_id")
		.references(() => tags.id)
		.notNull(),
})

// Workout Movements junction table
export const workoutMovements = sqliteTable("workout_movements", {
	...commonColumns,
	id: text("id").primaryKey(),
	workoutId: text("workout_id").references(() => workouts.id),
	movementId: text("movement_id").references(() => movements.id),
})

// Results base table (consolidated)
export const results = sqliteTable("results", {
	...commonColumns,
	id: text("id").primaryKey(),
	userId: text("user_id")
		.references(() => userTable.id)
		.notNull(),
	date: integer("date", { mode: "timestamp" }).notNull(),
	workoutId: text("workout_id").references(() => workouts.id), // Optional, for WOD results
	type: text("type", {
		enum: ["wod", "strength", "monostructural"],
	}).notNull(),
	notes: text("notes"),
	// Will be set as foreign key reference in main schema file
	programmingTrackId: text("programming_track_id"),
	// References to scheduled workout instances (team-based)
	scheduledWorkoutInstanceId: text("scheduled_workout_instance_id"),

	// WOD specific results
	scale: text("scale", { enum: ["rx", "scaled", "rx+"] }),
	wodScore: text("wod_score"), // e.g., "3:15", "10 rounds + 5 reps"

	// Strength specific results
	setCount: integer("set_count"),

	// Monostructural specific results
	distance: integer("distance"),
	time: integer("time"),
})

// Sets table (unified for all result types)
export const sets = sqliteTable("sets", {
	...commonColumns,
	id: text("id").primaryKey(),
	resultId: text("result_id")
		.references(() => results.id)
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
