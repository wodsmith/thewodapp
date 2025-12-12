import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import {
	commonColumns,
	createEntitlementId,
	createEntitlementTypeId,
	createFeatureId,
	createLimitId,
	createPlanId,
	createPlanFeatureId,
	createPlanLimitId,
	createTeamAddonId,
	createTeamEntitlementOverrideId,
	createTeamSubscriptionId,
	createTeamUsageId,
	createTeamFeatureEntitlementId,
	createTeamLimitEntitlementId,
} from "./common.server"
import { teamTable } from "./teams.server"
import { userTable } from "./users.server"

// Predefined entitlement types (seeded in database)
export const ENTITLEMENT_TYPES = {
	// Programming track access (individual purchase or subscription)
	PROGRAMMING_TRACK_ACCESS: "programming_track_access",
	// AI usage entitlements
	AI_MESSAGE_CREDITS: "ai_message_credits",
	// Feature trials
	FEATURE_TRIAL: "feature_trial",
	// Manual grants by admin
	MANUAL_FEATURE_GRANT: "manual_feature_grant",
	// Subscription-based access (complements team plan)
	SUBSCRIPTION_SEAT: "subscription_seat",
	// Add-on purchases
	ADDON_ACCESS: "addon_access",
} as const

// 1. Entitlement Type Table - Define categories of entitlements
export const entitlementTypeTable = sqliteTable("entitlement_type", {
	...commonColumns,
	id: text()
		.primaryKey()
		.$defaultFn(() => createEntitlementTypeId())
		.notNull(),
	name: text({ length: 100 }).notNull().unique(),
	description: text({ length: 500 }),
})

// 2. Entitlement Table - Explicit records of granted access
export const entitlementTable = sqliteTable(
	"entitlement",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createEntitlementId())
			.notNull(),
		// What type of access is this?
		entitlementTypeId: text()
			.notNull()
			.references(() => entitlementTypeTable.id),
		// Who has this access?
		userId: text()
			.notNull()
			.references(() => userTable.id),
		// Team context (for org-scoped access)
		teamId: text().references(() => teamTable.id),
		// Where did this entitlement come from?
		sourceType: text({
			enum: ["PURCHASE", "SUBSCRIPTION", "MANUAL"],
		}).notNull(),
		// What is the source? (purchaseId, subscriptionId, adminUserId, etc.)
		sourceId: text().notNull(),
		// Type-specific metadata (contentIds, featureIds, etc.)
		metadata: text({ mode: "json" }).$type<Record<string, any>>(),
		// Optional expiration
		expiresAt: integer({ mode: "timestamp" }),
		// Soft delete for audit trail
		deletedAt: integer({ mode: "timestamp" }),
	},
	(table) => [
		index("entitlement_user_id_idx").on(table.userId),
		index("entitlement_team_id_idx").on(table.teamId),
		index("entitlement_type_idx").on(table.entitlementTypeId),
		index("entitlement_source_idx").on(table.sourceType, table.sourceId),
		index("entitlement_deleted_at_idx").on(table.deletedAt),
	],
)

// 3. Feature Table - Define available features
export const featureTable = sqliteTable("feature", {
	...commonColumns,
	id: text()
		.primaryKey()
		.$defaultFn(() => createFeatureId())
		.notNull(),
	key: text({ length: 100 }).notNull().unique(), // e.g., "programming_tracks"
	name: text({ length: 100 }).notNull(),
	description: text({ length: 500 }),
	category: text({
		enum: [
			"workouts",
			"programming",
			"scaling",
			"ai",
			"team",
			"integration",
			"analytics",
		],
	}).notNull(),
	isActive: integer().default(1).notNull(),
})

// 4. Limit Table - Define available limits
export const limitTable = sqliteTable("limit", {
	...commonColumns,
	id: text()
		.primaryKey()
		.$defaultFn(() => createLimitId())
		.notNull(),
	key: text({ length: 100 }).notNull().unique(), // e.g., "max_teams"
	name: text({ length: 100 }).notNull(),
	description: text({ length: 500 }),
	unit: text({ length: 50 }).notNull(), // e.g., "teams", "MB", "messages"
	resetPeriod: text({ enum: ["monthly", "yearly", "never"] })
		.default("never")
		.notNull(),
	isActive: integer().default(1).notNull(),
})

