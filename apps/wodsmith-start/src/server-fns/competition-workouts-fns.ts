/**
 * Competition Workouts Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-workouts.ts
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	createProgrammingTrackId,
	createTagId,
	createTrackWorkoutId,
	createWorkoutScalingDescriptionId,
} from "@/db/schemas/common"
import {
	competitionHeatsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { eventResourcesTable } from "@/db/schemas/event-resources"
import {
	PROGRAMMING_TRACK_TYPE,
	programmingTracksTable,
	type TrackWorkout,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import {
	scalingLevelsTable,
	workoutScalingDescriptionsTable,
} from "@/db/schemas/scaling"
import { sponsorsTable } from "@/db/schemas/sponsors"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import {
	movements,
	SCORE_TYPE_VALUES,
	TIEBREAK_SCHEME_VALUES,
	tags,
	WORKOUT_SCHEME_VALUES,
	type Workout,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk, chunk } from "@/utils/batch-query"

// ============================================================================
// Types
// ============================================================================

export interface DivisionDescription {
	divisionId: string
	divisionLabel: string
	description: string | null
	position: number
}

export interface CompetitionWorkout {
	id: string
	trackId: string
	workoutId: string
	trackOrder: number
	notes: string | null
	pointsMultiplier: number | null
	heatStatus: TrackWorkout["heatStatus"]
	eventStatus: TrackWorkout["eventStatus"]
	sponsorId: string | null
	createdAt: Date
	updatedAt: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: Workout["scheme"]
		scoreType: Workout["scoreType"]
		roundsToScore: number | null
		repsPerRound: number | null
		tiebreakScheme: Workout["tiebreakScheme"]
		timeCap: number | null
		tags?: Array<{ id: string; name: string }>
		movements?: Array<{ id: string; name: string; type: string }>
	}
	divisionDescriptions?: DivisionDescription[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPublishedCompetitionWorkoutsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getWorkoutDivisionDescriptionsInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	divisionIds: z.array(z.string()),
})

const getCompetitionWorkoutsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const getCompetitionEventInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const getPublicEventDetailsInputSchema = z.object({
	eventId: z.string().min(1, "Event ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
})

const addWorkoutToCompetitionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	trackOrder: z.number().int().min(1).optional(),
	pointsMultiplier: z.number().int().min(1).default(100),
	notes: z.string().max(1000).optional(),
})

const createWorkoutAndAddToCompetitionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	name: z.string().min(1, "Name is required").max(200),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
	description: z.string().max(5000).optional(),
	roundsToScore: z.number().int().min(1).nullable().optional(),
	repsPerRound: z.number().int().min(1).nullable().optional(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
	tagIds: z.array(z.string()).optional(),
	tagNames: z.array(z.string()).optional(),
	movementIds: z.array(z.string()).optional(),
	sourceWorkoutId: z.string().nullable().optional(),
})

const updateCompetitionWorkoutInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	trackOrder: z.number().int().min(1).optional(),
	pointsMultiplier: z.number().int().min(1).optional(),
	notes: z.string().max(1000).nullable().optional(),
	heatStatus: z.enum(["draft", "published"]).optional(),
	eventStatus: z.enum(["draft", "published"]).optional(),
})

const removeWorkoutFromCompetitionInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const reorderCompetitionEventsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	updates: z
		.array(
			z.object({
				trackWorkoutId: z.string().min(1),
				trackOrder: z.number().int().min(1),
			}),
		)
		.min(1, "At least one update required"),
})

const saveCompetitionEventInputSchema = z.object({
	// Identifiers
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	// Workout details
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().max(5000).optional(),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
	roundsToScore: z.number().int().min(1).nullable().optional(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
	timeCap: z.number().int().min(1).nullable().optional(),
	movementIds: z.array(z.string()).optional(),
	// Track workout details
	pointsMultiplier: z.number().int().min(1).optional(),
	notes: z.string().max(1000).nullable().optional(),
	sponsorId: z.string().nullable().optional(),
	// Division descriptions
	divisionDescriptions: z
		.array(
			z.object({
				divisionId: z.string().min(1, "Division ID is required"),
				description: z.string().max(2000).nullable(),
			}),
		)
		.optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has permission on a team (or is a site admin)
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	// Site admins have all permissions
	if (session.user?.role === ROLES_ENUM.ADMIN) return true

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

/**
 * Get the programming track for a competition
 */
