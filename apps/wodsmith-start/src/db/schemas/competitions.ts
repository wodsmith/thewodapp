import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	boolean,
	datetime,
	index,
	int,
	mysqlTable,
	text,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import { addressesTable } from "./addresses"
import {
	commonColumns,
	createCompetitionEventId,
	createCompetitionGroupId,
	createCompetitionHeatAssignmentId,
	createCompetitionHeatId,
	createCompetitionId,
	createCompetitionRegistrationAnswerId,
	createCompetitionRegistrationId,
	createCompetitionRegistrationQuestionId,
	createCompetitionVenueId,
} from "./common"
import { programmingTracksTable } from "./programming"
import { scalingLevelsTable } from "./scaling"
import { teamMembershipTable, teamTable } from "./teams"
import { userTable } from "./users"
import {
	competitionJudgeRotationsTable,
	judgeHeatAssignmentsTable,
} from "./volunteers"

// Competition Groups (Series) Table
// Groups organize multiple competitions into series (e.g., "2026 Throwdowns Series")
export const competitionGroupsTable = mysqlTable(
	"competition_groups",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionGroupId())
			.notNull(),
		// The organizing team (gym) that created this group
		organizingTeamId: varchar({ length: 255 }).notNull(),
		// Slug is unique per organizing team (not globally unique)
		slug: varchar({ length: 255 }).notNull(),
		name: varchar({ length: 255 }).notNull(),
		description: varchar({ length: 1000 }),
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
export const competitionsTable = mysqlTable(
	"competitions",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionId())
			.notNull(),
		// The organizing team (gym) that owns/created this competition
		organizingTeamId: varchar({ length: 255 }).notNull(),
		// The competition_event team (auto-created) for athlete management
		competitionTeamId: varchar({ length: 255 }).notNull(),
		// OPTIONAL: Group/series this competition belongs to
		groupId: varchar({ length: 255 }),
		// Slug must be globally unique (used in public URLs like /compete/{slug})
		slug: varchar({ length: 255 }).notNull().unique(),
		name: varchar({ length: 255 }).notNull(),
		description: varchar({ length: 2000 }),
		// Competition dates (YYYY-MM-DD format for timezone-agnostic storage)
		startDate: varchar({ length: 255 }).notNull(),
		endDate: varchar({ length: 255 }).notNull(),
		// Registration window (YYYY-MM-DD format)
		registrationOpensAt: varchar({ length: 255 }),
		registrationClosesAt: varchar({ length: 255 }),
		// IANA timezone for competition dates and deadlines (e.g., "America/Denver")
		timezone: varchar({ length: 50 }).default("America/Denver"),
		// JSON settings (divisions, rules, etc.)
		settings: text(),

		// Commerce: Default registration fee (used if no division-specific fee exists)
		// $0 = free by default
		defaultRegistrationFeeCents: int().default(0),
		// Commerce: Fee configuration (nullable = use platform defaults)
		// Basis points, null = default 250 (2.5%)
		platformFeePercentage: int(),
		// Cents, null = default 200 ($2.00)
		platformFeeFixed: int(),
		// If true, Stripe fees are passed to customer instead of absorbed by organizer
		passStripeFeesToCustomer: boolean().default(false),
		// If true, platform fees are passed to customer instead of absorbed by organizer
		// Defaults to true for new competitions
		passPlatformFeesToCustomer: boolean().default(true),
		// Visibility: public = listed on /compete, private = unlisted but accessible via URL
		visibility: varchar({ length: 10 })
			.$type<"public" | "private">()
			.default("public")
			.notNull(),
		// Status: draft = only visible to organizers, published = visible based on visibility setting
		status: varchar({ length: 15 })
			.$type<"draft" | "published">()
			.default("draft")
			.notNull(),
		// Competition type: in-person = traditional venue-based, online = virtual/remote with video submissions
		competitionType: varchar({ length: 15 })
			.$type<"in-person" | "online">()
			.default("in-person")
			.notNull(),
		// Competition branding images
		profileImageUrl: varchar({ length: 600 }),
		bannerImageUrl: varchar({ length: 600 }),
		// Judge rotation defaults
		defaultHeatsPerRotation: int().default(4),
		defaultLaneShiftPattern: varchar({ length: 20 }).default("shift_right"),
		// Capacity: default max spots per division (null = unlimited)
		defaultMaxSpotsPerDivision: int(),
		// Primary address for the competition
		primaryAddressId: varchar({ length: 255 }),
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
export const competitionRegistrationsTable = mysqlTable(
	"competition_registrations",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionRegistrationId())
			.notNull(),
		// The competition this registration is for
		eventId: varchar({ length: 255 }).notNull(),
		// The user who registered (captain for team registrations)
		userId: varchar({ length: 255 }).notNull(),
		// The team membership created in the competition_event team
		teamMemberId: varchar({ length: 255 }).notNull(),
		// The division (scaling level) the athlete is competing in
		divisionId: varchar({ length: 255 }),
		// When the athlete registered
		registeredAt: datetime().notNull(),
		// Team info (NULL for individual registrations)
		teamName: varchar({ length: 255 }),
		// Who created the registration (same as userId for individuals)
		captainUserId: varchar({ length: 255 }),
		// For team registrations, the athlete team (competition_team type)
		// NULL for individual registrations (teamSize=1)
		athleteTeamId: varchar({ length: 255 }),
		// Pending teammates stored as JSON until they accept
		// Format: [{ email, firstName?, lastName?, affiliateName? }, ...]
		pendingTeammates: text(), // JSON array
		// Metadata as JSON (flexible for future expansion)
		metadata: text(), // JSON: { notes: "..." }

		// Commerce: Payment tracking
		// Reference to commerce_purchase (no FK to avoid circular deps - relation defined separately)
		commercePurchaseId: varchar({ length: 255 }),
		// Payment status: FREE | PENDING_PAYMENT | PAID | FAILED
		paymentStatus: varchar({ length: 20 }),
		// When payment was completed
		paidAt: datetime(),
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
export const competitionVenuesTable = mysqlTable(
	"competition_venues",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionVenueId())
			.notNull(),
		competitionId: varchar({ length: 255 }).notNull(),
		name: varchar({ length: 100 }).notNull(),
		laneCount: int().notNull().default(3),
		// Minutes between heats for auto-scheduling
		transitionMinutes: int().notNull().default(3),
		sortOrder: int().default(0).notNull(),
		// Address for this venue
		addressId: varchar({ length: 255 }),
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
export const competitionHeatsTable = mysqlTable(
	"competition_heats",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionHeatId())
			.notNull(),
		competitionId: varchar({ length: 255 }).notNull(),
		// References track_workout (competition event)
		trackWorkoutId: varchar({ length: 255 }).notNull(),
		venueId: varchar({ length: 255 }),
		heatNumber: int().notNull(),
		scheduledTime: datetime(),
		// Duration of this heat in minutes (workout cap + buffer)
		durationMinutes: int(),
		// Optional division filter (null = mixed divisions)
		divisionId: varchar({ length: 255 }),
		notes: varchar({ length: 500 }),
		// Per-heat schedule publishing: null = not published, timestamp = when published
		// Allows individual heat schedules to be made visible to athletes
		schedulePublishedAt: datetime(),
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
export const competitionHeatAssignmentsTable = mysqlTable(
	"competition_heat_assignments",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionHeatAssignmentId())
			.notNull(),
		heatId: varchar({ length: 255 }).notNull(),
		registrationId: varchar({ length: 255 }).notNull(),
		laneNumber: int().notNull(),
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

