import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createScalingGroupId,
	createScalingLevelId,
	createWorkoutScalingDescriptionId,
} from "./common"
import { teamTable } from "./teams"
import { workouts } from "./workouts"

// Scaling Groups table
export const scalingGroupsTable = sqliteTable(
	"scaling_groups",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createScalingGroupId())
			.notNull(),
		title: text({ length: 255 }).notNull(),
		description: text({ length: 1000 }),
		teamId: text().references(() => teamTable.id, {
			onDelete: "cascade",
		}), // Nullable for system groups
		isDefault: integer().default(0).notNull(),
		isSystem: integer().default(0).notNull(), // Marks global default group
	},
	(table) => [
		index("scaling_groups_team_idx").on(table.teamId),
		index("scaling_groups_default_idx").on(table.isDefault),
		index("scaling_groups_system_idx").on(table.isSystem),
	],
)

// Scaling Levels table
export const scalingLevelsTable = sqliteTable(
	"scaling_levels",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createScalingLevelId())
			.notNull(),
		scalingGroupId: text()
			.notNull()
			.references(() => scalingGroupsTable.id, {
				onDelete: "cascade",
			}),
		label: text({ length: 100 }).notNull(),
		position: integer().notNull(), // 0 = hardest, increasing numbers = easier
	},
	(table) => [
		index("scaling_levels_group_idx").on(table.scalingGroupId),
		index("scaling_levels_position_idx").on(
			table.scalingGroupId,
			table.position,
		),
	],
)

// Workout Scaling Descriptions table (optional descriptions for each scaling level in a workout)
export const workoutScalingDescriptionsTable = sqliteTable(
	"workout_scaling_descriptions",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createWorkoutScalingDescriptionId())
			.notNull(),
		workoutId: text()
			.notNull()
			.references(() => workouts.id, {
				onDelete: "cascade",
			}),
		scalingLevelId: text()
			.notNull()
			.references(() => scalingLevelsTable.id, {
				onDelete: "cascade",
			}),
		description: text({ length: 2000 }), // Optional workout-specific description for this scaling level
	},
	(table) => [
		index("workout_scaling_desc_workout_idx").on(table.workoutId),
		index("workout_scaling_desc_lookup_idx").on(
			table.workoutId,
			table.scalingLevelId,
		),
	],
)

// Relations
export const scalingGroupsRelations = relations(
	scalingGroupsTable,
	({ one, many }) => ({
		team: one(teamTable, {
			fields: [scalingGroupsTable.teamId],
			references: [teamTable.id],
		}),
		scalingLevels: many(scalingLevelsTable),
	}),
)

export const scalingLevelsRelations = relations(
	scalingLevelsTable,
	({ one, many }) => ({
		scalingGroup: one(scalingGroupsTable, {
			fields: [scalingLevelsTable.scalingGroupId],
			references: [scalingGroupsTable.id],
		}),
		workoutDescriptions: many(workoutScalingDescriptionsTable),
	}),
)

export const workoutScalingDescriptionsRelations = relations(
	workoutScalingDescriptionsTable,
	({ one }) => ({
		workout: one(workouts, {
			fields: [workoutScalingDescriptionsTable.workoutId],
			references: [workouts.id],
		}),
		scalingLevel: one(scalingLevelsTable, {
			fields: [workoutScalingDescriptionsTable.scalingLevelId],
			references: [scalingLevelsTable.id],
		}),
	}),
)

// Type exports
export type ScalingGroup = InferSelectModel<typeof scalingGroupsTable>
export type ScalingLevel = InferSelectModel<typeof scalingLevelsTable>
export type WorkoutScalingDescription = InferSelectModel<
	typeof workoutScalingDescriptionsTable
>

// Global default scaling group ID constant
export const GLOBAL_DEFAULT_SCALING_GROUP_ID = "sgrp_global_default"