// 5. Plan Table - Store available subscription plans
export interface PlanEntitlements {
	features: string[] // array of feature IDs
	limits: Record<string, number> // limit_id -> value (-1 for unlimited)
}

export const planTable = sqliteTable("plan", {
	...commonColumns,
	id: text()
		.primaryKey()
		.$defaultFn(() => createPlanId())
		.notNull(),
	name: text({ length: 100 }).notNull(),
	description: text({ length: 500 }),
	price: integer().notNull(), // in cents
	interval: text({ enum: ["month", "year"] }),
	isActive: integer().default(1).notNull(),
	isPublic: integer().default(1).notNull(), // can users sign up for this?
	sortOrder: integer().default(0).notNull(),
	// DEPRECATED: JSON field storing the plan's entitlements (use junction tables instead)
	entitlements: text({ mode: "json" }).$type<PlanEntitlements>(),
	// Stripe-related fields
	stripePriceId: text({ length: 255 }),
	stripeProductId: text({ length: 255 }),
})

// 5a. Plan Feature Junction Table - Links plans to features
export const planFeatureTable = sqliteTable(
	"plan_feature",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createPlanFeatureId())
			.notNull(),
		planId: text()
			.notNull()
			.references(() => planTable.id, { onDelete: "cascade" }),
		featureId: text()
			.notNull()
			.references(() => featureTable.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("plan_feature_plan_id_idx").on(table.planId),
		index("plan_feature_feature_id_idx").on(table.featureId),
		// Unique constraint to prevent duplicate feature assignments
		index("plan_feature_unique_idx").on(table.planId, table.featureId),
	],
)

// 5b. Plan Limit Junction Table - Links plans to limits with values
export const planLimitTable = sqliteTable(
	"plan_limit",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createPlanLimitId())
			.notNull(),
		planId: text()
			.notNull()
			.references(() => planTable.id, { onDelete: "cascade" }),
		limitId: text()
			.notNull()
			.references(() => limitTable.id, { onDelete: "cascade" }),
		value: integer().notNull(), // -1 for unlimited
	},
	(table) => [
		index("plan_limit_plan_id_idx").on(table.planId),
		index("plan_limit_limit_id_idx").on(table.limitId),
		// Unique constraint to prevent duplicate limit assignments
		index("plan_limit_unique_idx").on(table.planId, table.limitId),
	],
)

// 4. Team Subscription Table - Track team subscriptions
export const teamSubscriptionTable = sqliteTable(
	"team_subscription",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamSubscriptionId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		planId: text()
			.notNull()
			.references(() => planTable.id),
		status: text({
			enum: ["active", "cancelled", "past_due", "trialing", "paused"],
		}).notNull(),
		currentPeriodStart: integer({ mode: "timestamp" }).notNull(),
		currentPeriodEnd: integer({ mode: "timestamp" }).notNull(),
		cancelAtPeriodEnd: integer().default(0).notNull(),
		trialStart: integer({ mode: "timestamp" }),
		trialEnd: integer({ mode: "timestamp" }),
		// Stripe-related fields
		stripeSubscriptionId: text({ length: 255 }),
		stripeCustomerId: text({ length: 255 }),
	},
	(table) => [
		index("team_subscription_team_id_idx").on(table.teamId),
		index("team_subscription_status_idx").on(table.status),
	],
)

// 5. Team Addon Table - Track purchased add-ons
export const teamAddonTable = sqliteTable(
	"team_addon",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamAddonId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		addonId: text().notNull(), // reference to addon definition in code
		quantity: integer().default(1).notNull(),
		status: text({ enum: ["active", "cancelled"] }).notNull(),
		expiresAt: integer({ mode: "timestamp" }),
		// Stripe-related fields
		stripeSubscriptionItemId: text({ length: 255 }),
	},
	(table) => [
		index("team_addon_team_id_idx").on(table.teamId),
		index("team_addon_status_idx").on(table.status),
	],
)