// Competition Registration Questions Table
// Defines custom questions organizers can ask during registration
export const competitionRegistrationQuestionsTable = mysqlTable(
	"competition_registration_questions",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionRegistrationQuestionId())
			.notNull(),
		competitionId: varchar({ length: 255 }).notNull(),
		// Question type: text (free form), select (dropdown), number
		type: varchar({ length: 20 })
			.$type<"text" | "select" | "number">()
			.notNull(),
		// Question label shown to athletes
		label: varchar({ length: 500 }).notNull(),
		// Optional help text / description
		helpText: varchar({ length: 1000 }),
		// For select type: JSON array of options ["S", "M", "L", "XL"]
		options: text(),
		// Is this question required?
		required: boolean().default(true).notNull(),
		// Should teammates also answer this question? (for team divisions)
		forTeammates: boolean().default(false).notNull(),
		// Sort order for display
		sortOrder: int().default(0).notNull(),
	},
	(table) => [
		index("comp_reg_questions_competition_idx").on(table.competitionId),
		index("comp_reg_questions_sort_idx").on(
			table.competitionId,
			table.sortOrder,
		),
	],
)

// Competition Registration Answers Table
// Stores athlete answers to registration questions
export const competitionRegistrationAnswersTable = mysqlTable(
	"competition_registration_answers",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionRegistrationAnswerId())
			.notNull(),
		questionId: varchar({ length: 255 }).notNull(),
		// The registration this answer belongs to
		registrationId: varchar({ length: 255 }).notNull(),
		// The user who answered (useful for team registrations where teammates answer separately)
		userId: varchar({ length: 255 }).notNull(),
		// The answer value (stored as text, converted as needed based on question type)
		answer: text().notNull(),
	},
	(table) => [
		index("comp_reg_answers_question_idx").on(table.questionId),
		index("comp_reg_answers_registration_idx").on(table.registrationId),
		index("comp_reg_answers_user_idx").on(table.userId),
		// One answer per question per user per registration
		uniqueIndex("comp_reg_answers_unique_idx").on(
			table.questionId,
			table.registrationId,
			table.userId,
		),
	],
)

