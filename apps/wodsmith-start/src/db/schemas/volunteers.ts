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
	createHeatVolunteerId,
	createJudgeAssignmentVersionId,
	createJudgeRotationId,
} from "./common"
import { competitionHeatsTable, competitionsTable } from "./competitions"
import { trackWorkoutsTable } from "./programming"
import { teamMembershipTable } from "./teams"
import { userTable } from "./users"

// Volunteer role types
export const VOLUNTEER_ROLE_TYPES = {
	JUDGE: "judge",
	HEAD_JUDGE: "head_judge",
	EQUIPMENT: "equipment",
	MEDICAL: "medical",
	CHECK_IN: "check_in",
	STAFF: "staff",
	SCOREKEEPER: "scorekeeper",
	EMCEE: "emcee",
	FLOOR_MANAGER: "floor_manager",
	MEDIA: "media",
	GENERAL: "general",
} as const

export type VolunteerRoleType =
	(typeof VOLUNTEER_ROLE_TYPES)[keyof typeof VOLUNTEER_ROLE_TYPES]

// Lane shift pattern for judge rotations
export const LANE_SHIFT_PATTERN = {
	STAY: "stay",
	SHIFT_RIGHT: "shift_right",
} as const

export type LaneShiftPattern =
	(typeof LANE_SHIFT_PATTERN)[keyof typeof LANE_SHIFT_PATTERN]

// Volunteer availability schedule options
export const VOLUNTEER_AVAILABILITY = {
	MORNING: "morning",
	AFTERNOON: "afternoon",
	ALL_DAY: "all_day",
} as const

export type VolunteerAvailability =
	(typeof VOLUNTEER_AVAILABILITY)[keyof typeof VOLUNTEER_AVAILABILITY]

// How the volunteer invite was created
export const VOLUNTEER_INVITE_SOURCE = {
	// Admin directly invited a specific person - user accepts to join
	DIRECT: "direct",
	// Person applied via public form - admin approves to add them
	APPLICATION: "application",
} as const

export type VolunteerInviteSource =
	(typeof VOLUNTEER_INVITE_SOURCE)[keyof typeof VOLUNTEER_INVITE_SOURCE]

// TypeScript interface for volunteer membership metadata
// This gets stored as JSON in teamMembershipTable.metadata
export interface VolunteerMembershipMetadata {
	// Which volunteer roles this person can fill
	volunteerRoleTypes: VolunteerRoleType[]
	// Optional certifications/credentials (e.g., "L1 Judge", "EMT Certified")
	credentials?: string
	// T-shirt size for volunteer apparel
	shirtSize?: string
	// Schedule availability for this volunteer
	availability?: VolunteerAvailability
	// Availability notes (e.g., "Can only work Saturdays")
	availabilityNotes?: string
	// Emergency contact information
	emergencyContact?: {
		name: string
		phone: string
		relationship?: string
	}
	// Internal notes for organizers only
	internalNotes?: string
	// Volunteer signup status - for unauthenticated sign-ups
	status?: "pending" | "approved" | "rejected"
	// How the invite was created: "direct" (admin invited) or "application" (user applied)
	// - direct: Admin sends invite → user accepts → membership created
	// - application: User applies → admin approves → membership created
	inviteSource?: VolunteerInviteSource
	// Contact info from public sign-up form (for pending volunteers without user accounts)
	signupEmail?: string
	signupName?: string
	signupPhone?: string
}

// Judge Assignment Versions Table
// Tracks published versions of judge assignments for each event
export const judgeAssignmentVersionsTable = sqliteTable(
	"judge_assignment_versions",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createJudgeAssignmentVersionId())
			.notNull(),
		// The event/workout this version is for
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id, { onDelete: "cascade" }),
		// Version number (auto-increments per event)
		version: integer().notNull(),
		// When this version was published
		publishedAt: integer({
			mode: "timestamp",
		})
			.$defaultFn(() => new Date())
			.notNull(),
		// Who published this version (nullable for system-generated)
		publishedBy: text().references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Optional notes about this version
		notes: text({ length: 1000 }),
		// Whether this is the currently active version for this event
		isActive: integer({ mode: "boolean" }).notNull().default(false),
	},
	(table) => [
		index("judge_assignment_versions_workout_idx").on(table.trackWorkoutId),
		index("judge_assignment_versions_active_idx").on(
			table.trackWorkoutId,
			table.isActive,
		),
		// Ensure version numbers are unique per event
		uniqueIndex("judge_assignment_versions_unique_idx").on(
			table.trackWorkoutId,
			table.version,
		),
	],
)

// Judge Heat Assignments Table (formerly Competition Heat Volunteers)
// Maps volunteers (team memberships with volunteer role) to specific heats
export const judgeHeatAssignmentsTable = sqliteTable(
	"judge_heat_assignments",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createHeatVolunteerId())
			.notNull(),
		// The heat this volunteer is assigned to
		heatId: text()
			.notNull()
			.references(() => competitionHeatsTable.id, { onDelete: "cascade" }),
		// The team membership (must have volunteer role)
		membershipId: text()
			.notNull()
			.references(() => teamMembershipTable.id, { onDelete: "cascade" }),
		// Optional reference to the rotation that generated this assignment
		// (null for manually created assignments)
		// IMPORTANT: Keep this - it tracks which rotation generated an assignment
		rotationId: text().references(() => competitionJudgeRotationsTable.id, {
			onDelete: "set null",
		}),
		// Optional reference to the version this assignment belongs to
		// (nullable for migration - assignments created before versioning)
		versionId: text().references(() => judgeAssignmentVersionsTable.id, {
			onDelete: "set null",
		}),
		// Optional lane assignment (for lane judges)
		laneNumber: integer(),
		// Position/role for this specific heat (overrides default from metadata)
		position: text({ length: 50 }).$type<VolunteerRoleType>(),
		// Heat-specific instructions for this volunteer
		instructions: text({ length: 500 }),
		// Whether this assignment was manually overridden (not from rotation/version)
		isManualOverride: integer({ mode: "boolean" }).notNull().default(false),
	},
	(table) => [
		index("judge_heat_assignments_heat_idx").on(table.heatId),
		index("judge_heat_assignments_membership_idx").on(table.membershipId),
		index("judge_heat_assignments_version_idx").on(table.versionId),
		// Ensure a volunteer can only be assigned once per heat
		uniqueIndex("judge_heat_assignments_unique_idx").on(
			table.heatId,
			table.membershipId,
		),
	],
)

