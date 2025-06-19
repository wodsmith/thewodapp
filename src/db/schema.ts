import { relations, sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core"

import type { Prettify } from "@/lib/utils"
import { createId } from "@paralleldrive/cuid2"

export const ROLES_ENUM = {
	ADMIN: "admin",
	USER: "user",
} as const

const roleTuple = Object.values(ROLES_ENUM) as [string, ...string[]]

const commonColumns = {
	createdAt: integer({
		mode: "timestamp",
	})
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer({
		mode: "timestamp",
	})
		.$onUpdateFn(() => new Date())
		.notNull(),
	updateCounter: integer()
		.default(0)
		.$onUpdate(() => sql`updateCounter + 1`),
}

export const userTable = sqliteTable(
	"user",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `usr_${createId()}`)
			.notNull(),
		firstName: text({
			length: 255,
		}),
		lastName: text({
			length: 255,
		}),
		email: text({
			length: 255,
		}).unique(),
		passwordHash: text(),
		role: text({
			enum: roleTuple,
		})
			.default(ROLES_ENUM.USER)
			.notNull(),
		emailVerified: integer({
			mode: "timestamp",
		}),
		signUpIpAddress: text({
			length: 100,
		}),
		googleAccountId: text({
			length: 255,
		}),
		/**
		 * This can either be an absolute or relative path to an image
		 */
		avatar: text({
			length: 600,
		}),
		// Credit system fields
		currentCredits: integer().default(0).notNull(),
		lastCreditRefreshAt: integer({
			mode: "timestamp",
		}),
	},
	(table) => [
		index("email_idx").on(table.email),
		index("google_account_id_idx").on(table.googleAccountId),
		index("role_idx").on(table.role),
	],
)

export const passKeyCredentialTable = sqliteTable(
	"passkey_credential",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `pkey_${createId()}`)
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		credentialId: text({
			length: 255,
		})
			.notNull()
			.unique(),
		credentialPublicKey: text({
			length: 255,
		}).notNull(),
		counter: integer().notNull(),
		// Optional array of AuthenticatorTransport as JSON string
		transports: text({
			length: 255,
		}),
		// Authenticator Attestation GUID. We use this to identify the device/authenticator app that created the passkey
		aaguid: text({
			length: 255,
		}),
		// The user agent of the device that created the passkey
		userAgent: text({
			length: 255,
		}),
		// The IP address that created the passkey
		ipAddress: text({
			length: 100,
		}),
	},
	(table) => [
		index("user_id_idx").on(table.userId),
		index("credential_id_idx").on(table.credentialId),
	],
)

// Credit transaction types
export const CREDIT_TRANSACTION_TYPE = {
	PURCHASE: "PURCHASE",
	USAGE: "USAGE",
	MONTHLY_REFRESH: "MONTHLY_REFRESH",
} as const

export const creditTransactionTypeTuple = Object.values(
	CREDIT_TRANSACTION_TYPE,
) as [string, ...string[]]

export const creditTransactionTable = sqliteTable(
	"credit_transaction",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `ctxn_${createId()}`)
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		amount: integer().notNull(),
		// Track how many credits are still available from this transaction
		remainingAmount: integer().default(0).notNull(),
		type: text({
			enum: creditTransactionTypeTuple,
		}).notNull(),
		description: text({
			length: 255,
		}).notNull(),
		expirationDate: integer({
			mode: "timestamp",
		}),
		expirationDateProcessedAt: integer({
			mode: "timestamp",
		}),
		paymentIntentId: text({
			length: 255,
		}),
	},
	(table) => [
		index("credit_transaction_user_id_idx").on(table.userId),
		index("credit_transaction_type_idx").on(table.type),
		index("credit_transaction_created_at_idx").on(table.createdAt),
		index("credit_transaction_expiration_date_idx").on(table.expirationDate),
		index("credit_transaction_payment_intent_id_idx").on(table.paymentIntentId),
	],
)

// Define item types that can be purchased
export const PURCHASABLE_ITEM_TYPE = {
	COMPONENT: "COMPONENT",
	// Add more types in the future (e.g., TEMPLATE, PLUGIN, etc.)
} as const

export const purchasableItemTypeTuple = Object.values(
	PURCHASABLE_ITEM_TYPE,
) as [string, ...string[]]

