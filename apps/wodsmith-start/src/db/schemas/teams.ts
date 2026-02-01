import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createTeamId,
	createTeamInvitationId,
	createTeamMembershipId,
	createTeamRoleId,
} from "./common"
import {
	competitionGroupsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "./competitions"
import { userTable } from "./users"

// Team types for competition platform
export const TEAM_TYPE_ENUM = {
	GYM: "gym",
	COMPETITION_EVENT: "competition_event",
	COMPETITION_TEAM: "competition_team", // Athlete squads for team competitions
	PERSONAL: "personal",
} as const

export type TeamType = (typeof TEAM_TYPE_ENUM)[keyof typeof TEAM_TYPE_ENUM]

// System-defined roles - these are always available
export const SYSTEM_ROLES_ENUM = {
	OWNER: "owner",
	ADMIN: "admin",
	CAPTAIN: "captain", // Competition team captain
	MEMBER: "member",
	GUEST: "guest",
	VOLUNTEER: "volunteer", // Competition volunteer
} as const

// Invitation status for tracking guest acceptance
export const INVITATION_STATUS = {
	PENDING: "pending", // Invited but not yet responded
	ACCEPTED: "accepted", // Guest accepted (answered questions/signed waivers)
} as const

export type InvitationStatus =
	(typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS]

export const systemRoleTuple = Object.values(SYSTEM_ROLES_ENUM) as [
	string,
	...string[],
]

// Define available permissions
export const TEAM_PERMISSIONS = {
	// Resource access
	ACCESS_DASHBOARD: "access_dashboard",
	ACCESS_BILLING: "access_billing",

	// User management
	INVITE_MEMBERS: "invite_members",
	REMOVE_MEMBERS: "remove_members",
	CHANGE_MEMBER_ROLES: "change_member_roles",

	// Team management
	EDIT_TEAM_SETTINGS: "edit_team_settings",
	DELETE_TEAM: "delete_team",

	// Role management
	CREATE_ROLES: "create_roles",
	EDIT_ROLES: "edit_roles",
	DELETE_ROLES: "delete_roles",
	ASSIGN_ROLES: "assign_roles",

	// Content permissions
	CREATE_COMPONENTS: "create_components",
	EDIT_COMPONENTS: "edit_components",
	DELETE_COMPONENTS: "delete_components",

	// Programming track permissions
	MANAGE_PROGRAMMING: "manage_programming",

	// Scaling group permissions
	MANAGE_SCALING_GROUPS: "manage_scaling_groups",

	// Competition permissions
	MANAGE_COMPETITIONS: "manage_competitions",
} as const

// Team table - using self-reference pattern for parent organization
export const teamTable = sqliteTable(
	"team",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamId())
			.notNull(),
		name: text({ length: 255 }).notNull(),
		slug: text({ length: 255 }).notNull().unique(),
		description: text({ length: 1000 }),
		avatarUrl: text({ length: 600 }),
		// Settings could be stored as JSON
		settings: text({ length: 10000 }),
		// Optional billing-related fields
		billingEmail: text({ length: 255 }),
		// DEPRECATED: Legacy fields - will be removed after migration to entitlements system
		planId: text({ length: 100 }),
		planExpiresAt: integer({ mode: "timestamp" }),
		// Keep creditBalance for backward compatibility and one-off purchases
		creditBalance: integer().default(0).notNull(),
		// NEW: Current subscription plan (entitlements system)
		currentPlanId: text({ length: 100 }),
		defaultTrackId: text(),
		// Default scaling group for the team
		defaultScalingGroupId: text(),
		// Flag to indicate if this is a personal team (created automatically for each user)
		isPersonalTeam: integer().default(0).notNull(),
		// For personal teams, store the owner user ID
		personalTeamOwnerId: text().references(() => userTable.id),
		// Competition platform fields
		// Team type: gym (default), competition_event, or personal
		type: text({ length: 50 }).$type<TeamType>().default("gym").notNull(),
		// For competition_event teams, the parent organizing gym/team
		// Self-reference handled by Drizzle
		parentOrganizationId: text(),
		// JSON metadata for competition-specific settings
		competitionMetadata: text({ length: 10000 }),

		// Stripe Connect fields (Phase 2 prep for organizer payouts)
		stripeConnectedAccountId: text(), // Stripe account ID (acct_xxx)
		stripeAccountStatus: text({ length: 20 }), // NOT_CONNECTED | PENDING | VERIFIED
		stripeAccountType: text({ length: 20 }), // 'express' | 'standard' | null
		stripeOnboardingCompletedAt: integer({ mode: "timestamp" }),

		// Organizer fee overrides (for founding organizers or special arrangements)
		// Null = use platform defaults (4% + $4)
		// Set values = use custom rates (e.g., founding organizer at 2.5% + $3)
		organizerFeePercentage: integer(), // basis points (e.g., 250 = 2.5%)
		organizerFeeFixed: integer(), // cents (e.g., 300 = $3.00)
	},
	(table) => [
		index("team_slug_idx").on(table.slug),
		index("team_personal_owner_idx").on(table.personalTeamOwnerId),
		index("team_default_scaling_idx").on(table.defaultScalingGroupId),
		index("team_type_idx").on(table.type),
		index("team_parent_org_idx").on(table.parentOrganizationId),
		// Self-referencing foreign key for team hierarchy (competition_event -> organizing gym)
		foreignKey({
			columns: [table.parentOrganizationId],
			foreignColumns: [table.id],
			name: "team_parent_org_fk",
		}).onDelete("cascade"),
	],
)

