import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionsTable,
	type EventStatus,
	type HeatStatus,
	movements,
	programmingTracksTable,
	PROGRAMMING_TRACK_TYPE,
	scalingLevelsTable,
	tags,
	trackWorkoutsTable,
	workoutMovements,
	workouts,
	workoutScalingDescriptionsTable,
	workoutTags,
	type Workout,
} from "@/db/schema"
import { autochunk } from "@/utils/batch-query"

export interface DivisionDescription {
	divisionId: string
	divisionLabel: string
	description: string | null
	position: number
}

export interface CompetitionWorkout {
	id: string
	trackId: string
	workoutId: string
	trackOrder: number
	notes: string | null
	pointsMultiplier: number | null
	heatStatus: HeatStatus | null
	eventStatus: EventStatus | null
	createdAt: Date
	updatedAt: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: Workout["scheme"]
		scoreType: Workout["scoreType"]
		roundsToScore: number | null
		repsPerRound: number | null
		tiebreakScheme: Workout["tiebreakScheme"]
		secondaryScheme: Workout["secondaryScheme"]
		tags?: Array<{ id: string; name: string }>
		movements?: Array<{ id: string; name: string; type: string }>
	}
	divisionDescriptions?: DivisionDescription[]
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
			heatStatus: trackWorkoutsTable.heatStatus,
			eventStatus: trackWorkoutsTable.eventStatus,
			createdAt: trackWorkoutsTable.createdAt,
			updatedAt: trackWorkoutsTable.updatedAt,
			workout: {
				id: workouts.id,
				name: workouts.name,
				description: workouts.description,
				scheme: workouts.scheme,
				scoreType: workouts.scoreType,
				roundsToScore: workouts.roundsToScore,
				repsPerRound: workouts.repsPerRound,
				tiebreakScheme: workouts.tiebreakScheme,
				secondaryScheme: workouts.secondaryScheme,
			},
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.trackId, track.id))
		.orderBy(trackWorkoutsTable.trackOrder)

	return trackWorkouts
}

/**
 * Get published workouts for a competition (for public views)
 */