async function getCompetitionTrack(competitionId: string) {
	const db = getDb()

	const track = await db.query.programmingTracksTable.findFirst({
		where: eq(programmingTracksTable.competitionId, competitionId),
	})

	return track ?? null
}

/**
 * Get the next available track order for a competition
 */
async function getNextCompetitionEventOrder(
	competitionId: string,
): Promise<number> {
	const db = getDb()

	const track = await getCompetitionTrack(competitionId)
	if (!track) {
		return 1
	}

	const trackWorkouts = await db
		.select({ trackOrder: trackWorkoutsTable.trackOrder })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, track.id))

	if (trackWorkouts.length === 0) {
		return 1
	}

	const maxOrder = Math.max(...trackWorkouts.map((tw) => tw.trackOrder))
	return maxOrder + 1
}

/**
 * Create a new tag if it doesn't exist, or return the existing one
 */
async function findOrCreateTag(tagName: string) {
	const db = getDb()

	// First check if tag exists
	const existingTags = await db
		.select()
		.from(tags)
		.where(eq(tags.name, tagName))
		.limit(1)

	if (existingTags.length > 0 && existingTags[0]) {
		return existingTags[0]
	}

	// Create new tag
	const tagId = createTagId()
	await db.insert(tags).values({
		id: tagId,
		name: tagName,
		updateCounter: 0,
	})

	// Fetch the created tag
	const [newTag] = await db
		.select()
		.from(tags)
		.where(eq(tags.id, tagId))
		.limit(1)

	return newTag
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get published workouts for a competition (for public views)
 * Returns only workouts with eventStatus = 'published'
 */
export const getPublishedCompetitionWorkoutsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getPublishedCompetitionWorkoutsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get the competition's programming track
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		if (!track) {
			return { workouts: [] }
		}

		// Get only published workouts for this track
		const trackWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				trackId: trackWorkoutsTable.trackId,
				workoutId: trackWorkoutsTable.workoutId,
				trackOrder: trackWorkoutsTable.trackOrder,
				notes: trackWorkoutsTable.notes,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				heatStatus: trackWorkoutsTable.heatStatus,
				eventStatus: trackWorkoutsTable.eventStatus,
				sponsorId: trackWorkoutsTable.sponsorId,
				createdAt: trackWorkoutsTable.createdAt,
				updatedAt: trackWorkoutsTable.updatedAt,
				workout: {
					id: workouts.id,
					name: workouts.name,
					description: workouts.description,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					roundsToScore: workouts.roundsToScore,
					repsPerRound: workouts.repsPerRound,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				},
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(
				and(
					eq(trackWorkoutsTable.trackId, track.id),
					eq(trackWorkoutsTable.eventStatus, "published"),
				),
			)
			.orderBy(trackWorkoutsTable.trackOrder)

		return { workouts: trackWorkouts as CompetitionWorkout[] }
	})

/**
 * Get published workouts for a competition with full details (movements, tags, sponsor)
 * Returns only workouts with eventStatus = 'published'
 * This is the enhanced version for public competition pages
 */