// 6. Team Entitlement Override Table - Manual overrides for specific teams
export const teamEntitlementOverrideTable = sqliteTable(
	"team_entitlement_override",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamEntitlementOverrideId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		type: text({ enum: ["feature", "limit"] }).notNull(),
		key: text().notNull(), // feature or limit ID
		value: text().notNull(), // JSON value (boolean for features, number for limits)
		reason: text({ length: 500 }), // why was this override applied?
		expiresAt: integer({ mode: "timestamp" }),
		createdBy: text().references(() => userTable.id),
	},
	(table) => [
		index("team_entitlement_override_team_id_idx").on(table.teamId),
		index("team_entitlement_override_type_idx").on(table.type),
	],
)

// 7. Team Usage Table - Track usage against limits
export const teamUsageTable = sqliteTable(
	"team_usage",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamUsageId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id),
		limitKey: text().notNull(), // which limit this tracks
		currentValue: integer().default(0).notNull(),
		periodStart: integer({ mode: "timestamp" }).notNull(),
		periodEnd: integer({ mode: "timestamp" }).notNull(),
	},
	(table) => [
		index("team_usage_team_id_idx").on(table.teamId),
		index("team_usage_limit_key_idx").on(table.limitKey),
		// Unique constraint on team + limit + period
		index("team_usage_unique_idx").on(
			table.teamId,
			table.limitKey,
			table.periodStart,
		),
	],
)

// 8. Team Feature Entitlement Table - Snapshot of features a team has access to
// This is the SOURCE OF TRUTH for what features a team currently has
// Created when a team subscribes to a plan or when plan is changed
export const teamFeatureEntitlementTable = sqliteTable(
	"team_feature_entitlement",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamFeatureEntitlementId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		featureId: text()
			.notNull()
			.references(() => featureTable.id, { onDelete: "cascade" }),
		// Track where this entitlement came from
		source: text({
			enum: ["plan", "addon", "override"],
		})
			.default("plan")
			.notNull(),
		// Optional reference to the plan this came from (for audit trail)
		sourcePlanId: text().references(() => planTable.id),
		// Optional expiration (for trials, temporary grants)
		expiresAt: integer({ mode: "timestamp" }),
		// Track if this snapshot is currently active (for history preservation)
		isActive: integer().default(1).notNull(),
	},
	(table) => [
		index("team_feature_entitlement_team_id_idx").on(table.teamId),
		index("team_feature_entitlement_feature_id_idx").on(table.featureId),
		// Only one active entitlement per team/feature combination
		index("team_feature_entitlement_unique_active_idx").on(
			table.teamId,
			table.featureId,
		),
	],
)

// 9. Team Limit Entitlement Table - Snapshot of limits a team has
// This is the SOURCE OF TRUTH for what limits a team currently has
// Created when a team subscribes to a plan or when plan is changed
export const teamLimitEntitlementTable = sqliteTable(
	"team_limit_entitlement",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createTeamLimitEntitlementId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		limitId: text()
			.notNull()
			.references(() => limitTable.id, { onDelete: "cascade" }),
		value: integer().notNull(), // -1 for unlimited
		// Track where this entitlement came from
		source: text({
			enum: ["plan", "addon", "override"],
		})
			.default("plan")
			.notNull(),
		// Optional reference to the plan this came from (for audit trail)
		sourcePlanId: text().references(() => planTable.id),
		// Optional expiration (for trials, temporary grants)
		expiresAt: integer({ mode: "timestamp" }),
		// Track if this snapshot is currently active (for history preservation)
		isActive: integer().default(1).notNull(),
	},
	(table) => [
		index("team_limit_entitlement_team_id_idx").on(table.teamId),
		index("team_limit_entitlement_limit_id_idx").on(table.limitId),
		// Only one active entitlement per team/limit combination
		index("team_limit_entitlement_unique_active_idx").on(
			table.teamId,
			table.limitId,
		),
	],
)

// Relations
export const entitlementTypeRelations = relations(
	entitlementTypeTable,
	({ many }) => ({
		entitlements: many(entitlementTable),
	}),
)