export async function getPublishedCompetitionWorkouts(
	competitionId: string,
): Promise<CompetitionWorkout[]> {
	const db = getDb()

	// Get the competition's programming track
	const track = await getCompetitionTrack(competitionId)
	if (!track) {
		return []
	}

	// Get only published workouts for this track
	const trackWorkouts = await db
		.select({
			id: trackWorkoutsTable.id,
			trackId: trackWorkoutsTable.trackId,
			workoutId: trackWorkoutsTable.workoutId,
			trackOrder: trackWorkoutsTable.trackOrder,
			notes: trackWorkoutsTable.notes,
			pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
			heatStatus: trackWorkoutsTable.heatStatus,
			eventStatus: trackWorkoutsTable.eventStatus,
			createdAt: trackWorkoutsTable.createdAt,
			updatedAt: trackWorkoutsTable.updatedAt,
			workout: {
				id: workouts.id,
				name: workouts.name,
				description: workouts.description,
				scheme: workouts.scheme,
				scoreType: workouts.scoreType,
				roundsToScore: workouts.roundsToScore,
				repsPerRound: workouts.repsPerRound,
				tiebreakScheme: workouts.tiebreakScheme,
				secondaryScheme: workouts.secondaryScheme,
			},
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(
			and(
				eq(trackWorkoutsTable.trackId, track.id),
				eq(trackWorkoutsTable.eventStatus, "published"),
			),
		)
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
	heatStatus?: HeatStatus
	eventStatus?: EventStatus
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
	if (params.heatStatus !== undefined) {
		updateData.heatStatus = params.heatStatus
	}
	if (params.eventStatus !== undefined) {
		updateData.eventStatus = params.eventStatus
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
 * Get a single competition event by trackWorkoutId
 */
export async function getCompetitionEvent(
	trackWorkoutId: string,
): Promise<CompetitionWorkout | null> {
	const db = getDb()

	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, trackWorkoutId),
		with: {
			workout: true,
		},
	})

	if (!trackWorkout || !trackWorkout.workout) {
		return null
	}

	// Fetch tags for this workout
	const workoutTagsData = await db
		.select({
			tagId: tags.id,
			tagName: tags.name,
		})
		.from(workoutTags)
		.innerJoin(tags, eq(workoutTags.tagId, tags.id))
		.where(eq(workoutTags.workoutId, trackWorkout.workoutId))

	// Fetch movements for this workout
	const workoutMovementsData = await db
		.select({
			movementId: movements.id,
			movementName: movements.name,
			movementType: movements.type,
		})
		.from(workoutMovements)
		.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
		.where(eq(workoutMovements.workoutId, trackWorkout.workoutId))

	return {
		id: trackWorkout.id,
		trackId: trackWorkout.trackId,
		workoutId: trackWorkout.workoutId,
		trackOrder: trackWorkout.trackOrder,
		notes: trackWorkout.notes,
		pointsMultiplier: trackWorkout.pointsMultiplier,
		heatStatus: trackWorkout.heatStatus,
		eventStatus: trackWorkout.eventStatus,
		createdAt: trackWorkout.createdAt,
		updatedAt: trackWorkout.updatedAt,
		workout: {
			id: trackWorkout.workout.id,
			name: trackWorkout.workout.name,
			description: trackWorkout.workout.description,
			scheme: trackWorkout.workout.scheme,
			scoreType: trackWorkout.workout.scoreType,
			roundsToScore: trackWorkout.workout.roundsToScore,
			repsPerRound: trackWorkout.workout.repsPerRound,
			tiebreakScheme: trackWorkout.workout.tiebreakScheme,
			secondaryScheme: trackWorkout.workout.secondaryScheme,
			tags: workoutTagsData.map((t) => ({ id: t.tagId, name: t.tagName })),
			movements: workoutMovementsData.map((m) => ({
				id: m.movementId,
				name: m.movementName,
				type: m.movementType,
			})),
		},
	}
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

/**
 * Create a new competition event (creates workout and adds to competition track)
 */
export async function createCompetitionEvent(params: {
	competitionId: string
	teamId: string
	name: string
	scheme: string
	scoreType?: string
	description?: string
	roundsToScore?: number
	repsPerRound?: number
	tiebreakScheme?: "time" | "reps"
	secondaryScheme?:
		| "time"
		| "pass-fail"
		| "rounds-reps"
		| "reps"
		| "emom"
		| "load"
		| "calories"
		| "meters"
		| "feet"
		| "points"
	tagIds?: string[]
	tagNames?: string[]
	movementIds?: string[]
	sourceWorkoutId?: string
}): Promise<{ workoutId: string; trackWorkoutId: string }> {
	const db = getDb()

	// Get or create the competition track
	let track = await getCompetitionTrack(params.competitionId)
	if (!track) {
		// Track doesn't exist - get competition details and create it
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, params.competitionId),
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Create the programming track for this competition
		const [createdTrack] = await db
			.insert(programmingTracksTable)
			.values({
				name: `${competition.name} - Events`,
				description: `Competition events for ${competition.name}`,
				type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
				ownerTeamId: competition.competitionTeamId,
				competitionId: competition.id,
				isPublic: 0,
			})
			.returning()

		if (!createdTrack) {
			throw new Error("Failed to create programming track for competition")
		}

		track = createdTrack
	}

	// Get the next track order
	const nextOrder = await getNextCompetitionEventOrder(params.competitionId)

	// Create the workout
	const [workout] = await db
		.insert(workouts)
		.values({
			id: `workout_${createId()}`,
			name: params.name,
			scheme: params.scheme as typeof workouts.$inferInsert.scheme,
			scoreType: params.scoreType as typeof workouts.$inferInsert.scoreType,
			description: params.description || "",
			teamId: params.teamId,
			scope: "private", // Competition workouts are private to the organizing team
			roundsToScore: params.roundsToScore ?? null,
			repsPerRound: params.repsPerRound ?? null,
			tiebreakScheme: params.tiebreakScheme ?? null,
			secondaryScheme: params.secondaryScheme ?? null,
			sourceWorkoutId: params.sourceWorkoutId ?? null, // For remixes
		})
		.returning({ id: workouts.id })

	if (!workout) {
		throw new Error("Failed to create workout")
	}

	// Handle tags - create new ones from names and use existing IDs
	const finalTagIds: string[] = []

	// Create new tags from tag names
	if (params.tagNames && params.tagNames.length > 0) {
		const { findOrCreateTag } = await import("@/server/tags")

		for (const tagName of params.tagNames) {
			const tag = await findOrCreateTag(tagName)
			if (tag) {
				finalTagIds.push(tag.id)
			}
		}
	}

	// Add existing tag IDs (filter out temporary IDs)
	if (params.tagIds && params.tagIds.length > 0) {
		const existingIds = params.tagIds.filter((id) => !id.startsWith("new_tag_"))
		finalTagIds.push(...existingIds)
	}

	// Insert workout-tag relationships
	if (finalTagIds.length > 0) {
		await db.insert(workoutTags).values(
			finalTagIds.map((tagId) => ({
				id: `workout_tag_${createId()}`,
				workoutId: workout.id,
				tagId,
			})),
		)
	}

	// Insert workout-movement relationships
	if (params.movementIds && params.movementIds.length > 0) {
		await db.insert(workoutMovements).values(
			params.movementIds.map((movementId) => ({
				id: `workout_movement_${createId()}`,
				workoutId: workout.id,
				movementId,
			})),
		)
	}

	// Add to competition track
	const [trackWorkout] = await db
		.insert(trackWorkoutsTable)
		.values({
			trackId: track.id,
			workoutId: workout.id,
			trackOrder: nextOrder,
			pointsMultiplier: 100,
		})
		.returning({ id: trackWorkoutsTable.id })

	if (!trackWorkout) {
		throw new Error("Failed to add workout to competition")
	}

	return {
		workoutId: workout.id,
		trackWorkoutId: trackWorkout.id,
	}
}

/**
 * Update a competition event's workout details
 */
export async function updateCompetitionEventWorkout(params: {
	workoutId: string
	name?: string
	description?: string
	scheme?: string
	scoreType?: string | null
	roundsToScore?: number | null
	repsPerRound?: number | null
	tiebreakScheme?: "time" | "reps" | null
	secondaryScheme?:
		| "time"
		| "pass-fail"
		| "rounds-reps"
		| "reps"
		| "emom"
		| "load"
		| "calories"
		| "meters"
		| "feet"
		| "points"
		| null
	tagIds?: string[]
	movementIds?: string[]
}): Promise<void> {
	const db = getDb()

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	}

	if (params.name !== undefined) {
		updateData.name = params.name
	}
	if (params.description !== undefined) {
		updateData.description = params.description
	}
	if (params.scheme !== undefined) {
		updateData.scheme = params.scheme
	}
	if (params.scoreType !== undefined) {
		updateData.scoreType = params.scoreType
	}
	if (params.roundsToScore !== undefined) {
		updateData.roundsToScore = params.roundsToScore
	}
	if (params.repsPerRound !== undefined) {
		updateData.repsPerRound = params.repsPerRound
	}
	if (params.tiebreakScheme !== undefined) {
		updateData.tiebreakScheme = params.tiebreakScheme
	}
	if (params.secondaryScheme !== undefined) {
		updateData.secondaryScheme = params.secondaryScheme
	}

	await db
		.update(workouts)
		.set(updateData)
		.where(eq(workouts.id, params.workoutId))

	// Update tags if provided
	if (params.tagIds !== undefined) {
		// Delete existing tags
		await db
			.delete(workoutTags)
			.where(eq(workoutTags.workoutId, params.workoutId))

		// Insert new tags (filter out any new_tag_ prefixed ids)
		const tagIds = params.tagIds.filter((id) => !id.startsWith("new_tag_"))
		if (tagIds.length > 0) {
			await db.insert(workoutTags).values(
				tagIds.map((tagId) => ({
					id: `workout_tag_${createId()}`,
					workoutId: params.workoutId,
					tagId,
				})),
			)
		}
	}

	// Update movements if provided
	if (params.movementIds !== undefined) {
		// Delete existing movements
		await db
			.delete(workoutMovements)
			.where(eq(workoutMovements.workoutId, params.workoutId))

		// Insert new movements
		if (params.movementIds.length > 0) {
			await db.insert(workoutMovements).values(
				params.movementIds.map((movementId) => ({
					id: `workout_movement_${createId()}`,
					workoutId: params.workoutId,
					movementId,
				})),
			)
		}
	}
}