export const getPublishedCompetitionWorkoutsWithDetailsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getPublishedCompetitionWorkoutsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get the competition's programming track
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		if (!track) {
			return { workouts: [] }
		}

		// Get only published workouts for this track with sponsor join
		const trackWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				trackId: trackWorkoutsTable.trackId,
				workoutId: trackWorkoutsTable.workoutId,
				trackOrder: trackWorkoutsTable.trackOrder,
				notes: trackWorkoutsTable.notes,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				heatStatus: trackWorkoutsTable.heatStatus,
				eventStatus: trackWorkoutsTable.eventStatus,
				sponsorId: trackWorkoutsTable.sponsorId,
				createdAt: trackWorkoutsTable.createdAt,
				updatedAt: trackWorkoutsTable.updatedAt,
				workout: {
					id: workouts.id,
					name: workouts.name,
					description: workouts.description,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					roundsToScore: workouts.roundsToScore,
					repsPerRound: workouts.repsPerRound,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				},
				sponsorName: sponsorsTable.name,
				sponsorLogoUrl: sponsorsTable.logoUrl,
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.leftJoin(
				sponsorsTable,
				eq(trackWorkoutsTable.sponsorId, sponsorsTable.id),
			)
			.where(
				and(
					eq(trackWorkoutsTable.trackId, track.id),
					eq(trackWorkoutsTable.eventStatus, "published"),
				),
			)
			.orderBy(trackWorkoutsTable.trackOrder)

		if (trackWorkouts.length === 0) {
			return { workouts: [] }
		}

		// Get all workout IDs for batch fetching movements and tags
		const workoutIds = trackWorkouts.map((tw) => tw.workoutId)

		// Batch fetch movements for all workouts
		const allMovements = await autochunk(
			{ items: workoutIds },
			async (chunk: string[]) => {
				const rows = await db
					.select({
						workoutId: workoutMovements.workoutId,
						movementId: movements.id,
						movementName: movements.name,
					})
					.from(workoutMovements)
					.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
					.where(inArray(workoutMovements.workoutId, chunk))
				return rows
			},
		)

		// Batch fetch tags for all workouts
		const allTags = await autochunk(
			{ items: workoutIds },
			async (chunk: string[]) => {
				const rows = await db
					.select({
						workoutId: workoutTags.workoutId,
						tagId: tags.id,
						tagName: tags.name,
					})
					.from(workoutTags)
					.innerJoin(tags, eq(workoutTags.tagId, tags.id))
					.where(inArray(workoutTags.workoutId, chunk))
				return rows
			},
		)

		// Create lookup maps for movements and tags
		const movementsByWorkout = new Map<
			string,
			Array<{ id: string; name: string }>
		>()
		for (const m of allMovements) {
			const wid = m.workoutId
			if (wid === null) continue
			if (!movementsByWorkout.has(wid)) {
				movementsByWorkout.set(wid, [])
			}
			movementsByWorkout.get(wid)?.push({
				id: m.movementId,
				name: m.movementName,
			})
		}

		const tagsByWorkout = new Map<string, Array<{ id: string; name: string }>>()
		for (const t of allTags) {
			const wid = t.workoutId
			if (wid === null) continue
			if (!tagsByWorkout.has(wid)) {
				tagsByWorkout.set(wid, [])
			}
			tagsByWorkout.get(wid)?.push({
				id: t.tagId,
				name: t.tagName,
			})
		}

		// Combine all data
		const enrichedWorkouts = trackWorkouts.map((tw) => ({
			id: tw.id,
			trackId: tw.trackId,
			workoutId: tw.workoutId,
			trackOrder: tw.trackOrder,
			notes: tw.notes,
			pointsMultiplier: tw.pointsMultiplier,
			heatStatus: tw.heatStatus,
			eventStatus: tw.eventStatus,
			sponsorId: tw.sponsorId,
			createdAt: tw.createdAt,
			updatedAt: tw.updatedAt,
			workout: {
				...tw.workout,
				movements: movementsByWorkout.get(tw.workoutId) ?? [],
				tags: tagsByWorkout.get(tw.workoutId) ?? [],
			},
			sponsorName: tw.sponsorName ?? undefined,
			sponsorLogoUrl: tw.sponsorLogoUrl ?? undefined,
		}))

		return { workouts: enrichedWorkouts }
	})

/**
 * Get public event details including resources and heat times
 * Returns event details, resources, and first/last heat times for public views
 */
