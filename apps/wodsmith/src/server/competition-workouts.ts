import "server-only"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionsTable,
	programmingTracksTable,
	trackWorkoutsTable,
	workouts,
} from "@/db/schema"

export interface CompetitionWorkout {
	id: string
	trackId: string
	workoutId: string
	trackOrder: number
	notes: string | null
	pointsMultiplier: number | null
	createdAt: Date
	updatedAt: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: string
		scoreType: string | null
	}
}

/**
 * Get the programming track for a competition
 */
export async function getCompetitionTrack(competitionId: string) {
	const db = getDb()

	const track = await db.query.programmingTracksTable.findFirst({
		where: eq(programmingTracksTable.competitionId, competitionId),
	})

	return track ?? null
}

/**
 * Add a workout to a competition
 */
export async function addWorkoutToCompetition(params: {
	competitionId: string
	workoutId: string
	trackOrder: number
	pointsMultiplier?: number
	notes?: string
}): Promise<{ trackWorkoutId: string }> {
	const db = getDb()

	// Get the competition's programming track
	const track = await getCompetitionTrack(params.competitionId)
	if (!track) {
		throw new Error("Competition track not found")
	}

	// Verify workout exists
	const workout = await db.query.workouts.findFirst({
		where: eq(workouts.id, params.workoutId),
	})
	if (!workout) {
		throw new Error("Workout not found")
	}

	// Add workout to track
	const [trackWorkout] = await db
		.insert(trackWorkoutsTable)
		.values({
			trackId: track.id,
			workoutId: params.workoutId,
			trackOrder: params.trackOrder,
			pointsMultiplier: params.pointsMultiplier ?? 100,
			notes: params.notes,
		})
		.returning()

	if (!trackWorkout) {
		throw new Error("Failed to add workout to competition")
	}

	return { trackWorkoutId: trackWorkout.id }
}

/**
 * Get all workouts for a competition
 */
export async function getCompetitionWorkouts(
	competitionId: string,
): Promise<CompetitionWorkout[]> {
	const db = getDb()

	// Get the competition's programming track
	const track = await getCompetitionTrack(competitionId)
	if (!track) {
		return []
	}

	// Get all workouts for this track
	const trackWorkouts = await db
		.select({
			id: trackWorkoutsTable.id,
			trackId: trackWorkoutsTable.trackId,
			workoutId: trackWorkoutsTable.workoutId,
			trackOrder: trackWorkoutsTable.trackOrder,
			notes: trackWorkoutsTable.notes,
			pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
			createdAt: trackWorkoutsTable.createdAt,
			updatedAt: trackWorkoutsTable.updatedAt,
			workout: {
				id: workouts.id,
				name: workouts.name,
				description: workouts.description,
				scheme: workouts.scheme,
				scoreType: workouts.scoreType,
			},
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.trackId, track.id))
		.orderBy(trackWorkoutsTable.trackOrder)

	return trackWorkouts
}

/**
 * Update a competition workout
 */
export async function updateCompetitionWorkout(params: {
	trackWorkoutId: string
	trackOrder?: number
	pointsMultiplier?: number
	notes?: string | null
}): Promise<void> {
	const db = getDb()

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	}

	if (params.trackOrder !== undefined) {
		updateData.trackOrder = params.trackOrder
	}
	if (params.pointsMultiplier !== undefined) {
		updateData.pointsMultiplier = params.pointsMultiplier
	}
	if (params.notes !== undefined) {
		updateData.notes = params.notes
	}

	await db
		.update(trackWorkoutsTable)
		.set(updateData)
		.where(eq(trackWorkoutsTable.id, params.trackWorkoutId))
}

/**
 * Remove a workout from a competition
 */
export async function removeWorkoutFromCompetition(
	trackWorkoutId: string,
): Promise<void> {
	const db = getDb()

	await db
		.delete(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))
}

/**
 * Reorder competition events
 */
export async function reorderCompetitionEvents(
	competitionId: string,
	updates: { trackWorkoutId: string; trackOrder: number }[],
): Promise<number> {
	const db = getDb()

	// Get the competition's programming track
	const track = await getCompetitionTrack(competitionId)
	if (!track) {
		throw new Error("Competition track not found")
	}

	// Validate all track workouts belong to this track
	const existingWorkouts = await db
		.select({ id: trackWorkoutsTable.id })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, track.id))

	const existingIds = new Set(existingWorkouts.map((w) => w.id))

	for (const update of updates) {
		if (!existingIds.has(update.trackWorkoutId)) {
			throw new Error(
				`Track workout ${update.trackWorkoutId} does not belong to this competition`,
			)
		}
	}

	// Perform updates
	let updateCount = 0
	for (const update of updates) {
		await db
			.update(trackWorkoutsTable)
			.set({ trackOrder: update.trackOrder, updatedAt: new Date() })
			.where(eq(trackWorkoutsTable.id, update.trackWorkoutId))
		updateCount++
	}

	return updateCount
}

/**
 * Get the next available track order for a competition
 */
export async function getNextCompetitionEventOrder(
	competitionId: string,
): Promise<number> {
	const db = getDb()

	const track = await getCompetitionTrack(competitionId)
	if (!track) {
		return 1
	}

	const trackWorkouts = await db
		.select({ trackOrder: trackWorkoutsTable.trackOrder })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, track.id))

	if (trackWorkouts.length === 0) {
		return 1
	}

	const maxOrder = Math.max(...trackWorkouts.map((tw) => tw.trackOrder))
	return maxOrder + 1
}

/**
 * Get competition details with track info
 */
export async function getCompetitionWithTrack(competitionId: string) {
	const db = getDb()

	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	if (!competition) {
		return null
	}

	const track = await getCompetitionTrack(competitionId)

	return {
		...competition,
		track,
	}
}
