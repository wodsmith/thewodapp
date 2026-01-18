/**
 * @fileoverview Consolidated CRUD tools following manage_X pattern.
 *
 * Following MCP Rule #5: Respect the Token Budget
 * - Consolidate 6 tools per entity → 1 manage tool + 1 suggest tool
 * - Reduces tool count from 46 → ~20
 * - Each manage tool handles list/create/update/delete via action parameter
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { scalingLevelsTable, scalingGroupsTable } from "@/db/schemas/scaling"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { waiversTable } from "@/db/schemas/waivers"
import { createId } from "@paralleldrive/cuid2"
import {
	CommonErrors,
	createToolSuccess,
	createToolError,
	ErrorCode,
} from "../utils/tool-responses"
import { parseCompetitionSettings } from "@/types/competitions"

/**
 * Unified division management tool.
 * Replaces: listDivisions, getDivision, createDivision, updateDivision, deleteDivision
 * Keep separate: suggestDivisions (high-value outcome tool)
 */
export const manageDivisions = createTool({
	id: "manage-divisions",
	description: `
    Manage competition divisions (list, create, update, delete).

    Examples:
      // List all divisions
      manageDivisions({
        competitionId: "comp_123",
        action: "list"
      })

      // Create a division
      manageDivisions({
        competitionId: "comp_123",
        action: "create",
        divisionName: "Rx Men",
        feeDollars: 75,
        description: "Advanced male athletes - prescribed weights"
      })

      // Update a division
      manageDivisions({
        competitionId: "comp_123",
        action: "update",
        divisionId: "div_456",
        feeDollars: 80
      })

      // Delete a division
      manageDivisions({
        competitionId: "comp_123",
        action: "delete",
        divisionId: "div_456"
      })
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID"),
		action: z.enum(["list", "create", "update", "delete"]).describe("Operation to perform"),
		divisionId: z.string().optional().describe("Required for update/delete"),
		divisionName: z.string().optional().describe("Required for create, optional for update"),
		feeDollars: z.number().int().min(0).optional().describe("Registration fee in dollars"),
		description: z.string().max(500).optional().describe("Division description"),
		position: z.number().int().min(0).optional().describe("Display order position"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Verify competition access
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			// Get scaling group ID
			const settings = parseCompetitionSettings(competition.settings)
			const scalingGroupId = settings?.divisions?.scalingGroupId

			if (!scalingGroupId && inputData.action !== "list") {
				return createToolError({
					error: ErrorCode.DEPENDENCY_MISSING,
					message: "No scaling group configured for this competition",
					suggestion: "The competition needs a scaling group before you can manage divisions. Use setupNewCompetition to create a complete competition.",
					nextActions: ["setupNewCompetition"],
				})
			}

			// Handle action
			switch (inputData.action) {
				case "list": {
					if (!scalingGroupId) {
						return createToolSuccess({
							data: { divisions: [] },
							message: "No divisions configured yet",
							nextActions: ["setupNewCompetition", "createDivision"],
						})
					}

					const divisions = await db.query.scalingLevelsTable.findMany({
						where: eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
						orderBy: (d, { asc }) => [asc(d.position)],
					})

					return createToolSuccess({
						data: {
							divisions: divisions.map((d) => ({
								id: d.id,
								name: d.label,
								position: d.position,
								teamSize: d.teamSize,
							})),
						},
						message: `Found ${divisions.length} divisions`,
					})
				}

				case "create": {
					if (!inputData.divisionName) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "divisionName is required when creating a division",
							suggestion: "Provide divisionName parameter",
							example: { divisionName: "Rx Men" },
						})
					}

					const divisionId = `slvl_${createId()}`
					const maxPosition = await db.query.scalingLevelsTable.findMany({
						where: eq(scalingLevelsTable.scalingGroupId, scalingGroupId!),
						orderBy: (d, { desc }) => [desc(d.position)],
						limit: 1,
					})

					const position = inputData.position !== undefined
						? inputData.position
						: (maxPosition[0]?.position ?? 0) + 1

					await db.insert(scalingLevelsTable).values({
						id: divisionId,
						scalingGroupId: scalingGroupId!,
						label: inputData.divisionName,
						position,
						teamSize: 1, // Default to individual
					})

					return createToolSuccess({
						data: {
							divisionId,
							name: inputData.divisionName,
							position,
						},
						message: `Division "${inputData.divisionName}" created`,
						nextActions: ["validateCompetition", "publishCompetition"],
					})
				}

				case "update": {
					if (!inputData.divisionId) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "divisionId is required when updating a division",
							suggestion: "Use manageDivisions with action='list' to see division IDs",
							nextActions: ["listDivisions"],
						})
					}

					const updates: any = {}
					if (inputData.divisionName) updates.label = inputData.divisionName
					if (inputData.position !== undefined) updates.position = inputData.position

					await db
						.update(scalingLevelsTable)
						.set(updates)
						.where(eq(scalingLevelsTable.id, inputData.divisionId))

					return createToolSuccess({
						data: { divisionId: inputData.divisionId, updated: updates },
						message: `Division updated`,
					})
				}

				case "delete": {
					if (!inputData.divisionId) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "divisionId is required when deleting a division",
							suggestion: "Use manageDivisions with action='list' to see division IDs",
							nextActions: ["listDivisions"],
						})
					}

					await db
						.delete(scalingLevelsTable)
						.where(eq(scalingLevelsTable.id, inputData.divisionId))

					return createToolSuccess({
						data: { divisionId: inputData.divisionId },
						message: `Division deleted`,
					})
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Operation failed"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to ${inputData.action} division: ${message}`,
				suggestion: "Check the parameters and try again",
				nextActions: ["manageDivisions"],
			})
		}
	},
})