export const getPublicEventDetailsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getPublicEventDetailsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// First verify the event belongs to the competition
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		if (!track) {
			return { event: null, resources: [], heatTimes: null, totalEvents: 0 }
		}

		// Get the track workout with workout details and sponsor
		const trackWorkoutResult = await db
			.select({
				id: trackWorkoutsTable.id,
				trackId: trackWorkoutsTable.trackId,
				workoutId: trackWorkoutsTable.workoutId,
				trackOrder: trackWorkoutsTable.trackOrder,
				notes: trackWorkoutsTable.notes,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				heatStatus: trackWorkoutsTable.heatStatus,
				eventStatus: trackWorkoutsTable.eventStatus,
				sponsorId: trackWorkoutsTable.sponsorId,
				createdAt: trackWorkoutsTable.createdAt,
				updatedAt: trackWorkoutsTable.updatedAt,
				workout: {
					id: workouts.id,
					name: workouts.name,
					description: workouts.description,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					roundsToScore: workouts.roundsToScore,
					repsPerRound: workouts.repsPerRound,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				},
				sponsorName: sponsorsTable.name,
				sponsorLogoUrl: sponsorsTable.logoUrl,
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.leftJoin(
				sponsorsTable,
				eq(trackWorkoutsTable.sponsorId, sponsorsTable.id),
			)
			.where(
				and(
					eq(trackWorkoutsTable.id, data.eventId),
					eq(trackWorkoutsTable.trackId, track.id),
					eq(trackWorkoutsTable.eventStatus, "published"),
				),
			)
			.limit(1)

		if (trackWorkoutResult.length === 0) {
			return { event: null, resources: [], heatTimes: null, totalEvents: 0 }
		}

		const event = trackWorkoutResult[0]

		// Count total published events in this track for "Event X of Y" display
		const totalEventsResult = await db
			.select({ id: trackWorkoutsTable.id })
			.from(trackWorkoutsTable)
			.where(
				and(
					eq(trackWorkoutsTable.trackId, event.trackId),
					eq(trackWorkoutsTable.eventStatus, "published"),
				),
			)
		const totalEvents = totalEventsResult.length

		// Fetch movements for this workout
		const workoutMovementsData = await db
			.select({
				movementId: movements.id,
				movementName: movements.name,
			})
			.from(workoutMovements)
			.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
			.where(eq(workoutMovements.workoutId, event.workoutId))

		// Fetch tags for this workout
		const workoutTagsData = await db
			.select({
				tagId: tags.id,
				tagName: tags.name,
			})
			.from(workoutTags)
			.innerJoin(tags, eq(workoutTags.tagId, tags.id))
			.where(eq(workoutTags.workoutId, event.workoutId))

		// Fetch event resources
		const resources = await db
			.select()
			.from(eventResourcesTable)
			.where(eq(eventResourcesTable.eventId, data.eventId))
			.orderBy(asc(eventResourcesTable.sortOrder))

		// Only fetch heat times if the event's heatStatus is published
		let heatTimes: {
			firstHeatStartTime: Date
			lastHeatEndTime: Date
		} | null = null

		if (event.heatStatus === "published") {
			// Fetch heats for this event to get first and last heat times
			const heats = await db
				.select({
					scheduledTime: competitionHeatsTable.scheduledTime,
					durationMinutes: competitionHeatsTable.durationMinutes,
				})
				.from(competitionHeatsTable)
				.where(eq(competitionHeatsTable.trackWorkoutId, data.eventId))
				.orderBy(asc(competitionHeatsTable.scheduledTime))

			// Only include heats that have a scheduled time
			const scheduledHeats = heats.filter((h) => h.scheduledTime !== null)

			if (scheduledHeats.length > 0) {
				const sortedHeats = scheduledHeats
					.filter(
						(h): h is typeof h & { scheduledTime: Date } =>
							h.scheduledTime !== null,
					)
					.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())

				if (sortedHeats.length > 0) {
					const firstHeat = sortedHeats[0]!
					const lastHeat = sortedHeats[sortedHeats.length - 1]!

					// Calculate last heat end time (start time + duration)
					const lastHeatEndTime = new Date(lastHeat.scheduledTime.getTime())
					if (lastHeat.durationMinutes) {
						lastHeatEndTime.setMinutes(
							lastHeatEndTime.getMinutes() + lastHeat.durationMinutes,
						)
					}

					heatTimes = {
						firstHeatStartTime: firstHeat.scheduledTime!,
						lastHeatEndTime,
					}
				}
			}
		}

		// Combine all data
		const enrichedEvent = {
			id: event.id,
			trackId: event.trackId,
			workoutId: event.workoutId,
			trackOrder: event.trackOrder,
			notes: event.notes,
			pointsMultiplier: event.pointsMultiplier,
			heatStatus: event.heatStatus,
			eventStatus: event.eventStatus,
			sponsorId: event.sponsorId,
			createdAt: event.createdAt,
			updatedAt: event.updatedAt,
			workout: {
				...event.workout,
				movements: workoutMovementsData.map((m) => ({
					id: m.movementId,
					name: m.movementName,
				})),
				tags: workoutTagsData.map((t) => ({ id: t.tagId, name: t.tagName })),
			},
			sponsorName: event.sponsorName ?? undefined,
			sponsorLogoUrl: event.sponsorLogoUrl ?? undefined,
		}

		return {
			event: enrichedEvent,
			resources,
			heatTimes,
			totalEvents,
		}
	})

/**
 * Get division descriptions for a workout
 * Returns descriptions for specific divisions for a given workout
 */
export const getWorkoutDivisionDescriptionsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getWorkoutDivisionDescriptionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		if (data.divisionIds.length === 0) {
			return { descriptions: [] }
		}

		const db = getDb()

		// Get the scaling levels (divisions) with their descriptions for this workout (batched)
		const divisions = await autochunk(
			{ items: data.divisionIds },
			async (chunk: string[]) => {
				const rows = await db
					.select({
						divisionId: scalingLevelsTable.id,
						divisionLabel: scalingLevelsTable.label,
						position: scalingLevelsTable.position,
					})
					.from(scalingLevelsTable)
					.where(inArray(scalingLevelsTable.id, chunk))
				return rows
			},
		)

		// Get existing descriptions for this workout (batched)
		const descriptions = await autochunk(
			{ items: data.divisionIds, otherParametersCount: 1 }, // +1 for workoutId
			async (chunk: string[]) => {
				const rows = await db
					.select({
						scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
						description: workoutScalingDescriptionsTable.description,
					})
					.from(workoutScalingDescriptionsTable)
					.where(
						and(
							eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
							inArray(workoutScalingDescriptionsTable.scalingLevelId, chunk),
						),
					)
				return rows
			},
		)

		// Create a map for quick lookup
		const descriptionMap = new Map(
			descriptions.map((d) => [d.scalingLevelId, d.description] as const),
		)

		// Combine divisions with their descriptions
		const result: DivisionDescription[] = divisions.map((division) => ({
			divisionId: division.divisionId,
			divisionLabel: division.divisionLabel,
			description: descriptionMap.get(division.divisionId) ?? null,
			position: division.position,
		}))

		return { descriptions: result }
	})

/**
 * Get all workouts for a competition (organizer view with full details)
 * Returns all workouts regardless of publication status
 */
export const getCompetitionWorkoutsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionWorkoutsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Get the competition's programming track
		const track = await getCompetitionTrack(data.competitionId)
		if (!track) {
			return { workouts: [] }
		}

		// Get all workouts for this track
		const trackWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				trackId: trackWorkoutsTable.trackId,
				workoutId: trackWorkoutsTable.workoutId,
				trackOrder: trackWorkoutsTable.trackOrder,
				notes: trackWorkoutsTable.notes,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				heatStatus: trackWorkoutsTable.heatStatus,
				eventStatus: trackWorkoutsTable.eventStatus,
				sponsorId: trackWorkoutsTable.sponsorId,
				createdAt: trackWorkoutsTable.createdAt,
				updatedAt: trackWorkoutsTable.updatedAt,
				workout: {
					id: workouts.id,
					name: workouts.name,
					description: workouts.description,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					roundsToScore: workouts.roundsToScore,
					repsPerRound: workouts.repsPerRound,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				},
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(eq(trackWorkoutsTable.trackId, track.id))
			.orderBy(trackWorkoutsTable.trackOrder)

		return { workouts: trackWorkouts as CompetitionWorkout[] }
	})

/**
 * Get a single competition event by trackWorkoutId
 */
export const getCompetitionEventFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getCompetitionEventInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Check permission
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Get the track workout with workout details
		const trackWorkout = await db
			.select({
				id: trackWorkoutsTable.id,
				trackId: trackWorkoutsTable.trackId,
				workoutId: trackWorkoutsTable.workoutId,
				trackOrder: trackWorkoutsTable.trackOrder,
				notes: trackWorkoutsTable.notes,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				heatStatus: trackWorkoutsTable.heatStatus,
				eventStatus: trackWorkoutsTable.eventStatus,
				sponsorId: trackWorkoutsTable.sponsorId,
				createdAt: trackWorkoutsTable.createdAt,
				updatedAt: trackWorkoutsTable.updatedAt,
				workout: {
					id: workouts.id,
					name: workouts.name,
					description: workouts.description,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					roundsToScore: workouts.roundsToScore,
					repsPerRound: workouts.repsPerRound,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				},
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
			.limit(1)

		if (trackWorkout.length === 0) {
			return { event: null }
		}

		const event = trackWorkout[0]

		// Fetch tags for this workout
		const workoutTagsData = await db
			.select({
				tagId: tags.id,
				tagName: tags.name,
			})
			.from(workoutTags)
			.innerJoin(tags, eq(workoutTags.tagId, tags.id))
			.where(eq(workoutTags.workoutId, event.workoutId))

		// Fetch movements for this workout
		const workoutMovementsData = await db
			.select({
				movementId: movements.id,
				movementName: movements.name,
				movementType: movements.type,
			})
			.from(workoutMovements)
			.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
			.where(eq(workoutMovements.workoutId, event.workoutId))

		// Return event with tags and movements
		const eventWithDetails: CompetitionWorkout = {
			...event,
			workout: {
				...event.workout,
				tags: workoutTagsData.map((t) => ({ id: t.tagId, name: t.tagName })),
				movements: workoutMovementsData.map((m) => ({
					id: m.movementId,
					name: m.movementName,
					type: m.movementType,
				})),
			},
		}

		return { event: eventWithDetails }
	})

