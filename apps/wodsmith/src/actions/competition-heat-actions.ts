"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
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
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	name: z.string().min(1).max(100).optional(),
	laneCount: z.number().int().min(1).max(100).optional(),
	transitionMinutes: z.number().int().min(1).max(120).optional(),
	sortOrder: z.number().int().min(0).optional(),
})

const deleteVenueSchema = z.object({
	id: venueIdSchema,
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
	heatNumber: z.number().int().min(1).optional(), // Auto-increment if not provided
	venueId: venueIdSchema.nullable().optional(),
	scheduledTime: z.date().nullable().optional(),
	durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
	divisionId: z.string().nullable().optional(),
	notes: z.string().max(500).nullable().optional(),
})

const updateHeatSchema = z.object({
	id: heatIdSchema,
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	heatNumber: z.number().int().min(1).optional(),
	venueId: venueIdSchema.nullable().optional(),
	scheduledTime: z.date().nullable().optional(),
	divisionId: z.string().nullable().optional(),
	notes: z.string().max(500).nullable().optional(),
})

const deleteHeatSchema = z.object({
	id: heatIdSchema,
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
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	registrationId: z.string().startsWith("creg_", "Invalid registration ID"),
	laneNumber: z.number().int().min(1),
})

const removeFromHeatSchema = z.object({
	assignmentId: assignmentIdSchema,
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const updateAssignmentSchema = z.object({
	id: assignmentIdSchema,
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	laneNumber: z.number().int().min(1),
})

const moveAssignmentSchema = z.object({
	assignmentId: assignmentIdSchema,
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	targetHeatId: heatIdSchema,
	targetLaneNumber: z.number().int().min(1),
})

const bulkAssignSchema = z.object({
	heatId: heatIdSchema,
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
/*                           Venue Actions                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition venue
 */
export const createVenueAction = createServerAction()
	.input(createVenueSchema)
	.handler(async ({ input }) => {
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

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: venue }
		} catch (error) {
			console.error("Failed to create venue:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to create venue")
		}
	})

/**
 * Update a competition venue
 */
export const updateVenueAction = createServerAction()
	.input(updateVenueSchema)
	.handler(async ({ input }) => {
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

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to update venue:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to update venue")
		}
	})

/**
 * Delete a competition venue
 */
export const deleteVenueAction = createServerAction()
	.input(deleteVenueSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteVenue(input.id)

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to delete venue:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to delete venue")
		}
	})

/**
 * Get all venues for a competition (public)
 */
export const getVenuesAction = createServerAction()
	.input(getVenuesSchema)
	.handler(async ({ input }) => {
		try {
			const venues = await getCompetitionVenues(input.competitionId)
			return { success: true, data: venues }
		} catch (error) {
			console.error("Failed to get venues:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get venues")
		}
	})

/* -------------------------------------------------------------------------- */
/*                            Heat Actions                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a new heat
 */
export const createHeatAction = createServerAction()
	.input(createHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			// Auto-increment heat number if not provided
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

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: heat }
		} catch (error) {
			console.error("Failed to create heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to create heat")
		}
	})

/**
 * Update a heat
 */
export const updateHeatAction = createServerAction()
	.input(updateHeatSchema)
	.handler(async ({ input }) => {
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

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to update heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to update heat")
		}
	})

/**
 * Delete a heat
 */
export const deleteHeatAction = createServerAction()
	.input(deleteHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteHeat(input.id)

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to delete heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to delete heat")
		}
	})

/**
 * Bulk create heats for a workout
 */
export const bulkCreateHeatsAction = createServerAction()
	.input(bulkCreateHeatsSchema)
	.handler(async ({ input }) => {
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

			revalidatePath(`/compete/organizer/${input.competitionId}/schedule`)

			return { success: true, data: heats }
		} catch (error) {
			console.error("Failed to bulk create heats:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to create heats")
		}
	})

/**
 * Get heats for a workout (public)
 */
export const getHeatsForWorkoutAction = createServerAction()
	.input(getHeatsForWorkoutSchema)
	.handler(async ({ input }) => {
		try {
			const heats = await getHeatsForWorkout(input.trackWorkoutId)
			return { success: true, data: heats }
		} catch (error) {
			console.error("Failed to get heats:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get heats")
		}
	})

/**
 * Get all heats for a competition (public schedule view)
 */
export const getHeatsForCompetitionAction = createServerAction()
	.input(getHeatsForCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			const heats = await getHeatsForCompetition(input.competitionId)
			return { success: true, data: heats }
		} catch (error) {
			console.error("Failed to get competition heats:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get competition heats")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Assignment Actions                                  */
/* -------------------------------------------------------------------------- */

/**
 * Assign a registration to a heat lane
 */
export const assignToHeatAction = createServerAction()
	.input(assignToHeatSchema)
	.handler(async ({ input }) => {
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

			revalidatePath("/compete/organizer")

			return { success: true, data: assignment }
		} catch (error) {
			console.error("Failed to assign to heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to assign to heat")
		}
	})

/**
 * Remove an assignment from a heat
 */
export const removeFromHeatAction = createServerAction()
	.input(removeFromHeatSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await removeFromHeat(input.assignmentId)

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to remove from heat:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to remove from heat")
		}
	})

/**
 * Update a lane assignment
 */
export const updateAssignmentAction = createServerAction()
	.input(updateAssignmentSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateAssignment({
				id: input.id,
				laneNumber: input.laneNumber,
			})

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to update assignment:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to update assignment")
		}
	})

/**
 * Bulk assign registrations to a heat
 */
export const bulkAssignToHeatAction = createServerAction()
	.input(bulkAssignSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const assignments = await bulkAssignToHeat(
				input.heatId,
				input.assignments,
			)

			revalidatePath("/compete/organizer")

			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to bulk assign:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to bulk assign to heat")
		}
	})

/**
 * Get unassigned registrations for a workout
 */
export const getUnassignedRegistrationsAction = createServerAction()
	.input(getUnassignedSchema)
	.handler(async ({ input }) => {
		try {
			const registrations = await getUnassignedRegistrations(
				input.competitionId,
				input.trackWorkoutId,
			)
			return { success: true, data: registrations }
		} catch (error) {
			console.error("Failed to get unassigned registrations:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to get unassigned registrations")
		}
	})

/**
 * Move an assignment to a different heat/lane
 * Handles cross-heat moves by removing from old heat and assigning to new
 */
export const moveAssignmentAction = createServerAction()
	.input(moveAssignmentSchema)
	.handler(async ({ input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			// Get current assignment to find registrationId
			const { getAssignment } = await import("@/server/competition-heats")
			const currentAssignment = await getAssignment(input.assignmentId)

			if (!currentAssignment) {
				throw new ZSAError("NOT_FOUND", "Assignment not found")
			}

			// If same heat, just update lane
			if (currentAssignment.heatId === input.targetHeatId) {
				await updateAssignment({
					id: input.assignmentId,
					laneNumber: input.targetLaneNumber,
				})
			} else {
				// Different heat: remove from old, add to new
				await removeFromHeat(input.assignmentId)
				await assignToHeat({
					heatId: input.targetHeatId,
					registrationId: currentAssignment.registrationId,
					laneNumber: input.targetLaneNumber,
				})
			}

			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to move assignment:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("ERROR", "Failed to move assignment")
		}
	})
