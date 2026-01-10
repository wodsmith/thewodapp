/**
 * @fileoverview Event (workout) management tools for the Setup Agent.
 *
 * Events in WODsmith competitions are workouts assigned to a programming track.
 * Each competition has one track, and events are trackWorkouts within that track.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"

import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import {
	trackWorkoutsTable,
	programmingTracksTable,
	PROGRAMMING_TRACK_TYPE,
} from "@/db/schemas/programming"
import { workouts as workoutsTable, WORKOUT_SCHEME_VALUES } from "@/db/schemas/workouts"

/**
 * List all events for a competition.
 */
export const listEvents = createTool({
	id: "list-events",
	description:
		"List all events (workouts) for a competition with their status, order, and heat counts.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
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

		// Get programming track
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		if (!track) {
			return { events: [], message: "No programming track found for this competition" }
		}

		// Get events with workout details
		const events = await db
			.select({
				id: trackWorkoutsTable.id,
				trackOrder: trackWorkoutsTable.trackOrder,
				eventStatus: trackWorkoutsTable.eventStatus,
				heatStatus: trackWorkoutsTable.heatStatus,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				notes: trackWorkoutsTable.notes,
				workoutId: workoutsTable.id,
				workoutName: workoutsTable.name,
				workoutScheme: workoutsTable.scheme,
				workoutTimeCap: workoutsTable.timeCap,
				workoutDescription: workoutsTable.description,
			})
			.from(trackWorkoutsTable)
			.innerJoin(workoutsTable, eq(trackWorkoutsTable.workoutId, workoutsTable.id))
			.where(eq(trackWorkoutsTable.trackId, track.id))
			.orderBy(trackWorkoutsTable.trackOrder)

		return {
			trackId: track.id,
			events: events.map((e) => ({
				id: e.id,
				order: e.trackOrder,
				eventStatus: e.eventStatus,
				heatStatus: e.heatStatus,
				pointsMultiplier: e.pointsMultiplier,
				notes: e.notes,
				workout: {
					id: e.workoutId,
					name: e.workoutName,
					scheme: e.workoutScheme,
					timeCap: e.workoutTimeCap,
					description: e.workoutDescription,
				},
			})),
		}
	},
})

/**
 * Create a new event (workout) for a competition.
 */
export const createEvent = createTool({
	id: "create-event",
	description:
		"Create a new event (workout) for a competition. This creates the workout and adds it to the competition's programming track.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		name: z.string().min(1).max(255).describe("Event/workout name"),
		description: z
			.string()
			.max(5000)
			.optional()
			.describe("Workout description with movements and rep schemes"),
		scheme: z
			.enum(WORKOUT_SCHEME_VALUES)
			.describe("Scoring scheme: time, time-with-cap, rounds-reps, reps, load, points, pass-fail"),
		timeCap: z
			.number()
			.min(1)
			.optional()
			.describe("Time cap in minutes (required for time-with-cap, optional for others)"),
		pointsMultiplier: z
			.number()
			.min(100)
			.default(100)
			.describe("Points multiplier (100 = 1x, 200 = 2x for finals)"),
		order: z
			.number()
			.optional()
			.describe("Event order (1, 2, 3...). If not provided, adds at the end."),
	}),
	execute: async (inputData, context) => {
		const { competitionId, name, description, scheme, timeCap, pointsMultiplier, order } = inputData
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

		// Get or create programming track
		let track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		if (!track) {
			const [newTrack] = await db
				.insert(programmingTracksTable)
				.values({
					name: `${competition.name} Events`,
					type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
					ownerTeamId: teamId,
					competitionId,
					isPublic: 0,
				})
				.returning()
			track = newTrack
		}

		// Get max order if not provided
		let finalOrder = order
		if (finalOrder === undefined) {
			const existing = await db.query.trackWorkoutsTable.findMany({
				where: eq(trackWorkoutsTable.trackId, track.id),
				orderBy: (tw, { desc }) => [desc(tw.trackOrder)],
				limit: 1,
			})
			finalOrder = existing.length > 0 ? existing[0].trackOrder + 1 : 1
		}

		// Create the workout
		const workoutId = `workout_${createId()}`
		const [workout] = await db
			.insert(workoutsTable)
			.values({
				id: workoutId,
				name,
				description: description ?? "",
				scheme,
				timeCap: timeCap ?? null,
				teamId: teamId ?? null,
				scope: "private",
			})
			.returning()

		// Create the track workout (event)
		const [event] = await db
			.insert(trackWorkoutsTable)
			.values({
				trackId: track.id,
				workoutId: workout.id,
				trackOrder: finalOrder,
				pointsMultiplier,
				eventStatus: "draft",
				heatStatus: "draft",
			})
			.returning()

		return {
			success: true,
			event: {
				id: event.id,
				order: event.trackOrder,
				eventStatus: event.eventStatus,
				workout: {
					id: workout.id,
					name: workout.name,
					scheme: workout.scheme,
					timeCap: workout.timeCap,
				},
			},
		}
	},
})

