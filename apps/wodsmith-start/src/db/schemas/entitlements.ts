import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	datetime,
	index,
	int,
	json,
	mysqlTable,
	text,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import {
	commonColumns,
	createEntitlementId,
	createEntitlementTypeId,
	createFeatureId,
	createLimitId,
	createPlanFeatureId,
	createPlanId,
	createPlanLimitId,
	createTeamAddonId,
	createTeamEntitlementOverrideId,
	createTeamFeatureEntitlementId,
	createTeamLimitEntitlementId,
	createTeamSubscriptionId,
	createTeamUsageId,
} from "./common"
import { teamTable } from "./teams"
import { userTable } from "./users"

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
export const entitlementTypeTable = mysqlTable("entitlement_types", {
	...commonColumns,
	id: varchar({ length: 255 })
		.primaryKey()
		.$defaultFn(() => createEntitlementTypeId())
		.notNull(),
	name: varchar({ length: 100 }).notNull().unique(),
	description: text(),
})

// 2. Entitlement Table - Explicit records of granted access
export const entitlementTable = mysqlTable(
	"entitlements",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createEntitlementId())
			.notNull(),
		// What type of access is this?
		entitlementTypeId: varchar({ length: 255 }).notNull(),
		// Who has this access?
		userId: varchar({ length: 255 }).notNull(),
		// Team context (for org-scoped access)
		teamId: varchar({ length: 255 }),
		// Where did this entitlement come from?
		sourceType: varchar({
			length: 255,
			enum: ["PURCHASE", "SUBSCRIPTION", "MANUAL"],
		}).notNull(),
		// What is the source? (purchaseId, subscriptionId, adminUserId, etc.)
		sourceId: varchar({ length: 255 }).notNull(),
		// Type-specific metadata (contentIds, featureIds, etc.)
		metadata: json().$type<Record<string, any>>(),
		// Optional expiration
		expiresAt: datetime(),
		// Soft delete for audit trail
		deletedAt: datetime(),
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
export const featureTable = mysqlTable("features", {
	...commonColumns,
	id: varchar({ length: 255 })
		.primaryKey()
		.$defaultFn(() => createFeatureId())
		.notNull(),
	key: varchar({ length: 100 }).notNull().unique(), // e.g., "programming_tracks"
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	category: varchar({
		length: 255,
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
	isActive: int().default(1).notNull(),
})

// 4. Limit Table - Define available limits
export const limitTable = mysqlTable("limits", {
	...commonColumns,
	id: varchar({ length: 255 })
		.primaryKey()
		.$defaultFn(() => createLimitId())
		.notNull(),
	key: varchar({ length: 100 }).notNull().unique(), // e.g., "max_teams"
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	unit: varchar({ length: 50 }).notNull(), // e.g., "teams", "MB", "messages"
	resetPeriod: varchar({ length: 255, enum: ["monthly", "yearly", "never"] })
		.default("never")
		.notNull(),
	isActive: int().default(1).notNull(),
})

// 5. Plan Table - Store available subscription plans
export interface PlanEntitlements {
	features: string[] // array of feature IDs
	limits: Record<string, number> // limit_id -> value (-1 for unlimited)
}

export const planTable = mysqlTable("plans", {
	...commonColumns,
	id: varchar({ length: 255 })
		.primaryKey()
		.$defaultFn(() => createPlanId())
		.notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	price: int().notNull(), // in cents
	interval: varchar({ length: 255, enum: ["month", "year"] }),
	isActive: int().default(1).notNull(),
	isPublic: int().default(1).notNull(), // can users sign up for this?
	sortOrder: int().default(0).notNull(),
	// DEPRECATED: JSON field storing the plan's entitlements (use junction tables instead)
	entitlements: json().$type<PlanEntitlements>(),
	// Stripe-related fields
	stripePriceId: varchar({ length: 255 }),
	stripeProductId: varchar({ length: 255 }),
})

// 5a. Plan Feature Junction Table - Links plans to features
export const planFeatureTable = mysqlTable(
	"plan_features",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createPlanFeatureId())
			.notNull(),
		planId: varchar({ length: 255 }).notNull(),
		featureId: varchar({ length: 255 }).notNull(),
	},
	(table) => [
		index("plan_feature_plan_id_idx").on(table.planId),
		index("plan_feature_feature_id_idx").on(table.featureId),
		// Unique constraint to prevent duplicate feature assignments
		index("plan_feature_unique_idx").on(table.planId, table.featureId),
	],
)

// 5b. Plan Limit Junction Table - Links plans to limits with values
export const planLimitTable = mysqlTable(
	"plan_limits",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createPlanLimitId())
			.notNull(),
		planId: varchar({ length: 255 }).notNull(),
		limitId: varchar({ length: 255 }).notNull(),
		value: int().notNull(), // -1 for unlimited
	},
	(table) => [
		index("plan_limit_plan_id_idx").on(table.planId),
		index("plan_limit_limit_id_idx").on(table.limitId),
		// Unique constraint to prevent duplicate limit assignments
		index("plan_limit_unique_idx").on(table.planId, table.limitId),
	],
)

