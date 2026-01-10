/**
 * @fileoverview Heat management tools for the Operations Agent.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"

import { getDb } from "@/db"
import {
	competitionsTable,
	competitionHeatsTable,
	competitionHeatAssignmentsTable,
	competitionRegistrationsTable,
} from "@/db/schemas/competitions"

/**
 * List heats for an event with athlete assignments.
 */
export const listHeats = createTool({
	id: "list-heats",
	description:
		"List all heats for a specific event with their athlete assignments and scheduled times.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		eventId: z.string().describe("The event (track workout) ID"),
	}),
	execute: async (inputData, context) => {
		const { competitionId, eventId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get heats for this event
		const heats = await db.query.competitionHeatsTable.findMany({
			where: and(
				eq(competitionHeatsTable.competitionId, competitionId),
				eq(competitionHeatsTable.trackWorkoutId, eventId),
			),
			orderBy: (h, { asc }) => [asc(h.heatNumber)],
			with: {
				venue: true,
				division: true,
				assignments: {
					with: {
						registration: {
							with: {
								user: true,
							},
						},
					},
				},
			},
		})

		// Type assertion for relation data (Drizzle's with option returns these)
		type HeatWithRelations = (typeof heats)[number] & {
			venue?: { id: string; name: string; laneCount: number } | null
			division?: { id: string; label: string } | null
			assignments?: Array<{
				id: string
				registrationId: string
				laneNumber: number
				registration?: {
					user?: {
						firstName: string | null
						lastName: string | null
						email: string | null
					}
				}
			}>
		}

		return {
			heats: (heats as HeatWithRelations[]).map((h) => ({
				id: h.id,
				heatNumber: h.heatNumber,
				scheduledTime: h.scheduledTime?.toISOString(),
				durationMinutes: h.durationMinutes,
				venue: h.venue
					? { id: h.venue.id, name: h.venue.name, laneCount: h.venue.laneCount }
					: null,
				division: h.division
					? { id: h.division.id, name: h.division.label }
					: null,
				schedulePublished: !!h.schedulePublishedAt,
				athletes:
					h.assignments?.map((a) => ({
						assignmentId: a.id,
						registrationId: a.registrationId,
						laneNumber: a.laneNumber,
						athleteName: a.registration?.user
							? `${a.registration.user.firstName || ""} ${a.registration.user.lastName || ""}`.trim() ||
								a.registration.user.email
							: "Unknown",
					})) ?? [],
			})),
		}
	},
})

/**
 * Create a new heat for an event.
 */
export const createHeat = createTool({
	id: "create-heat",
	description: "Create a new heat for a competition event.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		eventId: z.string().describe("The event (track workout) ID"),
		heatNumber: z.number().min(1).describe("Heat number (1, 2, 3...)"),
		scheduledTime: z
			.string()
			.datetime()
			.optional()
			.describe("Scheduled start time (ISO 8601)"),
		durationMinutes: z
			.number()
			.min(1)
			.optional()
			.describe("Expected duration in minutes"),
		venueId: z.string().optional().describe("Venue/floor ID for this heat"),
		divisionId: z
			.string()
			.optional()
			.describe("Division ID if heat is division-specific"),
	}),
	execute: async (inputData, context) => {
		const {
			competitionId,
			eventId,
			heatNumber,
			scheduledTime,
			durationMinutes,
			venueId,
			divisionId,
		} = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Check for duplicate heat number
		const existing = await db.query.competitionHeatsTable.findFirst({
			where: and(
				eq(competitionHeatsTable.trackWorkoutId, eventId),
				eq(competitionHeatsTable.heatNumber, heatNumber),
			),
		})

		if (existing) {
			return { error: `Heat ${heatNumber} already exists for this event` }
		}

		// Create heat
		const [heat] = await db
			.insert(competitionHeatsTable)
			.values({
				competitionId,
				trackWorkoutId: eventId,
				heatNumber,
				scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
				durationMinutes: durationMinutes ?? null,
				venueId: venueId ?? null,
				divisionId: divisionId ?? null,
			})
			.returning()

		return {
			success: true,
			heat: {
				id: heat.id,
				heatNumber: heat.heatNumber,
				scheduledTime: heat.scheduledTime?.toISOString(),
			},
		}
	},
})

/**
 * Assign an athlete to a heat.
 */
