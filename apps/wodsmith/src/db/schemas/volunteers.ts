import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { commonColumns, createHeatVolunteerId } from "./common"
import { competitionHeatsTable } from "./competitions"
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

// Type exports
export type CompetitionHeatVolunteer = InferSelectModel<
	typeof competitionHeatVolunteersTable
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
	}),
)