/**
 * Unified event management tool.
 * Replaces: listEvents, getEvent, createEvent, updateEvent, deleteEvent
 * Keep separate: analyzeEventBalance (high-value outcome tool)
 */
export const manageEvents = createTool({
	id: "manage-events",
	description: `
    Manage competition events/workouts (list, create, update, delete).

    Examples:
      // List all events
      manageEvents({
        competitionId: "comp_123",
        action: "list"
      })

      // Create an event
      manageEvents({
        competitionId: "comp_123",
        action: "create",
        eventName: "Event 1 - Fran",
        workoutDescription: "21-15-9 Thrusters (95/65) and Pull-ups",
        scheme: "time",
        timeCap: 10
      })

      // Update an event
      manageEvents({
        competitionId: "comp_123",
        action: "update",
        trackWorkoutId: "twkt_123",
        workoutDescription: "Updated: 21-15-9 Thrusters (95/65) and Chest-to-Bar Pull-ups",
        timeCap: 12
      })

      // Delete an event
      manageEvents({
        competitionId: "comp_123",
        action: "delete",
        trackWorkoutId: "twkt_123"
      })
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID"),
		action: z.enum(["list", "create", "update", "delete"]).describe("Operation to perform"),
		trackWorkoutId: z.string().optional().describe("Required for update/delete"),
		eventName: z.string().optional().describe("Required for create"),
		workoutDescription: z.string().optional().describe("Workout details/movements"),
		scheme: z.enum(["time", "time-with-cap", "rounds-reps", "reps", "load", "points", "pass-fail"]).optional(),
		timeCap: z.number().min(1).max(180).optional().describe("Time cap in minutes"),
		eventStatus: z.enum(["draft", "published"]).optional().describe("Event visibility status"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Verify competition access
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			// Get or create programming track
			let track = await db.query.programmingTracksTable.findFirst({
				where: eq(programmingTracksTable.competitionId, inputData.competitionId),
			})

			if (!track && inputData.action === "create") {
				const trackId = `ptrk_${createId()}`
				await db.insert(programmingTracksTable).values({
					id: trackId,
					teamId,
					name: `${competition.name} Track`,
					description: "Competition programming track",
					competitionId: inputData.competitionId,
				})
				track = await db.query.programmingTracksTable.findFirst({
					where: eq(programmingTracksTable.id, trackId),
				})
			}

			// Handle action
			switch (inputData.action) {
				case "list": {
					if (!track) {
						return createToolSuccess({
							data: { events: [] },
							message: "No events created yet",
							nextActions: ["createEvent"],
						})
					}

					const events = await db
						.select({
							trackWorkout: trackWorkoutsTable,
							workout: workoutsTable,
						})
						.from(trackWorkoutsTable)
						.innerJoin(workoutsTable, eq(trackWorkoutsTable.workoutId, workoutsTable.id))
						.where(eq(trackWorkoutsTable.trackId, track.id))
						.orderBy(trackWorkoutsTable.trackOrder)

					return createToolSuccess({
						data: {
							events: events.map((e) => ({
								trackWorkoutId: e.trackWorkout.id,
								workoutId: e.workout.id,
								name: e.workout.name,
								description: e.workout.description,
								scheme: e.workout.scheme,
								timeCap: e.workout.timeCap,
								status: e.trackWorkout.eventStatus,
								order: e.trackWorkout.trackOrder,
							})),
						},
						message: `Found ${events.length} events`,
					})
				}

				case "create": {
					if (!inputData.eventName) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "eventName is required when creating an event",
							suggestion: "Provide eventName parameter",
							example: { eventName: "Event 1 - Fran" },
						})
					}

					if (!track) {
						return createToolError({
							error: ErrorCode.DEPENDENCY_MISSING,
							message: "No programming track found for this competition",
							suggestion: "This shouldn't happen - track is auto-created. Try again.",
							nextActions: ["manageEvents"],
						})
					}

					// Get max track order
					const maxOrder = await db.query.trackWorkoutsTable.findMany({
						where: eq(trackWorkoutsTable.trackId, track.id),
						orderBy: (tw, { desc }) => [desc(tw.trackOrder)],
						limit: 1,
					})

					const trackOrder = (maxOrder[0]?.trackOrder ?? -1) + 1

					// Create workout
					const workoutId = `wkt_${createId()}`
					await db.insert(workoutsTable).values({
						id: workoutId,
						teamId,
						name: inputData.eventName,
						description: inputData.workoutDescription,
						scheme: inputData.scheme || "time",
						timeCap: inputData.timeCap,
					})

					// Add to track
					const trackWorkoutId = `twkt_${createId()}`
					await db.insert(trackWorkoutsTable).values({
						id: trackWorkoutId,
						trackId: track.id,
						workoutId,
						trackOrder,
						eventStatus: inputData.eventStatus || "draft",
					})

					return createToolSuccess({
						data: {
							trackWorkoutId,
							workoutId,
							name: inputData.eventName,
							order: trackOrder,
						},
						message: `Event "${inputData.eventName}" created`,
						nextActions: ["analyzeEventBalance", "publishCompetition"],
					})
				}

				case "update": {
					if (!inputData.trackWorkoutId) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "trackWorkoutId is required when updating an event",
							suggestion: "Use manageEvents with action='list' to see event IDs",
							nextActions: ["listEvents"],
						})
					}

					// Get track workout to find workout ID
					const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
						where: eq(trackWorkoutsTable.id, inputData.trackWorkoutId),
					})

					if (!trackWorkout) {
						return createToolError({
							error: ErrorCode.RESOURCE_NOT_FOUND,
							message: `Event '${inputData.trackWorkoutId}' not found`,
							suggestion: "Check the event ID",
							nextActions: ["listEvents"],
						})
					}

					// Update workout
					const workoutUpdates: any = {}
					if (inputData.workoutDescription) workoutUpdates.description = inputData.workoutDescription
					if (inputData.scheme) workoutUpdates.scheme = inputData.scheme
					if (inputData.timeCap) workoutUpdates.timeCap = inputData.timeCap

					if (Object.keys(workoutUpdates).length > 0) {
						await db
							.update(workoutsTable)
							.set(workoutUpdates)
							.where(eq(workoutsTable.id, trackWorkout.workoutId))
					}

					// Update track workout
					const trackUpdates: any = {}
					if (inputData.eventStatus) trackUpdates.eventStatus = inputData.eventStatus

					if (Object.keys(trackUpdates).length > 0) {
						await db
							.update(trackWorkoutsTable)
							.set(trackUpdates)
							.where(eq(trackWorkoutsTable.id, inputData.trackWorkoutId))
					}

					return createToolSuccess({
						data: {
							trackWorkoutId: inputData.trackWorkoutId,
							updated: { ...workoutUpdates, ...trackUpdates },
						},
						message: `Event updated`,
					})
				}

				case "delete": {
					if (!inputData.trackWorkoutId) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "trackWorkoutId is required when deleting an event",
							suggestion: "Use manageEvents with action='list' to see event IDs",
							nextActions: ["listEvents"],
						})
					}

					// Get track workout to find workout ID
					const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
						where: eq(trackWorkoutsTable.id, inputData.trackWorkoutId),
					})

					if (!trackWorkout) {
						return createToolError({
							error: ErrorCode.RESOURCE_NOT_FOUND,
							message: `Event '${inputData.trackWorkoutId}' not found`,
							suggestion: "Check the event ID",
							nextActions: ["listEvents"],
						})
					}

					// Delete track workout (workout itself may be shared, so keep it)
					await db
						.delete(trackWorkoutsTable)
						.where(eq(trackWorkoutsTable.id, inputData.trackWorkoutId))

					return createToolSuccess({
						data: { trackWorkoutId: inputData.trackWorkoutId },
						message: `Event deleted`,
					})
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Operation failed"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to ${inputData.action} event: ${message}`,
				suggestion: "Check the parameters and try again",
				nextActions: ["manageEvents"],
			})
		}
	},
})

