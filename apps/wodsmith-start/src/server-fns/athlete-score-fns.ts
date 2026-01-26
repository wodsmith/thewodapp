/**
 * Athlete Score Submission Server Functions
 *
 * Server functions for athletes to submit their own scores in online competitions.
 * Includes validation for submission windows and score format based on workout scheme.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scoresTable } from "@/db/schemas/scores"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import { workouts } from "@/db/schemas/workouts"
import {
	computeSortKey,
	encodeScore,
	getDefaultScoreType,
	parseScore,
	type ScoreType,
	STATUS_ORDER,
	sortKeyToString,
	type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

export interface AthleteScoreSubmission {
	trackWorkoutId: string
	score: string
	status: "scored" | "cap"
	/** Secondary score (reps at cap) for time-capped workouts */
	secondaryScore?: string
	/** Tiebreak score if applicable */
	tiebreakScore?: string
}

export interface SubmissionWindowStatus {
	isOpen: boolean
	opensAt: string | null
	closesAt: string | null
	reason?: string
}

export interface AthleteEventScore {
	scoreId: string | null
	scoreValue: number | null
	displayScore: string | null
	status: string | null
	secondaryValue: number | null
	tiebreakValue: number | null
	submittedAt: Date | null
}

// ============================================================================
// Input Schemas
// ============================================================================

const submitScoreInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	score: z.string().min(1, "Score is required"),
	status: z.enum(["scored", "cap"]),
	secondaryScore: z.string().optional(),
	tiebreakScore: z.string().optional(),
})

const getScoreInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
})

const getSubmissionWindowInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map status to the simplified type for scores table.
 */
function getStatusOrder(status: "scored" | "cap"): number {
	switch (status) {
		case "scored":
			return STATUS_ORDER.scored
		case "cap":
			return STATUS_ORDER.cap
		default:
			return STATUS_ORDER.scored
	}
}

/**
 * Check if current time is within the event's submission window.
 */
async function checkSubmissionWindow(
	competitionId: string,
	trackWorkoutId: string,
): Promise<SubmissionWindowStatus> {
	const db = getDb()

	// Get competition type
	const [competition] = await db
		.select({
			competitionType: competitionsTable.competitionType,
		})
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))
		.limit(1)

	if (!competition) {
		return {
			isOpen: false,
			opensAt: null,
			closesAt: null,
			reason: "Competition not found",
		}
	}

	// Only check submission windows for online competitions
	if (competition.competitionType !== "online") {
		return {
			isOpen: false,
			opensAt: null,
			closesAt: null,
			reason: "This is not an online competition",
		}
	}

	// Get competition event with submission window
	const [event] = await db
		.select({
			submissionOpensAt: competitionEventsTable.submissionOpensAt,
			submissionClosesAt: competitionEventsTable.submissionClosesAt,
		})
		.from(competitionEventsTable)
		.where(
			and(
				eq(competitionEventsTable.competitionId, competitionId),
				eq(competitionEventsTable.trackWorkoutId, trackWorkoutId),
			),
		)
		.limit(1)

	// If no event record exists, submission not configured
	if (!event) {
		return {
			isOpen: false,
			opensAt: null,
			closesAt: null,
			reason: "Submission window not configured",
		}
	}

	// If no submission window is configured, submission not allowed
	if (!event.submissionOpensAt || !event.submissionClosesAt) {
		return {
			isOpen: false,
			opensAt: null,
			closesAt: null,
			reason: "Submission window not configured",
		}
	}

	// Check if current time is within the window
	const now = new Date()
	const opensAt = new Date(event.submissionOpensAt)
	const closesAt = new Date(event.submissionClosesAt)

	if (now < opensAt) {
		return {
			isOpen: false,
			opensAt: event.submissionOpensAt,
			closesAt: event.submissionClosesAt,
			reason: "Submission window has not opened yet",
		}
	}

	if (now > closesAt) {
		return {
			isOpen: false,
			opensAt: event.submissionOpensAt,
			closesAt: event.submissionClosesAt,
			reason: "Submission window has closed",
		}
	}

	return {
		isOpen: true,
		opensAt: event.submissionOpensAt,
		closesAt: event.submissionClosesAt,
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the submission window status for an event
 */
export const getSubmissionWindowStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getSubmissionWindowInputSchema.parse(data))
	.handler(async ({ data }): Promise<SubmissionWindowStatus> => {
		return checkSubmissionWindow(data.competitionId, data.trackWorkoutId)
	})

