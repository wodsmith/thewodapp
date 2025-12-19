/**
 * Core Entitlements Service
 * Centralized service for checking team plan-based entitlements and user-level entitlements
 */
import "server-only"

import { and, eq, gt, isNull, or, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { logInfo, logWarning } from "@/lib/logging/posthog-otel-logger"
import { FEATURES } from "../config/features"
import { LIMITS } from "../config/limits"
import type { Entitlement, PlanEntitlements } from "../db/schema"
import {
	entitlementTable,
	featureTable,
	limitTable,
	planFeatureTable,
	planLimitTable,
	planTable,
	programmingTracksTable,
	SYSTEM_ROLES_ENUM,
	teamEntitlementOverrideTable,
	teamFeatureEntitlementTable,
	teamLimitEntitlementTable,
	teamMembershipTable,
	teamTable,
	teamUsageTable,
} from "../db/schema"

// ============================================================================
// TEAM-LEVEL ENTITLEMENT CHECKING (Snapshot-Based)
// ============================================================================

export interface EntitlementCheckResult {
	allowed: boolean
	reason?: string
	upgradeRequired?: boolean
	currentLimit?: number
	usedAmount?: number
}

/**
 * Check if a team has snapshotted entitlements
 * Returns false if team needs migration
 */
export async function teamHasSnapshot(teamId: string): Promise<boolean> {
	const db = getDb()

	const featureCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(teamFeatureEntitlementTable)
		.where(
			and(
				eq(teamFeatureEntitlementTable.teamId, teamId),
				eq(teamFeatureEntitlementTable.isActive, 1),
			),
		)

	const limitCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(teamLimitEntitlementTable)
		.where(
			and(
				eq(teamLimitEntitlementTable.teamId, teamId),
				eq(teamLimitEntitlementTable.isActive, 1),
			),
		)

	return (featureCount[0]?.count ?? 0) > 0 || (limitCount[0]?.count ?? 0) > 0
}

/**
 * Snapshot all teams' entitlements
 * Useful for migrating existing teams to the snapshot system
 */
export async function snapshotAllTeams(): Promise<{
	success: number
	failed: number
	errors: Array<{ teamId: string; error: string }>
}> {
	const db = getDb()

	const teams = await db.select().from(teamTable)

	let success = 0
	let failed = 0
	const errors: Array<{ teamId: string; error: string }> = []

	for (const team of teams) {
		try {
			const hasSnapshot = await teamHasSnapshot(team.id)
			if (hasSnapshot) {
				logInfo({
					message: "[entitlements] Team already has snapshot, skipping",
					attributes: { teamId: team.id },
				})
				success++
				continue
			}

			const planId = team.currentPlanId || "free"
			await snapshotPlanEntitlements(team.id, planId)
			success++
		} catch (error) {
			failed++
			errors.push({
				teamId: team.id,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	return { success, failed, errors }
}

/**
 * Snapshot a plan's entitlements to a team
 * This is the key function that separates billing from entitlements
 *
 * When a team subscribes to a plan or changes plans, we snapshot the plan's
 * current features and limits to team-specific tables. This ensures that
 * future changes to plan definitions don't affect existing customers.
 *
 * @param teamId - Team to snapshot entitlements for
 * @param planId - Plan to snapshot from
 */
export async function snapshotPlanEntitlements(
	teamId: string,
	planId: string,
): Promise<void> {
	const db = getDb()

	// 1. Get the plan with all its features and limits
	const plan = await db.query.planTable.findFirst({
		where: eq(planTable.id, planId),
		with: {
			planFeatures: {
				with: {
					feature: true,
				},
			},
			planLimits: {
				with: {
					limit: true,
				},
			},
		},
	})

	if (!plan) {
		throw new Error(`Plan ${planId} not found`)
	}

	// 2. Soft-delete existing team entitlements (preserve history)
	await db
		.update(teamFeatureEntitlementTable)
		.set({ isActive: 0 })
		.where(
			and(
				eq(teamFeatureEntitlementTable.teamId, teamId),
				eq(teamFeatureEntitlementTable.isActive, 1),
			),
		)

	await db
		.update(teamLimitEntitlementTable)
		.set({ isActive: 0 })
		.where(
			and(
				eq(teamLimitEntitlementTable.teamId, teamId),
				eq(teamLimitEntitlementTable.isActive, 1),
			),
		)

	// 3. Snapshot features
	if (plan.planFeatures.length > 0) {
		await db.insert(teamFeatureEntitlementTable).values(
			plan.planFeatures.map((pf) => ({
				teamId,
				featureId: pf.featureId,
				source: "plan" as const,
				sourcePlanId: planId,
			})),
		)
	}

	// 4. Snapshot limits
	if (plan.planLimits.length > 0) {
		await db.insert(teamLimitEntitlementTable).values(
			plan.planLimits.map((pl) => ({
				teamId,
				limitId: pl.limitId,
				value: pl.value,
				source: "plan" as const,
				sourcePlanId: planId,
			})),
		)
	}

	logInfo({
		message: "[entitlements] Snapshotted plan to team",
		attributes: {
			teamId,
			planId,
			planName: plan.name,
			features: plan.planFeatures.length,
			limits: plan.planLimits.length,
		},
	})
}

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
			`Plan ${planId} not found in database. Run seed script first.`,
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
		logWarning({
			message:
				"[entitlements] Team missing snapshotted entitlements, falling back to plan definition",
			attributes: { teamId, planId: plan.id },
		})

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
	// 1. Get team's current plan
	const plan = await getTeamPlan(teamId)

	// 2. Check plan entitlements
	const hasFeatureInPlan = plan.entitlements.features.includes(featureId)

	// 3. Check for add-ons that enable this feature
	const hasFeatureFromAddon = await checkAddonForFeature(teamId, featureId)

	// 4. Check for manual overrides
	const override = await getFeatureOverride(teamId, featureId)
	if (override !== null) {
		return override
	}

	return hasFeatureInPlan || hasFeatureFromAddon
}

/**
 * Check if a team can perform an action that consumes a limited resource
 * NOTE: This does NOT increment usage - use requireLimit() for that
 */
export async function checkLimit(
	teamId: string,
	limitKey: string,
	incrementBy = 1,
): Promise<EntitlementCheckResult> {
	// 1. Get team's limit for this resource
	const maxLimit = await getTeamLimit(teamId, limitKey)

	// -1 means unlimited
	if (maxLimit === -1) {
		return { allowed: true }
	}

	// 2. Get current usage
	const currentUsage = await getCurrentUsage(teamId, limitKey)

	// 3. Check if action would exceed limit
	const wouldExceed = currentUsage + incrementBy > maxLimit

	if (wouldExceed) {
		return {
			allowed: false,
			reason: `This would exceed your plan's limit of ${maxLimit} ${limitKey}`,
			upgradeRequired: true,
			currentLimit: maxLimit,
			usedAmount: currentUsage,
		}
	}

	return {
		allowed: true,
		currentLimit: maxLimit,
		usedAmount: currentUsage,
	}
}

/**
 * Require a feature (throws if not available)
 */
export async function requireFeature(
	teamId: string,
	featureId: string,
): Promise<void> {
	const hasAccess = await hasFeature(teamId, featureId)

	if (!hasAccess) {
		throw new Error("This feature requires an upgrade to your plan")
	}
}

/**
 * Require limit check (throws if would exceed)
 * IMPORTANT: This also increments usage after check passes
 */
export async function requireLimit(
	teamId: string,
	limitKey: string,
	incrementBy = 1,
): Promise<void> {
	const result = await checkLimit(teamId, limitKey, incrementBy)

	if (!result.allowed) {
		throw new Error(result.reason || "Limit exceeded")
	}

	// Increment usage after check passes
	await incrementUsage(teamId, limitKey, incrementBy)
}

/**
 * Increment usage for a limited resource
 */
export async function incrementUsage(
	teamId: string,
	limitKey: string,
	amount = 1,
): Promise<void> {
	const db = getDb()

	// Get or create usage record for current period
	const now = new Date()
	const periodStart = getStartOfMonth(now)
	const periodEnd = getEndOfMonth(now)

	const existingUsage = await db.query.teamUsageTable.findFirst({
		where: and(
			eq(teamUsageTable.teamId, teamId),
			eq(teamUsageTable.limitKey, limitKey),
			eq(teamUsageTable.periodStart, periodStart),
		),
	})

	if (existingUsage) {
		await db
			.update(teamUsageTable)
			.set({ currentValue: existingUsage.currentValue + amount })
			.where(eq(teamUsageTable.id, existingUsage.id))
	} else {
		await db.insert(teamUsageTable).values({
			teamId,
			limitKey,
			currentValue: amount,
			periodStart,
			periodEnd,
		})
	}
}

// ============================================================================
// USER-LEVEL ENTITLEMENT CHECKING (Course-Builder Pattern)
// ============================================================================

/**
 * Get active entitlements for a user
 * @param userId - User ID
 * @param teamId - Optional team context
 * @param entitlementType - Optional filter by type
 */
export async function getUserEntitlements(
	userId: string,
	teamId?: string,
	entitlementType?: string,
): Promise<Entitlement[]> {
	const db = getDb()

	const conditions = [
		eq(entitlementTable.userId, userId),
		isNull(entitlementTable.deletedAt), // not soft-deleted
		or(
			isNull(entitlementTable.expiresAt), // doesn't expire
			gt(entitlementTable.expiresAt, new Date()), // or not yet expired
		),
	]

	if (teamId) {
		conditions.push(eq(entitlementTable.teamId, teamId))
	}

	if (entitlementType) {
		conditions.push(eq(entitlementTable.entitlementTypeId, entitlementType))
	}

	return await db.query.entitlementTable.findMany({
		where: and(...conditions),
		with: {
			entitlementType: true,
		},
	})
}

/**
 * Check if a user has a specific entitlement
 * @param userId - User ID
 * @param entitlementType - Type of entitlement to check
 * @param teamId - Optional team context
 * @returns boolean indicating if user has active entitlement
 */
export async function hasEntitlement(
	userId: string,
	entitlementType: string,
	teamId?: string,
): Promise<boolean> {
	const entitlements = await getUserEntitlements(
		userId,
		teamId,
		entitlementType,
	)
	return entitlements.length > 0
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
	metadata?: Record<string, any>
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

	// Invalidate user's sessions to refresh entitlements
	const { invalidateUserSessions } = await import("@/utils/kv-session")
	await invalidateUserSessions(userId)

	return entitlement
}

/**
 * Soft delete an entitlement (revoke access while maintaining audit trail)
 */
export async function revokeEntitlement(entitlementId: string): Promise<void> {
	const db = getDb()

	// Get entitlement to find userId
	const entitlement = await db.query.entitlementTable.findFirst({
		where: eq(entitlementTable.id, entitlementId),
	})

	if (!entitlement) return

	// Soft delete
	await db
		.update(entitlementTable)
		.set({ deletedAt: new Date() })
		.where(eq(entitlementTable.id, entitlementId))

	// Invalidate user's sessions to refresh entitlements
	const { invalidateUserSessions } = await import("@/utils/kv-session")
	await invalidateUserSessions(entitlement.userId)
}

/**
 * Soft delete all entitlements for a specific source
 * (e.g., when a purchase is refunded or subscription cancelled)
 */
export async function revokeEntitlementsBySource(
	sourceType: "PURCHASE" | "SUBSCRIPTION" | "MANUAL",
	sourceId: string,
): Promise<void> {
	const db = getDb()

	// Get affected entitlements to find userIds
	const affectedEntitlements = await db.query.entitlementTable.findMany({
		where: and(
			eq(entitlementTable.sourceType, sourceType),
			eq(entitlementTable.sourceId, sourceId),
			isNull(entitlementTable.deletedAt),
		),
	})

	// Soft delete all entitlements
	await db
		.update(entitlementTable)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(entitlementTable.sourceType, sourceType),
				eq(entitlementTable.sourceId, sourceId),
				isNull(entitlementTable.deletedAt), // only revoke active ones
			),
		)

	// Invalidate affected users' sessions in parallel
	const { invalidateUserSessions } = await import("@/utils/kv-session")
	const uniqueUserIds = [...new Set(affectedEntitlements.map((e) => e.userId))]
	await Promise.all(
		uniqueUserIds.map((userId) => invalidateUserSessions(userId)),
	)
}

/**
 * Check if user has access to a specific programming track (via purchase or entitlement)
 * Combines plan-based check with entitlement-based check
 */
export async function hasProgrammingTrackAccess(
	userId: string,
	teamId: string,
	trackId: string,
): Promise<boolean> {
	// 1. Check if team's plan includes programming tracks feature
	const teamPlan = await getTeamPlan(teamId)
	if (teamPlan.entitlements.features.includes(FEATURES.PROGRAMMING_TRACKS)) {
		return true // plan includes all programming tracks
	}

	// 2. Check if user has individual entitlement for this specific track
	const entitlements = await getUserEntitlements(
		userId,
		teamId,
		"programming_track_access",
	)

	return entitlements.some((e) => e.metadata?.trackId === trackId)
}

/**
 * Check if user can use AI features (workout generation, suggestions, etc.)
 * Checks feature access and remaining message limit
 */
export async function canUseAI(
	_userId: string,
	teamId: string,
): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
	// 1. Check if team has AI generation feature
	const hasAIFeature = await hasFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)
	if (!hasAIFeature) {
		return {
			allowed: false,
			reason: "Upgrade to Pro to use AI features",
		}
	}

	// 2. Check usage limit (counts all AI interactions as "messages")
	const limit = await checkLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 0)

	if (!limit.allowed) {
		return {
			allowed: false,
			remaining: 0,
			reason: `You've used all ${limit.currentLimit} AI messages this month. Upgrade for more!`,
		}
	}

	return {
		allowed: true,
		remaining: (limit.currentLimit ?? 0) - (limit.usedAmount ?? 0),
	}
}