// 4. Team Subscription Table - Track team subscriptions
export const teamSubscriptionTable = mysqlTable(
	"team_subscriptions",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createTeamSubscriptionId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		planId: varchar({ length: 255 }).notNull(),
		status: varchar({
			length: 255,
			enum: ["active", "cancelled", "past_due", "trialing", "paused"],
		}).notNull(),
		currentPeriodStart: datetime().notNull(),
		currentPeriodEnd: datetime().notNull(),
		cancelAtPeriodEnd: int().default(0).notNull(),
		trialStart: datetime(),
		trialEnd: datetime(),
		// Stripe-related fields
		stripeSubscriptionId: varchar({ length: 255 }),
		stripeCustomerId: varchar({ length: 255 }),
	},
	(table) => [
		index("team_subscription_team_id_idx").on(table.teamId),
		index("team_subscription_status_idx").on(table.status),
	],
)

// 5. Team Addon Table - Track purchased add-ons
export const teamAddonTable = mysqlTable(
	"team_addons",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createTeamAddonId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		addonId: varchar({ length: 255 }).notNull(), // reference to addon definition in code
		quantity: int().default(1).notNull(),
		status: varchar({ length: 255, enum: ["active", "cancelled"] }).notNull(),
		expiresAt: datetime(),
		// Stripe-related fields
		stripeSubscriptionItemId: varchar({ length: 255 }),
	},
	(table) => [
		index("team_addon_team_id_idx").on(table.teamId),
		index("team_addon_status_idx").on(table.status),
	],
)

// 6. Team Entitlement Override Table - Manual overrides for specific teams
export const teamEntitlementOverrideTable = mysqlTable(
	"team_entitlement_overrides",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createTeamEntitlementOverrideId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		type: varchar({ length: 255, enum: ["feature", "limit"] }).notNull(),
		key: varchar({ length: 255 }).notNull(), // feature or limit ID
		value: varchar({ length: 255 }).notNull(), // JSON value (boolean for features, number for limits)
		reason: text(), // why was this override applied?
		expiresAt: datetime(),
		createdBy: varchar({ length: 255 }),
	},
	(table) => [
		index("team_entitlement_override_team_id_idx").on(table.teamId),
		index("team_entitlement_override_type_idx").on(table.type),
		// Unique constraint on team/type/key - required for onConflictDoUpdate
		uniqueIndex("team_entitlement_override_team_type_key_unique").on(
			table.teamId,
			table.type,
			table.key,
		),
	],
)

// 7. Team Usage Table - Track usage against limits
export const teamUsageTable = mysqlTable(
	"team_usages",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createTeamUsageId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		limitKey: varchar({ length: 255 }).notNull(), // which limit this tracks
		currentValue: int().default(0).notNull(),
		periodStart: datetime().notNull(),
		periodEnd: datetime().notNull(),
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
export const teamFeatureEntitlementTable = mysqlTable(
	"team_feature_entitlements",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createTeamFeatureEntitlementId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		featureId: varchar({ length: 255 }).notNull(),
		// Track where this entitlement came from
		source: varchar({
			length: 255,
			enum: ["plan", "addon", "override"],
		})
			.default("plan")
			.notNull(),
		// Optional reference to the plan this came from (for audit trail)
		sourcePlanId: varchar({ length: 255 }),
		// Optional expiration (for trials, temporary grants)
		expiresAt: datetime(),
		// Track if this snapshot is currently active (for history preservation)
		isActive: int().default(1).notNull(),
	},
	(table) => [
		index("team_feature_entitlement_team_id_idx").on(table.teamId),
		index("team_feature_entitlement_feature_id_idx").on(table.featureId),
		// Unique constraint on team/feature - required for onConflictDoUpdate
		uniqueIndex("team_feature_entitlement_team_feature_unique").on(
			table.teamId,
			table.featureId,
		),
	],
)

// 9. Team Limit Entitlement Table - Snapshot of limits a team has
// This is the SOURCE OF TRUTH for what limits a team currently has
// Created when a team subscribes to a plan or when plan is changed
export const teamLimitEntitlementTable = mysqlTable(
	"team_limit_entitlements",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createTeamLimitEntitlementId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		limitId: varchar({ length: 255 }).notNull(),
		value: int().notNull(), // -1 for unlimited
		// Track where this entitlement came from
		source: varchar({
			length: 255,
			enum: ["plan", "addon", "override"],
		})
			.default("plan")
			.notNull(),
		// Optional reference to the plan this came from (for audit trail)
		sourcePlanId: varchar({ length: 255 }),
		// Optional expiration (for trials, temporary grants)
		expiresAt: datetime(),
		// Track if this snapshot is currently active (for history preservation)
		isActive: int().default(1).notNull(),
	},
	(table) => [
		index("team_limit_entitlement_team_id_idx").on(table.teamId),
		index("team_limit_entitlement_limit_id_idx").on(table.limitId),
		// Unique constraint on team/limit - required for onConflictDoUpdate
		uniqueIndex("team_limit_entitlement_team_limit_unique").on(
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
