/**
 * Division Results Publishing Server Functions for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 *
 * Handles publishing/unpublishing division results for competitions.
 * Results publishing controls visibility of division leaderboards/results to athletes.
 *
 * Results are published per event+division combination, allowing granular control
 * over which event results are visible for each division.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"

// ============================================================================
// Types
// ============================================================================

/**
 * Status for a single event+division combination
 */
export interface EventDivisionResultStatus {
	eventId: string
	eventName: string
	eventPosition: number
	divisionId: string
	divisionLabel: string
	divisionPosition: number
	registrationCount: number
	scoredCount: number
	missingScoreCount: number
	resultsPublishedAt: Date | null
	isPublished: boolean
}

/**
 * Division summary for a specific event
 */
export interface DivisionResultStatus {
	divisionId: string
	label: string
	position: number
	registrationCount: number
	scoredCount: number
	missingScoreCount: number
	resultsPublishedAt: Date | null
	isPublished: boolean
}

/**
 * Response for getting division results status for a specific event
 */
export interface EventDivisionResultsStatusResponse {
	eventId: string
	eventName: string
	divisions: DivisionResultStatus[]
	publishedCount: number
	totalCount: number
}

/**
 * Response for getting all events' division results status
 */
export interface AllEventsResultsStatusResponse {
	events: EventDivisionResultsStatusResponse[]
	totalPublishedCount: number
	totalCombinations: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const getDivisionResultsStatusInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	organizingTeamId: z.string().min(1, "Organizing team ID is required"),
	eventId: z.string().min(1, "Event ID is required").optional(),
})

const publishDivisionResultsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	organizingTeamId: z.string().min(1, "Organizing team ID is required"),
	eventId: z.string().min(1, "Event ID is required"),
	divisionId: z.string().min(1, "Division ID is required"),
	publish: z.boolean(),
})

const publishAllDivisionResultsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	organizingTeamId: z.string().min(1, "Organizing team ID is required"),
	eventId: z.string().min(1, "Event ID is required"),
	publish: z.boolean(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * New schema structure for per-event+division results
 */
interface DivisionResultsSchema {
	[eventId: string]: {
		[divisionId: string]: {
			publishedAt: number | null
		}
	}
}

/**
 * Parse competition settings from JSON string
 */
function parseCompetitionSettings(settings: string | null): {
	divisions?: { scalingGroupId?: string }
	divisionResults?: DivisionResultsSchema
	[key: string]: unknown
} | null {
	if (!settings) return null
	try {
		return JSON.parse(settings)
	} catch {
		return null
	}
}

/**
 * Stringify competition settings to JSON
 */
function stringifyCompetitionSettings(
	settings: {
		divisions?: { scalingGroupId?: string }
		divisionResults?: DivisionResultsSchema
		[key: string]: unknown
	} | null,
): string | null {
	if (!settings) return null
	try {
		return JSON.stringify(settings)
	} catch {
		return null
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get division results publishing status for a competition.
 *
 * If eventId is provided, returns status for that specific event's divisions.
 * If eventId is not provided, returns status for all events.
 *
 * The eventId is the track_workout ID (the event in the competition schedule).
 */
export const getDivisionResultsStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getDivisionResultsStatusInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<
			EventDivisionResultsStatusResponse | AllEventsResultsStatusResponse
		> => {
			// Verify authentication
			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			// Check permission (site admins bypass)
			const isSiteAdmin = session.user?.role === ROLES_ENUM.ADMIN
			const team = session.teams?.find((t) => t.id === data.organizingTeamId)
			if (
				!isSiteAdmin &&
				!team?.permissions.includes(TEAM_PERMISSIONS.ACCESS_DASHBOARD)
			) {
				throw new Error("Missing required permission")
			}

			const db = getDb()

			// Get competition with settings
			const [competition] = await db
				.select()
				.from(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))

			if (!competition) {
				throw new Error("Competition not found")
			}

			if (competition.organizingTeamId !== data.organizingTeamId) {
				throw new Error("Competition does not belong to this team")
			}

			const settings = parseCompetitionSettings(competition.settings)
			const scalingGroupId = settings?.divisions?.scalingGroupId

			if (!scalingGroupId) {
				if (data.eventId) {
					return {
						eventId: data.eventId,
						eventName: "",
						divisions: [],
						publishedCount: 0,
						totalCount: 0,
					}
				}
				return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
			}

			// Get all divisions for this competition
			const divisions = await db
				.select({
					id: scalingLevelsTable.id,
					label: scalingLevelsTable.label,
					position: scalingLevelsTable.position,
				})
				.from(scalingLevelsTable)
				.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

			if (divisions.length === 0) {
				if (data.eventId) {
					return {
						eventId: data.eventId,
						eventName: "",
						divisions: [],
						publishedCount: 0,
						totalCount: 0,
					}
				}
				return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
			}

			// Get registrations per division
			const divisionIds = divisions.map((d) => d.id)
			const registrationCounts = await autochunk(
				{ items: divisionIds, otherParametersCount: 1 },
				async (chunk) =>
					db
						.select({
							divisionId: competitionRegistrationsTable.divisionId,
							count: sql<number>`cast(count(*) as integer)`,
						})
						.from(competitionRegistrationsTable)
						.where(
							and(
								eq(competitionRegistrationsTable.eventId, data.competitionId),
								inArray(competitionRegistrationsTable.divisionId, chunk),
							),
						)
						.groupBy(competitionRegistrationsTable.divisionId),
			)

			const registrationCountMap = new Map<string, number>()
			for (const row of registrationCounts) {
				if (row.divisionId) {
					registrationCountMap.set(row.divisionId, row.count)
				}
			}

			// Get the competition's programming track to find all events
			const [track] = await db
				.select({ id: programmingTracksTable.id })
				.from(programmingTracksTable)
				.where(eq(programmingTracksTable.competitionId, data.competitionId))

			if (!track) {
				// No events yet
				if (data.eventId) {
					return {
						eventId: data.eventId,
						eventName: "",
						divisions: [],
						publishedCount: 0,
						totalCount: 0,
					}
				}
				return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
			}

			// Get all events (track workouts) for this competition with workout names
			const events = await db
				.select({
					id: trackWorkoutsTable.id,
					trackOrder: trackWorkoutsTable.trackOrder,
					workoutId: trackWorkoutsTable.workoutId,
					workoutName: workoutsTable.name,
				})
				.from(trackWorkoutsTable)
				.leftJoin(
					workoutsTable,
					eq(trackWorkoutsTable.workoutId, workoutsTable.id),
				)
				.where(eq(trackWorkoutsTable.trackId, track.id))
				.orderBy(trackWorkoutsTable.trackOrder)

			// If specific eventId requested, filter to that event
			const targetEvents = data.eventId
				? events.filter((e) => e.id === data.eventId)
				: events

			if (targetEvents.length === 0) {
				if (data.eventId) {
					return {
						eventId: data.eventId,
						eventName: "",
						divisions: [],
						publishedCount: 0,
						totalCount: 0,
					}
				}
				return { events: [], totalPublishedCount: 0, totalCombinations: 0 }
			}

			// Get registrations for score counting
			const registrations = await db
				.select({
					id: competitionRegistrationsTable.id,
					userId: competitionRegistrationsTable.userId,
					divisionId: competitionRegistrationsTable.divisionId,
				})
				.from(competitionRegistrationsTable)
				.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

			// Build a map of userId -> divisionId
			const userDivisionMap = new Map<string, string>()
			for (const reg of registrations) {
				if (reg.divisionId) {
					userDivisionMap.set(reg.userId, reg.divisionId)
				}
			}

			// Get scores for the target events
			const eventIds = targetEvents.map((e) => e.id)
			const allScores =
				eventIds.length > 0
					? await autochunk(
							{ items: eventIds, otherParametersCount: 0 },
							async (chunk) =>
								db
									.select({
										userId: scoresTable.userId,
										competitionEventId: scoresTable.competitionEventId,
									})
									.from(scoresTable)
									.where(
										and(
											inArray(scoresTable.competitionEventId, chunk),
											isNotNull(scoresTable.scoreValue),
										),
									),
						)
					: []

			// Build a map of eventId -> set of userIds with scores
			const eventScoreMap = new Map<string, Set<string>>()
			for (const score of allScores) {
				if (score.competitionEventId) {
					const existing =
						eventScoreMap.get(score.competitionEventId) ?? new Set()
					existing.add(score.userId)
					eventScoreMap.set(score.competitionEventId, existing)
				}
			}

			// Get division results from settings
			const divisionResults = settings?.divisionResults ?? {}

			// Build response for each event
			const eventResponses: EventDivisionResultsStatusResponse[] = []

			for (const event of targetEvents) {
				const eventDivisionResults = divisionResults[event.id] ?? {}
				const scoredUsers = eventScoreMap.get(event.id) ?? new Set()

				const divisionStatuses: DivisionResultStatus[] = divisions.map((d) => {
					// Count registrations in this division
					const divisionRegCount = registrationCountMap.get(d.id) ?? 0

					// Count scored athletes in this division for this event
					let scoredCount = 0
					let missingCount = 0
					for (const reg of registrations) {
						if (reg.divisionId === d.id) {
							if (scoredUsers.has(reg.userId)) {
								scoredCount++
							} else {
								missingCount++
							}
						}
					}

					const publishedInfo = eventDivisionResults[d.id]

					return {
						divisionId: d.id,
						label: d.label,
						position: d.position,
						registrationCount: divisionRegCount,
						scoredCount,
						missingScoreCount: missingCount,
						resultsPublishedAt: publishedInfo?.publishedAt
							? new Date(publishedInfo.publishedAt)
							: null,
						isPublished: !!publishedInfo?.publishedAt,
					}
				})

				const sortedDivisions = divisionStatuses.sort(
					(a, b) => a.position - b.position,
				)
				const publishedCount = sortedDivisions.filter(
					(d) => d.isPublished,
				).length

				eventResponses.push({
					eventId: event.id,
					eventName: event.workoutName ?? `Event ${event.trackOrder}`,
					divisions: sortedDivisions,
					publishedCount,
					totalCount: sortedDivisions.length,
				})
			}

			// If specific event requested, return single event response
			if (data.eventId && eventResponses.length === 1) {
				return eventResponses[0]
			}

			// Return all events response
			const totalPublished = eventResponses.reduce(
				(sum, e) => sum + e.publishedCount,
				0,
			)
			const totalCombinations = eventResponses.reduce(
				(sum, e) => sum + e.totalCount,
				0,
			)

			return {
				events: eventResponses,
				totalPublishedCount: totalPublished,
				totalCombinations,
			}
		},
	)

/**
 * Publish or unpublish results for a single event+division combination.
 *
 * The eventId is the track_workout ID (the event in the competition schedule).
 */
export const publishDivisionResultsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		publishDivisionResultsInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{ success: boolean; publishedAt: Date | null }> => {
			// Verify authentication
			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			// Check permission (site admins bypass)
			const isSiteAdmin = session.user?.role === ROLES_ENUM.ADMIN
			const team = session.teams?.find((t) => t.id === data.organizingTeamId)
			if (
				!isSiteAdmin &&
				!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
			) {
				throw new Error("Missing required permission")
			}

			const db = getDb()

			// Get competition with settings
			const [competition] = await db
				.select()
				.from(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))

			if (!competition) {
				throw new Error("Competition not found")
			}

			if (competition.organizingTeamId !== data.organizingTeamId) {
				throw new Error("Competition does not belong to this team")
			}

			// Parse current settings
			const settings = parseCompetitionSettings(competition.settings) ?? {}

			// Update division results status for this event+division
			const divisionResults: DivisionResultsSchema =
				settings.divisionResults ?? {}
			const publishedAt = data.publish ? Date.now() : null

			// Ensure the event entry exists
			if (!divisionResults[data.eventId]) {
				divisionResults[data.eventId] = {}
			}

			divisionResults[data.eventId][data.divisionId] = { publishedAt }

			// Save updated settings
			const newSettings = stringifyCompetitionSettings({
				...settings,
				divisionResults,
			})

			await db
				.update(competitionsTable)
				.set({ settings: newSettings, updatedAt: new Date() })
				.where(eq(competitionsTable.id, data.competitionId))

			return {
				success: true,
				publishedAt: publishedAt ? new Date(publishedAt) : null,
			}
		},
	)

