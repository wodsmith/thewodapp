/**
 * Usage limits and quotas for the entitlement system
 * Limits are countable resources that can be restricted per plan
 * -1 indicates unlimited
 */

export const LIMITS = {
	// NOTE: No limits on workouts, movements, or scheduled workouts - unlimited for all plans

	// Team limits (PRIORITY - Core Monetization)
	MAX_TEAMS: "max_teams", // Free: 1, Paid: unlimited (-1) - EXCLUDES personal team
	MAX_MEMBERS_PER_TEAM: "max_members_per_team", // Free: 5, Paid: higher limits
	MAX_ADMINS: "max_admins",

	// Programming limits (PRIORITY - Sellable)
	MAX_PROGRAMMING_TRACKS: "max_programming_tracks", // Free: 5, Paid: unlimited

	// AI usage limits (PRIORITY - Coming Soon)
	AI_MESSAGES_PER_MONTH: "ai_messages_per_month", // Free: 10-20, Paid: 200+

	// Storage limits
	MAX_FILE_STORAGE_MB: "max_file_storage_mb",
	MAX_VIDEO_STORAGE_MB: "max_video_storage_mb",
} as const

export type LimitKey = (typeof LIMITS)[keyof typeof LIMITS]

// Limit metadata for UI display
export interface LimitMetadata {
	id: LimitKey
	name: string
	description: string
	unit: string
	resetPeriod: "monthly" | "yearly" | "never"
	priority: "high" | "medium" | "low"
}

export const LIMIT_METADATA: Record<LimitKey, LimitMetadata> = {
	[LIMITS.MAX_TEAMS]: {
		id: LIMITS.MAX_TEAMS,
		name: "Teams",
		description: "Number of teams you can create (excluding personal team)",
		unit: "teams",
		resetPeriod: "never",
		priority: "high",
	},
	[LIMITS.MAX_MEMBERS_PER_TEAM]: {
		id: LIMITS.MAX_MEMBERS_PER_TEAM,
		name: "Team Members",
		description: "Maximum members per team",
		unit: "members",
		resetPeriod: "never",
		priority: "high",
	},
	[LIMITS.MAX_ADMINS]: {
		id: LIMITS.MAX_ADMINS,
		name: "Admins",
		description: "Number of admin users per team",
		unit: "admins",
		resetPeriod: "never",
		priority: "medium",
	},
	[LIMITS.MAX_PROGRAMMING_TRACKS]: {
		id: LIMITS.MAX_PROGRAMMING_TRACKS,
		name: "Programming Tracks",
		description: "Number of programming tracks per team",
		unit: "tracks",
		resetPeriod: "never",
		priority: "high",
	},
	[LIMITS.AI_MESSAGES_PER_MONTH]: {
		id: LIMITS.AI_MESSAGES_PER_MONTH,
		name: "AI Messages",
		description: "AI-powered messages per month",
		unit: "messages",
		resetPeriod: "monthly",
		priority: "high",
	},
	[LIMITS.MAX_FILE_STORAGE_MB]: {
		id: LIMITS.MAX_FILE_STORAGE_MB,
		name: "File Storage",
		description: "Total file storage space",
		unit: "MB",
		resetPeriod: "never",
		priority: "low",
	},
	[LIMITS.MAX_VIDEO_STORAGE_MB]: {
		id: LIMITS.MAX_VIDEO_STORAGE_MB,
		name: "Video Storage",
		description: "Total video storage space",
		unit: "MB",
		resetPeriod: "never",
		priority: "low",
	},
}
