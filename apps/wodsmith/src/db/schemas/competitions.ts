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
	createAffiliateId,
	createCompetitionGroupId,
	createCompetitionId,
	createCompetitionRegistrationId,
} from "./common"
import { scalingLevelsTable } from "./scaling"
import { teamMembershipTable, teamTable } from "./teams"
import { userTable } from "./users"

// Verification status enum for affiliates
export const affiliateVerificationStatus = [
	"unverified",
	"verified",
	"claimed",
] as const
export type AffiliateVerificationStatus =
	(typeof affiliateVerificationStatus)[number]

// Affiliates Table - Normalized gym/affiliate data
export const affiliatesTable = sqliteTable(
	"affiliates",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createAffiliateId())
			.notNull(),
		name: text({ length: 255 }).notNull().unique(), // "CrossFit Downtown"
		// Optional metadata
		location: text({ length: 255 }), // "Austin, TX"
		// Verification status: unverified (default), verified (admin verified), claimed (gym owner linked)
		verificationStatus: text({ enum: affiliateVerificationStatus })
			.default("unverified")
			.notNull(),
		// When claimed, links to the team that owns this affiliate
		ownerTeamId: text().references(() => teamTable.id, { onDelete: "set null" }),
	},
	(table) => [
		index("affiliates_name_idx").on(table.name),
		index("affiliates_owner_team_idx").on(table.ownerTeamId),
	],
)

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

// Type exports
export type Affiliate = InferSelectModel<typeof affiliatesTable>
export type CompetitionGroup = InferSelectModel<typeof competitionGroupsTable>
export type Competition = InferSelectModel<typeof competitionsTable>
export type CompetitionRegistration = InferSelectModel<
	typeof competitionRegistrationsTable
>

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
	}),
)

export const competitionRegistrationsRelations = relations(
	competitionRegistrationsTable,
	({ one }) => ({
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
	}),
)

// Affiliates relations
export const affiliatesRelations = relations(affiliatesTable, ({ one }) => ({
	// The team that owns this affiliate (if claimed)
	ownerTeam: one(teamTable, {
		fields: [affiliatesTable.ownerTeamId],
		references: [teamTable.id],
	}),
}))