export const purchasedItemsTable = sqliteTable(
	"purchased_item",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `pitem_${createId()}`)
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id),
		// The type of item (e.g., COMPONENT, TEMPLATE, etc.)
		itemType: text({
			enum: purchasableItemTypeTuple,
		}).notNull(),
		// The ID of the item within its type (e.g., componentId)
		itemId: text().notNull(),
		purchasedAt: integer({
			mode: "timestamp",
		})
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		index("purchased_item_user_id_idx").on(table.userId),
		index("purchased_item_type_idx").on(table.itemType),
		// Composite index for checking if a user owns a specific item of a specific type
		index("purchased_item_user_item_idx").on(
			table.userId,
			table.itemType,
			table.itemId,
		),
	],
)

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

	// Add more as needed
} as const

// ---------------------------------------------
// Programming Tracks & Scheduling (declare early to be referenced later)
// ---------------------------------------------

// Track types enum & tuple
export const PROGRAMMING_TRACK_TYPE = {
	SELF_PROGRAMMED: "self_programmed",
	TEAM_OWNED: "team_owned",
	OFFICIAL_3RD_PARTY: "official_3rd_party",
} as const

export const programmingTrackTypeTuple = Object.values(
	PROGRAMMING_TRACK_TYPE,
) as [string, ...string[]]

// Team table
export const teamTable = sqliteTable(
	"team",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `team_${createId()}`)
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
	},
	(table) => [index("team_slug_idx").on(table.slug)],
)

// programming_tracks
export const programmingTracksTable = sqliteTable(
	"programming_track",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `ptrk_${createId()}`)
			.notNull(),
		name: text({ length: 255 }).notNull(),
		description: text({ length: 1000 }),
		type: text({ enum: programmingTrackTypeTuple }).notNull(),
		ownerTeamId: text().references(() => teamTable.id),
		isPublic: integer().default(0).notNull(),
	},
	(table) => [
		index("programming_track_type_idx").on(table.type),
		index("programming_track_owner_idx").on(table.ownerTeamId),
	],
)

// Team membership table
export const teamMembershipTable = sqliteTable(
	"team_membership",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `tmem_${createId()}`)
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
			.$defaultFn(() => `trole_${createId()}`)
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
			.$defaultFn(() => `tinv_${createId()}`)
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

export const teamRelations = relations(teamTable, ({ many, one }) => ({
	memberships: many(teamMembershipTable),
	invitations: many(teamInvitationTable),
	roles: many(teamRoleTable),
	defaultTrack: one(programmingTracksTable, {
		fields: [teamTable.defaultTrackId],
		references: [programmingTracksTable.id],
	}),
	programmingTracks: many(teamProgrammingTracksTable),
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

export const creditTransactionRelations = relations(
	creditTransactionTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [creditTransactionTable.userId],
			references: [userTable.id],
		}),
	}),
)

export const purchasedItemsRelations = relations(
	purchasedItemsTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [purchasedItemsTable.userId],
			references: [userTable.id],
		}),
	}),
)

export const userRelations = relations(userTable, ({ many }) => ({
	passkeys: many(passKeyCredentialTable),
	creditTransactions: many(creditTransactionTable),
	purchasedItems: many(purchasedItemsTable),
	teamMemberships: many(teamMembershipTable, {
		relationName: "member",
	}),
	invitedTeamMemberships: many(teamMembershipTable, {
		relationName: "inviter",
	}),
	invitedTeamInvitations: many(teamInvitationTable, {
		relationName: "inviter",
	}),
	acceptedTeamInvitations: many(teamInvitationTable, {
		relationName: "acceptor",
	}),
}))

export const passKeyCredentialRelations = relations(
	passKeyCredentialTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [passKeyCredentialTable.userId],
			references: [userTable.id],
		}),
	}),
)

export const MOVEMENT_TYPE_VALUES = [
	"weightlifting",
	"gymnastic",
	"monostructural",
] as const
export const movements = sqliteTable("movements", {
	...commonColumns,
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	type: text("type", {
		enum: ["weightlifting", "gymnastic", "monostructural"],
	}).notNull(),
})

// Tags table (new)
export const tags = sqliteTable("spicy_tags", {
	...commonColumns,
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
})

