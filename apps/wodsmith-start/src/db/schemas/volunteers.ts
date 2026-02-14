import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	int,
	mysqlTable,
	varchar,
	boolean,
	datetime,
	uniqueIndex,
} from "drizzle-orm/mysql-core"
import {
	commonColumns,
	createHeatVolunteerId,
	createJudgeAssignmentVersionId,
	createJudgeRotationId,
	createVolunteerShiftAssignmentId,
	createVolunteerShiftId,
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
	ATHLETE_CONTROL: "athlete_control",
	EQUIPMENT_TEAM: "equipment_team",
} as const

export type VolunteerRoleType =
	(typeof VOLUNTEER_ROLE_TYPES)[keyof typeof VOLUNTEER_ROLE_TYPES]

// Human-readable labels for volunteer role types
export const VOLUNTEER_ROLE_LABELS: Record<VolunteerRoleType, string> = {
	judge: "Judge",
	head_judge: "Head Judge",
	equipment: "Equipment",
	medical: "Medical",
	check_in: "Check-In",
	staff: "Staff",
	scorekeeper: "Scorekeeper",
	emcee: "Emcee",
	floor_manager: "Floor Manager",
	media: "Media",
	general: "General",
	athlete_control: "Athlete Control",
	equipment_team: "Equipment Team",
}

// All role type values as an array (for zod schemas, dropdowns, etc.)
export const VOLUNTEER_ROLE_TYPE_VALUES = Object.values(
	VOLUNTEER_ROLE_TYPES,
) as [VolunteerRoleType, ...VolunteerRoleType[]]

// Role type options for dropdowns (value + label pairs)
export const VOLUNTEER_ROLE_OPTIONS: {
	value: VolunteerRoleType
	label: string
}[] = VOLUNTEER_ROLE_TYPE_VALUES.map((value) => ({
	value,
	label: VOLUNTEER_ROLE_LABELS[value],
}))

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
export const judgeAssignmentVersionsTable = mysqlTable(
	"judge_assignment_versions",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createJudgeAssignmentVersionId())
			.notNull(),
		// The event/workout this version is for
		trackWorkoutId: varchar({ length: 255 }).notNull(),
		// Version number (auto-increments per event)
		version: int().notNull(),
		// When this version was published
		publishedAt: datetime()
			.$defaultFn(() => new Date())
			.notNull(),
		// Who published this version (nullable for system-generated)
		publishedBy: varchar({ length: 255 }),
		// Optional notes about this version
		notes: varchar({ length: 1000 }),
		// Whether this is the currently active version for this event
		isActive: boolean().notNull().default(false),
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
export const judgeHeatAssignmentsTable = mysqlTable(
	"judge_heat_assignments",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createHeatVolunteerId())
			.notNull(),
		// The heat this volunteer is assigned to
		heatId: varchar({ length: 255 }).notNull(),
		// The team membership (must have volunteer role)
		membershipId: varchar({ length: 255 }).notNull(),
		// Optional reference to the rotation that generated this assignment
		// (null for manually created assignments)
		// IMPORTANT: Keep this - it tracks which rotation generated an assignment
		rotationId: varchar({ length: 255 }),
		// Optional reference to the version this assignment belongs to
		// (nullable for migration - assignments created before versioning)
		versionId: varchar({ length: 255 }),
		// Optional lane assignment (for lane judges)
		laneNumber: int(),
		// Position/role for this specific heat (overrides default from metadata)
		position: varchar({ length: 50 }).$type<VolunteerRoleType>(),
		// Heat-specific instructions for this volunteer
		instructions: varchar({ length: 500 }),
		// Whether this assignment was manually overridden (not from rotation/version)
		isManualOverride: boolean().notNull().default(false),
	},
	(table) => [
		index("judge_heat_assignments_heat_idx").on(table.heatId),
		index("judge_heat_assignments_membership_idx").on(table.membershipId),
		index("judge_heat_assignments_version_idx").on(table.versionId),
		// Ensure a volunteer can only be assigned once per heat per version
		uniqueIndex("judge_heat_assignments_unique_idx").on(
			table.heatId,
			table.membershipId,
			table.versionId,
		),
	],
)

