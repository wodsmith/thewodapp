import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core"
import { commonColumns } from "./common"
import { teamTable } from "./teams"
import { userTable } from "./users"

// Store coach-specific settings, linking a user to a team
export const coachesTable = sqliteTable(
	"coaches",
	{
		...commonColumns,
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id),
		teamId: text("team_id")
			.notNull()
			.references(() => teamTable.id),
		weeklyClassLimit: integer("weekly_class_limit"),
		schedulingPreference: text("scheduling_preference", {
			enum: ["morning", "afternoon", "night", "any"],
		}),
		schedulingNotes: text("scheduling_notes"), // For soft, unstructured preferences
		isActive: integer("is_active").default(1).notNull(),
	},
	(table) => [
		index("coach_user_team_unique_idx").on(table.userId, table.teamId),
	],
)

// Gym configuration tables
export const locationsTable = sqliteTable("locations", {
	...commonColumns,
	id: text("id").primaryKey(),
	teamId: text("team_id")
		.notNull()
		.references(() => teamTable.id),
	name: text("name").notNull(),
	capacity: integer("capacity").default(20).notNull(),
})

export const classCatalogTable = sqliteTable("class_catalog", {
	...commonColumns,
	id: text("id").primaryKey(),
	teamId: text("team_id")
		.notNull()
		.references(() => teamTable.id),
	name: text("name").notNull(),
	description: text("description"),
	durationMinutes: integer("duration_minutes").notNull().default(60),
	maxParticipants: integer("max_participants").notNull().default(20),
})

export const skillsTable = sqliteTable("skills", {
	...commonColumns,
	id: text("id").primaryKey(),
	teamId: text("team_id")
		.notNull()
		.references(() => teamTable.id),
	name: text("name").notNull(),
})

export const classCatalogToSkillsTable = sqliteTable(
	"class_catalog_to_skills",
	{
		classCatalogId: text("class_catalog_id")
			.notNull()
			.references(() => classCatalogTable.id, { onDelete: "cascade" }),
		skillId: text("skill_id")
			.notNull()
			.references(() => skillsTable.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.classCatalogId, table.skillId] })],
)

// Coach constraint tables
export const coachToSkillsTable = sqliteTable(
	"coach_to_skills",
	{
		coachId: text("coach_id")
			.notNull()
			.references(() => coachesTable.id),
		skillId: text("skill_id")
			.notNull()
			.references(() => skillsTable.id),
	},
	(table) => [primaryKey({ columns: [table.coachId, table.skillId] })],
)

export const coachBlackoutDatesTable = sqliteTable("coach_blackout_dates", {
	...commonColumns,
	id: text("id").primaryKey(),
	coachId: text("coach_id")
		.notNull()
		.references(() => coachesTable.id),
	startDate: integer("start_date", { mode: "timestamp" }).notNull(),
	endDate: integer("end_date", { mode: "timestamp" }).notNull(),
	reason: text("reason"),
})

export const coachRecurringUnavailabilityTable = sqliteTable(
	"coach_recurring_unavailability",
	{
		...commonColumns,
		id: text("id").primaryKey(),
		coachId: text("coach_id")
			.notNull()
			.references(() => coachesTable.id),
		dayOfWeek: integer("day_of_week").notNull(), // 0-6 for Sunday-Saturday
		startTime: text("start_time").notNull(), // "HH:MM"
		endTime: text("end_time").notNull(), // "HH:MM"
		description: text("description"),
	},
)

// Schedule template tables
export const scheduleTemplatesTable = sqliteTable("schedule_templates", {
	...commonColumns,
	id: text("id").primaryKey(),
	teamId: text("team_id")
		.notNull()
		.references(() => teamTable.id),
	name: text("name").notNull(),
})

