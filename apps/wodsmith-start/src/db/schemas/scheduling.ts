import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	int,
	boolean,
	datetime,
	primaryKey,
	mysqlTable,
	varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"
import { teamTable } from "./teams"
import { userTable } from "./users"

// Store coach-specific settings, linking a user to a team
export const coachesTable = mysqlTable(
	"coaches",
	{
		...commonColumns,
		id: varchar("id", { length: 255 }).primaryKey(),
		userId: varchar("user_id", { length: 255 })
			.notNull(),
		teamId: varchar("team_id", { length: 255 })
			.notNull(),
		weeklyClassLimit: int("weekly_class_limit"),
		schedulingPreference: varchar("scheduling_preference", {
			length: 255,
			enum: ["morning", "afternoon", "night", "any"],
		}),
		schedulingNotes: varchar("scheduling_notes", { length: 255 }), // For soft, unstructured preferences
		isActive: boolean("is_active").default(true),
	},
	(table) => [
		index("coach_user_team_unique_idx").on(table.userId, table.teamId),
	],
)

// Gym configuration tables
export const locationsTable = mysqlTable("locations", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	teamId: varchar("team_id", { length: 255 })
		.notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	capacity: int("capacity").default(20).notNull(),
})

export const classCatalogTable = mysqlTable("class_catalog", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	teamId: varchar("team_id", { length: 255 })
		.notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	description: varchar("description", { length: 255 }),
	durationMinutes: int("duration_minutes").notNull().default(60),
	maxParticipants: int("max_participants").notNull().default(20),
})

export const skillsTable = mysqlTable("skills", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	teamId: varchar("team_id", { length: 255 })
		.notNull(),
	name: varchar("name", { length: 255 }).notNull(),
})

export const classCatalogToSkillsTable = mysqlTable(
	"class_catalog_to_skills",
	{
		classCatalogId: varchar("class_catalog_id", { length: 255 })
			.notNull(),
		skillId: varchar("skill_id", { length: 255 })
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.classCatalogId, table.skillId] })],
)

// Coach constraint tables
export const coachToSkillsTable = mysqlTable(
	"coach_to_skills",
	{
		coachId: varchar("coach_id", { length: 255 })
			.notNull(),
		skillId: varchar("skill_id", { length: 255 })
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.coachId, table.skillId] })],
)

export const coachBlackoutDatesTable = mysqlTable("coach_blackout_dates", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	coachId: varchar("coach_id", { length: 255 })
		.notNull(),
	startDate: datetime("start_date").notNull(),
	endDate: datetime("end_date").notNull(),
	reason: varchar("reason", { length: 255 }),
})

export const coachRecurringUnavailabilityTable = mysqlTable(
	"coach_recurring_unavailability",
	{
		...commonColumns,
		id: varchar("id", { length: 255 }).primaryKey(),
		coachId: varchar("coach_id", { length: 255 })
			.notNull(),
		dayOfWeek: int("day_of_week").notNull(), // 0-6 for Sunday-Saturday
		startTime: varchar("start_time", { length: 255 }).notNull(), // "HH:MM"
		endTime: varchar("end_time", { length: 255 }).notNull(), // "HH:MM"
		description: varchar("description", { length: 255 }),
	},
)

// Schedule template tables
export const scheduleTemplatesTable = mysqlTable("schedule_templates", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	teamId: varchar("team_id", { length: 255 })
		.notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	classCatalogId: varchar("class_catalog_id", { length: 255 })
		.notNull(),
	locationId: varchar("location_id", { length: 255 })
		.notNull(),
})

export const scheduleTemplateClassesTable = mysqlTable(
	"schedule_template_classes",
	{
		...commonColumns,
		id: varchar("id", { length: 255 }).primaryKey(),
		templateId: varchar("template_id", { length: 255 })
			.notNull(),
		dayOfWeek: int("day_of_week").notNull(),
		startTime: varchar("start_time", { length: 255 }).notNull(),
		endTime: varchar("end_time", { length: 255 }).notNull(),
		requiredCoaches: int("required_coaches").default(1).notNull(),
	},
)

export const scheduleTemplateClassRequiredSkillsTable = mysqlTable(
	"schedule_template_class_required_skills",
	{
		templateClassId: varchar("template_class_id", { length: 255 })
			.notNull(),
		skillId: varchar("skill_id", { length: 255 })
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.templateClassId, table.skillId] })],
)

// Generated schedule tables
export const generatedSchedulesTable = mysqlTable("generated_schedules", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	teamId: varchar("team_id", { length: 255 })
		.notNull(),
	locationId: varchar("location_id", { length: 255 })
		.notNull(),
	weekStartDate: datetime("week_start_date").notNull(),
})

export const scheduledClassesTable = mysqlTable("scheduled_classes", {
	...commonColumns,
	id: varchar("id", { length: 255 }).primaryKey(),
	scheduleId: varchar("schedule_id", { length: 255 })
		.notNull(),
	coachId: varchar("coach_id", { length: 255 }), // Nullable if unassigned
	classCatalogId: varchar("class_catalog_id", { length: 255 })
		.notNull(),
	locationId: varchar("location_id", { length: 255 })
		.notNull(),
	startTime: datetime("start_time").notNull(),
	endTime: datetime("end_time").notNull(),
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
		classCatalog: one(classCatalogTable, {
			fields: [scheduleTemplatesTable.classCatalogId],
			references: [classCatalogTable.id],
		}),
		location: one(locationsTable, {
			fields: [scheduleTemplatesTable.locationId],
			references: [locationsTable.id],
		}),
	}),
)

export const scheduleTemplateClassesRelations = relations(
	scheduleTemplateClassesTable,
	({ one, many }) => ({
		template: one(scheduleTemplatesTable, {
			fields: [scheduleTemplateClassesTable.templateId],
			references: [scheduleTemplatesTable.id],
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
		location: one(locationsTable, {
			fields: [generatedSchedulesTable.locationId],
			references: [locationsTable.id],
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