// ============================================================================
// TEAM ENTITLEMENT SNAPSHOT QUERIES
// ============================================================================

/**
 * Get team's complete entitlement snapshot with full details
 * This shows exactly what the team has access to (their snapshot)
 */
export async function getTeamEntitlementSnapshot(teamId: string) {
	const db = getDb()

	// Get team info
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		throw new Error(`Team ${teamId} not found`)
	}

	// Get plan info (for display only - not used for entitlement checks)
	const plan = team.currentPlanId
		? await db.query.planTable.findFirst({
				where: eq(planTable.id, team.currentPlanId),
			})
		: null

	// Get team's snapshotted features with full details
	const features = await db
		.select({
			id: teamFeatureEntitlementTable.id,
			featureKey: featureTable.key,
			featureName: featureTable.name,
			featureDescription: featureTable.description,
			featureCategory: featureTable.category,
			source: teamFeatureEntitlementTable.source,
			sourcePlanId: teamFeatureEntitlementTable.sourcePlanId,
			expiresAt: teamFeatureEntitlementTable.expiresAt,
			createdAt: teamFeatureEntitlementTable.createdAt,
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
		.orderBy(featureTable.category, featureTable.name)

	// Get team's snapshotted limits with full details
	const limits = await db
		.select({
			id: teamLimitEntitlementTable.id,
			limitKey: limitTable.key,
			limitName: limitTable.name,
			limitDescription: limitTable.description,
			limitUnit: limitTable.unit,
			limitResetPeriod: limitTable.resetPeriod,
			value: teamLimitEntitlementTable.value,
			source: teamLimitEntitlementTable.source,
			sourcePlanId: teamLimitEntitlementTable.sourcePlanId,
			expiresAt: teamLimitEntitlementTable.expiresAt,
			createdAt: teamLimitEntitlementTable.createdAt,
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
		.orderBy(limitTable.name)

	// Get current usage for limits (filter by current period)
	const now = new Date()
	const periodStart = getStartOfMonth(now)

	const usageData = await db
		.select({
			limitKey: teamUsageTable.limitKey,
			currentValue: teamUsageTable.currentValue,
		})
		.from(teamUsageTable)
		.where(
			and(
				eq(teamUsageTable.teamId, teamId),
				eq(teamUsageTable.periodStart, periodStart),
			),
		)

	const usageMap = new Map(usageData.map((u) => [u.limitKey, u.currentValue]))

	// Calculate countable limits directly from database
	// These limits don't use team_usage table - they count actual records
	const memberCount = await db
		.select({ value: sql<number>`count(*)` })
		.from(teamMembershipTable)
		.where(eq(teamMembershipTable.teamId, teamId))

	// Count both owners and admins towards the admin limit
	const adminCount = await db
		.select({ value: sql<number>`count(*)` })
		.from(teamMembershipTable)
		.where(
			and(
				eq(teamMembershipTable.teamId, teamId),
				or(
					eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.ADMIN),
					eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.OWNER),
				),
			),
		)

	const trackCount = await db
		.select({ value: sql<number>`count(*)` })
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.ownerTeamId, teamId))

	// Map countable limits
	const countableUsage: Record<string, number> = {
		[LIMITS.MAX_MEMBERS_PER_TEAM]: memberCount[0]?.value ?? 0,
		[LIMITS.MAX_ADMINS]: adminCount[0]?.value ?? 0,
		[LIMITS.MAX_PROGRAMMING_TRACKS]: trackCount[0]?.value ?? 0,
	}

	// Enrich limits with usage data (prioritize countable over team_usage)
	const limitsWithUsage = limits.map((limit) => ({
		...limit,
		currentUsage:
			countableUsage[limit.limitKey] ?? usageMap.get(limit.limitKey) ?? 0,
	}))

	return {
		team: {
			id: team.id,
			name: team.name,
			currentPlanId: team.currentPlanId,
			currentPlanName: plan?.name ?? "No Plan",
		},
		features,
		limits: limitsWithUsage,
	}
}

