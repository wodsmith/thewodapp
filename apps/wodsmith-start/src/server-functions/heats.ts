import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"
import {
	assignToHeat,
	bulkAssignToHeat,
	bulkCreateHeats,
	createHeat,
	createVenue,
	deleteHeat,
	deleteVenue,
	getCompetitionVenues,
	getHeatsForCompetition,
	getHeatsForWorkout,
	getNextHeatNumber,
	getUnassignedRegistrations,
	removeFromHeat,
	updateAssignment,
	updateHeat,
	updateVenue,
} from "@/server/competition-heats"

/* -------------------------------------------------------------------------- */
/*                              Schemas                                        */
/* -------------------------------------------------------------------------- */

const venueIdSchema = z.string().startsWith("cvenue_", "Invalid venue ID")
const heatIdSchema = z.string().startsWith("cheat_", "Invalid heat ID")
const assignmentIdSchema = z
	.string()
	.startsWith("chasgn_", "Invalid assignment ID")

// Venue schemas
const createVenueSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	name: z.string().min(1, "Name is required").max(100),
	laneCount: z.number().int().min(1).max(100).default(3),
	transitionMinutes: z.number().int().min(1).max(120).default(3),
	sortOrder: z.number().int().min(0).optional(),
})

const updateVenueSchema = z.object({
	id: venueIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	name: z.string().min(1).max(100).optional(),
	laneCount: z.number().int().min(1).max(100).optional(),
	transitionMinutes: z.number().int().min(1).max(120).optional(),
	sortOrder: z.number().int().min(0).optional(),
})

const deleteVenueSchema = z.object({
	id: venueIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const getVenuesSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

// Heat schemas
const createHeatSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	heatNumber: z.number().int().min(1).optional(),
	venueId: venueIdSchema.nullable().optional(),
	scheduledTime: z.date().nullable().optional(),
	durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
	divisionId: z.string().nullable().optional(),
	notes: z.string().max(500).nullable().optional(),
})

const updateHeatSchema = z.object({
	id: heatIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	heatNumber: z.number().int().min(1).optional(),
	venueId: venueIdSchema.nullable().optional(),
	scheduledTime: z.date().nullable().optional(),
	divisionId: z.string().nullable().optional(),
	notes: z.string().max(500).nullable().optional(),
})

const deleteHeatSchema = z.object({
	id: heatIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const getHeatsForWorkoutSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const getHeatsForCompetitionSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const bulkCreateHeatsSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	count: z.number().int().min(1).max(50),
	venueId: venueIdSchema.nullable().optional(),
	divisionId: z.string().nullable().optional(),
	startTime: z.date().nullable().optional(),
	durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
})

// Assignment schemas
const assignToHeatSchema = z.object({
	heatId: heatIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	registrationId: z.string().startsWith("creg_", "Invalid registration ID"),
	laneNumber: z.number().int().min(1),
})

const removeFromHeatSchema = z.object({
	assignmentId: assignmentIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const updateAssignmentSchema = z.object({
	id: assignmentIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	laneNumber: z.number().int().min(1),
})

const moveAssignmentSchema = z.object({
	assignmentId: assignmentIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	targetHeatId: heatIdSchema,
	targetLaneNumber: z.number().int().min(1),
})

const bulkAssignSchema = z.object({
	heatId: heatIdSchema,
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	assignments: z.array(
		z.object({
			registrationId: z.string().startsWith("creg_", "Invalid registration ID"),
			laneNumber: z.number().int().min(1),
		}),
	),
})

const getUnassignedSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

/* -------------------------------------------------------------------------- */
/*                           Venue Functions                                   */
/* -------------------------------------------------------------------------- */

export const createVenueFn = createServerFn({ method: "POST" })
	.validator(createVenueSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const venue = await createVenue({
				competitionId: input.competitionId,
				name: input.name,
				laneCount: input.laneCount,
				transitionMinutes: input.transitionMinutes,
				sortOrder: input.sortOrder,
			})

			return { success: true, data: venue }
		} catch (error) {
			console.error("Failed to create venue:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to create venue")
		}
	})

export const updateVenueFn = createServerFn({ method: "POST" })
	.validator(updateVenueSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateVenue({
				id: input.id,
				name: input.name,
				laneCount: input.laneCount,
				transitionMinutes: input.transitionMinutes,
				sortOrder: input.sortOrder,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to update venue:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update venue")
		}
	})

export const deleteVenueFn = createServerFn({ method: "POST" })
	.validator(deleteVenueSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteVenue(input.id)

			return { success: true }
		} catch (error) {
			console.error("Failed to delete venue:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to delete venue")
		}
	})

export const getVenuesFn = createServerFn({ method: "POST" })
	.validator(getVenuesSchema)
	.handler(async ({ data: input }) => {
		try {
			const venues = await getCompetitionVenues(input.competitionId)
			return { success: true, data: venues }
		} catch (error) {
			console.error("Failed to get venues:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get venues")
		}
	})

