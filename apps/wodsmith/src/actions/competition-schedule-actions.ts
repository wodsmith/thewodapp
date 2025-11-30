"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	assignToHeat,
	autoGenerateHeatsForWorkout,
	checkInAthlete,
	createCompetitionFloor,
	createHeat,
	deleteCompetitionFloor,
	deleteHeat,
	deleteHeatsForWorkout,
	getAthleteSchedule,
	getCompetitionFloors,
	getCompetitionHeats,
	getCompetitionScheduleSummary,
	getHeatsForWorkout,
	removeFromHeat,
	undoCheckIn,
	updateCompetitionFloor,
	updateHeat,
	updateLaneAssignment,
} from "@/server/competition-schedule"
import { getCompetition } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// FLOOR ACTIONS
// ============================================================================

export const getCompetitionFloorsAction = createServerAction()
	.input(z.object({ competitionId: z.string() }))
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}
		return getCompetitionFloors(input.competitionId)
	})

export const createCompetitionFloorAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			name: z.string().min(1).max(255),
			capacity: z.number().int().min(1).max(100),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const floor = await createCompetitionFloor(input)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
		return floor
	})

export const updateCompetitionFloorAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			floorId: z.string(),
			name: z.string().min(1).max(255).optional(),
			capacity: z.number().int().min(1).max(100).optional(),
			position: z.number().int().min(0).optional(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await updateCompetitionFloor({
			floorId: input.floorId,
			name: input.name,
			capacity: input.capacity,
			position: input.position,
		})

		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

export const deleteCompetitionFloorAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			floorId: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await deleteCompetitionFloor(input.floorId)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

// ============================================================================
// HEAT ACTIONS
// ============================================================================

export const getCompetitionHeatsAction = createServerAction()
	.input(z.object({ competitionId: z.string() }))
	.handler(async ({ input }) => {
		return getCompetitionHeats(input.competitionId)
	})

export const getHeatsForWorkoutAction = createServerAction()
	.input(z.object({ trackWorkoutId: z.string() }))
	.handler(async ({ input }) => {
		return getHeatsForWorkout(input.trackWorkoutId)
	})

export const createHeatAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			trackWorkoutId: z.string(),
			floorId: z.string(),
			heatNumber: z.number().int().min(1),
			startTime: z.coerce.date(),
			targetDivisionId: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const heat = await createHeat(input)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
		return heat
	})

export const updateHeatAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			heatId: z.string(),
			startTime: z.coerce.date().optional(),
			floorId: z.string().optional(),
			targetDivisionId: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await updateHeat({
			heatId: input.heatId,
			startTime: input.startTime,
			floorId: input.floorId,
			targetDivisionId: input.targetDivisionId,
		})

		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

export const deleteHeatAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			heatId: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await deleteHeat(input.heatId)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

export const deleteHeatsForWorkoutAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			trackWorkoutId: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await deleteHeatsForWorkout(input.trackWorkoutId)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

// ============================================================================
// HEAT GENERATION
// ============================================================================

export const autoGenerateHeatsAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			trackWorkoutId: z.string(),
			floorId: z.string(),
			startTime: z.coerce.date(),
			heatDurationMinutes: z.number().int().min(1).max(120),
			transitionMinutes: z.number().int().min(0).max(60).optional(),
			keepDivisionsPure: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const heats = await autoGenerateHeatsForWorkout(input)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
		return heats
	})

// ============================================================================
// ASSIGNMENT ACTIONS
// ============================================================================

export const assignToHeatAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			heatId: z.string(),
			registrationId: z.string(),
			laneNumber: z.number().int().min(1).nullable().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const assignment = await assignToHeat({
			heatId: input.heatId,
			registrationId: input.registrationId,
			laneNumber: input.laneNumber,
		})

		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
		return assignment
	})

export const removeFromHeatAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			assignmentId: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await removeFromHeat(input.assignmentId)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

export const updateLaneAssignmentAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			assignmentId: z.string(),
			laneNumber: z.number().int().min(1).nullable(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await updateLaneAssignment({
			assignmentId: input.assignmentId,
			laneNumber: input.laneNumber,
		})

		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

export const checkInAthleteAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			assignmentId: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await checkInAthlete(input.assignmentId)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

export const undoCheckInAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string(),
			assignmentId: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const competition = await getCompetition(input.competitionId)
		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		await undoCheckIn(input.assignmentId)
		revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)
	})

// ============================================================================
// PUBLIC SCHEDULE ACTIONS
// ============================================================================

export const getAthleteScheduleAction = createServerAction()
	.input(z.object({ registrationId: z.string() }))
	.handler(async ({ input }) => {
		return getAthleteSchedule(input.registrationId)
	})

export const getCompetitionScheduleSummaryAction = createServerAction()
	.input(z.object({ competitionId: z.string() }))
	.handler(async ({ input }) => {
		return getCompetitionScheduleSummary(input.competitionId)
	})