export const scheduleTemplateClassesTable = sqliteTable(
	"schedule_template_classes",
	{
		...commonColumns,
		id: text("id").primaryKey(),
		templateId: text("template_id")
			.notNull()
			.references(() => scheduleTemplatesTable.id),
		classCatalogId: text("class_catalog_id")
			.notNull()
			.references(() => classCatalogTable.id),
		locationId: text("location_id")
			.notNull()
			.references(() => locationsTable.id),
		dayOfWeek: integer("day_of_week").notNull(),
		startTime: text("start_time").notNull(),
		endTime: text("end_time").notNull(),
		requiredCoaches: integer("required_coaches").default(1).notNull(),
	},
)

export const scheduleTemplateClassRequiredSkillsTable = sqliteTable(
	"schedule_template_class_required_skills",
	{
		templateClassId: text("template_class_id")
			.notNull()
			.references(() => scheduleTemplateClassesTable.id),
		skillId: text("skill_id")
			.notNull()
			.references(() => skillsTable.id),
	},
	(table) => [primaryKey({ columns: [table.templateClassId, table.skillId] })],
)

// Generated schedule tables
export const generatedSchedulesTable = sqliteTable("generated_schedules", {
	...commonColumns,
	id: text("id").primaryKey(),
	teamId: text("team_id")
		.notNull()
		.references(() => teamTable.id),
	weekStartDate: integer("week_start_date", { mode: "timestamp" }).notNull(),
})

export const scheduledClassesTable = sqliteTable("scheduled_classes", {
	...commonColumns,
	id: text("id").primaryKey(),
	scheduleId: text("schedule_id")
		.notNull()
		.references(() => generatedSchedulesTable.id),
	coachId: text("coach_id").references(() => coachesTable.id), // Nullable if unassigned
	classCatalogId: text("class_catalog_id")
		.notNull()
		.references(() => classCatalogTable.id),
	locationId: text("location_id")
		.notNull()
		.references(() => locationsTable.id),
	startTime: integer("start_time", { mode: "timestamp" }).notNull(),
	endTime: integer("end_time", { mode: "timestamp" }).notNull(),
})

// RELATIONS

export const coachesRelations = relations(coachesTable, ({ one, many }) => ({
	user: one(userTable, {
		fields: [coachesTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [coachesTable.teamId],
		references: [teamTable.id],
	}),
	skills: many(coachToSkillsTable),
	blackoutDates: many(coachBlackoutDatesTable),
	recurringUnavailability: many(coachRecurringUnavailabilityTable),
	scheduledClasses: many(scheduledClassesTable),
}))

export const locationsRelations = relations(locationsTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [locationsTable.teamId],
		references: [teamTable.id],
	}),
}))

export const classCatalogRelations = relations(
	classCatalogTable,
	({ one, many }) => ({
		team: one(teamTable, {
			fields: [classCatalogTable.teamId],
			references: [teamTable.id],
		}),
		classToSkills: many(classCatalogToSkillsTable),
	}),
)

export const skillsRelations = relations(skillsTable, ({ one, many }) => ({
	team: one(teamTable, {
		fields: [skillsTable.teamId],
		references: [teamTable.id],
	}),
	coachSkills: many(coachToSkillsTable),
	templateClassSkills: many(scheduleTemplateClassRequiredSkillsTable),
	classCatalogSkills: many(classCatalogToSkillsTable),
}))

export const coachToSkillsRelations = relations(
	coachToSkillsTable,
	({ one }) => ({
		coach: one(coachesTable, {
			fields: [coachToSkillsTable.coachId],
			references: [coachesTable.id],
		}),
		skill: one(skillsTable, {
			fields: [coachToSkillsTable.skillId],
			references: [skillsTable.id],
		}),
	}),
)

export const coachBlackoutDatesRelations = relations(
	coachBlackoutDatesTable,
	({ one }) => ({
		coach: one(coachesTable, {
			fields: [coachBlackoutDatesTable.coachId],
			references: [coachesTable.id],
		}),
	}),
)

export const coachRecurringUnavailabilityRelations = relations(
	coachRecurringUnavailabilityTable,
	({ one }) => ({
		coach: one(coachesTable, {
			fields: [coachRecurringUnavailabilityTable.coachId],
			references: [coachesTable.id],
		}),
	}),
)