/* -------------------------------------------------------------------------- */
/*                            Heat Functions                                   */
/* -------------------------------------------------------------------------- */

export const createHeatFn = createServerFn({ method: "POST" })
	.validator(createHeatSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const heatNumber =
				input.heatNumber ?? (await getNextHeatNumber(input.trackWorkoutId))

			const heat = await createHeat({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				heatNumber,
				venueId: input.venueId,
				scheduledTime: input.scheduledTime,
				durationMinutes: input.durationMinutes,
				divisionId: input.divisionId,
				notes: input.notes,
			})

			return { success: true, data: heat }
		} catch (error) {
			console.error("Failed to create heat:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to create heat")
		}
	})

export const updateHeatFn = createServerFn({ method: "POST" })
	.validator(updateHeatSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateHeat({
				id: input.id,
				heatNumber: input.heatNumber,
				venueId: input.venueId,
				scheduledTime: input.scheduledTime,
				divisionId: input.divisionId,
				notes: input.notes,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to update heat:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update heat")
		}
	})

export const deleteHeatFn = createServerFn({ method: "POST" })
	.validator(deleteHeatSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteHeat(input.id)

			return { success: true }
		} catch (error) {
			console.error("Failed to delete heat:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to delete heat")
		}
	})

export const bulkCreateHeatsFn = createServerFn({ method: "POST" })
	.validator(bulkCreateHeatsSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const heats = await bulkCreateHeats({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				count: input.count,
				venueId: input.venueId,
				divisionId: input.divisionId,
				startTime: input.startTime,
				durationMinutes: input.durationMinutes,
			})

			return { success: true, data: heats }
		} catch (error) {
			console.error("Failed to bulk create heats:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to create heats")
		}
	})

export const getHeatsForWorkoutFn = createServerFn({ method: "POST" })
	.validator(getHeatsForWorkoutSchema)
	.handler(async ({ data: input }) => {
		try {
			const heats = await getHeatsForWorkout(input.trackWorkoutId)
			return { success: true, data: heats }
		} catch (error) {
			console.error("Failed to get heats:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get heats")
		}
	})

export const getHeatsForCompetitionFn = createServerFn({ method: "POST" })
	.validator(getHeatsForCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			const heats = await getHeatsForCompetition(input.competitionId)
			return { success: true, data: heats }
		} catch (error) {
			console.error("Failed to get competition heats:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition heats")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Assignment Functions                                */
/* -------------------------------------------------------------------------- */

export const assignToHeatFn = createServerFn({ method: "POST" })
	.validator(assignToHeatSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const assignment = await assignToHeat({
				heatId: input.heatId,
				registrationId: input.registrationId,
				laneNumber: input.laneNumber,
			})

			return { success: true, data: assignment }
		} catch (error) {
			console.error("Failed to assign to heat:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to assign to heat")
		}
	})

export const removeFromHeatFn = createServerFn({ method: "POST" })
	.validator(removeFromHeatSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await removeFromHeat(input.assignmentId)

			return { success: true }
		} catch (error) {
			console.error("Failed to remove from heat:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to remove from heat")
		}
	})

export const updateAssignmentFn = createServerFn({ method: "POST" })
	.validator(updateAssignmentSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateAssignment({
				id: input.id,
				laneNumber: input.laneNumber,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to update assignment:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update assignment")
		}
	})

export const bulkAssignToHeatFn = createServerFn({ method: "POST" })
	.validator(bulkAssignSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const assignments = await bulkAssignToHeat(
				input.heatId,
				input.assignments,
			)

			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to bulk assign:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to bulk assign to heat")
		}
	})

export const getUnassignedRegistrationsFn = createServerFn({ method: "POST" })
	.validator(getUnassignedSchema)
	.handler(async ({ data: input }) => {
		try {
			const registrations = await getUnassignedRegistrations(
				input.competitionId,
				input.trackWorkoutId,
			)
			return { success: true, data: registrations }
		} catch (error) {
			console.error("Failed to get unassigned registrations:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get unassigned registrations")
		}
	})

export const moveAssignmentFn = createServerFn({ method: "POST" })
	.validator(moveAssignmentSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const { getAssignment } = await import("@/server/competition-heats")
			const currentAssignment = await getAssignment(input.assignmentId)

			if (!currentAssignment) {
				throw new Error("Assignment not found")
			}

			if (currentAssignment.heatId === input.targetHeatId) {
				await updateAssignment({
					id: input.assignmentId,
					laneNumber: input.targetLaneNumber,
				})
			} else {
				await removeFromHeat(input.assignmentId)
				await assignToHeat({
					heatId: input.targetHeatId,
					registrationId: currentAssignment.registrationId,
					laneNumber: input.targetLaneNumber,
				})
			}

			return { success: true }
		} catch (error) {
			console.error("Failed to move assignment:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to move assignment")
		}
	})