// Team membership table
export const teamMembershipTable = sqliteTable(
	"team_membership",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamMembershipId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		// This can be either a system role or a custom role ID
		roleId: text().notNull(),
		// Flag to indicate if this is a system role
		isSystemRole: integer().default(1).notNull(),
		invitedBy: text().references(() => userTable.id),
		invitedAt: integer({ mode: "timestamp" }),
		joinedAt: integer({ mode: "timestamp" }),
		expiresAt: integer({ mode: "timestamp" }),
		isActive: integer().default(1).notNull(),
		// JSON metadata for role-specific data (e.g., volunteer info)
		metadata: text({ length: 5000 }),
	},
	(table) => [
		index("team_membership_team_id_idx").on(table.teamId),
		index("team_membership_user_id_idx").on(table.userId),
		// Instead of unique() which causes linter errors, we'll create a unique constraint on columns
		index("team_membership_unique_idx").on(table.teamId, table.userId),
	],
)

// Team role table
export const teamRoleTable = sqliteTable(
	"team_role",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamRoleId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 1000 }),
		// Store permissions as a JSON array of permission keys
		permissions: text({ mode: "json" }).notNull().$type<string[]>(),
		// A JSON field for storing UI-specific settings like color, icon, etc.
		metadata: text({ length: 5000 }),
		// Optional flag to mark some roles as non-editable
		isEditable: integer().default(1).notNull(),
	},
	(table) => [
		index("team_role_team_id_idx").on(table.teamId),
		// Instead of unique() which causes linter errors, we'll create a unique constraint on columns
		index("team_role_name_unique_idx").on(table.teamId, table.name),
	],
)

