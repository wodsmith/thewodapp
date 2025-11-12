import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createId } from "@paralleldrive/cuid2"
import { commonColumns } from "./common"
import { scalingLevelsTable } from "./scaling"
import { teamMembershipTable, teamTable } from "./teams"
import { userTable } from "./users"
import { workouts } from "./workouts"

// Competition-specific ID generators
export const createCompetitionEventGroupId = () => `ceg_${createId()}`
export const createCompetitionEventId = () => `cev_${createId()}`
export const createCompetitionRegistrationId = () => `crg_${createId()}`
export const createCompetitionLeaderboardId = () => `clb_${createId()}`

// Registration status enum
export const REGISTRATION_STATUS = {
	PENDING: "pending",
	CONFIRMED: "confirmed",
	WITHDRAWN: "withdrawn",
	REFUNDED: "refunded",
} as const

const registrationStatusTuple = Object.values(REGISTRATION_STATUS) as [
	string,
	...string[],
]

// Payment status enum
export const PAYMENT_STATUS = {
	UNPAID: "unpaid",
	PAID: "paid",
	REFUNDED: "refunded",
} as const

const paymentStatusTuple = Object.values(PAYMENT_STATUS) as [
	string,
	...string[],
]

// Competition Event Groups (for organizing series of events)
export const competitionEventGroupsTable = sqliteTable(
	"competition_event_groups",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionEventGroupId())
			.notNull(),
		// The gym team that organizes this series
		organizingTeamId: text()
			.notNull()
			.references(() => teamTable.id),
		slug: text({ length: 255 }).notNull(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 2000 }),
		// Optional custom branding/metadata as JSON
		metadata: text({ length: 5000 }),
	},
	(table) => [
		index("comp_event_group_org_team_idx").on(table.organizingTeamId),
		index("comp_event_group_slug_idx").on(table.slug),
		// Ensure unique slug per organizing team
		index("comp_event_group_unique_idx").on(
			table.organizingTeamId,
			table.slug,
		),
	],
)

// Competition Events (individual competitions)
export const competitionEventsTable = sqliteTable(
	"competition_events",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionEventId())
			.notNull(),
		// The gym team that owns/organizes this event (revenue collector)
		organizingTeamId: text()
			.notNull()
			.references(() => teamTable.id),
		// The competition_event team created for this event (for athlete membership)
		competitionTeamId: text()
			.notNull()
			.references(() => teamTable.id),
		// Optional: Link to an event series/group
		eventGroupId: text().references(() => competitionEventGroupsTable.id),
		// GLOBALLY UNIQUE slug used in public URLs (/compete/{slug})
		slug: text({ length: 255 }).notNull().unique(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 5000 }),
		startDate: integer({ mode: "timestamp" }).notNull(),
		endDate: integer({ mode: "timestamp" }).notNull(),
		registrationOpensAt: integer({ mode: "timestamp" }),
		registrationClosesAt: integer({ mode: "timestamp" }),
		// Registration fee in cents (e.g., 5000 = $50.00)
		registrationFee: integer(),
		// Optional external registration URL (for existing registration systems)
		externalRegistrationUrl: text({ length: 600 }),
		// Competition settings and configuration as JSON
		// (e.g., rules, scoring system, divisions, etc.)
		settings: text({ length: 10000 }),
	},
	(table) => [
		index("comp_event_slug_idx").on(table.slug),
		index("comp_event_org_team_idx").on(table.organizingTeamId),
		index("comp_event_comp_team_idx").on(table.competitionTeamId),
		index("comp_event_group_idx").on(table.eventGroupId),
		index("comp_event_dates_idx").on(table.startDate, table.endDate),
	],
)

// Competition Registrations
export const competitionRegistrationsTable = sqliteTable(
	"competition_registrations",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionRegistrationId())
			.notNull(),
		eventId: text()
			.notNull()
			.references(() => competitionEventsTable.id),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		// Link to the team_membership record in the competition_event team
		teamMemberId: text().references(() => teamMembershipTable.id),
		// Division the athlete is competing in
		divisionId: text().references(() => scalingLevelsTable.id),
		// Registration form data as JSON (custom fields, waivers, etc.)
		registrationData: text({ length: 10000 }),
		status: text({ enum: registrationStatusTuple })
			.default(REGISTRATION_STATUS.PENDING)
			.notNull(),
		paymentStatus: text({ enum: paymentStatusTuple })
			.default(PAYMENT_STATUS.UNPAID)
			.notNull(),
		// Stripe payment intent ID or similar
		paymentIntentId: text({ length: 255 }),
		registeredAt: integer({ mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("comp_reg_event_idx").on(table.eventId),
		index("comp_reg_user_idx").on(table.userId),
		index("comp_reg_division_idx").on(table.divisionId),
		index("comp_reg_status_idx").on(table.status),
		// Ensure one registration per user per event
		index("comp_reg_unique_idx").on(table.eventId, table.userId),
	],
)