// ============================================================================
// DATABASE QUERIES FOR FEATURES AND LIMITS METADATA
// ============================================================================

/**
 * Get all features from database
 */
export async function getAllFeatures() {
	const db = getDb()
	return await db.query.featureTable.findMany({
		where: eq(featureTable.isActive, 1),
	})
}

/**
 * Get a specific feature by key
 */
export async function getFeatureByKey(key: string) {
	const db = getDb()
	return await db.query.featureTable.findFirst({
		where: and(eq(featureTable.key, key), eq(featureTable.isActive, 1)),
	})
}

/**
 * Get all limits from database
 */
export async function getAllLimits() {
	const db = getDb()
	return await db.query.limitTable.findMany({
		where: eq(limitTable.isActive, 1),
	})
}

/**
 * Get a specific limit by key
 */
export async function getLimitByKey(key: string) {
	const db = getDb()
	return await db.query.limitTable.findFirst({
		where: and(eq(limitTable.key, key), eq(limitTable.isActive, 1)),
	})
}

/**
 * Get all plans from database
 */
export async function getAllPlans() {
	const db = getDb()
	return await db.query.planTable.findMany({
		where: eq(planTable.isActive, 1),
		with: {
			planFeatures: {
				with: {
					feature: true,
				},
			},
			planLimits: {
				with: {
					limit: true,
				},
			},
		},
	})
}

