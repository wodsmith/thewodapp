import type { Set as DBSet, Movement, Result, Tag, Workout } from "~/db/schema"
import type { KVSession } from "./utils/kv-session"

export type SessionValidationResult = KVSession | null

// Workout related types
export type WorkoutResult = Result
export type ResultSet = DBSet

export type WorkoutResultWithWorkoutName = Result & {
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

// Re-export common types for convenience
export type { Movement, Tag, Workout } from "~/db/schema"
