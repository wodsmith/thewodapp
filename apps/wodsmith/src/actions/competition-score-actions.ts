"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
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

/* -------------------------------------------------------------------------- */
/*                        Competition Score Schemas                           */
/* -------------------------------------------------------------------------- */

const getEventScoreEntryDataSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	divisionId: z.string().optional(),
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
/*                        Competition Score Actions                           */
/* -------------------------------------------------------------------------- */

/**
 * Get athletes and existing scores for a competition event
 */
export const getEventScoreEntryDataAction = createServerAction()
	.input(getEventScoreEntryDataSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const data = await getEventScoreEntryData({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				divisionId: input.divisionId,
			})

			return { success: true, data }
		} catch (error) {
			console.error("Failed to get event score entry data:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get event score entry data")
		}
	})

/**
 * Save a single athlete's competition score
 */
export const saveCompetitionScoreAction = createServerAction()
	.input(saveCompetitionScoreSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const session = await getSessionFromCookie()
			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
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
				enteredBy: session.user.id,
			})

			// Revalidate competition pages
			revalidatePath(`/compete/organizer/${input.competitionId}`)
			revalidatePath(`/compete/organizer/${input.competitionId}/events`)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to save competition score:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to save competition score")
		}
	})

/**
 * Batch save multiple competition scores
 */
export const saveCompetitionScoresAction = createServerAction()
	.input(saveCompetitionScoresSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const session = await getSessionFromCookie()
			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
			}

			const result = await saveCompetitionScores({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				workoutId: input.workoutId,
				scores: input.scores,
				enteredBy: session.user.id,
			})

			// Revalidate competition pages
			revalidatePath(`/compete/organizer/${input.competitionId}`)
			revalidatePath(`/compete/organizer/${input.competitionId}/events`)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to save competition scores:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to save competition scores")
		}
	})

/**
 * Delete a competition score
 */
export const deleteCompetitionScoreAction = createServerAction()
	.input(deleteCompetitionScoreSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteCompetitionScore({
				trackWorkoutId: input.trackWorkoutId,
				userId: input.userId,
			})

			// Revalidate competition pages
			revalidatePath(`/compete/organizer/${input.competitionId}`)
			revalidatePath(`/compete/organizer/${input.competitionId}/events`)

			return { success: true }
		} catch (error) {
			console.error("Failed to delete competition score:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to delete competition score")
		}
	})