export const assignAthleteToHeat = createTool({
	id: "assign-athlete-to-heat",
	description: "Assign an athlete (registration) to a specific heat and lane.",
	inputSchema: z.object({
		heatId: z.string().describe("The heat ID"),
		registrationId: z.string().describe("The registration ID to assign"),
		laneNumber: z.number().min(1).describe("Lane number for the athlete"),
	}),
	execute: async (inputData, context) => {
		const { heatId, registrationId, laneNumber } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get heat with competition info
		const heat = await db.query.competitionHeatsTable.findFirst({
			where: eq(competitionHeatsTable.id, heatId),
		})

		if (!heat) {
			return { error: "Heat not found" }
		}

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, heat.competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Access denied" }
		}

		// Check if lane is already taken
		const existingLane =
			await db.query.competitionHeatAssignmentsTable.findFirst({
				where: and(
					eq(competitionHeatAssignmentsTable.heatId, heatId),
					eq(competitionHeatAssignmentsTable.laneNumber, laneNumber),
				),
			})

		if (existingLane) {
			return { error: `Lane ${laneNumber} is already assigned in this heat` }
		}

		// Check if athlete is already in this heat
		const existingAthlete =
			await db.query.competitionHeatAssignmentsTable.findFirst({
				where: and(
					eq(competitionHeatAssignmentsTable.heatId, heatId),
					eq(competitionHeatAssignmentsTable.registrationId, registrationId),
				),
			})

		if (existingAthlete) {
			return { error: "Athlete is already assigned to this heat" }
		}

		// Create assignment
		const [assignment] = await db
			.insert(competitionHeatAssignmentsTable)
			.values({
				heatId,
				registrationId,
				laneNumber,
			})
			.returning()

		return {
			success: true,
			assignment: {
				id: assignment.id,
				heatId: assignment.heatId,
				registrationId: assignment.registrationId,
				laneNumber: assignment.laneNumber,
			},
		}
	},
})

/**
 * Remove an athlete from a heat.
 */
export const removeAthleteFromHeat = createTool({
	id: "remove-athlete-from-heat",
	description: "Remove an athlete assignment from a heat.",
	inputSchema: z.object({
		assignmentId: z.string().describe("The heat assignment ID to remove"),
	}),
	execute: async (inputData, context) => {
		const { assignmentId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get assignment with heat and competition info
		const assignment = await db.query.competitionHeatAssignmentsTable.findFirst(
			{
				where: eq(competitionHeatAssignmentsTable.id, assignmentId),
				with: {
					heat: true,
				},
			},
		)

		if (!assignment) {
			return { error: "Assignment not found" }
		}

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, assignment.heat.competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Access denied" }
		}

		// Delete assignment
		await db
			.delete(competitionHeatAssignmentsTable)
			.where(eq(competitionHeatAssignmentsTable.id, assignmentId))

		return {
			success: true,
			message: "Athlete removed from heat",
		}
	},
})

/**
 * Delete a heat.
 */
export const deleteHeat = createTool({
	id: "delete-heat",
	description: "Delete a heat and all its athlete assignments.",
	inputSchema: z.object({
		heatId: z.string().describe("The heat ID to delete"),
	}),
	execute: async (inputData, context) => {
		const { heatId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get heat
		const heat = await db.query.competitionHeatsTable.findFirst({
			where: eq(competitionHeatsTable.id, heatId),
		})

		if (!heat) {
			return { error: "Heat not found" }
		}

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, heat.competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Access denied" }
		}

		// Delete heat (assignments cascade)
		await db
			.delete(competitionHeatsTable)
			.where(eq(competitionHeatsTable.id, heatId))

		return {
			success: true,
			message: "Heat deleted successfully",
		}
	},
})

/**
 * Get unassigned athletes for an event (not yet in any heat).
 */
export const getUnassignedAthletes = createTool({
	id: "get-unassigned-athletes",
	description:
		"Get list of athletes registered for a competition who are not yet assigned to any heat for a specific event.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		eventId: z.string().describe("The event (track workout) ID"),
		divisionId: z.string().optional().describe("Filter by division"),
	}),
	execute: async (inputData, context) => {
		const { competitionId, eventId, divisionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get all registrations
		const registrations = await db.query.competitionRegistrationsTable.findMany(
			{
				where: and(
					eq(competitionRegistrationsTable.eventId, competitionId),
					divisionId
						? eq(competitionRegistrationsTable.divisionId, divisionId)
						: undefined,
				),
				with: {
					user: true,
					division: true,
				},
			},
		)

		// Get heats for this event to find assigned athletes
		const heats = await db.query.competitionHeatsTable.findMany({
			where: eq(competitionHeatsTable.trackWorkoutId, eventId),
		})

		const heatIds = heats.map((h) => h.id)

		// Get all assignments for these heats
		const assignments =
			heatIds.length > 0
				? await db.query.competitionHeatAssignmentsTable.findMany({
						where: eq(competitionHeatAssignmentsTable.heatId, heatIds[0]),
					})
				: []

		const assignedRegistrationIds = new Set(
			assignments.map((a) => a.registrationId),
		)

		// Filter to unassigned
		const unassigned = registrations.filter(
			(r) => !assignedRegistrationIds.has(r.id),
		)

		return {
			unassignedAthletes: unassigned.map((r) => ({
				registrationId: r.id,
				userId: r.userId,
				athleteName: r.user
					? `${r.user.firstName || ""} ${r.user.lastName || ""}`.trim() ||
						r.user.email
					: "Unknown",
				divisionId: r.divisionId,
				divisionName: r.division?.label,
				teamName: r.teamName,
			})),
			totalUnassigned: unassigned.length,
		}
	},
})
