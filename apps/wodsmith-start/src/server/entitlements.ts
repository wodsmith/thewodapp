/**
 * Core Entitlements Service for WodSmith Start
 * Centralized service for checking team plan-based entitlements and user-level entitlements
 *
 * Migrated from apps/wodsmith/src/server/entitlements.ts
 */
import { and, eq, gt, isNull, or } from "drizzle-orm"
import { LIMITS } from "@/config/limits"
import { getDb } from "@/db"
import {
	type Entitlement,
	entitlementTable,
	featureTable,
	limitTable,
	type PlanEntitlements,
	planFeatureTable,
	planLimitTable,
	planTable,
	teamEntitlementOverrideTable,
	teamFeatureEntitlementTable,
	teamLimitEntitlementTable,
	teamTable,
} from "@/db/schema"

export type { Entitlement }

export interface EntitlementResult {
	id: string
	entitlementTypeId: string
	metadata: Record<string, unknown> | null
	expiresAt: Date | null
}

// ============================================================================
// TEAM-LEVEL ENTITLEMENT CHECKING (Snapshot-Based)
// ============================================================================

/**
 * Get team's current entitlements from their snapshot
 * This queries team-specific entitlement tables, NOT the live plan definition
 *
 * IMPORTANT: This function returns what the team CURRENTLY HAS, which is
 * separate from what their billing plan currently offers to new subscribers.
 */
export async function getTeamPlan(teamId: string): Promise<{
	id: string
	name: string
	entitlements: PlanEntitlements
}> {
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	// Default plan ID if none assigned (for display purposes only)
	const planId = team?.currentPlanId || "free"

	// Get plan metadata (name, etc.) - but NOT entitlements
	const plan = await db.query.planTable.findFirst({
		where: eq(planTable.id, planId),
	})

	if (!plan) {
		throw new Error(
			`Plan "${planId}" not found in database. Run "pnpm db:reset" in apps/wodsmith-start to migrate and seed the database.`,
		)
	}

	// Query team's SNAPSHOTTED features (not the plan's current features)
	const teamFeatures = await db
		.select({
			featureKey: featureTable.key,
		})
		.from(teamFeatureEntitlementTable)
		.innerJoin(
			featureTable,
			eq(teamFeatureEntitlementTable.featureId, featureTable.id),
		)
		.where(
			and(
				eq(teamFeatureEntitlementTable.teamId, teamId),
				eq(teamFeatureEntitlementTable.isActive, 1),
				or(
					isNull(teamFeatureEntitlementTable.expiresAt),
					gt(teamFeatureEntitlementTable.expiresAt, new Date()),
				),
			),
		)

	// Query team's SNAPSHOTTED limits (not the plan's current limits)
	const teamLimitsRaw = await db
		.select({
			limitKey: limitTable.key,
			value: teamLimitEntitlementTable.value,
		})
		.from(teamLimitEntitlementTable)
		.innerJoin(limitTable, eq(teamLimitEntitlementTable.limitId, limitTable.id))
		.where(
			and(
				eq(teamLimitEntitlementTable.teamId, teamId),
				eq(teamLimitEntitlementTable.isActive, 1),
				or(
					isNull(teamLimitEntitlementTable.expiresAt),
					gt(teamLimitEntitlementTable.expiresAt, new Date()),
				),
			),
		)

	// FALLBACK: If no snapshot exists, use plan definition
	// This handles teams created before the snapshot system was implemented
	let entitlements: PlanEntitlements

	if (teamFeatures.length === 0 && teamLimitsRaw.length === 0) {
		// Query plan's current features and limits as fallback
		const planFeatures = await db
			.select({
				featureKey: featureTable.key,
			})
			.from(planFeatureTable)
			.innerJoin(featureTable, eq(planFeatureTable.featureId, featureTable.id))
			.where(eq(planFeatureTable.planId, plan.id))

		const planLimitsRaw = await db
			.select({
				limitKey: limitTable.key,
				value: planLimitTable.value,
			})
			.from(planLimitTable)
			.innerJoin(limitTable, eq(planLimitTable.limitId, limitTable.id))
			.where(eq(planLimitTable.planId, plan.id))

		entitlements = {
			features: planFeatures.map((f) => f.featureKey),
			limits: Object.fromEntries(
				planLimitsRaw.map((l) => [l.limitKey, l.value]),
			),
		}
	} else {
		// Build entitlements object from snapshots
		entitlements = {
			features: teamFeatures.map((f) => f.featureKey),
			limits: Object.fromEntries(
				teamLimitsRaw.map((l) => [l.limitKey, l.value]),
			),
		}
	}

	return {
		id: plan.id,
		name: plan.name,
		entitlements,
	}
}

/**
 * Check if a team has access to a specific feature
 */
