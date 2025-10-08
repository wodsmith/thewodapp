/**
 * Core Entitlements Service
 * Centralized service for checking team plan-based entitlements and user-level entitlements
 */
import "server-only"

import { and, eq, gt, isNull, or, } from "drizzle-orm"
import type { Entitlement, PlanEntitlements } from "../db/schema"
import {
	entitlementTable,
	planTable,
	SYSTEM_ROLES_ENUM,
	teamEntitlementOverrideTable,
	teamMembershipTable,
	teamTable,
	teamUsageTable,
} from "../db/schema"
import { getDb } from "@/db"
import { FEATURES } from "../config/features"
import { LIMITS } from "../config/limits"
import { PLANS } from "../config/plans"

// ============================================================================
// TEAM-LEVEL ENTITLEMENT CHECKING (Plan-Based)
// ============================================================================

export interface EntitlementCheckResult {
	allowed: boolean
	reason?: string
	upgradeRequired?: boolean
	currentLimit?: number
	usedAmount?: number
}

/**
 * Get team's current plan configuration
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

	if (!team || !team.currentPlanId) {
		// Default to free plan if no plan assigned
		return {
			id: "free",
			name: "Free",
			entitlements: PLANS.FREE.entitlements,
		}
	}

	// Get plan from database
	const plan = await db.query.planTable.findFirst({
		where: eq(planTable.id, team.currentPlanId),
	})

	if (!plan) {
		// Fallback to free plan
		return {
			id: "free",
			name: "Free",
			entitlements: PLANS.FREE.entitlements,
		}
	}

	return {
		id: plan.id,
		name: plan.name,
		entitlements: plan.entitlements as PlanEntitlements,
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
 * Special limit check for MAX_TEAMS that excludes personal teams
 * Personal teams (isPersonalTeam = true) do NOT count toward the limit
 */
export async function requireLimitExcludingPersonalTeams(
	userId: string,
	limitKey: string,
): Promise<void> {
	if (limitKey !== LIMITS.MAX_TEAMS) {
		throw new Error("This function only applies to MAX_TEAMS limit")
	}

	const db = getDb()

	// Get all teams where the user is owner via team_membership
	const ownedTeamMemberships = await db.query.teamMembershipTable.findMany({
		where: and(
			eq(teamMembershipTable.userId, userId),
			eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.OWNER),
			eq(teamMembershipTable.isSystemRole, 1),
		),
		with: {
			team: true,
		},
	})

	// Filter out personal teams to count only non-personal teams
	const nonPersonalTeams = ownedTeamMemberships.filter(
		(membership) => !membership.team?.isPersonalTeam,
	)

	// Get user's plan from their first team (personal or otherwise)
	const firstTeam = ownedTeamMemberships[0]?.team
	let maxTeams = PLANS.FREE.entitlements.limits[limitKey]

	if (firstTeam) {
		const userPlan = await getTeamPlan(firstTeam.id)
		maxTeams = userPlan.entitlements.limits[limitKey]
	}

	// -1 means unlimited
	if (maxTeams === -1) {
		return
	}

	const currentTeamCount = nonPersonalTeams.length

	if (currentTeamCount >= maxTeams) {
		throw new Error(
			`You've reached your limit of ${maxTeams} team(s). Upgrade to create more teams. (Personal teams don't count toward this limit)`,
		)
	}
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
	await Promise.all(uniqueUserIds.map((userId) => invalidateUserSessions(userId)))
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get team's limit for a specific resource
 */
async function getTeamLimit(teamId: string, limitKey: string): Promise<number> {
	// 1. Check for manual override first
	const override = await getLimitOverride(teamId, limitKey)
	if (override !== null) {
		return override
	}

	// 2. Get plan limit
	const plan = await getTeamPlan(teamId)
	const planLimit = plan.entitlements.limits[limitKey]
	if (planLimit !== undefined) {
		return planLimit
	}

	// 3. Check add-ons that modify this limit
	const addonModifier = await getAddonLimitModifier(teamId, limitKey)

	// 4. Return plan limit + addon modifier
	return (planLimit ?? 0) + addonModifier
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
// DATE UTILITIES
// ============================================================================

function getStartOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getEndOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}
