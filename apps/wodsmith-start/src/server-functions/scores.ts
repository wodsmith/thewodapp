import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { SCORE_STATUS_VALUES } from "@/db/schemas/workouts"
import { requireTeamPermission } from "@/utils/team-auth"
import { getSessionFromCookie } from "@/utils/auth"
import {
	getEventScoreEntryData,
	saveCompetitionScore,
	saveCompetitionScores,
	deleteCompetitionScore,
} from "@/server/competition-scores"
import type { WorkoutScoreInfo } from "@/server/logs"

/* -------------------------------------------------------------------------- */
/*                        Competition Score Schemas                           */
/* -------------------------------------------------------------------------- */

const getEventScoreEntryDataSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	divisionId: z.string().optional(),
})

const roundScoreSchema = z.object({
	score: z.string(),
	parts: z.tuple([z.string(), z.string()]).optional(),
})

const workoutInfoSchema = z.object({
	scheme: z.string(),
	scoreType: z.string().nullable(),
	repsPerRound: z.number().nullable(),
	roundsToScore: z.number().nullable(),
	timeCap: z.number().nullable(),
	tiebreakScheme: z.string().nullable().optional(),
})

const saveCompetitionScoreSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	workoutId: z.string().min(1),
	registrationId: z.string().min(1),
	userId: z.string().min(1),
	divisionId: z.string().nullable(),
	score: z.string(),
	scoreStatus: z.enum(SCORE_STATUS_VALUES),
	tieBreakScore: z.string().nullable().optional(),
	secondaryScore: z.string().nullable().optional(),
	roundScores: z.array(roundScoreSchema).optional(),
	workout: workoutInfoSchema.optional(),
})

const saveCompetitionScoresSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	workoutId: z.string().min(1),
	scores: z.array(
		z.object({
			registrationId: z.string().min(1),
			userId: z.string().min(1),
			divisionId: z.string().nullable(),
			score: z.string(),
			scoreStatus: z.enum(SCORE_STATUS_VALUES),
			tieBreakScore: z.string().nullable().optional(),
			secondaryScore: z.string().nullable().optional(),
		}),
	),
})

const deleteCompetitionScoreSchema = z.object({
	organizingTeamId: z.string().min(1),
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	userId: z.string().min(1),
})

/* -------------------------------------------------------------------------- */
/*                        Competition Score Functions                         */
/* -------------------------------------------------------------------------- */

/**
 * Get athletes and existing scores for a competition event
 */
export const getEventScoreEntryDataFn = createServerFn({ method: "POST" })
	.validator(getEventScoreEntryDataSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const data = await getEventScoreEntryData({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				competitionTeamId: input.organizingTeamId,
				divisionId: input.divisionId,
			})

			return { success: true, data }
		} catch (error) {
			console.error("Failed to get event score entry data:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get event score entry data")
		}
	})

/**
 * Save a single athlete's competition score
 */
export const saveCompetitionScoreFn = createServerFn({ method: "POST" })
	.validator(saveCompetitionScoreSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const session = await getSessionFromCookie()
			if (!session?.user?.id) {
				throw new Error("Must be logged in")
			}

			const result = await saveCompetitionScore({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				workoutId: input.workoutId,
				registrationId: input.registrationId,
				userId: input.userId,
				divisionId: input.divisionId,
				score: input.score,
				scoreStatus: input.scoreStatus,
				tieBreakScore: input.tieBreakScore,
				secondaryScore: input.secondaryScore,
				roundScores: input.roundScores,
				workout: input.workout as WorkoutScoreInfo | undefined,
				enteredBy: session.user.id,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to save competition score:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to save competition score")
		}
	})

/**
 * Batch save multiple competition scores
 */
export const saveCompetitionScoresFn = createServerFn({ method: "POST" })
	.validator(saveCompetitionScoresSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const session = await getSessionFromCookie()
			if (!session?.user?.id) {
				throw new Error("Must be logged in")
			}

			const result = await saveCompetitionScores({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				competitionTeamId: input.organizingTeamId,
				workoutId: input.workoutId,
				scores: input.scores,
				enteredBy: session.user.id,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to save competition scores:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to save competition scores")
		}
	})

/**
 * Delete a competition score
 */
export const deleteCompetitionScoreFn = createServerFn({ method: "POST" })
	.validator(deleteCompetitionScoreSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteCompetitionScore({
				trackWorkoutId: input.trackWorkoutId,
				userId: input.userId,
				competitionTeamId: input.organizingTeamId,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to delete competition score:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to delete competition score")
		}
	})
