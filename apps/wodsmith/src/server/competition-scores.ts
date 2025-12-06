import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray } from "drizzle-orm"
import { ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import { autochunk } from "@/utils/batch-query"
import {
	competitionRegistrationsTable,
	results,
	scalingLevelsTable,
	sets,
	trackWorkoutsTable,
	userTable,
	type ScoreStatus,
	type WorkoutScheme,
	type ScoreType,
	type TiebreakScheme,
	type SecondaryScheme,
} from "@/db/schema"
import {
	processScoresToSetsAndWodScore,
	type WorkoutScoreInfo,
	type NormalizedScoreEntry,
} from "@/server/logs"
import { getSessionFromCookie } from "@/utils/auth"

/**
 * Verify that a track workout belongs to the specified competition team.
 * This provides defense-in-depth security by validating ownership at the data layer.
 */
async function verifyTrackWorkoutOwnership(
	trackWorkoutId: string,
	competitionTeamId: string,
): Promise<void> {
	const db = getDb()

	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, trackWorkoutId),
		with: {
			track: {
				columns: {
					ownerTeamId: true,
				},
			},
		},
	})

	if (!trackWorkout) {
		throw new ZSAError("NOT_FOUND", "Event not found")
	}

	if (trackWorkout.track?.ownerTeamId !== competitionTeamId) {
		throw new ZSAError(
			"NOT_AUTHORIZED",
			"Not authorized to access this competition event",
		)
	}
}

/** Round score data for multi-round workouts */
export interface RoundScoreData {
	score: string
	/** For rounds+reps format: [rounds, reps] */
	parts?: [string, string]
}