/**
 * Get all public plans (available for signup)
 */
export async function getPublicPlans() {
	const db = getDb()
	return await db
		.select()
		.from(planTable)
		.where(and(eq(planTable.isActive, 1), eq(planTable.isPublic, 1)))
		.orderBy(planTable.sortOrder)
}

/**
 * Get a specific plan by ID with all entitlements
 */
export async function getPlanById(planId: string) {
	const db = getDb()
	return await db.query.planTable.findFirst({
		where: eq(planTable.id, planId),
		with: {
			planFeatures: {
				with: {
					feature: true,
				},
			},
			planLimits: {
				with: {
					limit: true,
				},
			},
		},
	})
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get team's limit for a specific resource
 * Checks overrides first, then snapshotted entitlements, then add-ons
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

	// 3. Check add-ons that modify this limit
	const addonModifier = await getAddonLimitModifier(teamId, limitKey)

	// 4. Return plan limit + addon modifier, or just addon if no plan limit
	if (planLimit !== undefined && planLimit !== null) {
		return planLimit + addonModifier
	}

	// If no plan limit found, return only addon modifier (or 0 if no addons)
	return addonModifier
}

/**
 * Get current usage for a limit
 */
async function getCurrentUsage(
	teamId: string,
	limitKey: string,
): Promise<number> {
	const db = getDb()

	const now = new Date()
	const periodStart = getStartOfMonth(now)

	const usage = await db.query.teamUsageTable.findFirst({
		where: and(
			eq(teamUsageTable.teamId, teamId),
			eq(teamUsageTable.limitKey, limitKey),
			eq(teamUsageTable.periodStart, periodStart),
		),
	})

	return usage?.currentValue ?? 0
}

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

	return Number.parseInt(override.value, 10)
}

