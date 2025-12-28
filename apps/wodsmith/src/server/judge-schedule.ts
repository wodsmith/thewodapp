import "server-only"

import { inArray } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import {
	competitionHeatsTable,
	scalingLevelsTable,
	trackWorkoutsTable,
	workouts,
} from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import type {
	ScoreType,
	TiebreakScheme,
	WorkoutScheme,
} from "@/db/schemas/workouts"
import { autochunk } from "@/utils/batch-query"
import {
	type DivisionDescription,
	getWorkoutDivisionDescriptions,
} from "./competition-workouts"
import { getRotationsForJudge } from "./judge-rotations"

type Db = DrizzleD1Database<typeof schema>

// ============================================================================
// Types
// ============================================================================

/**
 * Workout metadata for judge reference
 */
export interface WorkoutDetails {
	description: string | null
	/** Workout scheme (time, rounds-reps, load, etc.) */
	scheme: WorkoutScheme
	/** How multiple scores are aggregated (min, max, sum, etc.) */
	scoreType: ScoreType | null
	/** Time cap in seconds (for time-with-cap workouts) */
	timeCap: number | null
	/** Reps per round for rounds-reps scoring */
	repsPerRound: number | null
	/** Number of rounds to score */
	roundsToScore: number | null
	/** Tiebreak scheme (time or reps) */
	tiebreakScheme: TiebreakScheme | null
}

/**
 * Heat assignment with division info for a judge's rotation
 */
export interface HeatAssignment {
	heatNumber: number
	divisionId: string | null
	divisionName: string | null
	scheduledTime: Date | null
	durationMinutes: number | null
}

export interface EnrichedRotation {
	// Original rotation data
	rotation: {
		id: string
		competitionId: string
		trackWorkoutId: string
		membershipId: string
		startingHeat: number
		startingLane: number
		heatsCount: number
		laneShiftPattern: LaneShiftPattern
		notes: string | null
		createdAt: Date
		updatedAt: Date
		updateCounter: number | null
	}
	// Enriched data
	eventName: string
	eventNotes: string | null
	timeWindow: string | null
	estimatedDuration: number | null
	isUpcoming: boolean
	divisionDescriptions: DivisionDescription[]
	// Full workout details for judge reference
	workout: WorkoutDetails
	// Heat assignments with division info
	heats: HeatAssignment[]
	// From rotation
	lane: number
	heatsCount: number
	startingHeat: number
}

/**
 * Rotations grouped by event for display
 */