// Competition Leaderboards (materialized view pattern for performance)
export const competitionLeaderboardsTable = sqliteTable(
	"competition_leaderboards",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionLeaderboardId())
			.notNull(),
		eventId: text()
			.notNull()
			.references(() => competitionEventsTable.id),
		workoutId: text().references(() => workouts.id),
		divisionId: text().references(() => scalingLevelsTable.id),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		// Current rank in the division for this workout
		rank: integer(),
		// Score as text to handle different scoring types (time, reps, weight, etc.)
		score: text({ length: 255 }),
		// Tiebreak data as text (e.g., time, reps at cap, etc.)
		tiebreak: text({ length: 255 }),
		// Points accumulated (for overall competition scoring)
		points: integer(),
		lastUpdated: integer({ mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("comp_leaderboard_event_idx").on(table.eventId),
		index("comp_leaderboard_workout_idx").on(table.workoutId),
		index("comp_leaderboard_division_idx").on(table.divisionId),
		index("comp_leaderboard_user_idx").on(table.userId),
		index("comp_leaderboard_rank_idx").on(table.rank),
		// Composite index for common queries
		index("comp_leaderboard_event_div_rank_idx").on(
			table.eventId,
			table.divisionId,
			table.rank,
		),
	],
)

// Relations
export const competitionEventGroupsRelations = relations(
	competitionEventGroupsTable,
	({ one, many }) => ({
		organizingTeam: one(teamTable, {
			fields: [competitionEventGroupsTable.organizingTeamId],
			references: [teamTable.id],
		}),
		events: many(competitionEventsTable),
	}),
)

export const competitionEventsRelations = relations(
	competitionEventsTable,
	({ one, many }) => ({
		organizingTeam: one(teamTable, {
			fields: [competitionEventsTable.organizingTeamId],
			references: [teamTable.id],
			relationName: "organizingTeam",
		}),
		competitionTeam: one(teamTable, {
			fields: [competitionEventsTable.competitionTeamId],
			references: [teamTable.id],
			relationName: "competitionTeam",
		}),
		eventGroup: one(competitionEventGroupsTable, {
			fields: [competitionEventsTable.eventGroupId],
			references: [competitionEventGroupsTable.id],
		}),
		registrations: many(competitionRegistrationsTable),
		leaderboardEntries: many(competitionLeaderboardsTable),
	}),
)

export const competitionRegistrationsRelations = relations(
	competitionRegistrationsTable,
	({ one }) => ({
		event: one(competitionEventsTable, {
			fields: [competitionRegistrationsTable.eventId],
			references: [competitionEventsTable.id],
		}),
		user: one(userTable, {
			fields: [competitionRegistrationsTable.userId],
			references: [userTable.id],
		}),
		teamMember: one(teamMembershipTable, {
			fields: [competitionRegistrationsTable.teamMemberId],
			references: [teamMembershipTable.id],
		}),
		division: one(scalingLevelsTable, {
			fields: [competitionRegistrationsTable.divisionId],
			references: [scalingLevelsTable.id],
		}),
	}),
)

export const competitionLeaderboardsRelations = relations(
	competitionLeaderboardsTable,
	({ one }) => ({
		event: one(competitionEventsTable, {
			fields: [competitionLeaderboardsTable.eventId],
			references: [competitionEventsTable.id],
		}),
		workout: one(workouts, {
			fields: [competitionLeaderboardsTable.workoutId],
			references: [workouts.id],
		}),
		division: one(scalingLevelsTable, {
			fields: [competitionLeaderboardsTable.divisionId],
			references: [scalingLevelsTable.id],
		}),
		user: one(userTable, {
			fields: [competitionLeaderboardsTable.userId],
			references: [userTable.id],
		}),
	}),
)

// Type exports
export type CompetitionEventGroup = InferSelectModel<
	typeof competitionEventGroupsTable
>
export type CompetitionEvent = InferSelectModel<typeof competitionEventsTable>
export type CompetitionRegistration = InferSelectModel<
	typeof competitionRegistrationsTable
>
export type CompetitionLeaderboard = InferSelectModel<
	typeof competitionLeaderboardsTable
>
