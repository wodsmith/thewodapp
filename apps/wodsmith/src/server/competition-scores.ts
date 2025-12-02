import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	results,
	scalingLevelsTable,
	trackWorkoutsTable,
	userTable,
	type ScoreStatus,
	type WorkoutScheme,
	type ScoreType,
	type TiebreakScheme,
	type SecondaryScheme,
} from "@/db/schema"

export interface EventScoreEntryAthlete {
	registrationId: string
	userId: string
	firstName: string
	lastName: string
	email: string
	divisionId: string | null
	divisionLabel: string
	existingResult: {
		resultId: string
		wodScore: string | null
		scoreStatus: ScoreStatus | null
		tieBreakScore: string | null
		secondaryScore: string | null
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
			secondaryScheme: SecondaryScheme | null
			repsPerRound: number | null
			roundsToScore: number | null
		}
	}
	athletes: EventScoreEntryAthlete[]
	divisions: Array<{ id: string; label: string; position: number }>
}

/**
 * Get athletes and existing scores for a competition event
 */
export async function getEventScoreEntryData(params: {
	competitionId: string
	trackWorkoutId: string
	divisionId?: string
}): Promise<EventScoreEntryData> {
	const db = getDb()

	// Get the track workout (event) with workout details
	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, params.trackWorkoutId),
		with: {
			workout: true,
		},
	})

	if (!trackWorkout || !trackWorkout.workout) {
		throw new Error("Event not found")
	}

	// Get all registrations for this competition
	const registrationsQuery = db
		.select({
			registration: competitionRegistrationsTable,
			user: userTable,
			division: scalingLevelsTable,
		})
		.from(competitionRegistrationsTable)
		.innerJoin(
			userTable,
			eq(competitionRegistrationsTable.userId, userTable.id),
		)
		.leftJoin(
			scalingLevelsTable,
			eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
		)
		.where(eq(competitionRegistrationsTable.eventId, params.competitionId))

	const registrations = await registrationsQuery

	// Filter by division if specified
	const filteredRegistrations = params.divisionId
		? registrations.filter(
				(r) => r.registration.divisionId === params.divisionId,
			)
		: registrations

	// Get existing results for this event
	const userIds = filteredRegistrations.map((r) => r.user.id)
	const existingResults =
		userIds.length > 0
			? await db
					.select()
					.from(results)
					.where(
						and(
							eq(results.competitionEventId, params.trackWorkoutId),
							inArray(results.userId, userIds),
						),
					)
			: []

	// Create a map of userId to result
	const resultsByUserId = new Map(
		existingResults.map((r) => [r.userId, r]),
	)

	// Get unique divisions for the filter dropdown
	const divisionIds = [
		...new Set(
			registrations
				.map((r) => r.registration.divisionId)
				.filter((id): id is string => id !== null),
		),
	]

	const divisions =
		divisionIds.length > 0
			? await db
					.select({
						id: scalingLevelsTable.id,
						label: scalingLevelsTable.label,
						position: scalingLevelsTable.position,
					})
					.from(scalingLevelsTable)
					.where(inArray(scalingLevelsTable.id, divisionIds))
			: []

	// Build athletes array
	const athletes: EventScoreEntryAthlete[] = filteredRegistrations.map(
		(reg) => {
			const existingResult = resultsByUserId.get(reg.user.id)

			return {
				registrationId: reg.registration.id,
				userId: reg.user.id,
				firstName: reg.user.firstName || "",
				lastName: reg.user.lastName || "",
				email: reg.user.email || "",
				divisionId: reg.registration.divisionId,
				divisionLabel: reg.division?.label || "Open",
				existingResult: existingResult
					? {
							resultId: existingResult.id,
							wodScore: existingResult.wodScore,
							scoreStatus: existingResult.scoreStatus as ScoreStatus | null,
							tieBreakScore: existingResult.tieBreakScore,
							secondaryScore: existingResult.secondaryScore,
						}
					: null,
			}
		},
	)

	// Sort by division label, then by last name
	athletes.sort((a, b) => {
		if (a.divisionLabel !== b.divisionLabel) {
			return a.divisionLabel.localeCompare(b.divisionLabel)
		}
		return a.lastName.localeCompare(b.lastName)
	})

	return {
		event: {
			id: trackWorkout.id,
			trackOrder: trackWorkout.trackOrder,
			pointsMultiplier: trackWorkout.pointsMultiplier,
			workout: {
				id: trackWorkout.workout.id,
				name: trackWorkout.workout.name,
				description: trackWorkout.workout.description,
				scheme: trackWorkout.workout.scheme as WorkoutScheme,
				scoreType: trackWorkout.workout.scoreType as ScoreType | null,
				tiebreakScheme: trackWorkout.workout
					.tiebreakScheme as TiebreakScheme | null,
				timeCap: trackWorkout.workout.timeCap,
				secondaryScheme: trackWorkout.workout
					.secondaryScheme as SecondaryScheme | null,
				repsPerRound: trackWorkout.workout.repsPerRound,
				roundsToScore: trackWorkout.workout.roundsToScore,
			},
		},
		athletes,
		divisions: divisions.sort((a, b) => a.position - b.position),
	}
}