/**
 * Publish or unpublish results for all divisions for a specific event.
 *
 * The eventId is the track_workout ID (the event in the competition schedule).
 * This publishes/unpublishes all divisions for ONE event, not all events.
 */
export const publishAllDivisionResultsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		publishAllDivisionResultsInputSchema.parse(data),
	)
	.handler(
		async ({ data }): Promise<{ success: boolean; updatedCount: number }> => {
			// Verify authentication
			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			// Check permission (site admins bypass)
			const isSiteAdmin = session.user?.role === ROLES_ENUM.ADMIN
			const team = session.teams?.find((t) => t.id === data.organizingTeamId)
			if (
				!isSiteAdmin &&
				!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
			) {
				throw new Error("Missing required permission")
			}

			const db = getDb()

			// Get competition with settings
			const [competition] = await db
				.select()
				.from(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))

			if (!competition) {
				throw new Error("Competition not found")
			}

			if (competition.organizingTeamId !== data.organizingTeamId) {
				throw new Error("Competition does not belong to this team")
			}

			// Parse current settings
			const settings = parseCompetitionSettings(competition.settings) ?? {}
			const scalingGroupId = settings?.divisions?.scalingGroupId

			if (!scalingGroupId) {
				return { success: true, updatedCount: 0 }
			}

			// Get all divisions
			const divisions = await db
				.select({ id: scalingLevelsTable.id })
				.from(scalingLevelsTable)
				.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

			if (divisions.length === 0) {
				return { success: true, updatedCount: 0 }
			}

			// Update all divisions for this specific event
			const divisionResults: DivisionResultsSchema =
				settings.divisionResults ?? {}
			const publishedAt = data.publish ? Date.now() : null

			// Ensure the event entry exists
			if (!divisionResults[data.eventId]) {
				divisionResults[data.eventId] = {}
			}

			for (const division of divisions) {
				divisionResults[data.eventId][division.id] = { publishedAt }
			}

			// Save updated settings
			const newSettings = stringifyCompetitionSettings({
				...settings,
				divisionResults,
			})

			await db
				.update(competitionsTable)
				.set({ settings: newSettings, updatedAt: new Date() })
				.where(eq(competitionsTable.id, data.competitionId))

			return { success: true, updatedCount: divisions.length }
		},
	)
