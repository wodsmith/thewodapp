/**
 * Feature flags for the entitlement system
 * Features are specific capabilities that can be enabled/disabled per team
 */

// Feature categories
export const FEATURES = {
	// Core workout features
	BASIC_WORKOUTS: "basic_workouts",
	ADVANCED_WORKOUTS: "advanced_workouts",
	WORKOUT_LIBRARY: "workout_library",

	// Programming features (PRIORITY - Sellable)
	PROGRAMMING_TRACKS: "programming_tracks",
	PROGRAM_CALENDAR: "program_calendar",
	PROGRAM_ANALYTICS: "program_analytics",

	// Scaling features
	BASIC_SCALING: "basic_scaling",
	ADVANCED_SCALING: "advanced_scaling",
	CUSTOM_SCALING_GROUPS: "custom_scaling_groups",

	// AI features (PRIORITY - Coming Soon)
	AI_WORKOUT_GENERATION: "ai_workout_generation",
	AI_WORKOUT_SUGGESTIONS: "ai_workout_suggestions",
	AI_PROGRAMMING_ASSISTANT: "ai_programming_assistant",

	// Team features (PRIORITY - Core Monetization)
	MULTI_TEAM_MANAGEMENT: "multi_team_management", // Free: 1 team, Paid: unlimited
	TEAM_COLLABORATION: "team_collaboration",
	CUSTOM_BRANDING: "custom_branding",

	// Integration features
	API_ACCESS: "api_access",
	WEBHOOK_INTEGRATION: "webhook_integration",

	// Analytics
	BASIC_ANALYTICS: "basic_analytics",
	ADVANCED_ANALYTICS: "advanced_analytics",
	CUSTOM_REPORTS: "custom_reports",
} as const

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES]

// Feature metadata for UI display
export interface FeatureMetadata {
	id: FeatureId
	name: string
	description: string
	category:
		| "workouts"
		| "programming"
		| "scaling"
		| "ai"
		| "team"
		| "integration"
		| "analytics"
	priority: "high" | "medium" | "low"
}

export const FEATURE_METADATA: Record<FeatureId, FeatureMetadata> = {
	[FEATURES.BASIC_WORKOUTS]: {
		id: FEATURES.BASIC_WORKOUTS,
		name: "Basic Workouts",
		description: "Create and manage basic workout templates",
		category: "workouts",
		priority: "high",
	},
	[FEATURES.ADVANCED_WORKOUTS]: {
		id: FEATURES.ADVANCED_WORKOUTS,
		name: "Advanced Workouts",
		description: "Advanced workout features with complex movements",
		category: "workouts",
		priority: "medium",
	},
	[FEATURES.WORKOUT_LIBRARY]: {
		id: FEATURES.WORKOUT_LIBRARY,
		name: "Workout Library",
		description: "Access to pre-built workout templates",
		category: "workouts",
		priority: "medium",
	},
	[FEATURES.PROGRAMMING_TRACKS]: {
		id: FEATURES.PROGRAMMING_TRACKS,
		name: "Programming Tracks",
		description: "Create and manage unlimited programming tracks",
		category: "programming",
		priority: "high",
	},
	[FEATURES.PROGRAM_CALENDAR]: {
		id: FEATURES.PROGRAM_CALENDAR,
		name: "Program Calendar",
		description: "Visual calendar for programming schedules",
		category: "programming",
		priority: "high",
	},
	[FEATURES.PROGRAM_ANALYTICS]: {
		id: FEATURES.PROGRAM_ANALYTICS,
		name: "Program Analytics",
		description: "Advanced analytics for programming effectiveness",
		category: "programming",
		priority: "medium",
	},
	[FEATURES.BASIC_SCALING]: {
		id: FEATURES.BASIC_SCALING,
		name: "Basic Scaling",
		description: "Basic workout scaling options",
		category: "scaling",
		priority: "high",
	},
	[FEATURES.ADVANCED_SCALING]: {
		id: FEATURES.ADVANCED_SCALING,
		name: "Advanced Scaling",
		description: "Advanced scaling with detailed options",
		category: "scaling",
		priority: "medium",
	},
	[FEATURES.CUSTOM_SCALING_GROUPS]: {
		id: FEATURES.CUSTOM_SCALING_GROUPS,
		name: "Custom Scaling Groups",
		description: "Create custom scaling groups for your gym",
		category: "scaling",
		priority: "low",
	},
	[FEATURES.AI_WORKOUT_GENERATION]: {
		id: FEATURES.AI_WORKOUT_GENERATION,
		name: "AI Workout Generation",
		description: "Generate workouts using AI",
		category: "ai",
		priority: "high",
	},
	[FEATURES.AI_WORKOUT_SUGGESTIONS]: {
		id: FEATURES.AI_WORKOUT_SUGGESTIONS,
		name: "AI Workout Suggestions",
		description: "Get AI-powered workout suggestions",
		category: "ai",
		priority: "high",
	},
	[FEATURES.AI_PROGRAMMING_ASSISTANT]: {
		id: FEATURES.AI_PROGRAMMING_ASSISTANT,
		name: "AI Programming Assistant",
		description: "AI assistant for programming strategy",
		category: "ai",
		priority: "medium",
	},
	[FEATURES.MULTI_TEAM_MANAGEMENT]: {
		id: FEATURES.MULTI_TEAM_MANAGEMENT,
		name: "Multi-Team Management",
		description: "Manage multiple teams from one account",
		category: "team",
		priority: "high",
	},
	[FEATURES.TEAM_COLLABORATION]: {
		id: FEATURES.TEAM_COLLABORATION,
		name: "Team Collaboration",
		description: "Collaborate with team members",
		category: "team",
		priority: "high",
	},
	[FEATURES.CUSTOM_BRANDING]: {
		id: FEATURES.CUSTOM_BRANDING,
		name: "Custom Branding",
		description: "Custom branding for your gym",
		category: "team",
		priority: "low",
	},
	[FEATURES.API_ACCESS]: {
		id: FEATURES.API_ACCESS,
		name: "API Access",
		description: "Access to REST API",
		category: "integration",
		priority: "low",
	},
	[FEATURES.WEBHOOK_INTEGRATION]: {
		id: FEATURES.WEBHOOK_INTEGRATION,
		name: "Webhook Integration",
		description: "Integrate with external systems via webhooks",
		category: "integration",
		priority: "low",
	},
	[FEATURES.BASIC_ANALYTICS]: {
		id: FEATURES.BASIC_ANALYTICS,
		name: "Basic Analytics",
		description: "Basic usage and performance analytics",
		category: "analytics",
		priority: "high",
	},
	[FEATURES.ADVANCED_ANALYTICS]: {
		id: FEATURES.ADVANCED_ANALYTICS,
		name: "Advanced Analytics",
		description: "Advanced analytics with custom reports",
		category: "analytics",
		priority: "medium",
	},
	[FEATURES.CUSTOM_REPORTS]: {
		id: FEATURES.CUSTOM_REPORTS,
		name: "Custom Reports",
		description: "Create custom analytics reports",
		category: "analytics",
		priority: "low",
	},
}