/**
 * Unified waiver management tool.
 * Replaces: listWaivers, getWaiver, updateWaiver, deleteWaiver
 * Keep separate: createWaiverSimple (template-based creation)
 */
export const manageWaivers = createTool({
	id: "manage-waivers",
	description: `
    Manage competition waivers (list, update, delete).

    Note: For creating waivers, use createWaiverSimple (template-based).

    Examples:
      // List all waivers
      manageWaivers({
        competitionId: "comp_123",
        action: "list"
      })

      // Update a waiver
      manageWaivers({
        competitionId: "comp_123",
        action: "update",
        waiverId: "wvr_456",
        isRequired: false
      })

      // Delete a waiver
      manageWaivers({
        competitionId: "comp_123",
        action: "delete",
        waiverId: "wvr_456"
      })
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID"),
		action: z.enum(["list", "update", "delete"]).describe("Operation to perform"),
		waiverId: z.string().optional().describe("Required for update/delete"),
		title: z.string().optional().describe("Waiver title"),
		isRequired: z.boolean().optional().describe("Athletes must sign to register"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Verify competition access
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			// Handle action
			switch (inputData.action) {
				case "list": {
					const waivers = await db.query.waiversTable.findMany({
						where: eq(waiversTable.competitionId, inputData.competitionId),
					})

					return createToolSuccess({
						data: {
							waivers: waivers.map((w) => ({
								id: w.id,
								title: w.title,
								isRequired: w.isRequired,
							})),
						},
						message: `Found ${waivers.length} waivers`,
					})
				}

				case "update": {
					if (!inputData.waiverId) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "waiverId is required when updating a waiver",
							suggestion: "Use manageWaivers with action='list' to see waiver IDs",
							nextActions: ["listWaivers"],
						})
					}

					const updates: any = {}
					if (inputData.title) updates.title = inputData.title
					if (inputData.isRequired !== undefined) updates.isRequired = inputData.isRequired

					await db
						.update(waiversTable)
						.set(updates)
						.where(eq(waiversTable.id, inputData.waiverId))

					return createToolSuccess({
						data: { waiverId: inputData.waiverId, updated: updates },
						message: `Waiver updated`,
					})
				}

				case "delete": {
					if (!inputData.waiverId) {
						return createToolError({
							error: ErrorCode.INVALID_INPUT,
							message: "waiverId is required when deleting a waiver",
							suggestion: "Use manageWaivers with action='list' to see waiver IDs",
							nextActions: ["listWaivers"],
						})
					}

					await db
						.delete(waiversTable)
						.where(eq(waiversTable.id, inputData.waiverId))

					return createToolSuccess({
						data: { waiverId: inputData.waiverId },
						message: `Waiver deleted`,
					})
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Operation failed"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to ${inputData.action} waiver: ${message}`,
				suggestion: "Check the parameters and try again",
				nextActions: ["manageWaivers"],
			})
		}
	},
})
