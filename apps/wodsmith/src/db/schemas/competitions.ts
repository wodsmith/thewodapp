import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createCompetitionFloorId,
	createCompetitionGroupId,
	createCompetitionHeatId,
	createCompetitionId,
	createCompetitionRegistrationId,
	createHeatAssignmentId,
} from "./common"
import { trackWorkoutsTable } from "./programming"
import { scalingLevelsTable } from "./scaling"
import { teamMembershipTable, teamTable } from "./teams"
import { userTable } from "./users"

// Competition Groups (Series) Table
// Groups organize multiple competitions into series (e.g., "2026 Throwdowns Series")
export const competitionGroupsTable = sqliteTable(
	"competition_groups",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionGroupId())
			.notNull(),
		// The organizing team (gym) that created this group
		organizingTeamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		// Slug is unique per organizing team (not globally unique)
		slug: text({ length: 255 }).notNull(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 1000 }),
	},
	(table) => [
		// Ensure slug is unique per organizing team
		uniqueIndex("competition_groups_org_slug_idx").on(
			table.organizingTeamId,
			table.slug,
		),
	],
)

// Competitions Table
// Represents individual competition events
export const competitionsTable = sqliteTable(
	"competitions",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionId())
			.notNull(),
		// The organizing team (gym) that owns/created this competition
		organizingTeamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		// The competition_event team (auto-created) for athlete management
		competitionTeamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		// OPTIONAL: Group/series this competition belongs to
		groupId: text().references(() => competitionGroupsTable.id, {
			onDelete: "set null",
		}),
		// Slug must be globally unique (used in public URLs like /compete/{slug})
		slug: text({ length: 255 }).notNull().unique(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 2000 }),
		// Competition dates
		startDate: integer({ mode: "timestamp" }).notNull(),
		endDate: integer({ mode: "timestamp" }).notNull(),
		// Registration window
		registrationOpensAt: integer({ mode: "timestamp" }),
		registrationClosesAt: integer({ mode: "timestamp" }),
		// JSON settings (divisions, rules, etc.)
		settings: text({ length: 10000 }),
	},
	(table) => [
		// slug unique index is already created by .unique() on the column
		index("competitions_organizing_team_idx").on(table.organizingTeamId),
		index("competitions_competition_team_idx").on(table.competitionTeamId),
		index("competitions_group_idx").on(table.groupId),
		index("competitions_start_date_idx").on(table.startDate),
	],
)

// Competition Registrations Table
// Tracks athlete registrations for competitions
export const competitionRegistrationsTable = sqliteTable(
	"competition_registrations",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionRegistrationId())
			.notNull(),
		// The competition this registration is for
		eventId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// The user who registered (captain for team registrations)
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		// The team membership created in the competition_event team
		teamMemberId: text()
			.notNull()
			.references(() => teamMembershipTable.id, { onDelete: "cascade" }),
		// The division (scaling level) the athlete is competing in
		divisionId: text().references(() => scalingLevelsTable.id),
		// When the athlete registered
		registeredAt: integer({ mode: "timestamp" }).notNull(),
		// Team info (NULL for individual registrations)
		teamName: text({ length: 255 }),
		// Who created the registration (same as userId for individuals)
		captainUserId: text().references(() => userTable.id, {
			onDelete: "set null",
		}),
		// For team registrations, the athlete team (competition_team type)
		// NULL for individual registrations (teamSize=1)
		athleteTeamId: text().references(() => teamTable.id, {
			onDelete: "set null",
		}),
		// Pending teammates stored as JSON until they accept
		// Format: [{ email, firstName?, lastName?, affiliateName? }, ...]
		pendingTeammates: text({ length: 5000 }), // JSON array
		// Metadata as JSON (flexible for future expansion)
		metadata: text({ length: 10000 }), // JSON: { notes: "..." }
	},
	(table) => [
		// One user can only register once per competition
		uniqueIndex("competition_registrations_event_user_idx").on(
			table.eventId,
			table.userId,
		),
		index("competition_registrations_user_idx").on(table.userId),
		index("competition_registrations_event_idx").on(table.eventId),
		index("competition_registrations_division_idx").on(table.divisionId),
		index("competition_registrations_captain_idx").on(table.captainUserId),
		index("competition_registrations_athlete_team_idx").on(table.athleteTeamId),
	],
)