/**
 * Add a workout to a competition
 */
export const addWorkoutToCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		addWorkoutToCompetitionInputSchema.parse(data),
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

		// Get the competition's programming track
		const track = await getCompetitionTrack(data.competitionId)
		if (!track) {
			throw new Error("Competition track not found")
		}

		// Verify workout exists
		const workout = await db.query.workouts.findFirst({
			where: eq(workouts.id, data.workoutId),
		})
		if (!workout) {
			throw new Error("Workout not found")
		}

		// Get next order if not provided
		const trackOrder =
			data.trackOrder ??
			(await getNextCompetitionEventOrder(data.competitionId))

		// Add workout to track
		const trackWorkoutId = createTrackWorkoutId()
		await db.insert(trackWorkoutsTable).values({
			id: trackWorkoutId,
			trackId: track.id,
			workoutId: data.workoutId,
			trackOrder,
			pointsMultiplier: data.pointsMultiplier ?? 100,
			notes: data.notes,
		})

		return { trackWorkoutId }
	})

/**
 * Remove a workout from a competition
 */
export const removeWorkoutFromCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		removeWorkoutFromCompetitionInputSchema.parse(data),
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

		// Delete the track workout
		await db
			.delete(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

		return { success: true }
	})

/**
 * Create a new workout and add it to a competition
 */
export const createWorkoutAndAddToCompetitionFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		createWorkoutAndAddToCompetitionInputSchema.parse(data),
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

		// Get or create the competition track
		let track = await getCompetitionTrack(data.competitionId)
		if (!track) {
			// Track doesn't exist - get competition details and create it
			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, data.competitionId),
			})

			if (!competition) {
				throw new Error("Competition not found")
			}

			// Create the programming track for this competition
			const createdTrackId = createProgrammingTrackId()
			await db.insert(programmingTracksTable).values({
				id: createdTrackId,
				name: `${competition.name} - Events`,
				description: `Competition events for ${competition.name}`,
				type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
				ownerTeamId: competition.organizingTeamId,
				competitionId: competition.id,
				isPublic: 0,
			})

			// Fetch the created track
			const createdTrack = await db.query.programmingTracksTable.findFirst({
				where: eq(programmingTracksTable.id, createdTrackId),
			})

			if (!createdTrack) {
				throw new Error("Failed to create programming track for competition")
			}

			track = createdTrack
		}

		// Get the next track order
		const nextOrder = await getNextCompetitionEventOrder(data.competitionId)

		// Create the workout
		const workoutId = `workout_${createId()}`
		await db.insert(workouts).values({
			id: workoutId,
			name: data.name,
			scheme: data.scheme as (typeof workouts.$inferInsert)["scheme"],
			scoreType: data.scoreType as (typeof workouts.$inferInsert)["scoreType"],
			description: data.description ?? "",
			teamId: data.teamId,
			scope: "private", // Competition workouts are private to the organizing team
			roundsToScore: data.roundsToScore ?? null,
			repsPerRound: data.repsPerRound ?? null,
			tiebreakScheme: data.tiebreakScheme ?? null,
			sourceWorkoutId: data.sourceWorkoutId ?? null, // For remixes
		})

		const workout = { id: workoutId }

		// Handle tags - create new ones from names and use existing IDs
		const finalTagIds: string[] = []

		// Create new tags from tag names
		if (data.tagNames && data.tagNames.length > 0) {
			for (const tagName of data.tagNames) {
				const tag = await findOrCreateTag(tagName)
				if (tag) {
					finalTagIds.push(tag.id)
				}
			}
		}

		// Add existing tag IDs (filter out temporary IDs)
		if (data.tagIds && data.tagIds.length > 0) {
			const existingIds = data.tagIds.filter((id) => !id.startsWith("new_tag_"))
			finalTagIds.push(...existingIds)
		}

		// Insert workout-tag relationships
		if (finalTagIds.length > 0) {
			await db.insert(workoutTags).values(
				finalTagIds.map((tagId) => ({
					id: `workout_tag_${createId()}`,
					workoutId: workout.id,
					tagId,
				})),
			)
		}

		// Insert workout-movement relationships
		if (data.movementIds && data.movementIds.length > 0) {
			await db.insert(workoutMovements).values(
				data.movementIds.map((movementId) => ({
					id: `workout_movement_${createId()}`,
					workoutId: workout.id,
					movementId,
				})),
			)
		}

		// Add to competition track
		const trackWorkoutId = createTrackWorkoutId()
		await db.insert(trackWorkoutsTable).values({
			id: trackWorkoutId,
			trackId: track.id,
			workoutId: workout.id,
			trackOrder: nextOrder,
			pointsMultiplier: 100,
		})

		return {
			workoutId: workout.id,
			trackWorkoutId,
		}
	})