/**
 * Get division descriptions for a workout
 * @param workoutId - The workout to get descriptions for
 * @param divisionIds - The division IDs to fetch descriptions for
 * @param teamId - The team that owns the workout (for ownership verification)
 * @throws Error if the workout doesn't belong to the specified team
 */
export async function getWorkoutDivisionDescriptions(
	workoutId: string,
	divisionIds: string[],
	teamId: string,
): Promise<DivisionDescription[]> {
	if (divisionIds.length === 0) {
		return []
	}

	const db = getDb()

	// Verify the workout belongs to this team
	const workout = await db
		.select({ id: workouts.id })
		.from(workouts)
		.where(and(eq(workouts.id, workoutId), eq(workouts.teamId, teamId)))
		.limit(1)

	if (workout.length === 0) {
		throw new Error("Workout not found or does not belong to this team")
	}

	// Get the scaling levels (divisions) with their descriptions for this workout (batched)
	const divisions = await autochunk(
		{ items: divisionIds },
		async (chunk: string[]) => {
			const rows = await db
				.select({
					divisionId: scalingLevelsTable.id,
					divisionLabel: scalingLevelsTable.label,
					position: scalingLevelsTable.position,
				})
				.from(scalingLevelsTable)
				.where(inArray(scalingLevelsTable.id, chunk))
			return rows
		},
	)

	// Get existing descriptions for this workout (batched)
	const descriptions = await autochunk(
		{ items: divisionIds, otherParametersCount: 1 }, // +1 for workoutId
		async (chunk: string[]) => {
			const rows = await db
				.select({
					scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
					description: workoutScalingDescriptionsTable.description,
				})
				.from(workoutScalingDescriptionsTable)
				.where(
					and(
						eq(workoutScalingDescriptionsTable.workoutId, workoutId),
						inArray(workoutScalingDescriptionsTable.scalingLevelId, chunk),
					),
				)
			return rows
		},
	)

	// Create a map for quick lookup
	const descriptionMap = new Map(
		descriptions.map((d) => [d.scalingLevelId, d.description] as const),
	)

	// Combine divisions with their descriptions
	return divisions.map((division) => ({
		divisionId: division.divisionId,
		divisionLabel: division.divisionLabel,
		description: descriptionMap.get(division.divisionId) ?? null,
		position: division.position,
	}))
}