/** Existing set data from the sets table */
export interface ExistingSetData {
	setNumber: number
	score: number | null
	reps: number | null
}

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
	competitionTeamId: string
	divisionId?: string
}): Promise<EventScoreEntryData> {
	// Defense-in-depth: Verify session exists
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
	}

	// Defense-in-depth: Verify team ownership
	await verifyTrackWorkoutOwnership(
		params.trackWorkoutId,
		params.competitionTeamId,
	)

	const db = getDb()

	// Get the track workout (event) with workout details
	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, params.trackWorkoutId),
		with: {
			workout: true,
		},
	})

	if (!trackWorkout || !trackWorkout.workout) {
		throw new ZSAError("NOT_FOUND", "Event not found")
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

	// Get existing results for this event (chunked to avoid D1 parameter limit)
	const userIds = filteredRegistrations.map((r) => r.user.id)
	const existingResults =
		userIds.length > 0
			? await autochunk(
					{ items: userIds, otherParametersCount: 1 },
					async (chunk) =>
						db
							.select()
							.from(results)
							.where(
								and(
									eq(results.competitionEventId, params.trackWorkoutId),
									inArray(results.userId, chunk),
								),
							),
				)
			: []

	// Get sets for all existing results (chunked to avoid D1 parameter limit)
	const resultIds = existingResults.map((r) => r.id)
	const existingSets =
		resultIds.length > 0
			? await autochunk({ items: resultIds }, async (chunk) =>
					db
						.select({
							resultId: sets.resultId,
							setNumber: sets.setNumber,
							score: sets.score,
							reps: sets.reps,
						})
						.from(sets)
						.where(inArray(sets.resultId, chunk)),
				)
			: []

	// Group sets by resultId
	const setsByResultId = new Map<string, ExistingSetData[]>()
	for (const set of existingSets) {
		const existing = setsByResultId.get(set.resultId) || []
		existing.push({
			setNumber: set.setNumber,
			score: set.score,
			reps: set.reps,
		})
		setsByResultId.set(set.resultId, existing)
	}

	// Create a map of userId to result
	const resultsByUserId = new Map(existingResults.map((r) => [r.userId, r]))

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
			? await autochunk({ items: divisionIds }, async (chunk) =>
					db
						.select({
							id: scalingLevelsTable.id,
							label: scalingLevelsTable.label,
							position: scalingLevelsTable.position,
						})
						.from(scalingLevelsTable)
						.where(inArray(scalingLevelsTable.id, chunk)),
				)
			: []

	// Build athletes array
	const athletes: EventScoreEntryAthlete[] = filteredRegistrations.map(
		(reg) => {
			const existingResult = resultsByUserId.get(reg.user.id)
			const resultSets = existingResult
				? (setsByResultId.get(existingResult.id) || []).sort(
						(a, b) => a.setNumber - b.setNumber,
					)
				: []

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
							sets: resultSets,
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
 * Convert RoundScoreData to NormalizedScoreEntry format used by shared functions
 */
function convertToNormalizedEntries(
	roundScores: RoundScoreData[],
): NormalizedScoreEntry[] {
	return roundScores.map((round) => ({
		score: round.score,
		parts: round.parts,
		timeCapped: false, // Competition scores don't currently track per-round time cap
	}))
}

/**
 * Save a single athlete's competition score
 * Uses the same score processing logic as submitLogForm via shared functions
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
	/** Round scores for multi-round workouts - stored in sets table */
	roundScores?: RoundScoreData[]
	/** Workout info for proper score processing */
	workout?: WorkoutScoreInfo
	enteredBy: string
}): Promise<{ resultId: string; isNew: boolean }> {
	const db = getDb()

	console.log("[Action] saveCompetitionScore called with:", params)
	let finalWodScore = params.score
	let setsToInsert: Array<{
		id: string
		resultId: string
		setNumber: number
		score: number | null
		reps: number | null
		time: number | null
		weight: number | null
		distance: number | null
		status: "pass" | "fail" | null
	}> = []

	// Process round scores if provided using shared functions
	if (params.roundScores && params.roundScores.length > 0 && params.workout) {
		// Convert to normalized format used by shared functions
		const normalizedEntries = convertToNormalizedEntries(params.roundScores)

		// Use shared processing function from logs.ts
		const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
			normalizedEntries,
			params.workout,
		)

		finalWodScore = wodScore

		// Prepare sets for insertion (resultId will be set below)
		setsToInsert = setsForDb.map((set, index) => ({
			id: `set_${createId()}`,
			resultId: "", // Will be set after we have the result ID
			setNumber: index + 1,
			score: set.score ?? null,
			reps: set.reps ?? null,
			time: set.time ?? null,
			weight: set.weight ?? null,
			distance: set.distance ?? null,
			status: (set.status as "pass" | "fail" | null) ?? null,
		}))
	} else if (params.roundScores && params.roundScores.length > 0) {
		// Fallback: no workout info, use simple formatting (legacy behavior)
		const formattedRounds = params.roundScores.map((round) => {
			if (round.parts) {
				return `${round.parts[0] || "0"}+${round.parts[1] || "0"}`
			}
			return round.score || "0"
		})
		finalWodScore = formattedRounds.join(", ")

		// Simple sets without proper processing
		setsToInsert = params.roundScores.map((round, index) => {
			const scoreNum = parseInt(round.parts ? round.parts[0] : round.score, 10)
			const repsNum = round.parts?.[1] ? parseInt(round.parts[1], 10) : NaN
			return {
				id: `set_${createId()}`,
				resultId: "",
				setNumber: index + 1,
				score: Number.isNaN(scoreNum) ? null : scoreNum,
				reps: Number.isNaN(repsNum) ? null : repsNum,
				time: null,
				weight: null,
				distance: null,
				status: null,
			}
		})
	} else if (params.score && params.workout) {
		// Single score (no roundScores array) - still create a set
		const normalizedEntries: NormalizedScoreEntry[] = [
			{ score: params.score, parts: undefined, timeCapped: false },
		]

		const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
			normalizedEntries,
			params.workout,
		)

		finalWodScore = wodScore

		setsToInsert = setsForDb.map((set, index) => ({
			id: `set_${createId()}`,
			resultId: "",
			setNumber: index + 1,
			score: set.score ?? null,
			reps: set.reps ?? null,
			time: set.time ?? null,
			weight: set.weight ?? null,
			distance: set.distance ?? null,
			status: (set.status as "pass" | "fail" | null) ?? null,
		}))
	}

	// Use upsert pattern to prevent race conditions
	// The unique index on (competitionEventId, userId) ensures atomicity
	const newResultId = `result_${createId()}`

	const [upsertedResult] = await db
		.insert(results)
		.values({
			id: newResultId,
			userId: params.userId,
			workoutId: params.workoutId,
			competitionEventId: params.trackWorkoutId,
			competitionRegistrationId: params.registrationId,
			date: new Date(),
			type: "wod",
			wodScore: finalWodScore,
			scoreStatus: params.scoreStatus,
			tieBreakScore: params.tieBreakScore ?? null,
			secondaryScore: params.secondaryScore ?? null,
			scalingLevelId: params.divisionId,
			enteredBy: params.enteredBy,
			setCount: setsToInsert.length || null,
			asRx: true, // Competition scores are always "as prescribed" for the division
		})
		.onConflictDoUpdate({
			target: [results.competitionEventId, results.userId],
			set: {
				wodScore: finalWodScore,
				scoreStatus: params.scoreStatus,
				tieBreakScore: params.tieBreakScore ?? null,
				secondaryScore: params.secondaryScore ?? null,
				scalingLevelId: params.divisionId,
				competitionRegistrationId: params.registrationId,
				enteredBy: params.enteredBy,
				setCount: setsToInsert.length || null,
				updatedAt: new Date(),
			},
		})
		.returning({ id: results.id })

	if (!upsertedResult) {
		throw new ZSAError("ERROR", "Failed to save competition score")
	}

	const resultId = upsertedResult.id
	const isNew = resultId === newResultId

	// Handle sets - delete existing and insert new
	if (setsToInsert.length > 0) {
		// Delete existing sets for this result (if any)
		await db.delete(sets).where(eq(sets.resultId, resultId))

		// Insert new sets
		const setsWithResultId = setsToInsert.map((set) => ({
			...set,
			resultId,
		}))
		await db.insert(sets).values(setsWithResultId)
	}

	return { resultId, isNew }
}

/**
 * Batch save multiple competition scores
 */
export async function saveCompetitionScores(params: {
	competitionId: string
	trackWorkoutId: string
	competitionTeamId: string
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
}): Promise<{
	savedCount: number
	errors: Array<{ userId: string; error: string }>
}> {
	// Defense-in-depth: Verify session exists
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
	}

	// Defense-in-depth: Verify team ownership
	await verifyTrackWorkoutOwnership(
		params.trackWorkoutId,
		params.competitionTeamId,
	)

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
	competitionTeamId: string
}): Promise<void> {
	// Defense-in-depth: Verify session exists
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
	}

	// Defense-in-depth: Verify team ownership
	await verifyTrackWorkoutOwnership(
		params.trackWorkoutId,
		params.competitionTeamId,
	)

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
