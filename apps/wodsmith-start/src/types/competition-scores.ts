/**
 * Competition Scores Types
 *
 * Shared types for competition score entry UI components.
 * These match the types from the server layer in competition-scores.ts
 */

import type {
	ScoreStatus,
	ScoreType,
	TiebreakScheme,
	WorkoutScheme,
} from "@/db/schema"

/** Existing set data from the sets table */
export interface ExistingSetData {
	setNumber: number
	score: number | null
	reps: number | null
}

/** Team member info for team competitions */
export interface TeamMemberInfo {
	userId: string
	firstName: string
	lastName: string
	isCaptain: boolean
}

export interface EventScoreEntryAthlete {
	registrationId: string
	userId: string
	firstName: string
	lastName: string
	email: string
	divisionId: string | null
	divisionLabel: string
	/** Team name for team competitions (null for individuals) */
	teamName: string | null
	/** Team members including captain (empty for individuals) */
	teamMembers: TeamMemberInfo[]
	existingResult: {
		resultId: string
		wodScore: string | null
		scoreStatus: ScoreStatus | null
		tieBreakScore: string | null
		secondaryScore: string | null
		/** Video URL for online submissions */
		videoUrl: string | null
		/** Video platform (youtube, vimeo) */
		videoPlatform: string | null
		/** Video ID for embedding */
		videoId: string | null
		/** Existing sets for multi-round workouts */
		sets: ExistingSetData[]
	} | null
}

export interface EventScoreEntryData {
	event: {
		id: string
		trackOrder: number
		pointsMultiplier: number | null
		workout: {
			id: string
			name: string
			description: string
			scheme: WorkoutScheme
			scoreType: ScoreType | null
			tiebreakScheme: TiebreakScheme | null
			timeCap: number | null
			repsPerRound: number | null
			roundsToScore: number | null
		}
	}
	athletes: EventScoreEntryAthlete[]
	divisions: Array<{ id: string; label: string; position: number }>
}

/** Heat info with assignment context for score entry UI */
export interface HeatScoreGroup {
	heatId: string
	heatNumber: number
	scheduledTime: Date | null
	venue: { id: string; name: string } | null
	division: { id: string; label: string } | null
	/** Lane assignments with registration IDs for linking to athletes */
	assignments: Array<{
		laneNumber: number
		registrationId: string
	}>
}

/** Response for heat-grouped score entry data */
export interface EventScoreEntryDataWithHeats extends EventScoreEntryData {
	heats: HeatScoreGroup[]
	/** Registration IDs that are not assigned to any heat */
	unassignedRegistrationIds: string[]
}
