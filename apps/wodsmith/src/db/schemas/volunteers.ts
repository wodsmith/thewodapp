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
	createJudgeRotationId,
} from "./common"
import { competitionHeatsTable, competitionsTable } from "./competitions"
import { trackWorkoutsTable } from "./programming"
import { teamMembershipTable } from "./teams"

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
	SHIFT_LEFT: "shift_left",
} as const

export type LaneShiftPattern =
	(typeof LANE_SHIFT_PATTERN)[keyof typeof LANE_SHIFT_PATTERN]

// TypeScript interface for volunteer membership metadata
// This gets stored as JSON in teamMembershipTable.metadata
export interface VolunteerMembershipMetadata {
	// Which volunteer roles this person can fill
	volunteerRoleTypes: VolunteerRoleType[]
	// Optional certifications/credentials (e.g., "L1 Judge", "EMT Certified")
	credentials?: string
	// T-shirt size for volunteer apparel
	shirtSize?: string
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
	// Contact info from public sign-up form (for pending volunteers without user accounts)
	signupEmail?: string
	signupName?: string
	signupPhone?: string
}

// Competition Heat Volunteers Table
// Maps volunteers (team memberships with volunteer role) to specific heats
export const competitionHeatVolunteersTable = sqliteTable(
	"competition_heat_volunteers",
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
		rotationId: text().references(() => competitionJudgeRotationsTable.id, {
			onDelete: "set null",
		}),
		// Optional lane assignment (for lane judges)
		laneNumber: integer(),
		// Position/role for this specific heat (overrides default from metadata)
		position: text({ length: 50 }).$type<VolunteerRoleType>(),
		// Heat-specific instructions for this volunteer
		instructions: text({ length: 500 }),
	},
	(table) => [
		index("competition_heat_volunteers_heat_idx").on(table.heatId),
		index("competition_heat_volunteers_membership_idx").on(table.membershipId),
		// Ensure a volunteer can only be assigned once per heat
		uniqueIndex("competition_heat_volunteers_unique_idx").on(
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
		// Lane shift pattern ('stay', 'shift_right', 'shift_left')
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
export type CompetitionHeatVolunteer = InferSelectModel<
	typeof competitionHeatVolunteersTable
>
export type CompetitionJudgeRotation = InferSelectModel<
	typeof competitionJudgeRotationsTable
>

// Relations
export const competitionHeatVolunteersRelations = relations(
	competitionHeatVolunteersTable,
	({ one }) => ({
		heat: one(competitionHeatsTable, {
			fields: [competitionHeatVolunteersTable.heatId],
			references: [competitionHeatsTable.id],
		}),
		membership: one(teamMembershipTable, {
			fields: [competitionHeatVolunteersTable.membershipId],
			references: [teamMembershipTable.id],
		}),
		rotation: one(competitionJudgeRotationsTable, {
			fields: [competitionHeatVolunteersTable.rotationId],
			references: [competitionJudgeRotationsTable.id],
		}),
	}),
)

// Reverse relation: heats can have many volunteers
export const competitionHeatsVolunteersReverseRelations = relations(
	competitionHeatsTable,
	({ many }) => ({
		volunteers: many(competitionHeatVolunteersTable),
	}),
)

// Reverse relation: team memberships can have volunteer assignments
export const teamMembershipVolunteersReverseRelations = relations(
	teamMembershipTable,
	({ many }) => ({
		volunteerAssignments: many(competitionHeatVolunteersTable),
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

// Reverse relation: track workouts can have judge rotations
export const trackWorkoutsJudgeRotationsReverseRelations = relations(
	trackWorkoutsTable,
	({ many }) => ({
		judgeRotations: many(competitionJudgeRotationsTable),
	}),
)
