/**
 * Server functions for checking entitlements in UI
 * These return structured data for UI display, not throwing errors
 */
import "server-only"

import { and, count, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	programmingTracksTable,
	SYSTEM_ROLES_ENUM,
	teamMembershipTable,
	teamUsageTable,
} from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"
import { PLANS } from "@/config/plans"
import { getTeamPlan } from "./entitlements"

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
 * Check if the current user can create more teams
 * Returns structured data for UI display
 */
export async function checkCanCreateTeam(): Promise<TeamLimitCheckResult> {
	const session = await requireVerifiedEmail()
	if (!session) {
		return {
			canCreate: false,
			currentCount: 0,
			maxAllowed: 0,
			isUnlimited: false,
			planName: "Free",
			message: "You must be logged in to create teams",
		}
	}

	const db = getDb()

	// Get all teams where the user is owner via team_membership
	const ownedTeamMemberships = await db.query.teamMembershipTable.findMany({
		where: and(
			eq(teamMembershipTable.userId, session.userId),
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
	const freePlan = PLANS.FREE
	if (!freePlan) {
		throw new Error("FREE plan configuration is missing")
	}

	let maxTeams = freePlan.entitlements.limits[LIMITS.MAX_TEAMS]
	let planName = "Free"

	if (firstTeam) {
		const userPlan = await getTeamPlan(firstTeam.id)
		maxTeams = userPlan.entitlements.limits[LIMITS.MAX_TEAMS]
		planName = userPlan.name
	}

	// Ensure maxTeams is defined
	if (maxTeams === undefined) {
		throw new Error("MAX_TEAMS limit not found in plan configuration")
	}

	const currentCount = nonPersonalTeams.length
	const isUnlimited = maxTeams === -1
	const canCreate = isUnlimited || currentCount < maxTeams

	let message: string | undefined
	if (!canCreate) {
		message = `You've reached your limit of ${maxTeams} team${
			maxTeams === 1 ? "" : "s"
		} on the ${planName} plan. Upgrade to create more teams.`
	} else if (!isUnlimited) {
		message = `You have ${maxTeams - currentCount} team${
			maxTeams - currentCount === 1 ? "" : "s"
		} remaining on your ${planName} plan.`
	}

	return {
		canCreate,
		currentCount,
		maxAllowed: maxTeams,
		isUnlimited,
		planName,
		message,
		upgradeRequired: !canCreate,
	}
}

/**
 * Check if a team can invite more members
 * Returns structured data for UI display
 */
export async function checkCanInviteMember(
	teamId: string,
): Promise<LimitCheckResult> {
	const db = getDb()

	// Get team's plan
	const teamPlan = await getTeamPlan(teamId)
	const maxMembers = teamPlan.entitlements.limits[LIMITS.MAX_MEMBERS_PER_TEAM]
	const planName = teamPlan.name

	// Ensure maxMembers is defined
	if (maxMembers === undefined) {
		throw new Error("MAX_MEMBERS_PER_TEAM limit not found in plan configuration")
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

	// Get team's plan
	const teamPlan = await getTeamPlan(teamId)
	const maxTracks = teamPlan.entitlements.limits[LIMITS.MAX_PROGRAMMING_TRACKS]
	const hasFeature = teamPlan.entitlements.features.includes(
		FEATURES.PROGRAMMING_TRACKS,
	)
	const planName = teamPlan.name

	// Ensure maxTracks is defined
	if (maxTracks === undefined) {
		throw new Error("MAX_PROGRAMMING_TRACKS limit not found in plan configuration")
	}

	// Count current tracks owned by this team
	const trackCount = await db
		.select({ value: count() })
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.ownerTeamId, teamId))

	const currentCount = trackCount[0]?.value || 0
	const isUnlimited = maxTracks === -1
	const canCreate = hasFeature && (isUnlimited || currentCount < maxTracks)

	let message: string | undefined
	if (!hasFeature) {
		message = `Programming tracks are not available on the ${planName} plan. Upgrade to Pro or Enterprise to create programming tracks.`
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
		upgradeRequired: !canCreate || !hasFeature,
		hasFeature,
	}
}

/**
 * Check if team can use AI features
 * Returns structured data for UI display
 */
export async function checkCanUseAI(
	teamId: string,
): Promise<
	LimitCheckResult & { hasFeature: boolean; remaining?: number }
> {
	const db = getDb()

	// Get team's plan
	const teamPlan = await getTeamPlan(teamId)
	const maxMessages = teamPlan.entitlements.limits[LIMITS.AI_MESSAGES_PER_MONTH]
	const hasFeature = teamPlan.entitlements.features.includes(
		FEATURES.AI_WORKOUT_GENERATION,
	)
	const planName = teamPlan.name

	// Ensure maxMessages is defined
	if (maxMessages === undefined) {
		throw new Error("AI_MESSAGES_PER_MONTH limit not found in plan configuration")
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
	const remaining = isUnlimited ? undefined : Math.max(0, maxMessages - currentCount)
	const canCreate = hasFeature && (isUnlimited || currentCount < maxMessages)

	let message: string | undefined
	if (!hasFeature) {
		message = `AI features are not available on the ${planName} plan. Upgrade to Pro or Enterprise to use AI.`
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
		upgradeRequired: !canCreate || !hasFeature,
		hasFeature,
		remaining,
	}
}