/**
 * Update an event's details.
 */
export const updateEvent = createTool({
	id: "update-event",
	description:
		"Update an event's workout details, status, or order.",
	inputSchema: z.object({
		eventId: z.string().describe("The event (track workout) ID"),
		name: z.string().min(1).max(255).optional().describe("Event/workout name"),
		description: z.string().max(5000).optional().describe("Workout description"),
		scheme: z.enum(WORKOUT_SCHEME_VALUES).optional().describe("Scoring scheme"),
		timeCap: z.number().min(1).nullable().optional().describe("Time cap in minutes"),
		pointsMultiplier: z.number().min(100).optional().describe("Points multiplier"),
		order: z.number().min(1).optional().describe("Event order"),
		eventStatus: z.enum(["draft", "published"]).optional().describe("Event visibility status"),
		heatStatus: z.enum(["draft", "published"]).optional().describe("Heat schedule visibility"),
		notes: z.string().max(1000).optional().describe("Event-specific notes"),
	}),
	execute: async (inputData, context) => {
		const {
			eventId,
			name,
			description,
			scheme,
			timeCap,
			pointsMultiplier,
			order,
			eventStatus,
			heatStatus,
			notes,
		} = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get event with track and competition info
		const eventRaw = await db.query.trackWorkoutsTable.findFirst({
			where: eq(trackWorkoutsTable.id, eventId),
			with: {
				track: {
					with: {
						competition: true,
					},
				},
				workout: true,
			},
		})

		if (!eventRaw) {
			return { error: "Event not found" }
		}

		// Type assertion for nested relations
		type EventWithRelations = typeof eventRaw & {
			track?: { competition?: { organizingTeamId: string } }
			workout?: { name: string; description: string; scheme: string; timeCap: number | null }
		}
		const event = eventRaw as EventWithRelations

		// Verify team access
		if (teamId && event.track?.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		// Update workout if needed
		if (name !== undefined || description !== undefined || scheme !== undefined || timeCap !== undefined) {
			await db
				.update(workoutsTable)
				.set({
					...(name !== undefined && { name }),
					...(description !== undefined && { description }),
					...(scheme !== undefined && { scheme }),
					...(timeCap !== undefined && { timeCap }),
					updatedAt: new Date(),
				})
				.where(eq(workoutsTable.id, event.workoutId))
		}

		// Update track workout if needed
		if (
			pointsMultiplier !== undefined ||
			order !== undefined ||
			eventStatus !== undefined ||
			heatStatus !== undefined ||
			notes !== undefined
		) {
			await db
				.update(trackWorkoutsTable)
				.set({
					...(pointsMultiplier !== undefined && { pointsMultiplier }),
					...(order !== undefined && { trackOrder: order }),
					...(eventStatus !== undefined && { eventStatus }),
					...(heatStatus !== undefined && { heatStatus }),
					...(notes !== undefined && { notes }),
					updatedAt: new Date(),
				})
				.where(eq(trackWorkoutsTable.id, eventId))
		}

		return {
			success: true,
			eventId,
			updated: {
				name,
				description,
				scheme,
				timeCap,
				pointsMultiplier,
				order,
				eventStatus,
				heatStatus,
				notes,
			},
		}
	},
})

/**
 * Delete an event from a competition.
 */
export const deleteEvent = createTool({
	id: "delete-event",
	description:
		"Delete an event from a competition. This removes the track workout and optionally the underlying workout.",
	inputSchema: z.object({
		eventId: z.string().describe("The event (track workout) ID to delete"),
		deleteWorkout: z
			.boolean()
			.default(true)
			.describe("Also delete the underlying workout (default true)"),
	}),
	execute: async (inputData, context) => {
		const { eventId, deleteWorkout } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get event with track and competition info
		const eventRaw = await db.query.trackWorkoutsTable.findFirst({
			where: eq(trackWorkoutsTable.id, eventId),
			with: {
				track: {
					with: {
						competition: true,
					},
				},
			},
		})

		if (!eventRaw) {
			return { error: "Event not found" }
		}

		// Type assertion for nested relations
		type EventWithTrack = typeof eventRaw & {
			track?: { competition?: { organizingTeamId: string } }
		}
		const event = eventRaw as EventWithTrack

		// Verify team access
		if (teamId && event.track?.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		const workoutId = eventRaw.workoutId

		// Delete the track workout
		await db.delete(trackWorkoutsTable).where(eq(trackWorkoutsTable.id, eventId))

		// Optionally delete the workout
		if (deleteWorkout) {
			await db.delete(workoutsTable).where(eq(workoutsTable.id, workoutId))
		}

		return {
			success: true,
			message: "Event deleted successfully",
			deletedWorkout: deleteWorkout,
		}
	},
})

/**
 * Analyze event balance across time domains and scoring schemes.
 */
export const analyzeEventBalance = createTool({
	id: "analyze-event-balance",
	description:
		"Analyze the balance of events in a competition across time domains, movement patterns, and equipment. Returns gaps and recommendations.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID to analyze"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get programming track
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		if (!track) {
			return {
				eventCount: 0,
				analysis: { timeDomains: { short: 0, medium: 0, long: 0 }, schemes: {} },
				gaps: ["No programming track found - create events first"],
				recommendations: ["Start by adding a programming track and events"],
			}
		}

		// Get events with workout details
		const trackWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				scheme: workoutsTable.scheme,
				timeCap: workoutsTable.timeCap,
			})
			.from(trackWorkoutsTable)
			.innerJoin(workoutsTable, eq(trackWorkoutsTable.workoutId, workoutsTable.id))
			.where(eq(trackWorkoutsTable.trackId, track.id))

		// Analyze time domains and schemes
		const timeDomains = { short: 0, medium: 0, long: 0 }
		const schemes: Record<string, number> = {}

		for (const tw of trackWorkouts) {
			const scheme = tw.scheme ?? "time"
			schemes[scheme] = (schemes[scheme] ?? 0) + 1

			const timeCap = tw.timeCap
			if (timeCap) {
				if (timeCap < 5) timeDomains.short++
				else if (timeCap <= 15) timeDomains.medium++
				else timeDomains.long++
			} else if (scheme === "load") {
				timeDomains.short++
			} else {
				timeDomains.medium++
			}
		}

		// Generate gaps and recommendations
		const gaps: string[] = []
		const recommendations: string[] = []
		const eventCount = trackWorkouts.length

		if (eventCount === 0) {
			gaps.push("No events have been created yet")
			recommendations.push("Start by creating 3-5 events covering different time domains")
		} else {
			if (timeDomains.short === 0 && eventCount >= 3) {
				gaps.push("Missing short time domain events (<5 min)")
				recommendations.push("Add a sprint workout like a max lift or short couplet")
			}
			if (timeDomains.medium === 0 && eventCount >= 3) {
				gaps.push("Missing medium time domain events (5-15 min)")
				recommendations.push("Add a medium-length workout testing multiple modalities")
			}
			if (timeDomains.long === 0 && eventCount >= 3) {
				gaps.push("Missing long time domain events (>15 min)")
				recommendations.push("Add a longer chipper or AMRAP to test endurance")
			}
			if (!schemes["load"] && eventCount >= 4) {
				gaps.push("No max load events")
				recommendations.push("Consider adding a 1RM or complex to test strength")
			}
			if (eventCount < 3) {
				recommendations.push(`Consider adding ${3 - eventCount} more events for a well-rounded competition`)
			}
		}

		return {
			eventCount,
			analysis: { timeDomains, schemes },
			gaps: gaps.length > 0 ? gaps : ["Event balance looks good!"],
			recommendations,
		}
	},
})
