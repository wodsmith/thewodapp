/**
 * Seed data for features, limits, and plans
 * This data is used by the seed script to populate the database
 * It is the source of truth for the entitlements system
 */

import { FEATURES } from "./features"
import { LIMITS } from "./limits"

// Feature metadata for seeding
export const FEATURE_SEED_DATA = [
	{
		key: FEATURES.BASIC_WORKOUTS,
		name: "Basic Workouts",
		description: "Create and manage basic workout templates",
		category: "workouts" as const,
	},
	{
		key: FEATURES.PROGRAMMING_TRACKS,
		name: "Programming Tracks",
		description: "Create and manage unlimited programming tracks",
		category: "programming" as const,
	},
	{
		key: FEATURES.PROGRAM_CALENDAR,
		name: "Program Calendar",
		description: "Visual calendar for programming schedules",
		category: "programming" as const,
	},
	{
		key: FEATURES.PROGRAM_ANALYTICS,
		name: "Program Analytics",
		description: "Advanced analytics for programming effectiveness",
		category: "programming" as const,
	},
	{
		key: FEATURES.CUSTOM_SCALING_GROUPS,
		name: "Custom Scaling Groups",
		description: "Create custom scaling groups for your gym",
		category: "scaling" as const,
	},
	{
		key: FEATURES.AI_WORKOUT_GENERATION,
		name: "AI Workout Generation",
		description: "Generate workouts using AI",
		category: "ai" as const,
	},
	{
		key: FEATURES.AI_PROGRAMMING_ASSISTANT,
		name: "AI Programming Assistant",
		description: "AI assistant for programming strategy",
		category: "ai" as const,
	},
	{
		key: FEATURES.MULTI_TEAM_MANAGEMENT,
		name: "Multi-Team Management",
		description: "Manage multiple teams from one account",
		category: "team" as const,
	},
	{
		key: FEATURES.HOST_COMPETITIONS,
		name: "Host Competitions",
		description: "Create and manage competitions and events",
		category: "team" as const,
	},
]

// Limit metadata for seeding
export const LIMIT_SEED_DATA = [
	{
		key: LIMITS.MAX_MEMBERS_PER_TEAM,
		name: "Team Members",
		description: "Maximum members per team",
		unit: "members",
		resetPeriod: "never" as const,
	},
	{
		key: LIMITS.MAX_ADMINS,
		name: "Admins",
		description: "Number of admin users per team",
		unit: "admins",
		resetPeriod: "never" as const,
	},
	{
		key: LIMITS.MAX_PROGRAMMING_TRACKS,
		name: "Programming Tracks",
		description: "Number of programming tracks per team",
		unit: "tracks",
		resetPeriod: "never" as const,
	},
	{
		key: LIMITS.AI_MESSAGES_PER_MONTH,
		name: "AI Messages",
		description: "AI-powered messages per month",
		unit: "messages",
		resetPeriod: "monthly" as const,
	},
]

// Plan seed data
export const PLAN_SEED_DATA = [
	{
		id: "free",
		name: "Free",
		description: "Perfect for getting started with basic workout management",
		price: 0,
		interval: null,
		isActive: true,
		isPublic: true,
		sortOrder: 0,
		features: [
			FEATURES.BASIC_WORKOUTS,
			FEATURES.PROGRAMMING_TRACKS,
			FEATURES.AI_WORKOUT_GENERATION,
		],
		limits: {
			[LIMITS.MAX_MEMBERS_PER_TEAM]: 5,
			[LIMITS.MAX_PROGRAMMING_TRACKS]: 5,
			[LIMITS.AI_MESSAGES_PER_MONTH]: 10,
			[LIMITS.MAX_ADMINS]: 2,
		},
		stripePriceId: undefined,
		stripeProductId: undefined,
	},
	{
		id: "pro",
		name: "Pro",
		description: "Advanced features for growing gyms and coaches",
		price: 2900, // $29.00
		interval: "month" as const,
		isActive: true,
		isPublic: true,
		sortOrder: 1,
		features: [
			FEATURES.BASIC_WORKOUTS,
			FEATURES.PROGRAMMING_TRACKS,
			FEATURES.PROGRAM_CALENDAR,
			FEATURES.CUSTOM_SCALING_GROUPS,
			FEATURES.AI_WORKOUT_GENERATION,
			FEATURES.MULTI_TEAM_MANAGEMENT,
		],
		limits: {
			[LIMITS.MAX_MEMBERS_PER_TEAM]: 25,
			[LIMITS.MAX_PROGRAMMING_TRACKS]: -1,
			[LIMITS.AI_MESSAGES_PER_MONTH]: 200,
			[LIMITS.MAX_ADMINS]: 5,
		},
		stripePriceId: undefined,
		stripeProductId: undefined,
	},
	{
		id: "enterprise",
		name: "Enterprise",
		description: "Everything you need for large organizations",
		price: 9900, // $99.00
		interval: "month" as const,
		isActive: true,
		isPublic: true,
		sortOrder: 2,
		features: [
			FEATURES.BASIC_WORKOUTS,
			FEATURES.PROGRAMMING_TRACKS,
			FEATURES.PROGRAM_CALENDAR,
			FEATURES.PROGRAM_ANALYTICS,
			FEATURES.CUSTOM_SCALING_GROUPS,
			FEATURES.AI_WORKOUT_GENERATION,
			FEATURES.AI_PROGRAMMING_ASSISTANT,
			FEATURES.MULTI_TEAM_MANAGEMENT,
		],
		limits: {
			[LIMITS.MAX_MEMBERS_PER_TEAM]: -1,
			[LIMITS.MAX_PROGRAMMING_TRACKS]: -1,
			[LIMITS.AI_MESSAGES_PER_MONTH]: -1,
			[LIMITS.MAX_ADMINS]: -1,
		},
		stripePriceId: undefined,
		stripeProductId: undefined,
	},
]