export const entitlementRelations = relations(entitlementTable, ({ one }) => ({
	entitlementType: one(entitlementTypeTable, {
		fields: [entitlementTable.entitlementTypeId],
		references: [entitlementTypeTable.id],
	}),
	user: one(userTable, {
		fields: [entitlementTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [entitlementTable.teamId],
		references: [teamTable.id],
	}),
}))

export const featureRelations = relations(featureTable, ({ many }) => ({
	planFeatures: many(planFeatureTable),
}))

export const limitRelations = relations(limitTable, ({ many }) => ({
	planLimits: many(planLimitTable),
}))

export const planRelations = relations(planTable, ({ many }) => ({
	teamSubscriptions: many(teamSubscriptionTable),
	planFeatures: many(planFeatureTable),
	planLimits: many(planLimitTable),
}))

export const planFeatureRelations = relations(planFeatureTable, ({ one }) => ({
	plan: one(planTable, {
		fields: [planFeatureTable.planId],
		references: [planTable.id],
	}),
	feature: one(featureTable, {
		fields: [planFeatureTable.featureId],
		references: [featureTable.id],
	}),
}))

export const planLimitRelations = relations(planLimitTable, ({ one }) => ({
	plan: one(planTable, {
		fields: [planLimitTable.planId],
		references: [planTable.id],
	}),
	limit: one(limitTable, {
		fields: [planLimitTable.limitId],
		references: [limitTable.id],
	}),
}))

export const teamSubscriptionRelations = relations(
	teamSubscriptionTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamSubscriptionTable.teamId],
			references: [teamTable.id],
		}),
		plan: one(planTable, {
			fields: [teamSubscriptionTable.planId],
			references: [planTable.id],
		}),
	}),
)

export const teamAddonRelations = relations(teamAddonTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamAddonTable.teamId],
		references: [teamTable.id],
	}),
}))

export const teamEntitlementOverrideRelations = relations(
	teamEntitlementOverrideTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamEntitlementOverrideTable.teamId],
			references: [teamTable.id],
		}),
		createdBy: one(userTable, {
			fields: [teamEntitlementOverrideTable.createdBy],
			references: [userTable.id],
		}),
	}),
)

export const teamUsageRelations = relations(teamUsageTable, ({ one }) => ({
	team: one(teamTable, {
		fields: [teamUsageTable.teamId],
		references: [teamTable.id],
	}),
}))

export const teamFeatureEntitlementRelations = relations(
	teamFeatureEntitlementTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamFeatureEntitlementTable.teamId],
			references: [teamTable.id],
		}),
		feature: one(featureTable, {
			fields: [teamFeatureEntitlementTable.featureId],
			references: [featureTable.id],
		}),
		sourcePlan: one(planTable, {
			fields: [teamFeatureEntitlementTable.sourcePlanId],
			references: [planTable.id],
		}),
	}),
)

export const teamLimitEntitlementRelations = relations(
	teamLimitEntitlementTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [teamLimitEntitlementTable.teamId],
			references: [teamTable.id],
		}),
		limit: one(limitTable, {
			fields: [teamLimitEntitlementTable.limitId],
			references: [limitTable.id],
		}),
		sourcePlan: one(planTable, {
			fields: [teamLimitEntitlementTable.sourcePlanId],
			references: [planTable.id],
		}),
	}),
)

// Type exports
export type EntitlementType = InferSelectModel<typeof entitlementTypeTable>
export type Entitlement = InferSelectModel<typeof entitlementTable>
export type Feature = InferSelectModel<typeof featureTable>
export type Limit = InferSelectModel<typeof limitTable>
export type Plan = InferSelectModel<typeof planTable>
export type PlanFeature = InferSelectModel<typeof planFeatureTable>
export type PlanLimit = InferSelectModel<typeof planLimitTable>
export type TeamSubscription = InferSelectModel<typeof teamSubscriptionTable>
export type TeamAddon = InferSelectModel<typeof teamAddonTable>
export type TeamEntitlementOverride = InferSelectModel<
	typeof teamEntitlementOverrideTable
>
export type TeamUsage = InferSelectModel<typeof teamUsageTable>
export type TeamFeatureEntitlement = InferSelectModel<
	typeof teamFeatureEntitlementTable
>
export type TeamLimitEntitlement = InferSelectModel<
	typeof teamLimitEntitlementTable
>