// Team invitation table
export const teamInvitationTable = sqliteTable(
	"team_invitation",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamInvitationId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		email: text({ length: 255 }).notNull(),
		// This can be either a system role or a custom role ID
		roleId: text().notNull(),
		// Flag to indicate if this is a system role
		isSystemRole: integer().default(1).notNull(),
		token: text({ length: 255 }).notNull().unique(),
		invitedBy: text().references(() => userTable.id),
		expiresAt: integer({ mode: "timestamp" }).notNull(),
		acceptedAt: integer({ mode: "timestamp" }),
		acceptedBy: text().references(() => userTable.id),
		// Invitation status: pending (awaiting response) or accepted (guest accepted invite)
		// Note: acceptedAt tracks when a user with account formally joined
		// status tracks when the invite was accepted (guest submitted form data)
		status: text({ length: 20 })
			.$type<InvitationStatus>()
			.default("pending")
			.notNull(),
		// Optional JSON metadata to transfer to membership on acceptance
		metadata: text(),
	},
	(table) => [
		index("team_invitation_team_id_idx").on(table.teamId),
		index("team_invitation_email_idx").on(table.email),
		index("team_invitation_token_idx").on(table.token),
	],
)

// Relations
export const teamRelations = relations(teamTable, ({ many, one }) => ({
	memberships: many(teamMembershipTable),
	invitations: many(teamInvitationTable),
	roles: many(teamRoleTable),
	// Personal team owner relation
	personalTeamOwner: one(userTable, {
		fields: [teamTable.personalTeamOwnerId],
		references: [userTable.id],
		relationName: "personalTeamOwner",
	}),
	// Competition platform relations
	// Parent organization (for competition_event teams)
	parentOrganization: one(teamTable, {
		fields: [teamTable.parentOrganizationId],
		references: [teamTable.id],
		relationName: "teamHierarchy",
	}),
	// Child teams (competition_event teams owned by this team)
	childTeams: many(teamTable, {
		relationName: "teamHierarchy",
	}),
	// Competition groups created by this organizing team
	competitionGroups: many(competitionGroupsTable),
	// Competitions organized by this team (as the organizing gym)
	organizedCompetitions: many(competitionsTable, {
		relationName: "organizingTeam",
	}),
	// Competitions managed by this team (as the competition_event team)
	managedCompetitions: many(competitionsTable, {
		relationName: "competitionTeam",
	}),
	// Registrations where this team is the athlete team (competition_team type)
	athleteTeamRegistrations: many(competitionRegistrationsTable, {
		relationName: "athleteTeamRegistration",
	}),
}))

export const teamRoleRelations = relations(teamRoleTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamRoleTable.teamId],
		references: [teamTable.id],
	}),
}))

export const teamMembershipRelations = relations(
	teamMembershipTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamMembershipTable.teamId],
			references: [teamTable.id],
		}),
		user: one(userTable, {
			relationName: "member",
			fields: [teamMembershipTable.userId],
			references: [userTable.id],
		}),
		invitedByUser: one(userTable, {
			relationName: "inviter",
			fields: [teamMembershipTable.invitedBy],
			references: [userTable.id],
		}),
	}),
)

export const teamInvitationRelations = relations(
	teamInvitationTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamInvitationTable.teamId],
			references: [teamTable.id],
		}),
		invitedByUser: one(userTable, {
			relationName: "inviter",
			fields: [teamInvitationTable.invitedBy],
			references: [userTable.id],
		}),
		acceptedByUser: one(userTable, {
			relationName: "acceptor",
			fields: [teamInvitationTable.acceptedBy],
			references: [userTable.id],
		}),
	}),
)

// Pending invite data types (stored in teamInvitationTable.metadata before account creation)
export interface PendingInviteAnswer {
	questionId: string
	answer: string
}

export interface PendingWaiverSignature {
	waiverId: string
	signedAt: string // ISO date string
	signatureName: string // The name they typed as signature
}

export interface PendingInviteData {
	pendingAnswers?: PendingInviteAnswer[]
	pendingSignatures?: PendingWaiverSignature[]
	submittedAt?: string // ISO date when guest submitted
}

// Type exports
export type Team = InferSelectModel<typeof teamTable>
export type TeamMembership = InferSelectModel<typeof teamMembershipTable>
export type TeamRole = InferSelectModel<typeof teamRoleTable>
export type TeamInvitation = InferSelectModel<typeof teamInvitationTable>
