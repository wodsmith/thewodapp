/**
 * @fileoverview Result entry tools for the Operations Agent.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"

import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scoresTable } from "@/db/schemas/scores"
import {
	WORKOUT_SCHEME_VALUES,
	TIEBREAK_SCHEME_VALUES,
} from "@/db/schemas/workouts"

/**
 * Enter a result for an athlete on a specific event.
 */
export const enterResult = createTool({
	id: "enter-result",
	description:
		"Enter or update a competition result for an athlete. The score format depends on the workout scheme.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		eventId: z.string().describe("The event (track workout) ID"),
		registrationId: z.string().describe("The athlete's registration ID"),
		scoreValue: z
			.number()
			.describe(
				"Score value encoded as integer: Time in ms, Rounds+Reps as rounds*100000+reps, Load in grams",
			),
		status: z
			.enum(["scored", "cap", "dq", "withdrawn"])
			.default("scored")
			.describe("Score status"),
		tiebreakValue: z
			.number()
			.optional()
			.describe("Tiebreak value (same encoding as scoreValue)"),
		tiebreakScheme: z
			.enum(TIEBREAK_SCHEME_VALUES)
			.optional()
			.describe("Scheme for tiebreak value"),
		secondaryValue: z
			.number()
			.optional()
			.describe("Secondary value for capped athletes (reps completed)"),
	}),
	execute: async (inputData, context) => {
		const {
			competitionId,
			eventId,
			registrationId,
			scoreValue,
			status,
			tiebreakValue,
			tiebreakScheme,
			secondaryValue,
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

		// Get registration to get userId
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: and(
					eq(competitionRegistrationsTable.id, registrationId),
					eq(competitionRegistrationsTable.eventId, competitionId),
				),
			},
		)

		if (!registration) {
			return { error: "Registration not found for this competition" }
		}

		// Get event/workout info
		const eventRaw = await db.query.trackWorkoutsTable.findFirst({
			where: eq(trackWorkoutsTable.id, eventId),
			with: {
				workout: true,
			},
		})

		if (!eventRaw) {
			return { error: "Event not found" }
		}

		// Type assertion for relation data
		type EventWithWorkout = typeof eventRaw & {
			workout: {
				scheme: string
				scoreType: string | null
				timeCap: number | null
			}
		}
		const event = eventRaw as EventWithWorkout

		// Calculate status order for sorting
		const statusOrder =
			status === "scored" ? 0 : status === "cap" ? 1 : status === "dq" ? 2 : 3

		// Check if score already exists
		const existing = await db.query.scoresTable.findFirst({
			where: and(
				eq(scoresTable.competitionEventId, eventId),
				eq(scoresTable.userId, registration.userId),
			),
		})

		if (existing) {
			// Update existing score
			await db
				.update(scoresTable)
				.set({
					scoreValue,
					status,
					statusOrder,
					tiebreakValue: tiebreakValue ?? null,
					tiebreakScheme: tiebreakScheme ?? null,
					secondaryValue: secondaryValue ?? null,
					updatedAt: new Date(),
				})
				.where(eq(scoresTable.id, existing.id))

			return {
				success: true,
				scoreId: existing.id,
				action: "updated",
			}
		}

		// Create new score
		const [score] = await db
			.insert(scoresTable)
			.values({
				userId: registration.userId,
				teamId: competition.organizingTeamId,
				workoutId: event.workoutId,
				competitionEventId: eventId,
				scheme: event.workout.scheme as (typeof WORKOUT_SCHEME_VALUES)[number],
				scoreType: (event.workout.scoreType ?? "max") as "max" | "min",
				scoreValue,
				status,
				statusOrder,
				tiebreakValue: tiebreakValue ?? null,
				tiebreakScheme: tiebreakScheme ?? null,
				secondaryValue: secondaryValue ?? null,
				timeCapMs: event.workout.timeCap
					? event.workout.timeCap * 60 * 1000
					: null,
				recordedAt: new Date(),
			})
			.returning()

		return {
			success: true,
			scoreId: score.id,
			action: "created",
		}
	},
})

/**
 * Get results for an event.
 */
export const getEventResults = createTool({
	id: "get-event-results",
	description: "Get all results entered for a specific competition event.",
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

		// Get all registrations for filtering
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

		const userIds = registrations.map((r) => r.userId)

		// Get scores for this event
		const scores = await db.query.scoresTable.findMany({
			where: eq(scoresTable.competitionEventId, eventId),
		})

		// Filter to registered users
		const filteredScores = scores.filter((s) => userIds.includes(s.userId))

		// Build results with athlete info
		const results = filteredScores.map((s) => {
			const registration = registrations.find((r) => r.userId === s.userId)
			return {
				scoreId: s.id,
				registrationId: registration?.id,
				userId: s.userId,
				athleteName: registration?.user
					? `${registration.user.firstName || ""} ${registration.user.lastName || ""}`.trim() ||
						registration.user.email
					: "Unknown",
				divisionId: registration?.divisionId,
				divisionName: registration?.division?.label,
				teamName: registration?.teamName,
				scoreValue: s.scoreValue,
				status: s.status,
				tiebreakValue: s.tiebreakValue,
				secondaryValue: s.secondaryValue,
			}
		})

		// Sort by statusOrder and scoreValue
		results.sort((a, b) => {
			const aStatus = a.status === "scored" ? 0 : a.status === "cap" ? 1 : 2
			const bStatus = b.status === "scored" ? 0 : b.status === "cap" ? 1 : 2
			if (aStatus !== bStatus) return aStatus - bStatus
			return (a.scoreValue ?? 0) - (b.scoreValue ?? 0)
		})

		return {
			results,
			totalResults: results.length,
			totalRegistrations: registrations.length,
		}
	},
})

/**
 * Delete a result.
 */
export const deleteResult = createTool({
	id: "delete-result",
	description: "Delete a competition result.",
	inputSchema: z.object({
		scoreId: z.string().describe("The score ID to delete"),
	}),
	execute: async (inputData, context) => {
		const { scoreId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get score
		const score = await db.query.scoresTable.findFirst({
			where: eq(scoresTable.id, scoreId),
		})

		if (!score) {
			return { error: "Score not found" }
		}

		// Verify it's a competition score
		if (!score.competitionEventId) {
			return { error: "Not a competition score" }
		}

		// Get event to verify competition access
		const eventRaw = await db.query.trackWorkoutsTable.findFirst({
			where: eq(trackWorkoutsTable.id, score.competitionEventId),
			with: {
				track: {
					with: {
						competition: true,
					},
				},
			},
		})

		// Type assertion for nested relations
		type EventWithTrack = typeof eventRaw & {
			track?: {
				competition?: {
					organizingTeamId: string
				}
			}
		}
		const event = eventRaw as EventWithTrack | undefined

		if (!event?.track?.competition) {
			return { error: "Event not found" }
		}

		// Verify team access
		if (teamId && event.track.competition.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		// Delete score
		await db.delete(scoresTable).where(eq(scoresTable.id, scoreId))

		return {
			success: true,
			message: "Result deleted successfully",
		}
	},
})