/**
 * Update division descriptions for a workout
 * @param workoutId - The workout to update descriptions for
 * @param teamId - The team that owns the workout (for ownership verification)
 * @param descriptions - Array of division descriptions to update
 *   - description: null means delete the record
 *   - description: "" (empty string) or any string is persisted as-is
 * @throws Error if the workout doesn't belong to the specified team
 */
export async function updateWorkoutDivisionDescriptions(params: {
	workoutId: string
	teamId: string
	descriptions: Array<{ divisionId: string; description: string | null }>
}): Promise<void> {
	const db = getDb()

	// Verify the workout belongs to this team
	const workout = await db
		.select({ id: workouts.id })
		.from(workouts)
		.where(
			and(
				eq(workouts.id, params.workoutId),
				eq(workouts.teamId, params.teamId),
			),
		)
		.limit(1)

	if (workout.length === 0) {
		throw new Error("Workout not found or does not belong to this team")
	}

	for (const { divisionId, description } of params.descriptions) {
		// Check if a record already exists
		const existing = await db
			.select({ id: workoutScalingDescriptionsTable.id })
			.from(workoutScalingDescriptionsTable)
			.where(
				and(
					eq(workoutScalingDescriptionsTable.workoutId, params.workoutId),
					eq(workoutScalingDescriptionsTable.scalingLevelId, divisionId),
				),
			)
			.limit(1)

		const existingRecord = existing[0]

		if (description === null) {
			// Delete the record only when description is explicitly null
			if (existingRecord) {
				await db
					.delete(workoutScalingDescriptionsTable)
					.where(eq(workoutScalingDescriptionsTable.id, existingRecord.id))
			}
		} else if (existingRecord) {
			// Update existing record (including empty string)
			await db
				.update(workoutScalingDescriptionsTable)
				.set({
					description,
					updatedAt: new Date(),
				})
				.where(eq(workoutScalingDescriptionsTable.id, existingRecord.id))
		} else {
			// Insert new record (including empty string)
			await db.insert(workoutScalingDescriptionsTable).values({
				workoutId: params.workoutId,
				scalingLevelId: divisionId,
				description,
			})
		}
	}
}