export interface EventWithRotations {
	trackWorkoutId: string
	eventName: string
	eventNotes: string | null
	workout: WorkoutDetails
	divisionDescriptions: DivisionDescription[]
	rotations: EnrichedRotation[]
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetch rotations for a judge with all related data in efficient batched queries.
 *
 * This function:
 * 1. Fetches base rotations for judge
 * 2. Batch-fetches trackWorkouts with autochunk (D1-safe)
 * 3. Batch-fetches workouts with autochunk (D1-safe)
 * 4. Batch-fetches heats with autochunk (D1-safe)
 * 5. Fetches division descriptions with getWorkoutDivisionDescriptions (already uses autochunk)
 * 6. Calculates derived fields (timeWindow, estimatedDuration, isUpcoming)
 *
 * @param db - Database instance
 * @param membershipId - Judge's team membership ID
 * @param competitionId - Competition ID
 * @param divisionIds - Division IDs to fetch descriptions for
 * @returns Array of enriched rotations ready for UI display
 */
export async function getEnrichedRotationsForJudge(
	db: Db,
	membershipId: string,
	competitionId: string,
	divisionIds: string[],
): Promise<EnrichedRotation[]> {
	// 1. Get base rotations
	const rotations = await getRotationsForJudge(db, membershipId, competitionId)

	if (rotations.length === 0) {
		return []
	}

	// 2. Extract unique IDs for batching
	const trackWorkoutIds = [...new Set(rotations.map((r) => r.trackWorkoutId))]

	// 3. Batch-fetch trackWorkouts with autochunk
	const trackWorkouts = await autochunk(
		{ items: trackWorkoutIds },
		async (chunk) => {
			return db
				.select({
					id: trackWorkoutsTable.id,
					workoutId: trackWorkoutsTable.workoutId,
					notes: trackWorkoutsTable.notes,
					eventStatus: trackWorkoutsTable.eventStatus,
				})
				.from(trackWorkoutsTable)
				.where(inArray(trackWorkoutsTable.id, chunk))
		},
	)

	// Create lookup map
	const trackWorkoutMap = new Map(trackWorkouts.map((tw) => [tw.id, tw]))

	// 4. Extract unique workout IDs and batch-fetch workouts with autochunk
	const workoutIds = [
		...new Set(trackWorkouts.map((tw) => tw.workoutId).filter(Boolean)),
	]

	const workoutsList = await autochunk({ items: workoutIds }, async (chunk) => {
		return db
			.select({
				id: workouts.id,
				name: workouts.name,
				description: workouts.description,
				scheme: workouts.scheme,
				scoreType: workouts.scoreType,
				timeCap: workouts.timeCap,
				repsPerRound: workouts.repsPerRound,
				roundsToScore: workouts.roundsToScore,
				tiebreakScheme: workouts.tiebreakScheme,
				teamId: workouts.teamId, // Need this for division descriptions lookup
			})
			.from(workouts)
			.where(inArray(workouts.id, chunk))
	})

	// Create lookup map
	const workoutMap = new Map(workoutsList.map((w) => [w.id, w]))

	// 5. Batch-fetch heats for all trackWorkouts with autochunk (including divisionId)
	const heatsData = await autochunk(
		{ items: trackWorkoutIds },
		async (chunk) => {
			return db
				.select({
					trackWorkoutId: competitionHeatsTable.trackWorkoutId,
					heatNumber: competitionHeatsTable.heatNumber,
					scheduledTime: competitionHeatsTable.scheduledTime,
					durationMinutes: competitionHeatsTable.durationMinutes,
					divisionId: competitionHeatsTable.divisionId,
				})
				.from(competitionHeatsTable)
				.where(inArray(competitionHeatsTable.trackWorkoutId, chunk))
		},
	)

	// Collect unique division IDs from heats to fetch names
	const heatDivisionIds = [
		...new Set(heatsData.map((h) => h.divisionId).filter(Boolean)),
	] as string[]

	// Batch-fetch division names (scaling levels)
	const divisionNames = await autochunk(
		{ items: heatDivisionIds },
		async (chunk) => {
			return db
				.select({
					id: scalingLevelsTable.id,
					label: scalingLevelsTable.label,
				})
				.from(scalingLevelsTable)
				.where(inArray(scalingLevelsTable.id, chunk))
		},
	)

	// Create division name lookup
	const divisionNameMap = new Map(divisionNames.map((d) => [d.id, d.label]))

	// Group heats by trackWorkoutId
	const heatsByTrackWorkout = new Map<
		string,
		Array<{
			heatNumber: number
			scheduledTime: Date | null
			durationMinutes: number | null
			divisionId: string | null
			divisionName: string | null
		}>
	>()

	for (const heat of heatsData) {
		const existing = heatsByTrackWorkout.get(heat.trackWorkoutId) || []
		existing.push({
			heatNumber: heat.heatNumber,
			scheduledTime: heat.scheduledTime,
			durationMinutes: heat.durationMinutes,
			divisionId: heat.divisionId,
			divisionName: heat.divisionId
				? divisionNameMap.get(heat.divisionId) || null
				: null,
		})
		heatsByTrackWorkout.set(heat.trackWorkoutId, existing)
	}

	// 6. Fetch division descriptions for all workouts with getWorkoutDivisionDescriptions
	// This function already uses autochunk internally
	// IMPORTANT: Use the workout's own teamId, not the competition's teamId,
	// because workouts can be shared across teams
	const divisionDescriptionsByWorkout = new Map<string, DivisionDescription[]>()

	for (const workout of workoutsList) {
		if (!workout.teamId) {
			// Workout has no team owner, skip descriptions
			divisionDescriptionsByWorkout.set(workout.id, [])
			continue
		}

		try {
			const descriptions = await getWorkoutDivisionDescriptions(
				workout.id,
				divisionIds,
				workout.teamId, // Use workout's teamId, not competition's teamId
			)
			divisionDescriptionsByWorkout.set(workout.id, descriptions)
		} catch (error) {
			// If error fetching descriptions, skip them
			console.warn(
				`[getEnrichedRotationsForJudge] Failed to fetch division descriptions for workout ${workout.id}:`,
				error,
			)
			divisionDescriptionsByWorkout.set(workout.id, [])
		}
	}

	// 7. Build enriched results
	const now = new Date()
	const enriched: EnrichedRotation[] = []

	for (const rotation of rotations) {
		const trackWorkout = trackWorkoutMap.get(rotation.trackWorkoutId)
		const workout = trackWorkout
			? workoutMap.get(trackWorkout.workoutId)
			: undefined
		const heats = heatsByTrackWorkout.get(rotation.trackWorkoutId) || []
		const divisionDescriptions = workout
			? divisionDescriptionsByWorkout.get(workout.id) || []
			: []

		// Skip if event is not published
		if (trackWorkout?.eventStatus !== "published") {
			continue
		}

		// Calculate time window and duration for this judge's rotation
		const judgeHeats = heats.filter(
			(h) =>
				h.heatNumber >= rotation.startingHeat &&
				h.heatNumber < rotation.startingHeat + rotation.heatsCount,
		)

		let timeWindow: string | null = null
		let estimatedDuration: number | null = null
		let isUpcoming = false

		if (judgeHeats.length > 0) {
			const scheduledHeats = judgeHeats.filter(
				(h) => h.scheduledTime && h.durationMinutes,
			)

			if (scheduledHeats.length > 0) {
				// Sort by scheduled time
				scheduledHeats.sort(
					(a, b) =>
						(a.scheduledTime?.getTime() ?? 0) -
						(b.scheduledTime?.getTime() ?? 0),
				)

				const firstHeat = scheduledHeats[0]
				const lastHeat = scheduledHeats[scheduledHeats.length - 1]

				if (firstHeat?.scheduledTime && lastHeat?.scheduledTime) {
					// Calculate time window
					const startTime = firstHeat.scheduledTime
					const endTime = new Date(
						lastHeat.scheduledTime.getTime() +
							(lastHeat.durationMinutes || 0) * 60 * 1000,
					)

					// Format time window (e.g., "2:00 PM - 3:30 PM")
					const formatter = new Intl.DateTimeFormat("en-US", {
						hour: "numeric",
						minute: "2-digit",
						hour12: true,
					})

					timeWindow = `${formatter.format(startTime)} - ${formatter.format(endTime)}`

					// Calculate estimated duration in minutes
					estimatedDuration = Math.round(
						(endTime.getTime() - startTime.getTime()) / (60 * 1000),
					)

					// Check if upcoming (first heat hasn't started yet)
					isUpcoming = startTime > now
				}
			}
		}

		// Build heat assignments with division info for this rotation
		const heatAssignments: HeatAssignment[] = judgeHeats
			.sort((a, b) => a.heatNumber - b.heatNumber)
			.map((h) => ({
				heatNumber: h.heatNumber,
				divisionId: h.divisionId,
				divisionName: h.divisionName,
				scheduledTime: h.scheduledTime,
				durationMinutes: h.durationMinutes,
			}))

		enriched.push({
			rotation: {
				id: rotation.id,
				competitionId: rotation.competitionId,
				trackWorkoutId: rotation.trackWorkoutId,
				membershipId: rotation.membershipId,
				startingHeat: rotation.startingHeat,
				startingLane: rotation.startingLane,
				heatsCount: rotation.heatsCount,
				laneShiftPattern: rotation.laneShiftPattern,
				notes: rotation.notes,
				createdAt: rotation.createdAt,
				updatedAt: rotation.updatedAt,
				updateCounter: rotation.updateCounter,
			},
			eventName: workout?.name || "Unknown Event",
			eventNotes: trackWorkout?.notes || null,
			workout: {
				description: workout?.description || null,
				scheme: workout?.scheme || "time",
				scoreType: workout?.scoreType || null,
				timeCap: workout?.timeCap || null,
				repsPerRound: workout?.repsPerRound || null,
				roundsToScore: workout?.roundsToScore || null,
				tiebreakScheme: workout?.tiebreakScheme || null,
			},
			heats: heatAssignments,
			timeWindow,
			estimatedDuration,
			isUpcoming,
			divisionDescriptions,
			lane: rotation.startingLane,
			heatsCount: rotation.heatsCount,
			startingHeat: rotation.startingHeat,
		})
	}

	// Sort by time (upcoming first, then by start time)
	enriched.sort((a, b) => {
		// Prioritize upcoming events
		if (a.isUpcoming !== b.isUpcoming) {
			return a.isUpcoming ? -1 : 1
		}

		// Then sort by start heat number
		return a.startingHeat - b.startingHeat
	})

	return enriched
}

/**
 * Group enriched rotations by event (trackWorkoutId).
 * Returns events with their associated rotations for UI display.
 */
export function groupRotationsByEvent(
	rotations: EnrichedRotation[],
): EventWithRotations[] {
	const eventMap = new Map<string, EventWithRotations>()

	for (const rotation of rotations) {
		const key = rotation.rotation.trackWorkoutId
		const existing = eventMap.get(key)

		if (existing) {
			existing.rotations.push(rotation)
		} else {
			eventMap.set(key, {
				trackWorkoutId: key,
				eventName: rotation.eventName,
				eventNotes: rotation.eventNotes,
				workout: rotation.workout,
				divisionDescriptions: rotation.divisionDescriptions,
				rotations: [rotation],
			})
		}
	}

	// Sort rotations within each event by starting heat
	for (const event of eventMap.values()) {
		event.rotations.sort((a, b) => a.startingHeat - b.startingHeat)
	}

	// Return events sorted by first rotation's upcoming status and heat number
	return Array.from(eventMap.values()).sort((a, b) => {
		const aFirst = a.rotations[0]
		const bFirst = b.rotations[0]

		if (!aFirst || !bFirst) return 0

		// Prioritize events with upcoming rotations
		if (aFirst.isUpcoming !== bFirst.isUpcoming) {
			return aFirst.isUpcoming ? -1 : 1
		}

		// Then sort by first heat number
		return aFirst.startingHeat - bFirst.startingHeat
	})
}
