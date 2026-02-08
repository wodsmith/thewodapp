/**
 * Competition Events Server Functions for TanStack Start
 * Handles CRUD operations for competition event submission windows
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionEventsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const upsertCompetitionEventsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	events: z
		.array(
			z.object({
				trackWorkoutId: z.string().min(1, "Track workout ID is required"),
				submissionOpensAt: z.string().nullable().optional(),
				submissionClosesAt: z.string().nullable().optional(),
			}),
		)
		.min(1, "At least one event required"),
})

const deleteCompetitionEventInputSchema = z.object({
	eventId: z.string().min(1, "Event ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Require team permission or throw error
 * Site admins bypass this check
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new Error("Not authenticated")
	}

	// Site admins have all permissions
	if (session.user?.role === ROLES_ENUM.ADMIN) return

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) {
		throw new Error("Team not found or access denied")
	}

	if (!team.permissions.includes(permission)) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all competition events for a competition (authenticated)
 * Returns event settings including submission windows
 */
export const getCompetitionEventsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionEventsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get all events for this competition
		const events = await db
			.select({
				id: competitionEventsTable.id,
				competitionId: competitionEventsTable.competitionId,
				trackWorkoutId: competitionEventsTable.trackWorkoutId,
				submissionOpensAt: competitionEventsTable.submissionOpensAt,
				submissionClosesAt: competitionEventsTable.submissionClosesAt,
				createdAt: competitionEventsTable.createdAt,
				updatedAt: competitionEventsTable.updatedAt,
			})
			.from(competitionEventsTable)
			.where(eq(competitionEventsTable.competitionId, data.competitionId))

		return { events }
	})

/**
 * Get competition events for public viewing
 * Used on public schedule/workouts pages to show submission windows
 * No authentication required
 */
export const getPublicCompetitionEventsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionEventsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify competition exists and is published
		const competition = await db
			.select({
				id: competitionsTable.id,
				status: competitionsTable.status,
				competitionType: competitionsTable.competitionType,
				startDate: competitionsTable.startDate,
				timezone: competitionsTable.timezone,
			})
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (competition.length === 0 || competition[0].status !== "published") {
			return { events: [], competitionStarted: false }
		}

		// Check if competition has started
		const compData = competition[0]
		const now = new Date()
		const startDateInTz = new Date(`${compData.startDate}T00:00:00`)
		const competitionStarted = now >= startDateInTz

		// Get all events for this competition
		const events = await db
			.select({
				id: competitionEventsTable.id,
				competitionId: competitionEventsTable.competitionId,
				trackWorkoutId: competitionEventsTable.trackWorkoutId,
				submissionOpensAt: competitionEventsTable.submissionOpensAt,
				submissionClosesAt: competitionEventsTable.submissionClosesAt,
			})
			.from(competitionEventsTable)
			.where(eq(competitionEventsTable.competitionId, data.competitionId))

		return { events, competitionStarted }
	})

/**
 * Bulk upsert competition events with submission windows
 * Creates or updates event records for each workout
 */
export const upsertCompetitionEventsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		upsertCompetitionEventsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify competition exists and belongs to team
		const competition = await db
			.select({ id: competitionsTable.id })
			.from(competitionsTable)
			.where(
				and(
					eq(competitionsTable.id, data.competitionId),
					eq(competitionsTable.organizingTeamId, data.teamId),
				),
			)
			.limit(1)

		if (competition.length === 0) {
			throw new Error("Competition not found or access denied")
		}

		// Upsert each event (D1 doesn't support batch upsert well)
		const upsertedIds: string[] = []
		for (const event of data.events) {
			const [result] = await db
				.insert(competitionEventsTable)
				.values({
					competitionId: data.competitionId,
					trackWorkoutId: event.trackWorkoutId,
					submissionOpensAt: event.submissionOpensAt ?? null,
					submissionClosesAt: event.submissionClosesAt ?? null,
				})
				.onConflictDoUpdate({
					target: [
						competitionEventsTable.competitionId,
						competitionEventsTable.trackWorkoutId,
					],
					set: {
						submissionOpensAt: event.submissionOpensAt ?? null,
						submissionClosesAt: event.submissionClosesAt ?? null,
						updatedAt: new Date(),
					},
				})
				.returning({ id: competitionEventsTable.id })

			if (result) {
				upsertedIds.push(result.id)
			}
		}

		return { success: true, upsertedCount: upsertedIds.length }
	})

/**
 * Delete a competition event
 * Removes submission window configuration for a specific event
 */
export const deleteCompetitionEventFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		deleteCompetitionEventInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Verify event exists and belongs to team's competition
		const event = await db
			.select({
				eventId: competitionEventsTable.id,
				competitionId: competitionEventsTable.competitionId,
			})
			.from(competitionEventsTable)
			.innerJoin(
				competitionsTable,
				eq(competitionEventsTable.competitionId, competitionsTable.id),
			)
			.where(
				and(
					eq(competitionEventsTable.id, data.eventId),
					eq(competitionsTable.organizingTeamId, data.teamId),
				),
			)
			.limit(1)

		if (event.length === 0) {
			throw new Error("Event not found or access denied")
		}

		// Delete the event
		await db
			.delete(competitionEventsTable)
			.where(eq(competitionEventsTable.id, data.eventId))

		return { success: true }
	})