// Judge Rotations Table
// Defines rotation patterns for judges across multiple heats
export const competitionJudgeRotationsTable = sqliteTable(
	"competition_judge_rotations",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createJudgeRotationId())
			.notNull(),
		// The competition this rotation belongs to
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// The event/workout this rotation is for
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id, { onDelete: "cascade" }),
		// The judge (team membership with volunteer role)
		membershipId: text()
			.notNull()
			.references(() => teamMembershipTable.id, { onDelete: "cascade" }),
		// Starting heat number (1-indexed)
		startingHeat: integer().notNull(),
		// Starting lane number (1-indexed)
		startingLane: integer().notNull(),
		// How many consecutive heats they judge
		heatsCount: integer().notNull(),
		// Lane shift pattern ('stay', 'shift_right')
		laneShiftPattern: text({ length: 20 })
			.$type<LaneShiftPattern>()
			.notNull()
			.default("stay"),
		// Optional notes/instructions for this rotation
		notes: text({ length: 500 }),
	},
	(table) => [
		index("competition_judge_rotations_competition_idx").on(
			table.competitionId,
		),
		index("competition_judge_rotations_workout_idx").on(table.trackWorkoutId),
		index("competition_judge_rotations_membership_idx").on(table.membershipId),
		// Composite index for efficient rotation lookups
		index("competition_judge_rotations_event_heat_idx").on(
			table.trackWorkoutId,
			table.startingHeat,
		),
	],
)

// Type exports
export type JudgeAssignmentVersion = InferSelectModel<
	typeof judgeAssignmentVersionsTable
>
export type JudgeHeatAssignment = InferSelectModel<
	typeof judgeHeatAssignmentsTable
>
export type CompetitionJudgeRotation = InferSelectModel<
	typeof competitionJudgeRotationsTable
>

// Legacy type aliases for backward compatibility
export type CompetitionHeatVolunteer = JudgeHeatAssignment

// Relations for judge assignment versions
export const judgeAssignmentVersionsRelations = relations(
	judgeAssignmentVersionsTable,
	({ one, many }) => ({
		trackWorkout: one(trackWorkoutsTable, {
			fields: [judgeAssignmentVersionsTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
		publishedByUser: one(userTable, {
			fields: [judgeAssignmentVersionsTable.publishedBy],
			references: [userTable.id],
		}),
		assignments: many(judgeHeatAssignmentsTable),
	}),
)

// Relations for judge heat assignments
export const judgeHeatAssignmentsRelations = relations(
	judgeHeatAssignmentsTable,
	({ one }) => ({
		heat: one(competitionHeatsTable, {
			fields: [judgeHeatAssignmentsTable.heatId],
			references: [competitionHeatsTable.id],
		}),
		membership: one(teamMembershipTable, {
			fields: [judgeHeatAssignmentsTable.membershipId],
			references: [teamMembershipTable.id],
		}),
		rotation: one(competitionJudgeRotationsTable, {
			fields: [judgeHeatAssignmentsTable.rotationId],
			references: [competitionJudgeRotationsTable.id],
		}),
		version: one(judgeAssignmentVersionsTable, {
			fields: [judgeHeatAssignmentsTable.versionId],
			references: [judgeAssignmentVersionsTable.id],
		}),
	}),
)

// Reverse relation: heats can have many judge assignments
export const competitionHeatsJudgeAssignmentsReverseRelations = relations(
	competitionHeatsTable,
	({ many }) => ({
		judgeAssignments: many(judgeHeatAssignmentsTable),
	}),
)

// Reverse relation: team memberships can have judge assignments
export const teamMembershipJudgeAssignmentsReverseRelations = relations(
	teamMembershipTable,
	({ many }) => ({
		judgeAssignments: many(judgeHeatAssignmentsTable),
		judgeRotations: many(competitionJudgeRotationsTable),
	}),
)

// Judge rotations relations
export const competitionJudgeRotationsRelations = relations(
	competitionJudgeRotationsTable,
	({ one }) => ({
		competition: one(competitionsTable, {
			fields: [competitionJudgeRotationsTable.competitionId],
			references: [competitionsTable.id],
		}),
		trackWorkout: one(trackWorkoutsTable, {
			fields: [competitionJudgeRotationsTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
		membership: one(teamMembershipTable, {
			fields: [competitionJudgeRotationsTable.membershipId],
			references: [teamMembershipTable.id],
		}),
	}),
)

// Reverse relation: competitions can have judge rotations
export const competitionsJudgeRotationsReverseRelations = relations(
	competitionsTable,
	({ many }) => ({
		judgeRotations: many(competitionJudgeRotationsTable),
	}),
)

// Reverse relation: track workouts can have judge rotations and versions
export const trackWorkoutsJudgeSystemReverseRelations = relations(
	trackWorkoutsTable,
	({ many }) => ({
		judgeRotations: many(competitionJudgeRotationsTable),
		judgeAssignmentVersions: many(judgeAssignmentVersionsTable),
	}),
)