// Competition Floors Table
// Represents physical floors/lanes/areas where heats run during a competition
export const competitionFloorsTable = sqliteTable(
	"competition_floors",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionFloorId())
			.notNull(),
		// The competition this floor belongs to
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// Display name (e.g., "Floor A", "Lanes 1-10", "Main Stage")
		name: text({ length: 255 }).notNull(),
		// Maximum athletes/teams per heat on this floor
		capacity: integer().notNull().default(10),
		// Display order for UI
		position: integer().notNull().default(0),
	},
	(table) => [
		index("competition_floors_competition_idx").on(table.competitionId),
		index("competition_floors_position_idx").on(
			table.competitionId,
			table.position,
		),
	],
)

// Competition Heats Table
// Represents a scheduled time slot for a group of athletes to perform a workout
export const competitionHeatsTable = sqliteTable(
	"competition_heats",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionHeatId())
			.notNull(),
		// The competition this heat belongs to
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// The workout/event this heat is for
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id, { onDelete: "cascade" }),
		// The floor/lane where this heat runs
		floorId: text()
			.notNull()
			.references(() => competitionFloorsTable.id, { onDelete: "cascade" }),
		// Heat number for this workout (1, 2, 3...)
		heatNumber: integer().notNull(),
		// When this heat starts
		startTime: integer({ mode: "timestamp" }).notNull(),
		// Target division for this heat (optional - for division-pure heats)
		// NULL means mixed divisions
		targetDivisionId: text().references(() => scalingLevelsTable.id, {
			onDelete: "set null",
		}),
	},
	(table) => [
		index("competition_heats_competition_idx").on(table.competitionId),
		index("competition_heats_workout_idx").on(table.trackWorkoutId),
		index("competition_heats_floor_idx").on(table.floorId),
		index("competition_heats_start_time_idx").on(table.startTime),
		index("competition_heats_division_idx").on(table.targetDivisionId),
		uniqueIndex("competition_heats_workout_heat_idx").on(
			table.trackWorkoutId,
			table.floorId,
			table.heatNumber,
		),
	],
)

// Heat Assignments Table
// Links registered athletes/teams to specific heats
export const heatAssignmentsTable = sqliteTable(
	"heat_assignments",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createHeatAssignmentId())
			.notNull(),
		// The heat this assignment is for
		heatId: text()
			.notNull()
			.references(() => competitionHeatsTable.id, { onDelete: "cascade" }),
		// The registration (athlete/team) assigned to this heat
		registrationId: text()
			.notNull()
			.references(() => competitionRegistrationsTable.id, {
				onDelete: "cascade",
			}),
		// Optional lane number within the heat
		laneNumber: integer(),
		// When the athlete checked in (NULL if not checked in yet)
		checkInAt: integer({ mode: "timestamp" }),
	},
	(table) => [
		index("heat_assignments_heat_idx").on(table.heatId),
		index("heat_assignments_registration_idx").on(table.registrationId),
		// One registration per heat (athlete can only be in one heat per workout)
		uniqueIndex("heat_assignments_heat_registration_idx").on(
			table.heatId,
			table.registrationId,
		),
	],
)

// Type exports
export type CompetitionGroup = InferSelectModel<typeof competitionGroupsTable>
export type Competition = InferSelectModel<typeof competitionsTable>
export type CompetitionRegistration = InferSelectModel<
	typeof competitionRegistrationsTable
>
export type CompetitionFloor = InferSelectModel<typeof competitionFloorsTable>
export type CompetitionHeat = InferSelectModel<typeof competitionHeatsTable>
export type HeatAssignment = InferSelectModel<typeof heatAssignmentsTable>

// Relations
export const competitionGroupsRelations = relations(
	competitionGroupsTable,
	({ one, many }) => ({
		// The gym/team that owns this group
		organizingTeam: one(teamTable, {
			fields: [competitionGroupsTable.organizingTeamId],
			references: [teamTable.id],
		}),
		// All competitions in this group
		competitions: many(competitionsTable),
	}),
)