/**
 * Update a competition workout
 */
export const updateCompetitionWorkoutFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateCompetitionWorkoutInputSchema.parse(data),
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

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		}

		if (data.trackOrder !== undefined) {
			updateData.trackOrder = data.trackOrder
		}
		if (data.pointsMultiplier !== undefined) {
			updateData.pointsMultiplier = data.pointsMultiplier
		}
		if (data.notes !== undefined) {
			updateData.notes = data.notes
		}
		if (data.heatStatus !== undefined) {
			updateData.heatStatus = data.heatStatus
		}
		if (data.eventStatus !== undefined) {
			updateData.eventStatus = data.eventStatus
		}

		await db
			.update(trackWorkoutsTable)
			.set(updateData)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

		return { success: true }
	})

/**
 * Save all competition event details in a single operation.
 * This consolidates workout updates, track workout updates, and division descriptions
 * into a single server call for better performance.
 */
export const saveCompetitionEventFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		saveCompetitionEventInputSchema.parse(data),
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

		// 1. Update workout table
		const workoutUpdateData: Record<string, unknown> = {
			name: data.name,
			updatedAt: new Date(),
		}

		if (data.description !== undefined) {
			workoutUpdateData.description = data.description
		}
		if (data.scheme !== undefined) {
			workoutUpdateData.scheme = data.scheme
		}
		if (data.scoreType !== undefined) {
			workoutUpdateData.scoreType = data.scoreType
		}
		if (data.roundsToScore !== undefined) {
			workoutUpdateData.roundsToScore = data.roundsToScore
		}
		if (data.tiebreakScheme !== undefined) {
			workoutUpdateData.tiebreakScheme = data.tiebreakScheme
		}
		if (data.timeCap !== undefined) {
			workoutUpdateData.timeCap = data.timeCap
		}

		await db
			.update(workouts)
			.set(workoutUpdateData)
			.where(eq(workouts.id, data.workoutId))

		// 2. Update movements if provided
		if (data.movementIds !== undefined) {
			// Delete existing movements
			await db
				.delete(workoutMovements)
				.where(eq(workoutMovements.workoutId, data.workoutId))

			// Insert new movements in batches
			if (data.movementIds.length > 0) {
				const movementValues = data.movementIds.map((movementId) => ({
					id: `workout_movement_${createId()}`,
					workoutId: data.workoutId,
					movementId,
				}))

				// workoutMovements has 6 columns (commonColumns + id, workoutId, movementId)
				// Batch limit: 100 params, so max rows per batch = floor(100/6) = 16
				const movementBatches = chunk(movementValues, 16)
				for (const batch of movementBatches) {
					await db.insert(workoutMovements).values(batch)
				}
			}
		}

		// 3. Update track workout (pointsMultiplier, notes, sponsorId)
		const trackWorkoutUpdateData: Record<string, unknown> = {
			updatedAt: new Date(),
		}

		if (data.pointsMultiplier !== undefined) {
			trackWorkoutUpdateData.pointsMultiplier = data.pointsMultiplier
		}
		if (data.notes !== undefined) {
			trackWorkoutUpdateData.notes = data.notes
		}
		if (data.sponsorId !== undefined) {
			trackWorkoutUpdateData.sponsorId = data.sponsorId
		}

		await db
			.update(trackWorkoutsTable)
			.set(trackWorkoutUpdateData)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

		// 4. Update division descriptions using upsert with ON CONFLICT
		if (data.divisionDescriptions && data.divisionDescriptions.length > 0) {
			// Separate null descriptions (to delete) from non-null (to upsert)
			const toDelete: string[] = []
			const toUpsert: Array<{
				divisionId: string
				description: string
			}> = []

			for (const { divisionId, description } of data.divisionDescriptions) {
				if (description === null) {
					toDelete.push(divisionId)
				} else {
					toUpsert.push({ divisionId, description })
				}
			}

			// Delete descriptions that are explicitly null
			if (toDelete.length > 0) {
				// Batch delete by divisionId using autochunk
				await autochunk(
					{ items: toDelete, otherParametersCount: 1 }, // +1 for workoutId
					async (chunk: string[]) => {
						await db
							.delete(workoutScalingDescriptionsTable)
							.where(
								and(
									eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
									inArray(
										workoutScalingDescriptionsTable.scalingLevelId,
										chunk,
									),
								),
							)
						// Return empty array since delete doesn't return rows
						return [] as unknown[]
					},
				)
			}

			// Upsert descriptions that have values
			// Manual upsert pattern for MySQL compatibility
			for (const { divisionId, description } of toUpsert) {
				// Check if record exists
				const existing = await db
					.select({ id: workoutScalingDescriptionsTable.id })
					.from(workoutScalingDescriptionsTable)
					.where(
						and(
							eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
							eq(workoutScalingDescriptionsTable.scalingLevelId, divisionId),
						),
					)
					.limit(1)

				if (existing.length > 0) {
					// Update existing
					await db
						.update(workoutScalingDescriptionsTable)
						.set({
							description,
							updatedAt: new Date(),
						})
						.where(eq(workoutScalingDescriptionsTable.id, existing[0]!.id))
				} else {
					// Insert new
					await db.insert(workoutScalingDescriptionsTable).values({
						id: createWorkoutScalingDescriptionId(),
						workoutId: data.workoutId,
						scalingLevelId: divisionId,
						description,
					})
				}
			}
		}

		return { success: true }
	})