/**
 * Check if a team has an add-on that enables a feature
 */
async function checkAddonForFeature(
	_teamId: string,
	_featureId: string,
): Promise<boolean> {
	const _db = getDb()

	// TODO: Implement add-on feature checking
	// This would query team_addon table and check if any active add-ons
	// provide access to the specified feature

	return false
}

/**
 * Get limit modifier from add-ons
 */
async function getAddonLimitModifier(
	_teamId: string,
	_limitKey: string,
): Promise<number> {
	const _db = getDb()

	// TODO: Implement add-on limit modifiers
	// This would query team_addon table and sum up all modifications
	// to the specified limit from active add-ons

	return 0
}

// ============================================================================
// GRANT TEAM FEATURE ENTITLEMENTS
// ============================================================================

/**
 * Grant a feature to a team as an override
 * This adds a new active feature entitlement to the team
 *
 * @param teamId - Team to grant feature to
 * @param featureKey - Feature key to grant (e.g., "host_competitions")
 * @param source - Source of the grant (default: "override")
 */
export async function grantTeamFeature(
	teamId: string,
	featureKey: string,
	source: "plan" | "addon" | "override" = "override",
): Promise<void> {
	const db = getDb()

	// 1. Get the feature by key
	const feature = await db.query.featureTable.findFirst({
		where: eq(featureTable.key, featureKey),
	})

	if (!feature) {
		throw new Error(`Feature "${featureKey}" not found`)
	}

	// 2. Check if team already has this feature
	const existingEntitlement =
		await db.query.teamFeatureEntitlementTable.findFirst({
			where: and(
				eq(teamFeatureEntitlementTable.teamId, teamId),
				eq(teamFeatureEntitlementTable.featureId, feature.id),
				eq(teamFeatureEntitlementTable.isActive, 1),
			),
		})

	if (existingEntitlement) {
		// Already has the feature, nothing to do
		return
	}

	// 3. Insert new feature entitlement
	await db.insert(teamFeatureEntitlementTable).values({
		teamId,
		featureId: feature.id,
		source,
		isActive: 1,
	})

	logInfo({
		message: "[entitlements] Granted feature to team",
		attributes: { teamId, featureKey },
	})
}