// Workout Tags junction table (new)
export const workoutTags = sqliteTable("workout_tags", {
	...commonColumns,
	id: text("id").primaryKey(),
	workoutId: text("workout_id")
		.references(() => workouts.id)
		.notNull(),
	tagId: text("tag_id")
		.references(() => tags.id)
		.notNull(),
})

// Workouts table (with relation to tags)
export const workouts = sqliteTable("workouts", {
	...commonColumns,
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	scope: text("scope", {
		enum: ["private", "public"],
	})
		.default("private")
		.notNull(),
	scheme: text("scheme", {
		enum: [
			"time",
			"time-with-cap",
			"pass-fail",
			"rounds-reps",
			"reps",
			"emom",
			"load",
			"calories",
			"meters",
			"feet",
			"points",
		],
	}).notNull(),
	repsPerRound: integer("reps_per_round"),
	roundsToScore: integer("rounds_to_score").default(1),
	userId: text("user_id").references(() => userTable.id),
	sugarId: text("sugar_id"),
	tiebreakScheme: text("tiebreak_scheme", { enum: ["time", "reps"] }),
	secondaryScheme: text("secondary_scheme", {
		enum: [
			"time",
			"pass-fail",
			"rounds-reps",
			"reps",
			"emom",
			"load",
			"calories",
			"meters",
			"feet",
			"points",
		],
	}),
	sourceTrackId: text("source_track_id").references(
		() => programmingTracksTable.id,
	),
})

// Workout Movements junction table (no changes)
export const workoutMovements = sqliteTable("workout_movements", {
	...commonColumns,
	id: text("id").primaryKey(),
	workoutId: text("workout_id").references(() => workouts.id),
	movementId: text("movement_id").references(() => movements.id),
})

// Results base table (consolidated)
export const results = sqliteTable("results", {
	...commonColumns,
	id: text("id").primaryKey(),
	userId: text("user_id")
		.references(() => userTable.id)
		.notNull(),
	date: integer("date", { mode: "timestamp" }).notNull(),
	workoutId: text("workout_id").references(() => workouts.id), // Optional, for WOD results
	type: text("type", {
		enum: ["wod", "strength", "monostructural"],
	}).notNull(),
	notes: text("notes"),
	programmingTrackId: text("programming_track_id").references(
		() => programmingTracksTable.id,
	),

	// New reference to scheduled workout instance
	scheduledWorkoutInstanceId: text("scheduled_workout_instance_id").references(
		() => scheduledWorkoutInstancesTable.id,
	),

	// WOD specific results
	scale: text("scale", { enum: ["rx", "scaled", "rx+"] }),
	wodScore: text("wod_score"), // e.g., "3:15", "10 rounds + 5 reps"

	// Strength specific results
	setCount: integer("set_count"),

	// Monostructural specific results
	distance: integer("distance"),
	time: integer("time"),
})

// Sets table (unified for all result types)
export const sets = sqliteTable("sets", {
	...commonColumns,
	id: text("id").primaryKey(),
	resultId: text("result_id")
		.references(() => results.id)
		.notNull(),
	setNumber: integer("set_number").notNull(),
	notes: text("notes"),

	// Generic set data - only one of these will typically be populated
	reps: integer("reps"),
	weight: integer("weight"),
	status: text("status", { enum: ["pass", "fail"] }),
	distance: integer("distance"),
	time: integer("time"),
	score: integer("score"), // For sets within a WOD (e.g., rounds completed in an AMRAP)
})

export type User = Prettify<InferSelectModel<typeof userTable>>
export type PassKeyCredential = Prettify<
	InferSelectModel<typeof passKeyCredentialTable>
>
export type CreditTransaction = Prettify<
	InferSelectModel<typeof creditTransactionTable>
>
export type PurchasedItem = Prettify<
	InferSelectModel<typeof purchasedItemsTable>
>
export type Team = Prettify<InferSelectModel<typeof teamTable>>
export type TeamMembership = Prettify<
	InferSelectModel<typeof teamMembershipTable>
>
export type TeamRole = Prettify<InferSelectModel<typeof teamRoleTable>>
export type TeamInvitation = Prettify<
	InferSelectModel<typeof teamInvitationTable>
