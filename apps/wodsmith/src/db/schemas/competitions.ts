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
	createCompetitionGroupId,
	createCompetitionHeatAssignmentId,
	createCompetitionHeatId,
	createCompetitionId,
	createCompetitionRegistrationId,
	createCompetitionVenueId,
} from "./common"
import { programmingTracksTable } from "./programming"
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

		// Commerce: Default registration fee (used if no division-specific fee exists)
		// $0 = free by default
		defaultRegistrationFeeCents: integer().default(0),
		// Commerce: Fee configuration (nullable = use platform defaults)
		// Basis points, null = default 250 (2.5%)
		platformFeePercentage: integer(),
		// Cents, null = default 200 ($2.00)
		platformFeeFixed: integer(),
		// If true, Stripe fees are passed to customer instead of absorbed by organizer
		passStripeFeesToCustomer: integer({ mode: "boolean" }).default(false),
		// If true, platform fees are passed to customer instead of absorbed by organizer
		// Defaults to true for new competitions
		passPlatformFeesToCustomer: integer({ mode: "boolean" }).default(true),
		// Visibility: public = listed on /compete, private = unlisted but accessible via URL
		visibility: text({ length: 10 })
			.$type<"public" | "private">()
			.default("public")
			.notNull(),
		// Status: draft = only visible to organizers, published = visible based on visibility setting
		status: text({ length: 15 })
			.$type<"draft" | "published">()
			.default("draft")
			.notNull(),
		// Competition branding images
		profileImageUrl: text({ length: 600 }),
		bannerImageUrl: text({ length: 600 }),
		// Judge rotation defaults
		defaultHeatsPerRotation: integer().default(4),
		defaultLaneShiftPattern: text({ length: 20 }).default("stay"),
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

		// Commerce: Payment tracking
		// Reference to commerce_purchase (no FK to avoid circular deps - relation defined separately)
		commercePurchaseId: text(),
		// Payment status: FREE | PENDING_PAYMENT | PAID | FAILED
		paymentStatus: text({ length: 20 }),
		// When payment was completed
		paidAt: integer({ mode: "timestamp" }),
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
		index("competition_registrations_purchase_idx").on(
			table.commercePurchaseId,
		),
	],
)

// Competition Venues Table
// Floors/areas for heat scheduling (e.g., "Main Floor", "Outside Rig")
export const competitionVenuesTable = sqliteTable(
	"competition_venues",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionVenueId())
			.notNull(),
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		name: text({ length: 100 }).notNull(),
		laneCount: integer().notNull().default(3),
		// Minutes between heats for auto-scheduling
		transitionMinutes: integer().notNull().default(3),
		sortOrder: integer().default(0).notNull(),
	},
	(table) => [
		index("competition_venues_competition_idx").on(table.competitionId),
		index("competition_venues_sort_idx").on(
			table.competitionId,
			table.sortOrder,
		),
	],
)

// Competition Heats Table
// Heat definitions per workout with time and venue
export const competitionHeatsTable = sqliteTable(
	"competition_heats",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionHeatId())
			.notNull(),
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// References track_workout (competition event)
		trackWorkoutId: text().notNull(),
		venueId: text().references(() => competitionVenuesTable.id, {
			onDelete: "set null",
		}),
		heatNumber: integer().notNull(),
		scheduledTime: integer({ mode: "timestamp" }),
		// Duration of this heat in minutes (workout cap + buffer)
		durationMinutes: integer(),
		// Optional division filter (null = mixed divisions)
		divisionId: text().references(() => scalingLevelsTable.id, {
			onDelete: "set null",
		}),
		notes: text({ length: 500 }),
	},
	(table) => [
		index("competition_heats_competition_idx").on(table.competitionId),
		index("competition_heats_workout_idx").on(table.trackWorkoutId),
		index("competition_heats_time_idx").on(table.scheduledTime),
		uniqueIndex("competition_heats_workout_number_idx").on(
			table.trackWorkoutId,
			table.heatNumber,
		),
	],
)

// Competition Heat Assignments Table
// Athlete/team lane assignments within heats
export const competitionHeatAssignmentsTable = sqliteTable(
	"competition_heat_assignments",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createCompetitionHeatAssignmentId())
			.notNull(),
		heatId: text()
			.notNull()
			.references(() => competitionHeatsTable.id, { onDelete: "cascade" }),
		registrationId: text()
			.notNull()
			.references(() => competitionRegistrationsTable.id, {
				onDelete: "cascade",
			}),
		laneNumber: integer().notNull(),
	},
	(table) => [
		index("competition_heat_assignments_heat_idx").on(table.heatId),
		uniqueIndex("competition_heat_assignments_reg_idx").on(
			table.heatId,
			table.registrationId,
		),
		uniqueIndex("competition_heat_assignments_lane_idx").on(
			table.heatId,
			table.laneNumber,
		),
	],
)

// Type exports
export type CompetitionGroup = InferSelectModel<typeof competitionGroupsTable>
export type Competition = InferSelectModel<typeof competitionsTable>
export type CompetitionRegistration = InferSelectModel<
	typeof competitionRegistrationsTable
>
export type CompetitionVenue = InferSelectModel<typeof competitionVenuesTable>
export type CompetitionHeat = InferSelectModel<typeof competitionHeatsTable>
export type CompetitionHeatAssignment = InferSelectModel<
	typeof competitionHeatAssignmentsTable
>

// Competition visibility constants
export const COMPETITION_VISIBILITY = {
	PUBLIC: "public",
	PRIVATE: "private",
} as const

export type CompetitionVisibility =
	(typeof COMPETITION_VISIBILITY)[keyof typeof COMPETITION_VISIBILITY]

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
		// Heat scheduling
		venues: many(competitionVenuesTable),
		heats: many(competitionHeatsTable),
		// Programming tracks (events)
		programmingTrack: many(programmingTracksTable),
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
		// Heat assignments for this registration
		heatAssignments: many(competitionHeatAssignmentsTable),
	}),
)

// Venue relations
export const competitionVenuesRelations = relations(
	competitionVenuesTable,
	({ one, many }) => ({
		competition: one(competitionsTable, {
			fields: [competitionVenuesTable.competitionId],
			references: [competitionsTable.id],
		}),
		heats: many(competitionHeatsTable),
	}),
)

// Heat relations
export const competitionHeatsRelations = relations(
	competitionHeatsTable,
	({ one, many }) => ({
		competition: one(competitionsTable, {
			fields: [competitionHeatsTable.competitionId],
			references: [competitionsTable.id],
		}),
		venue: one(competitionVenuesTable, {
			fields: [competitionHeatsTable.venueId],
			references: [competitionVenuesTable.id],
		}),
		division: one(scalingLevelsTable, {
			fields: [competitionHeatsTable.divisionId],
			references: [scalingLevelsTable.id],
		}),
		assignments: many(competitionHeatAssignmentsTable),
		// Note: volunteers relation defined in volunteers.ts to avoid circular dependency
	}),
)

// Heat assignment relations
export const competitionHeatAssignmentsRelations = relations(
	competitionHeatAssignmentsTable,
	({ one }) => ({
		heat: one(competitionHeatsTable, {
			fields: [competitionHeatAssignmentsTable.heatId],
			references: [competitionHeatsTable.id],
		}),
		registration: one(competitionRegistrationsTable, {
			fields: [competitionHeatAssignmentsTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
	}),
)