/**
 * Revoke a feature from a team
 * This soft-deletes the feature entitlement
 *
 * @param teamId - Team to revoke feature from
 * @param featureKey - Feature key to revoke
 */
export async function revokeTeamFeature(
	teamId: string,
	featureKey: string,
): Promise<void> {
	const db = getDb()

	// 1. Get the feature by key
	const feature = await db.query.featureTable.findFirst({
		where: eq(featureTable.key, featureKey),
	})

	if (!feature) {
		throw new Error(`Feature "${featureKey}" not found`)
	}

	// 2. Soft-delete the feature entitlement
	await db
		.update(teamFeatureEntitlementTable)
		.set({ isActive: 0 })
		.where(
			and(
				eq(teamFeatureEntitlementTable.teamId, teamId),
				eq(teamFeatureEntitlementTable.featureId, feature.id),
				eq(teamFeatureEntitlementTable.isActive, 1),
			),
		)

	logInfo({
		message: "[entitlements] Revoked feature from team",
		attributes: { teamId, featureKey },
	})
}

/**
 * Set a limit override for a team
 * This creates or updates an override in the team_entitlement_override table
 *
 * @param teamId - Team to set limit override for
 * @param limitKey - Limit key (e.g., "max_published_competitions")
 * @param value - Limit value (-1 for unlimited, 0 for none, or positive number)
 * @param reason - Optional reason for the override
 */
export async function setTeamLimitOverride(
	teamId: string,
	limitKey: string,
	value: number,
	reason?: string,
): Promise<void> {
	const db = getDb()

	// Check if override already exists
	const existingOverride =
		await db.query.teamEntitlementOverrideTable.findFirst({
			where: and(
				eq(teamEntitlementOverrideTable.teamId, teamId),
				eq(teamEntitlementOverrideTable.type, "limit"),
				eq(teamEntitlementOverrideTable.key, limitKey),
			),
		})

	if (existingOverride) {
		// Update existing override
		await db
			.update(teamEntitlementOverrideTable)
			.set({
				value: value.toString(),
				reason: reason ?? existingOverride.reason,
			})
			.where(eq(teamEntitlementOverrideTable.id, existingOverride.id))
	} else {
		// Create new override
		await db.insert(teamEntitlementOverrideTable).values({
			teamId,
			type: "limit",
			key: limitKey,
			value: value.toString(),
			reason,
		})
	}

	logInfo({
		message: "[entitlements] Set limit override for team",
		attributes: { teamId, limitKey, value },
	})
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function getStartOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getEndOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}