export const scheduleTemplatesRelations = relations(
	scheduleTemplatesTable,
	({ one, many }) => ({
		team: one(teamTable, {
			fields: [scheduleTemplatesTable.teamId],
			references: [teamTable.id],
		}),
		templateClasses: many(scheduleTemplateClassesTable),
	}),
)

export const scheduleTemplateClassesRelations = relations(
	scheduleTemplateClassesTable,
	({ one, many }) => ({
		template: one(scheduleTemplatesTable, {
			fields: [scheduleTemplateClassesTable.templateId],
			references: [scheduleTemplatesTable.id],
		}),
		classCatalog: one(classCatalogTable, {
			fields: [scheduleTemplateClassesTable.classCatalogId],
			references: [classCatalogTable.id],
		}),
		location: one(locationsTable, {
			fields: [scheduleTemplateClassesTable.locationId],
			references: [locationsTable.id],
		}),
		requiredSkills: many(scheduleTemplateClassRequiredSkillsTable),
	}),
)

export const scheduleTemplateClassRequiredSkillsRelations = relations(
	scheduleTemplateClassRequiredSkillsTable,
	({ one }) => ({
		templateClass: one(scheduleTemplateClassesTable, {
			fields: [scheduleTemplateClassRequiredSkillsTable.templateClassId],
			references: [scheduleTemplateClassesTable.id],
		}),
		skill: one(skillsTable, {
			fields: [scheduleTemplateClassRequiredSkillsTable.skillId],
			references: [skillsTable.id],
		}),
	}),
)

export const generatedSchedulesRelations = relations(
	generatedSchedulesTable,
	({ one, many }) => ({
		team: one(teamTable, {
			fields: [generatedSchedulesTable.teamId],
			references: [teamTable.id],
		}),
		scheduledClasses: many(scheduledClassesTable),
	}),
)

export const scheduledClassesRelations = relations(
	scheduledClassesTable,
	({ one }) => ({
		schedule: one(generatedSchedulesTable, {
			fields: [scheduledClassesTable.scheduleId],
			references: [generatedSchedulesTable.id],
		}),
		coach: one(coachesTable, {
			fields: [scheduledClassesTable.coachId],
			references: [coachesTable.id],
		}),
		classCatalog: one(classCatalogTable, {
			fields: [scheduledClassesTable.classCatalogId],
			references: [classCatalogTable.id],
		}),
		location: one(locationsTable, {
			fields: [scheduledClassesTable.locationId],
			references: [locationsTable.id],
		}),
	}),
)

export const classCatalogToSkillsRelations = relations(
	classCatalogToSkillsTable,
	({ one }) => ({
		classCatalog: one(classCatalogTable, {
			fields: [classCatalogToSkillsTable.classCatalogId],
			references: [classCatalogTable.id],
		}),
		skill: one(skillsTable, {
			fields: [classCatalogToSkillsTable.skillId],
			references: [skillsTable.id],
		}),
	}),
)

// Type exports
export type Coach = InferSelectModel<typeof coachesTable>
export type Location = InferSelectModel<typeof locationsTable>
export type ClassCatalog = InferSelectModel<typeof classCatalogTable>
export type Skill = InferSelectModel<typeof skillsTable>
export type CoachToSkill = InferSelectModel<typeof coachToSkillsTable>
export type CoachBlackoutDate = InferSelectModel<typeof coachBlackoutDatesTable>
export type CoachRecurringUnavailability = InferSelectModel<
	typeof coachRecurringUnavailabilityTable
>
export type ScheduleTemplate = InferSelectModel<typeof scheduleTemplatesTable>
export type ScheduleTemplateClass = InferSelectModel<
	typeof scheduleTemplateClassesTable
>
export type ScheduleTemplateClassRequiredSkill = InferSelectModel<
	typeof scheduleTemplateClassRequiredSkillsTable
>
export type GeneratedSchedule = InferSelectModel<typeof generatedSchedulesTable>
export type ScheduledClass = InferSelectModel<typeof scheduledClassesTable>
