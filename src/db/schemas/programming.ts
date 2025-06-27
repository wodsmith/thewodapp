import { relations } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createProgrammingTrackId,
	createScheduledWorkoutInstanceId,
	createTrackWorkoutId,
} from "./common"
import { teamTable } from "./teams"
import { workouts } from "./workouts"

// Track types enum & tuple
export const PROGRAMMING_TRACK_TYPE = {
	SELF_PROGRAMMED: "self_programmed",
	TEAM_OWNED: "team_owned",
	OFFICIAL_3RD_PARTY: "official_3rd_party",
} as const

export const programmingTrackTypeTuple = Object.values(
	PROGRAMMING_TRACK_TYPE,
) as [string, ...string[]]

// Programming tracks table
export const programmingTracksTable = sqliteTable(
	"programming_track",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createProgrammingTrackId())
			.notNull(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 1000 }),
		type: text({ enum: programmingTrackTypeTuple }).notNull(),
		ownerTeamId: text().references(() => teamTable.id),
		isPublic: integer().default(0).notNull(),
	},
	(table) => [
		index("programming_track_type_idx").on(table.type),
		index("programming_track_owner_idx").on(table.ownerTeamId),
	],
)

// Team programming tracks (join table)
export const teamProgrammingTracksTable = sqliteTable(
	"team_programming_track",
	{
		...commonColumns,
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		isActive: integer().default(1).notNull(),
		subscribedAt: integer({ mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		// Optional: allow teams to customize their start day within the track
		startDayOffset: integer().default(0).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.teamId, table.trackId] }),
		index("team_programming_track_active_idx").on(table.isActive),
		index("team_programming_track_team_idx").on(table.teamId),
	],
)

// Track workouts
export const trackWorkoutsTable = sqliteTable(
	"track_workout",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTrackWorkoutId())
			.notNull(),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		workoutId: text()
			.notNull()
			.references(() => workouts.id),
		dayNumber: integer().notNull(),
		weekNumber: integer(),
		notes: text({ length: 1000 }),
	},
	(table) => [
		index("track_workout_track_idx").on(table.trackId),
		index("track_workout_day_idx").on(table.dayNumber),
		index("track_workout_workoutid_idx").on(table.workoutId),
		index("track_workout_unique_idx").on(
			table.trackId,
			table.workoutId,
			table.dayNumber,
		),
	],
)

// Scheduled Workout Instances
export const scheduledWorkoutInstancesTable = sqliteTable(
	"scheduled_workout_instance",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createScheduledWorkoutInstanceId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id),
		scheduledDate: integer({ mode: "timestamp" }).notNull(),
		teamSpecificNotes: text({ length: 1000 }),
		scalingGuidanceForDay: text({ length: 1000 }),
		classTimes: text({ length: 500 }), // JSON string or comma-separated times
	},
	(table) => [
		index("scheduled_workout_instance_team_idx").on(table.teamId),
		index("scheduled_workout_instance_date_idx").on(table.scheduledDate),
	],
)

// Relations
export const programmingTracksRelations = relations(
	programmingTracksTable,
	({ one, many }) => ({
		ownerTeam: one(teamTable, {
			fields: [programmingTracksTable.ownerTeamId],
			references: [teamTable.id],
		}),
		teamProgrammingTracks: many(teamProgrammingTracksTable),
		trackWorkouts: many(trackWorkoutsTable),
	}),
)

export const teamProgrammingTracksRelations = relations(
	teamProgrammingTracksTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamProgrammingTracksTable.teamId],
			references: [teamTable.id],
		}),
		track: one(programmingTracksTable, {
			fields: [teamProgrammingTracksTable.trackId],
			references: [programmingTracksTable.id],
		}),
	}),
)

export const trackWorkoutsRelations = relations(
	trackWorkoutsTable,
	({ one, many }) => ({
		track: one(programmingTracksTable, {
			fields: [trackWorkoutsTable.trackId],
			references: [programmingTracksTable.id],
		}),
		workout: one(workouts, {
			fields: [trackWorkoutsTable.workoutId],
			references: [workouts.id],
		}),
		scheduledInstances: many(scheduledWorkoutInstancesTable),
	}),
)

export const scheduledWorkoutInstancesRelations = relations(
	scheduledWorkoutInstancesTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [scheduledWorkoutInstancesTable.teamId],
			references: [teamTable.id],
		}),
		trackWorkout: one(trackWorkoutsTable, {
			fields: [scheduledWorkoutInstancesTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
	}),
)

// Type exports
export type ProgrammingTrack = InferSelectModel<typeof programmingTracksTable>
export type TeamProgrammingTrack = InferSelectModel<
	typeof teamProgrammingTracksTable
>
export type TrackWorkout = InferSelectModel<typeof trackWorkoutsTable>
export type ScheduledWorkoutInstance = InferSelectModel<
	typeof scheduledWorkoutInstancesTable
>