/**
 * Get the athlete's existing score for an event
 */
export const getAthleteEventScoreFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getScoreInputSchema.parse(data))
	.handler(async ({ data }): Promise<AthleteEventScore> => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const db = getDb()

		// Get the user's existing score for this event
		const [existingScore] = await db
			.select({
				id: scoresTable.id,
				scoreValue: scoresTable.scoreValue,
				status: scoresTable.status,
				secondaryValue: scoresTable.secondaryValue,
				tiebreakValue: scoresTable.tiebreakValue,
				recordedAt: scoresTable.recordedAt,
				scheme: scoresTable.scheme,
			})
			.from(scoresTable)
			.where(
				and(
					eq(scoresTable.competitionEventId, data.trackWorkoutId),
					eq(scoresTable.userId, session.userId),
				),
			)
			.limit(1)

		if (!existingScore) {
			return {
				scoreId: null,
				scoreValue: null,
				displayScore: null,
				status: null,
				secondaryValue: null,
				tiebreakValue: null,
				submittedAt: null,
			}
		}

		// Decode the score for display
		const { decodeScore } = await import("@/lib/scoring")
		let displayScore: string | null = null
		if (existingScore.scoreValue !== null) {
			displayScore = decodeScore(
				existingScore.scoreValue,
				existingScore.scheme as WorkoutScheme,
				{ compact: false },
			)
		}

		return {
			scoreId: existingScore.id,
			scoreValue: existingScore.scoreValue,
			displayScore,
			status: existingScore.status,
			secondaryValue: existingScore.secondaryValue,
			tiebreakValue: existingScore.tiebreakValue,
			submittedAt: existingScore.recordedAt,
		}
	})

/**
 * Submit or update an athlete's score for an event
 */
