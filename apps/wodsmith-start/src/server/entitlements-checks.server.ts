/**
 * Server functions for checking entitlements in UI
 * These return structured data for UI display, not throwing errors
 * Ported from Next.js (apps/wodsmith) to TanStack Start
 */

import { and, count, eq } from "drizzle-orm"
import { getDb } from "@/db/index.server"
import { teamUsageTable } from "@/db/schemas/entitlements.server"
import { programmingTracksTable } from "@/db/schemas/programming.server"
import { teamMembershipTable } from "@/db/schemas/teams.server"
import { FEATURES, LIMITS } from "@/constants"
import { getTeamLimit, getTeamPlan, hasFeature } from "./entitlements.server"

export interface LimitCheckResult {
	canCreate: boolean
	currentCount: number
	maxAllowed: number
	isUnlimited: boolean
	planName: string
	message?: string
	upgradeRequired?: boolean
}

export interface FeatureCheckResult {
	hasAccess: boolean
	planName: string
	message?: string
	upgradeRequired?: boolean
}

// Legacy alias
export type TeamLimitCheckResult = LimitCheckResult

/**
 * Check if a team can invite more members
 * Returns structured data for UI display
 */
export async function checkCanInviteMember(
	teamId: string,
): Promise<LimitCheckResult> {
	const db = getDb()

	// Get team's plan and limit (with overrides)
	const teamPlan = await getTeamPlan(teamId)
	const maxMembers = await getTeamLimit(teamId, LIMITS.MAX_MEMBERS_PER_TEAM)
	const planName = teamPlan.name

	// Ensure maxMembers is defined in database
	if (maxMembers === undefined || maxMembers === null) {
		throw new Error(
			`MAX_MEMBERS_PER_TEAM limit not found in database for team ${teamId}. Run seed script first.`,
		)
	}

	// Count current members
	const memberCount = await db
		.select({ value: count() })
		.from(teamMembershipTable)
		.where(eq(teamMembershipTable.teamId, teamId))

	const currentCount = memberCount[0]?.value || 0
	const isUnlimited = maxMembers === -1
	const canCreate = isUnlimited || currentCount < maxMembers

	let message: string | undefined
	if (!canCreate) {
		message = `You've reached your limit of ${maxMembers} team member${
			maxMembers === 1 ? "" : "s"
		} on the ${planName} plan. Upgrade to invite more members.`
	} else if (!isUnlimited) {
		const remaining = maxMembers - currentCount
		message = `You can invite ${remaining} more member${
			remaining === 1 ? "" : "s"
		} on your ${planName} plan.`
	}

	return {
		canCreate,
		currentCount,
		maxAllowed: maxMembers,
		isUnlimited,
		planName,
		message,
		upgradeRequired: !canCreate,
	}
}

/**
 * Check if a team can create more programming tracks
 * Returns structured data for UI display
 */
export async function checkCanCreateProgrammingTrack(
	teamId: string,
): Promise<LimitCheckResult & { hasFeature: boolean }> {
	const db = getDb()

	// Get team's plan and check feature/limit (with overrides)
	const teamPlan = await getTeamPlan(teamId)
	const maxTracks = await getTeamLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS)
	const hasFeatureAccess = await hasFeature(teamId, FEATURES.PROGRAMMING_TRACKS)
	const planName = teamPlan.name

	// Ensure maxTracks is defined in database
	if (maxTracks === undefined || maxTracks === null) {
		throw new Error(
			`MAX_PROGRAMMING_TRACKS limit not found in database for team ${teamId}. Run seed script first.`,
		)
	}

	// Count current tracks owned by this team
	const trackCount = await db
		.select({ value: count() })
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.ownerTeamId, teamId))

	const currentCount = trackCount[0]?.value || 0
	const isUnlimited = maxTracks === -1
	const canCreate =
		hasFeatureAccess && (isUnlimited || currentCount < maxTracks)

	let message: string | undefined
	if (!hasFeatureAccess) {
		message = `Programming tracks are not available on the ${planName} plan. Upgrade your plan to create programming tracks.`
	} else if (!canCreate) {
		message = `You've reached your limit of ${maxTracks} programming track${
			maxTracks === 1 ? "" : "s"
		} on the ${planName} plan. Upgrade for unlimited tracks.`
	} else if (!isUnlimited) {
		const remaining = maxTracks - currentCount
		message = `You can create ${remaining} more programming track${
			remaining === 1 ? "" : "s"
		} on your ${planName} plan.`
	}

	return {
		canCreate,
		currentCount,
		maxAllowed: maxTracks,
		isUnlimited,
		planName,
		message,
		upgradeRequired: !canCreate || !hasFeatureAccess,
		hasFeature: hasFeatureAccess,
	}
}

/**
 * Check if team can use AI features
 * Returns structured data for UI display
 */
export async function checkCanUseAI(
	teamId: string,
): Promise<LimitCheckResult & { hasFeature: boolean; remaining?: number }> {
	const db = getDb()

	// Get team's plan and check feature/limit (with overrides)
	const teamPlan = await getTeamPlan(teamId)
	const maxMessages = await getTeamLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH)
	const hasFeatureAccess = await hasFeature(
		teamId,
		FEATURES.AI_WORKOUT_GENERATION,
	)
	const planName = teamPlan.name

	// Ensure maxMessages is defined in database
	if (maxMessages === undefined || maxMessages === null) {
		throw new Error(
			`AI_MESSAGES_PER_MONTH limit not found in database for team ${teamId}. Run seed script first.`,
		)
	}

	// Get current usage for this month
	const now = new Date()
	const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

	const usage = await db.query.teamUsageTable.findFirst({
		where: and(
			eq(teamUsageTable.teamId, teamId),
			eq(teamUsageTable.limitKey, LIMITS.AI_MESSAGES_PER_MONTH),
			eq(teamUsageTable.periodStart, periodStart),
		),
	})

	const currentCount = usage?.currentValue || 0
	const isUnlimited = maxMessages === -1
	const remaining = isUnlimited
		? undefined
		: Math.max(0, maxMessages - currentCount)
	const canCreate =
		hasFeatureAccess && (isUnlimited || currentCount < maxMessages)

	let message: string | undefined
	if (!hasFeatureAccess) {
		message = `AI features are not available on the ${planName} plan. Upgrade your plan to use AI features.`
	} else if (!canCreate) {
		message = `You've used all ${maxMessages} AI messages this month on the ${planName} plan. Upgrade for more messages.`
	} else if (!isUnlimited) {
		message = `You have ${remaining} AI message${
			remaining === 1 ? "" : "s"
		} remaining this month on your ${planName} plan.`
	}

	return {
		canCreate,
		currentCount,
		maxAllowed: maxMessages,
		isUnlimited,
		planName,
		message,
		upgradeRequired: !canCreate || !hasFeatureAccess,
		hasFeature: hasFeatureAccess,
		remaining,
	}
}