/**
 * Reorder competition events
 */
export const reorderCompetitionEventsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		reorderCompetitionEventsInputSchema.parse(data),
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

		// Get the competition's programming track
		const track = await getCompetitionTrack(data.competitionId)
		if (!track) {
			throw new Error("Competition track not found")
		}

		// Validate all track workouts belong to this track
		const existingWorkouts = await db
			.select({ id: trackWorkoutsTable.id })
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.trackId, track.id))

		const existingIds = new Set(existingWorkouts.map((w) => w.id))

		for (const update of data.updates) {
			if (!existingIds.has(update.trackWorkoutId)) {
				throw new Error(
					`Track workout ${update.trackWorkoutId} does not belong to this competition`,
				)
			}
		}

		// Perform updates
		let updateCount = 0
		for (const update of data.updates) {
			await db
				.update(trackWorkoutsTable)
				.set({ trackOrder: update.trackOrder, updatedAt: new Date() })
				.where(eq(trackWorkoutsTable.id, update.trackWorkoutId))
			updateCount++
		}

		return { updateCount }
	})

const updateWorkoutDivisionDescriptionsInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	descriptions: z
		.array(
			z.object({
				divisionId: z.string().min(1),
				description: z.string().nullable(),
			}),
		)
		.min(1, "At least one description required"),
})

/**
 * Update workout division descriptions
 * Upserts scaling descriptions for each division
 */
export const updateWorkoutDivisionDescriptionsFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		updateWorkoutDivisionDescriptionsInputSchema.parse(data),
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

		// Verify the workout belongs to this team
		const workout = await db
			.select({ id: workouts.id })
			.from(workouts)
			.where(
				and(eq(workouts.id, data.workoutId), eq(workouts.teamId, data.teamId)),
			)
			.limit(1)

		if (workout.length === 0) {
			throw new Error("Workout not found or does not belong to this team")
		}

		for (const { divisionId, description } of data.descriptions) {
			// Check if a record already exists
			const existing = await db
				.select({ id: workoutScalingDescriptionsTable.id })
				.from(workoutScalingDescriptionsTable)
				.where(
					and(
						eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
						eq(workoutScalingDescriptionsTable.scalingLevelId, divisionId),
					),
				)
				.limit(1)

			const existingRecord = existing[0]

			if (description === null) {
				// Delete the record only when description is explicitly null
				if (existingRecord) {
					await db
						.delete(workoutScalingDescriptionsTable)
						.where(eq(workoutScalingDescriptionsTable.id, existingRecord.id))
				}
			} else if (existingRecord) {
				// Update existing record
				await db
					.update(workoutScalingDescriptionsTable)
					.set({
						description,
						updatedAt: new Date(),
					})
					.where(eq(workoutScalingDescriptionsTable.id, existingRecord.id))
			} else {
				// Create new record
				await db.insert(workoutScalingDescriptionsTable).values({
					id: createWorkoutScalingDescriptionId(),
					workoutId: data.workoutId,
					scalingLevelId: divisionId,
					description,
				})
			}
		}

		return { success: true }
	})
