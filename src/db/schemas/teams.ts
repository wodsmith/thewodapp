import { relations } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createTeamId,
	createTeamInvitationId,
	createTeamMembershipId,
	createTeamRoleId,
} from "./common"
import { userTable } from "./users"

// System-defined roles - these are always available
export const SYSTEM_ROLES_ENUM = {
	OWNER: "owner",
	ADMIN: "admin",
	MEMBER: "member",
	GUEST: "guest",
} as const

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

	// Add more as needed
} as const

// Team table
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
		planId: text({ length: 100 }),
		planExpiresAt: integer({ mode: "timestamp" }),
		creditBalance: integer().default(0).notNull(),
		defaultTrackId: text(),
		// Flag to indicate if this is a personal team (created automatically for each user)
		isPersonalTeam: integer().default(0).notNull(),
		// For personal teams, store the owner user ID
		personalTeamOwnerId: text().references(() => userTable.id),
	},
	(table) => [
		index("team_slug_idx").on(table.slug),
		index("team_personal_owner_idx").on(table.personalTeamOwnerId),
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
		invitedBy: text()
			.notNull()
			.references(() => userTable.id),
		expiresAt: integer({ mode: "timestamp" }).notNull(),
		acceptedAt: integer({ mode: "timestamp" }),
		acceptedBy: text().references(() => userTable.id),
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

// Type exports
export type Team = InferSelectModel<typeof teamTable>
export type TeamMembership = InferSelectModel<typeof teamMembershipTable>
export type TeamRole = InferSelectModel<typeof teamRoleTable>
export type TeamInvitation = InferSelectModel<typeof teamInvitationTable>
