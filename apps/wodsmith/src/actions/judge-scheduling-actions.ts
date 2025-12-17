"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	assignJudgeToHeat,
	bulkAssignJudgesToHeat,
	clearHeatJudgeAssignments,
	copyJudgeAssignmentsToHeat,
	copyJudgeAssignmentsToRemainingHeats,
	getJudgeHeatAssignments,
	getJudgeVolunteers,
	moveJudgeAssignment,
	removeJudgeFromHeat,
} from "@/server/judge-scheduling"
import { requireTeamPermission } from "@/utils/team-auth"

/* -------------------------------------------------------------------------- */
/*                              Schemas                                        */
/* -------------------------------------------------------------------------- */

const membershipIdSchema = z
	.string()
	.startsWith("tmem_", "Invalid membership ID")
const heatIdSchema = z.string().startsWith("cheat_", "Invalid heat ID")
const assignmentIdSchema = z
	.string()
	.startsWith("chvol_", "Invalid assignment ID")
const competitionTeamIdSchema = z
	.string()
	.startsWith("team_", "Invalid team ID")

const getJudgeVolunteersSchema = z.object({
	competitionTeamId: competitionTeamIdSchema,
	organizingTeamId: competitionTeamIdSchema,
})

const getJudgeHeatAssignmentsSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const assignJudgeToHeatSchema = z.object({
	heatId: heatIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	membershipId: membershipIdSchema,
	laneNumber: z.number().int().min(1),
	position: z.string().nullable().optional(),
	instructions: z.string().nullable().optional(),
})

const bulkAssignJudgesToHeatSchema = z.object({
	heatId: heatIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	assignments: z.array(
		z.object({
			membershipId: membershipIdSchema,
			laneNumber: z.number().int().min(1),
			position: z.string().nullable().optional(),
			instructions: z.string().nullable().optional(),
		}),
	),
})

const removeJudgeFromHeatSchema = z.object({
	assignmentId: assignmentIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const moveJudgeAssignmentSchema = z.object({
	assignmentId: assignmentIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	targetHeatId: heatIdSchema,
	targetLaneNumber: z.number().int().min(1),
})

const copyJudgeAssignmentsToHeatSchema = z.object({
	sourceHeatId: heatIdSchema,
	targetHeatId: heatIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const copyJudgeAssignmentsToRemainingHeatsSchema = z.object({
	sourceHeatId: heatIdSchema,
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const clearHeatJudgeAssignmentsSchema = z.object({
	heatId: heatIdSchema,
	organizingTeamId: competitionTeamIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

/* -------------------------------------------------------------------------- */
/*                        Judge Scheduling Actions                             */
/* -------------------------------------------------------------------------- */

/**
 * Get all judge volunteers for a competition team
 */
export const getJudgeVolunteersAction = createServerAction()
	.input(getJudgeVolunteersSchema)
	.handler(async ({ input }) => {
		try {
			// Public read access - no permission check needed
			const db = getDb()
			const judges = await getJudgeVolunteers(db, input.competitionTeamId)
			return { success: true, data: judges }
		} catch (error) {
			console.error("Failed to get judge volunteers:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get judge volunteers")
		}
	})

/**
 * Get all judge assignments for a track workout (event)
 */
export const getJudgeHeatAssignmentsAction = createServerAction()
	.input(getJudgeHeatAssignmentsSchema)
	.handler(async ({ input }) => {
		try {
			// Public read access - no permission check needed
			const db = getDb()
			const assignments = await getJudgeHeatAssignments(
				db,
				input.trackWorkoutId,
			)
			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to get judge heat assignments:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get judge heat assignments")
		}
	})

/**
 * Assign a judge to a heat lane
 */
export const assignJudgeToHeatAction = createServerAction()
	.input(assignJudgeToHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			const assignment = await assignJudgeToHeat(db, {
				heatId: input.heatId,
				membershipId: input.membershipId,
				laneNumber: input.laneNumber,
				position: input.position ?? null,
				instructions: input.instructions ?? null,
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: assignment }
		} catch (error) {
			console.error("Failed to assign judge to heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to assign judge to heat")
		}
	})

/**
 * Bulk assign judges to a heat
 */
export const bulkAssignJudgesToHeatAction = createServerAction()
	.input(bulkAssignJudgesToHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			const assignments = await bulkAssignJudgesToHeat(db, {
				heatId: input.heatId,
				assignments: input.assignments.map((a) => ({
					membershipId: a.membershipId,
					laneNumber: a.laneNumber,
					position: a.position ?? null,
					instructions: a.instructions ?? null,
				})),
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to bulk assign judges:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to bulk assign judges to heat")
		}
	})

/**
 * Remove a judge assignment from a heat
 */
export const removeJudgeFromHeatAction = createServerAction()
	.input(removeJudgeFromHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await removeJudgeFromHeat(db, input.assignmentId)

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true }
		} catch (error) {
			console.error("Failed to remove judge from heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to remove judge from heat")
		}
	})

/**
 * Move a judge assignment to a different heat/lane
 */
export const moveJudgeAssignmentAction = createServerAction()
	.input(moveJudgeAssignmentSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await moveJudgeAssignment(db, {
				assignmentId: input.assignmentId,
				targetHeatId: input.targetHeatId,
				targetLaneNumber: input.targetLaneNumber,
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true }
		} catch (error) {
			console.error("Failed to move judge assignment:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to move judge assignment")
		}
	})

/**
 * Copy judge assignments from one heat to another
 */
export const copyJudgeAssignmentsToHeatAction = createServerAction()
	.input(copyJudgeAssignmentsToHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			const assignments = await copyJudgeAssignmentsToHeat(db, {
				sourceHeatId: input.sourceHeatId,
				targetHeatId: input.targetHeatId,
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to copy judge assignments to heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to copy judge assignments to heat")
		}
	})

/**
 * Copy judge assignments from a heat to all remaining heats in the event
 */
export const copyJudgeAssignmentsToRemainingHeatsAction = createServerAction()
	.input(copyJudgeAssignmentsToRemainingHeatsSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			const results = await copyJudgeAssignmentsToRemainingHeats(db, {
				sourceHeatId: input.sourceHeatId,
				trackWorkoutId: input.trackWorkoutId,
			})

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: results }
		} catch (error) {
			console.error(
				"Failed to copy judge assignments to remaining heats:",
				error,
			)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError(
				"ERROR",
				"Failed to copy judge assignments to remaining heats",
			)
		}
	})

/**
 * Clear all judge assignments from a heat
 */
export const clearHeatJudgeAssignmentsAction = createServerAction()
	.input(clearHeatJudgeAssignmentsSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			const db = getDb()
			await clearHeatJudgeAssignments(db, input.heatId)

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true }
		} catch (error) {
			console.error("Failed to clear heat judge assignments:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to clear heat judge assignments")
		}
	})