// Competition Events Table
// Per-event settings for online competitions (submission windows, etc.)
export const competitionEventsTable = mysqlTable(
	"competition_events",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createCompetitionEventId())
			.notNull(),
		competitionId: varchar({ length: 255 }).notNull(),
		// References track_workout (competition event/workout)
		trackWorkoutId: varchar({ length: 255 }).notNull(),
		// Submission window for online competitions (ISO 8601 datetime strings)
		// Athletes can only submit scores within this window
		submissionOpensAt: varchar({ length: 255 }),
		submissionClosesAt: varchar({ length: 255 }),
	},
	(table) => [
		index("competition_events_competition_idx").on(table.competitionId),
		index("competition_events_workout_idx").on(table.trackWorkoutId),
		// One event config per workout per competition
		uniqueIndex("competition_events_comp_workout_idx").on(
			table.competitionId,
			table.trackWorkoutId,
		),
	],
)

// Type exports
export type CompetitionEvent = InferSelectModel<typeof competitionEventsTable>
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
export type CompetitionRegistrationQuestion = InferSelectModel<
	typeof competitionRegistrationQuestionsTable
>
export type CompetitionRegistrationAnswer = InferSelectModel<
	typeof competitionRegistrationAnswersTable
>

// Competition visibility constants
export const COMPETITION_VISIBILITY = {
	PUBLIC: "public",
	PRIVATE: "private",
} as const

export type CompetitionVisibility =
	(typeof COMPETITION_VISIBILITY)[keyof typeof COMPETITION_VISIBILITY]

// Competition type constants
export const COMPETITION_TYPES = {
	IN_PERSON: "in-person",
	ONLINE: "online",
} as const

export type CompetitionType =
	(typeof COMPETITION_TYPES)[keyof typeof COMPETITION_TYPES]

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
		// Registration questions
		registrationQuestions: many(competitionRegistrationQuestionsTable),
		// Primary address
		primaryAddress: one(addressesTable, {
			fields: [competitionsTable.primaryAddressId],
			references: [addressesTable.id],
		}),
		// Per-event settings (submission windows for online competitions)
		events: many(competitionEventsTable),
		// Judge rotations (from volunteers system)
		judgeRotations: many(competitionJudgeRotationsTable),
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
		// Registration question answers
		registrationAnswers: many(competitionRegistrationAnswersTable),
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
		address: one(addressesTable, {
			fields: [competitionVenuesTable.addressId],
			references: [addressesTable.id],
		}),
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
		// Judge assignments (from volunteers system)
		judgeAssignments: many(judgeHeatAssignmentsTable),
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

// Registration questions relations
export const competitionRegistrationQuestionsRelations = relations(
	competitionRegistrationQuestionsTable,
	({ one, many }) => ({
		competition: one(competitionsTable, {
			fields: [competitionRegistrationQuestionsTable.competitionId],
			references: [competitionsTable.id],
		}),
		answers: many(competitionRegistrationAnswersTable),
	}),
)

// Registration answers relations
export const competitionRegistrationAnswersRelations = relations(
	competitionRegistrationAnswersTable,
	({ one }) => ({
		question: one(competitionRegistrationQuestionsTable, {
			fields: [competitionRegistrationAnswersTable.questionId],
			references: [competitionRegistrationQuestionsTable.id],
		}),
		registration: one(competitionRegistrationsTable, {
			fields: [competitionRegistrationAnswersTable.registrationId],
			references: [competitionRegistrationsTable.id],
		}),
		user: one(userTable, {
			fields: [competitionRegistrationAnswersTable.userId],
			references: [userTable.id],
		}),
	}),
)

// Competition events relations
export const competitionEventsRelations = relations(
	competitionEventsTable,
	({ one }) => ({
		competition: one(competitionsTable, {
			fields: [competitionEventsTable.competitionId],
			references: [competitionsTable.id],
		}),
	}),
)
