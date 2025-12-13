import type { Set as DBSet, Movement, Result, Score, ScoreRound, Tag, Workout } from "@/db/schema"
import type { KVSession } from "./utils/kv-session"

export type SessionValidationResult = KVSession | null

// Workout related types - using new scores tables
export type WorkoutResult = Score
export type ResultSet = ScoreRound

// Legacy type aliases for backward compatibility during migration
export type LegacyResult = Result
export type LegacySet = DBSet

/**
 * Score with workout name and scaling info for display
 */
export type WorkoutResultWithWorkoutName = {
	id: string
	userId: string
	date: Date
	workoutId: string
	notes: string | null
	scalingLevelId: string | null
	asRx: boolean
	scoreValue: number | null
	scheme: string
	status: string
	createdAt: Date
	updatedAt: Date
	/** Decoded score for display (e.g., "3:45", "5+12", "150 lbs") */
	displayScore?: string
	workoutName?: string
	scalingLevelLabel?: string
	scalingLevelPosition?: number
}

export type ResultSetInput = {
	setNumber: number
	reps?: number | null
	weight?: number | null
	status?: "pass" | "fail" | null
	distance?: number | null
	time?: number | null
	score?: number | null
}

export type WorkoutWithTagsAndMovements = Workout & {
	tags: (Pick<Tag, "id" | "name"> & {
		createdAt?: Date
		updatedAt?: Date
		updateCounter?: number | null
	})[]
	movements: {
		id: Movement["id"]
		name: Movement["name"]
		type: "monostructural" | "weightlifting" | "gymnastic"
		createdAt?: Date
		updatedAt?: Date
		updateCounter?: number | null
	}[]
	// Optional remix information
	sourceWorkout?: {
		id: string
		name: string
		teamName?: string
	} | null
	remixCount?: number
	// Scaling information
	scalingLevels?: Array<{
		id: string
		label: string
		position: number
	}>
	scalingDescriptions?: Array<{
		scalingLevelId: string
		description: string | null
	}>
}

export type WorkoutUpdate = Partial<
	Pick<
		Workout,
		| "name"
		| "description"
		| "scheme"
		| "scoreType"
		| "scope"
		| "repsPerRound"
		| "roundsToScore"
		| "scalingGroupId"
	>
>

export interface ParsedUserAgent {
	ua: string
	browser: {
		name?: string
		version?: string
		major?: string
	}
	device: {
		model?: string
		type?: string
		vendor?: string
	}
	engine: {
		name?: string
		version?: string
	}
	os: {
		name?: string
		version?: string
	}
}

export interface SessionWithMeta extends KVSession {
	isCurrentSession: boolean
	expiration?: Date
	createdAt: number
	userAgent?: string | null
	parsedUserAgent?: ParsedUserAgent
}

/**
 * Score with scaling information for leaderboard queries
 */
export type ScoreWithScaling = WorkoutResult & {
	displayScore?: string
	scalingLabel?: string
	scalingPosition?: number
	scalingGroupTitle?: string
	scalingDescription?: string
	userName?: string
	userAvatar?: string
}

// Re-export common types for convenience
export type { Movement, Tag, Workout } from "@/db/schema"