export const submitAthleteScoreFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => submitScoreInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{
			success: boolean
			scoreId: string
			message: string
		}> => {
			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			const db = getDb()

			// 1. Check that user is registered for this competition
			const [registration] = await db
				.select({
					id: competitionRegistrationsTable.id,
					divisionId: competitionRegistrationsTable.divisionId,
				})
				.from(competitionRegistrationsTable)
				.where(
					and(
						eq(competitionRegistrationsTable.eventId, data.competitionId),
						eq(competitionRegistrationsTable.userId, session.userId),
					),
				)
				.limit(1)

			if (!registration) {
				throw new Error("You are not registered for this competition")
			}

			// 2. Check submission window
			const windowStatus = await checkSubmissionWindow(
				data.competitionId,
				data.trackWorkoutId,
			)

			if (!windowStatus.isOpen) {
				throw new Error(windowStatus.reason || "Submission window is not open")
			}

			// 3. Get workout info for proper encoding
			const [trackWorkout] = await db
				.select({
					workoutId: trackWorkoutsTable.workoutId,
					trackId: trackWorkoutsTable.trackId,
				})
				.from(trackWorkoutsTable)
				.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
				.limit(1)

			if (!trackWorkout) {
				throw new Error("Event not found")
			}

			const [workout] = await db
				.select({
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				})
				.from(workouts)
				.where(eq(workouts.id, trackWorkout.workoutId))
				.limit(1)

			if (!workout) {
				throw new Error("Workout not found")
			}

			const scheme = workout.scheme as WorkoutScheme
			const scoreType =
				(workout.scoreType as ScoreType) || getDefaultScoreType(scheme)

			// 4. Parse and validate the score
			const parseResult = parseScore(data.score, scheme)
			if (!parseResult.isValid) {
				throw new Error(
					`Invalid score format: ${parseResult.error || "Please check your entry"}`,
				)
			}

			// Encode the score
			let encodedValue: number | null = encodeScore(data.score, scheme)

			// Handle CAP status for time-with-cap workouts
			if (
				data.status === "cap" &&
				scheme === "time-with-cap" &&
				workout.timeCap
			) {
				encodedValue = workout.timeCap * 1000 // Time cap in milliseconds
			}

			// Parse secondary score (reps at cap)
			let secondaryValue: number | null = null
			if (data.secondaryScore && data.status === "cap") {
				const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
				if (!Number.isNaN(parsed) && parsed >= 0) {
					secondaryValue = parsed
				}
			}

			// Parse tiebreak score
			let tiebreakValue: number | null = null
			if (data.tiebreakScore && workout.tiebreakScheme) {
				tiebreakValue = encodeScore(
					data.tiebreakScore,
					workout.tiebreakScheme as WorkoutScheme,
				)
			}

			// Time cap in milliseconds
			const timeCapMs = workout.timeCap ? workout.timeCap * 1000 : null

			// Compute sort key
			const sortKey =
				encodedValue !== null
					? computeSortKey({
							value: encodedValue,
							status: data.status,
							scheme,
							scoreType,
						})
					: null

			// 5. Get teamId from track
			const [track] = await db
				.select({
					ownerTeamId: programmingTracksTable.ownerTeamId,
				})
				.from(programmingTracksTable)
				.where(eq(programmingTracksTable.id, trackWorkout.trackId))
				.limit(1)

			if (!track?.ownerTeamId) {
				throw new Error("Could not determine team ownership")
			}

			// 6. Upsert the score
			await db
				.insert(scoresTable)
				.values({
					userId: session.userId,
					teamId: track.ownerTeamId,
					workoutId: trackWorkout.workoutId,
					competitionEventId: data.trackWorkoutId,
					scheme,
					scoreType,
					scoreValue: encodedValue,
					status: data.status,
					statusOrder: getStatusOrder(data.status),
					sortKey: sortKey ? sortKeyToString(sortKey) : null,
					tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
					tiebreakValue,
					timeCapMs,
					secondaryValue,
					scalingLevelId: registration.divisionId,
					asRx: true,
					recordedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [scoresTable.competitionEventId, scoresTable.userId],
					set: {
						scoreValue: encodedValue,
						status: data.status,
						statusOrder: getStatusOrder(data.status),
						sortKey: sortKey ? sortKeyToString(sortKey) : null,
						tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
						tiebreakValue,
						timeCapMs,
						secondaryValue,
						scalingLevelId: registration.divisionId,
						updatedAt: new Date(),
					},
				})

			// Get the final score ID
			const [finalScore] = await db
				.select({ id: scoresTable.id })
				.from(scoresTable)
				.where(
					and(
						eq(scoresTable.competitionEventId, data.trackWorkoutId),
						eq(scoresTable.userId, session.userId),
					),
				)
				.limit(1)

			if (!finalScore) {
				throw new Error("Failed to save score")
			}

			return {
				success: true,
				scoreId: finalScore.id,
				message: "Score submitted successfully",
			}
		},
	)

/**
 * Get workout details needed for score submission UI
 */
export const getEventWorkoutDetailsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getScoreInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{
			workoutId: string
			name: string
			scheme: WorkoutScheme
			scoreType: ScoreType | null
			timeCap: number | null
			tiebreakScheme: string | null
			repsPerRound: number | null
		}> => {
			const db = getDb()

			const [result] = await db
				.select({
					workoutId: workouts.id,
					name: workouts.name,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					timeCap: workouts.timeCap,
					tiebreakScheme: workouts.tiebreakScheme,
					repsPerRound: workouts.repsPerRound,
				})
				.from(trackWorkoutsTable)
				.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
				.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
				.limit(1)

			if (!result) {
				throw new Error("Event not found")
			}

			return {
				workoutId: result.workoutId,
				name: result.name,
				scheme: result.scheme as WorkoutScheme,
				scoreType: result.scoreType as ScoreType | null,
				timeCap: result.timeCap,
				tiebreakScheme: result.tiebreakScheme,
				repsPerRound: result.repsPerRound,
			}
		},
	)
