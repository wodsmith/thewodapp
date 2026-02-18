import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	boolean,
	index,
	int,
	mysqlTable,
	text,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import {
	commonColumns,
	createScalingGroupId,
	createScalingLevelId,
	createWorkoutScalingDescriptionId,
} from "./common"
import { teamTable } from "./teams"
import { workouts } from "./workouts"

// Scaling Groups table
export const scalingGroupsTable = mysqlTable(
	"scaling_groups",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createScalingGroupId())
			.notNull(),
		title: varchar({ length: 255 }).notNull(),
		description: text('description'),
		teamId: varchar({ length: 255 }), // Nullable for system groups
		isDefault: boolean().default(false).notNull(),
		isSystem: boolean().default(false).notNull(), // Marks global default group
	},
	(table) => [
		index("scaling_groups_team_idx").on(table.teamId),
		index("scaling_groups_default_idx").on(table.isDefault),
		index("scaling_groups_system_idx").on(table.isSystem),
	],
)

// Scaling Levels table
export const scalingLevelsTable = mysqlTable(
	"scaling_levels",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createScalingLevelId())
			.notNull(),
		scalingGroupId: varchar({ length: 255 }).notNull(),
		label: varchar({ length: 100 }).notNull(),
		position: int().notNull(), // 0 = hardest, increasing numbers = easier
		teamSize: int().default(1).notNull(), // 1 = individual, 2+ = team
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
export const workoutScalingDescriptionsTable = mysqlTable(
	"workout_scaling_descriptions",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createWorkoutScalingDescriptionId())
			.notNull(),
		workoutId: varchar({ length: 255 }).notNull(),
		scalingLevelId: varchar({ length: 255 }).notNull(),
		description: text('description'), // Optional workout-specific description for this scaling level
	},
	(table) => [
		index("workout_scaling_desc_workout_idx").on(table.workoutId),
		uniqueIndex("workout_scaling_desc_unique_idx").on(
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