// Judge Rotations Table
// Defines rotation patterns for judges across multiple heats
export const competitionJudgeRotationsTable = mysqlTable(
	"competition_judge_rotations",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createJudgeRotationId())
			.notNull(),
		// The competition this rotation belongs to
		competitionId: varchar({ length: 255 }).notNull(),
		// The event/workout this rotation is for
		trackWorkoutId: varchar({ length: 255 }).notNull(),
		// The judge (team membership with volunteer role)
		membershipId: varchar({ length: 255 }).notNull(),
		// Starting heat number (1-indexed)
		startingHeat: int().notNull(),
		// Starting lane number (1-indexed)
		startingLane: int().notNull(),
		// How many consecutive heats they judge
		heatsCount: int().notNull(),
		// Lane shift pattern ('stay', 'shift_right')
		laneShiftPattern: varchar({ length: 20 })
			.$type<LaneShiftPattern>()
			.notNull()
			.default("stay"),
		// Optional notes/instructions for this rotation
		notes: varchar({ length: 500 }),
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

// Volunteer Shifts Table
// Time-based volunteer shifts for non-judge roles (medical, check_in, staff, etc.)
// Unlike judge rotations (heat-based), these are standalone time slots
export const volunteerShiftsTable = mysqlTable(
	"volunteer_shifts",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createVolunteerShiftId())
			.notNull(),
		// The competition this shift belongs to
		competitionId: varchar({ length: 255 }).notNull(),
		// Name of the shift (e.g., "Morning Check-In", "Medical Station A")
		name: varchar({ length: 200 }).notNull(),
		// Role type for this shift
		roleType: varchar({ length: 50 }).$type<VolunteerRoleType>().notNull(),
		// Shift start time
		startTime: datetime().notNull(),
		// Shift end time
		endTime: datetime().notNull(),
		// Optional location for this shift
		location: varchar({ length: 200 }),
		// Maximum number of volunteers for this shift
		capacity: int().notNull().default(1),
		// Optional notes/instructions for this shift
		notes: varchar({ length: 1000 }),
	},
	(table) => [
		index("volunteer_shifts_competition_idx").on(table.competitionId),
		index("volunteer_shifts_start_time_idx").on(table.startTime),
	],
)

// Volunteer Shift Assignments Table
// Junction table to assign volunteers (team memberships) to shifts
// A volunteer can be assigned to multiple shifts, and a shift can have multiple volunteers up to its capacity
export const volunteerShiftAssignmentsTable = mysqlTable(
	"volunteer_shift_assignments",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createVolunteerShiftAssignmentId())
			.notNull(),
		// The shift this assignment is for
		shiftId: varchar({ length: 255 }).notNull(),
		// The team membership (volunteer) being assigned
		membershipId: varchar({ length: 255 }).notNull(),
		// Optional notes/instructions for this specific assignment
		notes: varchar({ length: 500 }),
	},
	(table) => [
		index("volunteer_shift_assignments_shift_idx").on(table.shiftId),
		index("volunteer_shift_assignments_membership_idx").on(table.membershipId),
		// Ensure a volunteer can only be assigned once per shift
		uniqueIndex("volunteer_shift_assignments_unique_idx").on(
			table.shiftId,
			table.membershipId,
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
export type VolunteerShift = InferSelectModel<typeof volunteerShiftsTable>
export type VolunteerShiftAssignment = InferSelectModel<
	typeof volunteerShiftAssignmentsTable
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

// Note: Reverse relations for competitionHeatsTable and teamMembershipTable
// are merged into their primary definitions in competitions.ts and teams.ts
// volunteerShiftAssignments reverse relation is also included there

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

// Note: Reverse relations for competitionsTable and trackWorkoutsTable
// are merged into their primary definitions in competitions.ts and programming.ts
// volunteerShifts reverse relation is also included there

// Volunteer shifts relations
export const volunteerShiftsRelations = relations(
	volunteerShiftsTable,
	({ one, many }) => ({
		competition: one(competitionsTable, {
			fields: [volunteerShiftsTable.competitionId],
			references: [competitionsTable.id],
		}),
		assignments: many(volunteerShiftAssignmentsTable),
	}),
)

// Volunteer shift assignments relations
export const volunteerShiftAssignmentsRelations = relations(
	volunteerShiftAssignmentsTable,
	({ one }) => ({
		shift: one(volunteerShiftsTable, {
			fields: [volunteerShiftAssignmentsTable.shiftId],
			references: [volunteerShiftsTable.id],
		}),
		membership: one(teamMembershipTable, {
			fields: [volunteerShiftAssignmentsTable.membershipId],
			references: [teamMembershipTable.id],
		}),
	}),
)
