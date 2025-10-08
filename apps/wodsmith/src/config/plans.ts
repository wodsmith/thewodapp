/**
 * Plan configurations for the entitlement system
 */

import type { PlanEntitlements } from "../db/schemas/entitlements"
import { FEATURES } from "./features"
import { LIMITS } from "./limits"

export interface PlanConfig {
	id: string
	name: string
	description: string
	price: number // in cents
	interval: "month" | "year" | null
	isActive: boolean
	isPublic: boolean
	sortOrder: number
	entitlements: PlanEntitlements
	stripePriceId?: string
	stripeProductId?: string
}

/**
 * Plan configurations
 * NOTE: -1 for limits means unlimited
 */
export const PLANS: Record<string, PlanConfig> = {
	FREE: {
		id: "free",
		name: "Free",
		description: "Perfect for getting started with basic workout management",
		price: 0,
		interval: null,
		isActive: true,
		isPublic: true,
		sortOrder: 0,
		entitlements: {
			features: [
				FEATURES.BASIC_WORKOUTS,
				FEATURES.BASIC_SCALING,
				FEATURES.TEAM_COLLABORATION,
				FEATURES.BASIC_ANALYTICS,
			],
			limits: {
				[LIMITS.MAX_TEAMS]: 1, // PRIORITY: Only 1 team (excluding personal team)
				[LIMITS.MAX_MEMBERS_PER_TEAM]: 5, // PRIORITY: 5 members per team
				[LIMITS.MAX_PROGRAMMING_TRACKS]: 5, // PRIORITY: 5 programming tracks
				[LIMITS.AI_MESSAGES_PER_MONTH]: 10, // PRIORITY: Limited AI usage
				[LIMITS.MAX_ADMINS]: 2,
				[LIMITS.MAX_FILE_STORAGE_MB]: 100,
				[LIMITS.MAX_VIDEO_STORAGE_MB]: 0,
				// NOTE: No limits on workouts, movements, or scheduled workouts
			},
		},
	},
	PRO: {
		id: "pro",
		name: "Pro",
		description: "Advanced features for growing gyms and coaches",
		price: 2900, // $29.00
		interval: "month",
		isActive: true,
		isPublic: true,
		sortOrder: 1,
		entitlements: {
			features: [
				FEATURES.BASIC_WORKOUTS,
				FEATURES.ADVANCED_WORKOUTS,
				FEATURES.WORKOUT_LIBRARY,
				FEATURES.PROGRAMMING_TRACKS, // PRIORITY: Full programming access
				FEATURES.PROGRAM_CALENDAR,
				FEATURES.BASIC_SCALING,
				FEATURES.ADVANCED_SCALING,
				FEATURES.AI_WORKOUT_GENERATION, // PRIORITY: AI features included
				FEATURES.AI_WORKOUT_SUGGESTIONS,
				FEATURES.MULTI_TEAM_MANAGEMENT, // PRIORITY: Unlimited teams
				FEATURES.TEAM_COLLABORATION,
				FEATURES.BASIC_ANALYTICS,
			],
			limits: {
				[LIMITS.MAX_TEAMS]: -1, // PRIORITY: Unlimited teams (excluding personal)
				[LIMITS.MAX_MEMBERS_PER_TEAM]: 25, // PRIORITY: 25 members per team
				[LIMITS.MAX_PROGRAMMING_TRACKS]: -1, // PRIORITY: Unlimited programming tracks
				[LIMITS.AI_MESSAGES_PER_MONTH]: 200, // PRIORITY: 200 AI messages/month
				[LIMITS.MAX_ADMINS]: 5,
				[LIMITS.MAX_FILE_STORAGE_MB]: 1000, // 1GB
				[LIMITS.MAX_VIDEO_STORAGE_MB]: 500,
				// NOTE: No limits on workouts, movements, or scheduled workouts
			},
		},
	},
	ENTERPRISE: {
		id: "enterprise",
		name: "Enterprise",
		description: "Everything you need for large organizations",
		price: 9900, // $99.00
		interval: "month",
		isActive: true,
		isPublic: true,
		sortOrder: 2,
		entitlements: {
			features: [
				FEATURES.BASIC_WORKOUTS,
				FEATURES.ADVANCED_WORKOUTS,
				FEATURES.WORKOUT_LIBRARY,
				FEATURES.PROGRAMMING_TRACKS,
				FEATURES.PROGRAM_CALENDAR,
				FEATURES.PROGRAM_ANALYTICS, // Additional analytics
				FEATURES.BASIC_SCALING,
				FEATURES.ADVANCED_SCALING,
				FEATURES.CUSTOM_SCALING_GROUPS,
				FEATURES.AI_WORKOUT_GENERATION,
				FEATURES.AI_WORKOUT_SUGGESTIONS,
				FEATURES.AI_PROGRAMMING_ASSISTANT, // Advanced AI features
				FEATURES.MULTI_TEAM_MANAGEMENT,
				FEATURES.TEAM_COLLABORATION,
				FEATURES.CUSTOM_BRANDING,
				FEATURES.API_ACCESS,
				FEATURES.BASIC_ANALYTICS,
				FEATURES.ADVANCED_ANALYTICS,
				FEATURES.CUSTOM_REPORTS,
			],
			limits: {
				[LIMITS.MAX_TEAMS]: -1, // Unlimited teams (excluding personal)
				[LIMITS.MAX_MEMBERS_PER_TEAM]: -1, // Unlimited members
				[LIMITS.MAX_PROGRAMMING_TRACKS]: -1, // Unlimited programming tracks
				[LIMITS.AI_MESSAGES_PER_MONTH]: -1, // Unlimited AI messages
				[LIMITS.MAX_ADMINS]: -1, // Unlimited admins
				[LIMITS.MAX_FILE_STORAGE_MB]: 10000, // 10GB
				[LIMITS.MAX_VIDEO_STORAGE_MB]: 5000, // 5GB
				// NOTE: No limits on workouts, movements, or scheduled workouts
			},
		},
	},
}

// Helper to get plan by ID
export function getPlanConfig(planId: string): PlanConfig | undefined {
	return Object.values(PLANS).find((plan) => plan.id === planId)
}

// Get all active public plans
export function getPublicPlans(): PlanConfig[] {
	return Object.values(PLANS)
		.filter((plan) => plan.isActive && plan.isPublic)
		.sort((a, b) => a.sortOrder - b.sortOrder)
}

// Check if a plan includes a feature
export function planHasFeature(planId: string, featureId: string): boolean {
	const plan = getPlanConfig(planId)
	return plan?.entitlements.features.includes(featureId) ?? false
}

// Get limit value for a plan
export function getPlanLimit(planId: string, limitKey: string): number {
	const plan = getPlanConfig(planId)
	return plan?.entitlements.limits[limitKey] ?? 0
}