export const competitionsRelations = relations(
	competitionsTable,
	({ one, many }) => ({
		// The gym/team that owns and created this competition
		organizingTeam: one(teamTable, {
			fields: [competitionsTable.organizingTeamId],
			references: [teamTable.id],
			relationName: "organizingTeam",
		}),
		// The competition_event team for athlete management
		competitionTeam: one(teamTable, {
			fields: [competitionsTable.competitionTeamId],
			references: [teamTable.id],
			relationName: "competitionTeam",
		}),
		// The group/series this competition belongs to (optional)
		group: one(competitionGroupsTable, {
			fields: [competitionsTable.groupId],
			references: [competitionGroupsTable.id],
		}),
		// All athlete registrations for this competition
		registrations: many(competitionRegistrationsTable),
		// All floors for this competition
		floors: many(competitionFloorsTable),
		// All heats for this competition
		heats: many(competitionHeatsTable),
	}),
)

export const competitionRegistrationsRelations = relations(
	competitionRegistrationsTable,
	({ one, many }) => ({
		// The competition being registered for
		competition: one(competitionsTable, {
			fields: [competitionRegistrationsTable.eventId],
			references: [competitionsTable.id],
		}),
		// The user who registered
		user: one(userTable, {
			fields: [competitionRegistrationsTable.userId],
			references: [userTable.id],
			relationName: "registeredUser",
		}),
		// The captain who created the registration (for team registrations)
		captain: one(userTable, {
			fields: [competitionRegistrationsTable.captainUserId],
			references: [userTable.id],
			relationName: "captainUser",
		}),
		// The team membership in the competition_event team
		teamMember: one(teamMembershipTable, {
			fields: [competitionRegistrationsTable.teamMemberId],
			references: [teamMembershipTable.id],
		}),
		// The division the athlete is competing in
		division: one(scalingLevelsTable, {
			fields: [competitionRegistrationsTable.divisionId],
			references: [scalingLevelsTable.id],
		}),
		// The athlete team (competition_team type) for team registrations
		athleteTeam: one(teamTable, {
			fields: [competitionRegistrationsTable.athleteTeamId],
			references: [teamTable.id],
			relationName: "athleteTeamRegistration",
		}),
		// All heat assignments for this registration
		heatAssignments: many(heatAssignmentsTable),
	}),
)

// Competition Floors Relations
export const competitionFloorsRelations = relations(
	competitionFloorsTable,
	({ one, many }) => ({
		// The competition this floor belongs to
		competition: one(competitionsTable, {
			fields: [competitionFloorsTable.competitionId],
			references: [competitionsTable.id],
		}),
		// All heats on this floor
		heats: many(competitionHeatsTable),
	}),
)

// Competition Heats Relations
export const competitionHeatsRelations = relations(
	competitionHeatsTable,
	({ one, many }) => ({
		// The competition this heat belongs to
		competition: one(competitionsTable, {
			fields: [competitionHeatsTable.competitionId],
			references: [competitionsTable.id],
		}),
		// The workout/event this heat is for
		trackWorkout: one(trackWorkoutsTable, {
			fields: [competitionHeatsTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
		// The floor where this heat runs
		floor: one(competitionFloorsTable, {
			fields: [competitionHeatsTable.floorId],
			references: [competitionFloorsTable.id],
		}),
		// The target division for this heat (optional)
		targetDivision: one(scalingLevelsTable, {
			fields: [competitionHeatsTable.targetDivisionId],
			references: [scalingLevelsTable.id],
		}),
		// All athletes assigned to this heat
		assignments: many(heatAssignmentsTable),
	}),
)

// Heat Assignments Relations
export const heatAssignmentsRelations = relations(
	heatAssignmentsTable,
	({ one }) => ({
		// The heat this assignment belongs to
		heat: one(competitionHeatsTable, {
			fields: [heatAssignmentsTable.heatId],
			references: [competitionHeatsTable.id],
		}),
		// The registration (athlete/team) assigned
		registration: one(competitionRegistrationsTable, {
			fields: [heatAssignmentsTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
	}),
)