export async function hasFeature(
	teamId: string,
	featureId: string,
): Promise<boolean> {
	// 1. Check for manual overrides first
	const override = await getFeatureOverride(teamId, featureId)
	if (override !== null) {
		return override
	}

	// 2. Get team's current plan entitlements
	const plan = await getTeamPlan(teamId)

	// 3. Check plan entitlements
	return plan.entitlements.features.includes(featureId)
}

/**
 * Get team's limit for a specific resource
 * Checks overrides first, then snapshotted entitlements
 */
export async function getTeamLimit(
	teamId: string,
	limitKey: string,
): Promise<number> {
	// 1. Check for manual override first
	const override = await getLimitOverride(teamId, limitKey)
	if (override !== null) {
		return override
	}

	// 2. Get plan limit from snapshotted entitlements
	const plan = await getTeamPlan(teamId)
	const planLimit = plan.entitlements.limits[limitKey]

	// Return plan limit, or 0 if not found
	if (planLimit !== undefined && planLimit !== null) {
		return planLimit
	}

	return 0
}

/**
 * Check if a specific team has pending organizer status (limit of 0)
 * A team is pending when they've applied to organize but haven't been approved yet.
 * Pending teams can create draft competitions but cannot publish them.
 */
export async function isTeamPendingOrganizer(teamId: string): Promise<boolean> {
	const limit = await getTeamLimit(teamId, LIMITS.MAX_PUBLISHED_COMPETITIONS)
	return limit === 0
}

// ============================================================================
// USER-LEVEL ENTITLEMENT CHECKING
// ============================================================================

/**
 * Get user's active entitlements
 * Active = not soft-deleted (deletedAt is null) and not expired
 */
export async function getUserEntitlements(
	userId: string,
): Promise<EntitlementResult[]> {
	const db = getDb()

	const now = new Date()

	// entitlementTable uses deletedAt for soft deletes, not isActive
	const entitlements = await db.query.entitlementTable.findMany({
		where: and(
			eq(entitlementTable.userId, userId),
			isNull(entitlementTable.deletedAt),
			or(
				isNull(entitlementTable.expiresAt),
				gt(entitlementTable.expiresAt, now),
			),
		),
	})

	return entitlements.map((e) => ({
		id: e.id,
		entitlementTypeId: e.entitlementTypeId,
		metadata: e.metadata as Record<string, unknown> | null,
		expiresAt: e.expiresAt,
	}))
}

/**
 * Create an entitlement (typically called after purchase/subscription/manual grant)
 */
export async function createEntitlement({
	userId,
	teamId,
	entitlementTypeId,
	sourceType,
	sourceId,
	metadata,
	expiresAt,
}: {
	userId: string
	teamId?: string
	entitlementTypeId: string
	sourceType: "PURCHASE" | "SUBSCRIPTION" | "MANUAL"
	sourceId: string
	metadata?: Record<string, unknown>
	expiresAt?: Date
}): Promise<Entitlement> {
	const db = getDb()

	const [entitlement] = await db
		.insert(entitlementTable)
		.values({
			userId,
			teamId,
			entitlementTypeId,
			sourceType,
			sourceId,
			metadata,
			expiresAt,
		})
		.returning()

	if (!entitlement) {
		throw new Error("Failed to create entitlement")
	}

	return entitlement
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get feature override for a team
 */
async function getFeatureOverride(
	teamId: string,
	featureId: string,
): Promise<boolean | null> {
	const db = getDb()

	const override = await db.query.teamEntitlementOverrideTable.findFirst({
		where: and(
			eq(teamEntitlementOverrideTable.teamId, teamId),
			eq(teamEntitlementOverrideTable.type, "feature"),
			eq(teamEntitlementOverrideTable.key, featureId),
			or(
				isNull(teamEntitlementOverrideTable.expiresAt),
				gt(teamEntitlementOverrideTable.expiresAt, new Date()),
			),
		),
	})

	if (!override) return null

	return override.value === "true" || override.value === "1"
}

/**
 * Get limit override for a team
 */
async function getLimitOverride(
	teamId: string,
	limitKey: string,
): Promise<number | null> {
	const db = getDb()

	const override = await db.query.teamEntitlementOverrideTable.findFirst({
		where: and(
			eq(teamEntitlementOverrideTable.teamId, teamId),
			eq(teamEntitlementOverrideTable.type, "limit"),
			eq(teamEntitlementOverrideTable.key, limitKey),
			or(
				isNull(teamEntitlementOverrideTable.expiresAt),
				gt(teamEntitlementOverrideTable.expiresAt, new Date()),
			),
		),
	})

	if (!override) return null

	const parsed = Number.parseInt(override.value, 10)
	return Number.isNaN(parsed) ? null : parsed
}