>
export type Workout = Prettify<InferSelectModel<typeof workouts>>
export type Movement = Prettify<InferSelectModel<typeof movements>>
export type Tag = Prettify<InferSelectModel<typeof tags>>
export type WorkoutTag = Prettify<InferSelectModel<typeof workoutTags>>
export type Result = Prettify<InferSelectModel<typeof results>>
export type Set = Prettify<InferSelectModel<typeof sets>>
export type WorkoutMovement = Prettify<
	InferSelectModel<typeof workoutMovements>
>

// ---------------------------------------------
// Programming Tracks & Scheduling
// ---------------------------------------------

// team_programming_tracks (join table)
export const teamProgrammingTracksTable = sqliteTable(
	"team_programming_track",
	{
		...commonColumns,
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		isActive: integer().default(1).notNull(),
		addedAt: integer({ mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.teamId, table.trackId] }),
		index("team_programming_track_active_idx").on(table.isActive),
	],
)

// track_workouts
export const trackWorkoutsTable = sqliteTable(
	"track_workout",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `trwk_${createId()}`)
			.notNull(),
		trackId: text()
			.notNull()
			.references(() => programmingTracksTable.id),
		workoutId: text()
			.notNull()
			.references(() => workouts.id),
		dayNumber: integer().notNull(),
		weekNumber: integer(),
		notes: text({ length: 1000 }),
	},
	(table) => [
		index("track_workout_track_idx").on(table.trackId),
		index("track_workout_day_idx").on(table.dayNumber),
		index("track_workout_workoutid_idx").on(table.workoutId),
		index("track_workout_unique_idx").on(
			table.trackId,
			table.workoutId,
			table.dayNumber,
		),
	],
)

// New exported types
export type ProgrammingTrack = Prettify<
	InferSelectModel<typeof programmingTracksTable>
>
export type TeamProgrammingTrack = Prettify<
	InferSelectModel<typeof teamProgrammingTracksTable>
>
export type TrackWorkout = Prettify<InferSelectModel<typeof trackWorkoutsTable>>

// ---------------------------------------------
// Scheduled Workout Instances
// ---------------------------------------------

export const scheduledWorkoutInstancesTable = sqliteTable(
	"scheduled_workout_instance",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => `swi_${createId()}`)
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id),
		scheduledDate: integer({ mode: "timestamp" }).notNull(),
		teamSpecificNotes: text({ length: 1000 }),
		scalingGuidanceForDay: text({ length: 1000 }),
		classTimes: text({ length: 500 }), // JSON string or comma-separated times
	},
	(table) => [
		index("scheduled_workout_instance_team_idx").on(table.teamId),
		index("scheduled_workout_instance_date_idx").on(table.scheduledDate),
	],
)

// ---------------------------------------------
// Export types for new table
// ---------------------------------------------
export type ScheduledWorkoutInstance = Prettify<
	InferSelectModel<typeof scheduledWorkoutInstancesTable>
>

// ---------------------------------------------
// Programming Tracks & Scheduling Relations
// ---------------------------------------------

export const programmingTracksRelations = relations(
	programmingTracksTable,
	({ one, many }) => ({
		ownerTeam: one(teamTable, {
			fields: [programmingTracksTable.ownerTeamId],
			references: [teamTable.id],
		}),
		teamProgrammingTracks: many(teamProgrammingTracksTable),
		trackWorkouts: many(trackWorkoutsTable),
	}),
)

export const teamProgrammingTracksRelations = relations(
	teamProgrammingTracksTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamProgrammingTracksTable.teamId],
			references: [teamTable.id],
		}),
		track: one(programmingTracksTable, {
			fields: [teamProgrammingTracksTable.trackId],
			references: [programmingTracksTable.id],
		}),
	}),
)

export const trackWorkoutsRelations = relations(
	trackWorkoutsTable,
	({ one, many }) => ({
		track: one(programmingTracksTable, {
			fields: [trackWorkoutsTable.trackId],
			references: [programmingTracksTable.id],
		}),
		workout: one(workouts, {
			fields: [trackWorkoutsTable.workoutId],
			references: [workouts.id],
		}),
		scheduledInstances: many(scheduledWorkoutInstancesTable),
	}),
)

export const scheduledWorkoutInstancesRelations = relations(
	scheduledWorkoutInstancesTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [scheduledWorkoutInstancesTable.teamId],
			references: [teamTable.id],
		}),
		trackWorkout: one(trackWorkoutsTable, {
			fields: [scheduledWorkoutInstancesTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
	}),
)