/**
 * Save a single athlete's competition score
 */
export async function saveCompetitionScore(params: {
	competitionId: string
	trackWorkoutId: string
	registrationId: string
	userId: string
	divisionId: string | null
	workoutId: string
	score: string
	scoreStatus: ScoreStatus
	tieBreakScore?: string | null
	secondaryScore?: string | null
	enteredBy: string
}): Promise<{ resultId: string; isNew: boolean }> {
	const db = getDb()

	// Check if result already exists
	const existingResult = await db.query.results.findFirst({
		where: and(
			eq(results.competitionEventId, params.trackWorkoutId),
			eq(results.userId, params.userId),
		),
	})

	if (existingResult) {
		// Update existing result
		await db
			.update(results)
			.set({
				wodScore: params.score,
				scoreStatus: params.scoreStatus,
				tieBreakScore: params.tieBreakScore ?? null,
				secondaryScore: params.secondaryScore ?? null,
				scalingLevelId: params.divisionId,
				competitionRegistrationId: params.registrationId,
				enteredBy: params.enteredBy,
				updatedAt: new Date(),
			})
			.where(eq(results.id, existingResult.id))

		return { resultId: existingResult.id, isNew: false }
	}

	// Create new result
	const resultId = `result_${createId()}`
	await db.insert(results).values({
		id: resultId,
		userId: params.userId,
		workoutId: params.workoutId,
		competitionEventId: params.trackWorkoutId,
		competitionRegistrationId: params.registrationId,
		date: new Date(),
		type: "wod",
		wodScore: params.score,
		scoreStatus: params.scoreStatus,
		tieBreakScore: params.tieBreakScore ?? null,
		secondaryScore: params.secondaryScore ?? null,
		scalingLevelId: params.divisionId,
		enteredBy: params.enteredBy,
		asRx: true, // Competition scores are always "as prescribed" for the division
	})

	return { resultId, isNew: true }
}

/**
 * Batch save multiple competition scores
 */
export async function saveCompetitionScores(params: {
	competitionId: string
	trackWorkoutId: string
	workoutId: string
	scores: Array<{
		registrationId: string
		userId: string
		divisionId: string | null
		score: string
		scoreStatus: ScoreStatus
		tieBreakScore?: string | null
	}>
	enteredBy: string
}): Promise<{ savedCount: number; errors: Array<{ userId: string; error: string }> }> {
	const errors: Array<{ userId: string; error: string }> = []
	let savedCount = 0

	for (const scoreData of params.scores) {
		try {
			await saveCompetitionScore({
				competitionId: params.competitionId,
				trackWorkoutId: params.trackWorkoutId,
				workoutId: params.workoutId,
				registrationId: scoreData.registrationId,
				userId: scoreData.userId,
				divisionId: scoreData.divisionId,
				score: scoreData.score,
				scoreStatus: scoreData.scoreStatus,
				tieBreakScore: scoreData.tieBreakScore,
				enteredBy: params.enteredBy,
			})
			savedCount++
		} catch (error) {
			errors.push({
				userId: scoreData.userId,
				error: error instanceof Error ? error.message : "Unknown error",
			})
		}
	}

	return { savedCount, errors }
}

/**
 * Delete a competition score (mark as no result)
 */
export async function deleteCompetitionScore(params: {
	trackWorkoutId: string
	userId: string
}): Promise<void> {
	const db = getDb()

	await db
		.delete(results)
		.where(
			and(
				eq(results.competitionEventId, params.trackWorkoutId),
				eq(results.userId, params.userId),
			),
		)
}
