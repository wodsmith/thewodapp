import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { ZSAError } from "@repo/zsa"
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm"
import { getDb } from "@/db"
import type { Workout } from "@/db/schema"
import {
	movements,
	scheduledWorkoutInstancesTable,
	scoresTable,
	tags,
	teamMembershipTable,
	teamTable,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schema"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import {
	scalingLevelsTable,
	workoutScalingDescriptionsTable,
} from "@/db/schemas/scaling"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import { computeSortKey, decodeScore } from "@/lib/scoring"
import {
	isTeamSubscribedToProgrammingTrack,
	isWorkoutInTeamSubscribedTrack,
} from "@/server/programming"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { isTeamMember } from "@/utils/team-auth"

/**
 * Helper function to fetch tags by workout IDs (batched)
 */
async function fetchTagsByWorkoutId(
	db: ReturnType<typeof getDb>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutTagsData = await autochunk(
		{ items: workoutIds },
		async (chunk) =>
			db
				.select({
					workoutId: workoutTags.workoutId,
					tagId: tags.id,
					tagName: tags.name,
				})
				.from(workoutTags)
				.innerJoin(tags, eq(workoutTags.tagId, tags.id))
				.where(inArray(workoutTags.workoutId, chunk)),
	)

	const tagsByWorkoutId = new Map<string, Array<{ id: string; name: string }>>()

	for (const item of workoutTagsData) {
		if (!tagsByWorkoutId.has(item.workoutId)) {
			tagsByWorkoutId.set(item.workoutId, [])
		}
		tagsByWorkoutId.get(item.workoutId)?.push({
			id: item.tagId,
			name: item.tagName,
		})
	}

	return tagsByWorkoutId
}

/**
 * Helper function to fetch movements by workout IDs (batched)
 */
async function fetchMovementsByWorkoutId(
	db: ReturnType<typeof getDb>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string; type: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutMovementsData = await autochunk(
		{ items: workoutIds },
		async (chunk) =>
			db
				.select({
					workoutId: workoutMovements.workoutId,
					movementId: movements.id,
					movementName: movements.name,
					movementType: movements.type,
				})
				.from(workoutMovements)
				.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
				.where(inArray(workoutMovements.workoutId, chunk)),
	)

	const movementsByWorkoutId = new Map<
		string,
		Array<{ id: string; name: string; type: string }>
	>()

	for (const item of workoutMovementsData) {
		if (!movementsByWorkoutId.has(item?.workoutId || "")) {
			movementsByWorkoutId.set(item?.workoutId || "", [])
		}
		movementsByWorkoutId.get(item?.workoutId || "")?.push({
			id: item.movementId,
			name: item.movementName,
			type: item.movementType,
		})
	}

	return movementsByWorkoutId
}

/**
 * Result summary type for today's scores
 */
type TodaysScoreSummary = {
	id: string
	recordedAt: Date
	displayScore?: string
	scalingLabel?: string
	scalingPosition?: number
	asRx?: boolean
}

/**
 * Helper function to fetch today's scores by workout IDs (batched)
 */
async function fetchTodaysScoresByWorkoutId(
	db: ReturnType<typeof getDb>,
	userId: string,
	workoutIds: string[],
) {
	if (workoutIds.length === 0)
		return new Map<string, Array<TodaysScoreSummary>>()

	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const tomorrow = new Date(today)
	tomorrow.setDate(tomorrow.getDate() + 1)

	const todaysScores = await autochunk(
		{ items: workoutIds, otherParametersCount: 4 }, // +4 for userId, isNotNull, gte, lt
		async (chunk) =>
			db
				.select({
					id: scoresTable.id,
					workoutId: scoresTable.workoutId,
					recordedAt: scoresTable.recordedAt,
					scoreType: scoresTable.scoreType,
					scoreValue: scoresTable.scoreValue,
					scheme: scoresTable.scheme,
					status: scoresTable.status,
					secondaryValue: scoresTable.secondaryValue,
					asRx: scoresTable.asRx,
					scalingLabel: scalingLevelsTable.label,
					scalingPosition: scalingLevelsTable.position,
				})
				.from(scoresTable)
				.leftJoin(
					scalingLevelsTable,
					eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
				)
				.where(
					and(
						eq(scoresTable.userId, userId),
						isNotNull(scoresTable.workoutId),
						inArray(scoresTable.workoutId, chunk),
						gte(scoresTable.recordedAt, today),
						lt(scoresTable.recordedAt, tomorrow),
					),
				),
	)

	const scoresByWorkoutId = new Map<string, Array<TodaysScoreSummary>>()
	const sortKeysByScoreId = new Map<string, bigint>()

	for (const score of todaysScores) {
		if (score.workoutId) {
			const workoutId = score.workoutId

			if (!scoresByWorkoutId.has(workoutId)) {
				scoresByWorkoutId.set(workoutId, [])
			}

			// Decode the score value to display string
			let displayScore: string | undefined
			if (score.scheme) {
				if (score.status === "cap" && score.scheme === "time-with-cap") {
					const timeStr =
						score.scoreValue !== null
							? decodeScore(score.scoreValue, score.scheme)
							: ""
					displayScore =
						score.secondaryValue !== null && score.secondaryValue !== undefined
							? `CAP (${timeStr}) - ${score.secondaryValue} reps`
							: `CAP (${timeStr})`
				} else if (score.status === "withdrawn") {
					displayScore = "WITHDRAWN"
				} else if (score.scoreValue !== null) {
					displayScore = decodeScore(score.scoreValue, score.scheme)
				}
			}

			// Compute a best-first sort key using the scoring library.
			// Lower sortKey is always better (direction is normalized inside computeSortKey).
			sortKeysByScoreId.set(
				score.id,
				computeSortKey({
					value: score.scoreValue,
					status: score.status,
					scheme: score.scheme,
					scoreType: score.scoreType,
				}),
			)

			scoresByWorkoutId.get(workoutId)?.push({
				id: score.id,
				recordedAt: score.recordedAt,
				displayScore,
				scalingLabel: score.scalingLabel || undefined,
				scalingPosition: score.scalingPosition || undefined,
				asRx: score.asRx,
			})
		}
	}

	// Sort so `resultsToday[0]` is the best score (fastest for time, max for reps, etc.)
	for (const [workoutId, items] of scoresByWorkoutId.entries()) {
		items.sort((a, b) => {
			const aKey = sortKeysByScoreId.get(a.id)
			const bKey = sortKeysByScoreId.get(b.id)
			if (aKey === undefined || bKey === undefined) return 0
			if (aKey === bKey) return 0
			return aKey < bKey ? -1 : 1
		})
		scoresByWorkoutId.set(workoutId, items)
	}

	return scoresByWorkoutId
}

/**
 * Get total count of user workouts for pagination
 */
export async function getUserWorkoutsCount({
	teamId,
	trackId,
	search,
	tag,
	movement,
	type,
}: {
	teamId: string | string[]
	trackId?: string
	search?: string
	tag?: string
	movement?: string
	type?: "all" | "original" | "remix"
}): Promise<number> {
	const db = getDb()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Build a single query with all necessary joins
	const needsTrackJoin = !!trackId
	const needsTagJoin = !!tag
	const needsMovementJoin = !!movement

	// Build conditions
	const conditions: SQL[] = []

	// Base condition: team-owned or public workouts
	// Support multiple team IDs by converting single teamId to array
	const teamIds = Array.isArray(teamId) ? teamId : [teamId]
	const teamOrPublicCondition = or(
		inArray(workouts.teamId, teamIds),
		eq(workouts.scope, "public"),
	)
	if (teamOrPublicCondition) {
		conditions.push(teamOrPublicCondition)
	}

	// Type filter
	if (type === "original") {
		conditions.push(isNull(workouts.sourceWorkoutId))
	} else if (type === "remix") {
		conditions.push(isNotNull(workouts.sourceWorkoutId))
	}

	// Track filter
	if (trackId) {
		conditions.push(eq(trackWorkoutsTable.trackId, trackId))
	}

	// Tag filter
	if (tag) {
		conditions.push(eq(tags.name, tag))
	}

	// Movement filter
	if (movement) {
		conditions.push(eq(movements.name, movement))
	}

	// Search filter
	if (search) {
		const searchLower = search.toLowerCase()
		const searchCondition = or(
			sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
			sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
		)
		if (searchCondition) {
			conditions.push(searchCondition)
		}
	}

	// Build the complete query based on needed joins
	let baseQuery = db
		.select({
			count: sql<number>`COUNT(DISTINCT ${workouts.id})`,
		})
		.from(workouts)

	if (needsTrackJoin) {
		baseQuery = baseQuery.innerJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.workoutId, workouts.id),
		) as any
	}
	if (needsTagJoin) {
		baseQuery = baseQuery
			.innerJoin(workoutTags, eq(workoutTags.workoutId, workouts.id))
			.innerJoin(tags, eq(tags.id, workoutTags.tagId)) as any
	}
	if (needsMovementJoin) {
		baseQuery = baseQuery
			.innerJoin(workoutMovements, eq(workoutMovements.workoutId, workouts.id))
			.innerJoin(
				movements,
				eq(movements.id, workoutMovements.movementId),
			) as any
	}

	const result = await baseQuery.where(and(...conditions))
	return result[0]?.count || 0
}

/**
 * Get all workouts for the current team (team-owned + public workouts)
 */
export async function getUserWorkouts({
	teamId,
	trackId,
	search,
	tag,
	movement,
	type,
	limit = 50,
	offset = 0,
}: {
	teamId: string | string[]
	trackId?: string
	search?: string
	tag?: string
	movement?: string
	type?: "all" | "original" | "remix"
	limit?: number
	offset?: number
}): Promise<
	Array<
		Workout & {
			tags: Array<{ id: string; name: string }>
			movements: Array<{ id: string; name: string; type: string }>
			resultsToday: Array<TodaysScoreSummary>
			// Optional remix information
			sourceWorkout?: {
				id: string
				name: string
				teamName?: string
			} | null
			remixCount?: number
		}
	>
> {
	const db = getDb()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Determine which joins we need
	const needsTrackJoin = !!trackId
	const needsTagJoin = !!tag
	const needsMovementJoin = !!movement

	// Build conditions
	const conditions: SQL[] = []

	// Base condition: team-owned or public workouts
	// Support multiple team IDs by converting single teamId to array
	const teamIds = Array.isArray(teamId) ? teamId : [teamId]
	const teamOrPublicCondition = or(
		inArray(workouts.teamId, teamIds),
		eq(workouts.scope, "public"),
	)
	if (teamOrPublicCondition) {
		conditions.push(teamOrPublicCondition)
	}

	// Type filter
	if (type === "original") {
		conditions.push(isNull(workouts.sourceWorkoutId))
	} else if (type === "remix") {
		conditions.push(isNotNull(workouts.sourceWorkoutId))
	}

	// Track filter
	if (trackId) {
		conditions.push(eq(trackWorkoutsTable.trackId, trackId))
	}

	// Tag filter
	if (tag) {
		conditions.push(eq(tags.name, tag))
	}

	// Movement filter
	if (movement) {
		conditions.push(eq(movements.name, movement))
	}

	// Search filter
	if (search) {
		const searchLower = search.toLowerCase()
		const searchCondition = or(
			sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
			sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
		)
		if (searchCondition) {
			conditions.push(searchCondition)
		}
	}

	// Build the complete query based on needed joins
	let baseQuery = db
		.selectDistinct({
			id: workouts.id,
			name: workouts.name,
			description: workouts.description,
			scheme: workouts.scheme,
			scoreType: workouts.scoreType,
			scope: workouts.scope,
			teamId: workouts.teamId,
			scalingGroupId: workouts.scalingGroupId,
			repsPerRound: workouts.repsPerRound,
			roundsToScore: workouts.roundsToScore,
			sugarId: workouts.sugarId,
			tiebreakScheme: workouts.tiebreakScheme,
			timeCap: workouts.timeCap,
			sourceWorkoutId: workouts.sourceWorkoutId,
			sourceTrackId: workouts.sourceTrackId,
			createdAt: workouts.createdAt,
			updatedAt: workouts.updatedAt,
			updateCounter: workouts.updateCounter,
		})
		.from(workouts)

	if (needsTrackJoin) {
		baseQuery = baseQuery.innerJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.workoutId, workouts.id),
		) as any
	}
	if (needsTagJoin) {
		baseQuery = baseQuery
			.innerJoin(workoutTags, eq(workoutTags.workoutId, workouts.id))
			.innerJoin(tags, eq(tags.id, workoutTags.tagId)) as any
	}
	if (needsMovementJoin) {
		baseQuery = baseQuery
			.innerJoin(workoutMovements, eq(workoutMovements.workoutId, workouts.id))
			.innerJoin(
				movements,
				eq(movements.id, workoutMovements.movementId),
			) as any
	}

	const allWorkouts = await baseQuery
		.where(and(...conditions))
		.orderBy(desc(workouts.updatedAt))
		.limit(limit)
		.offset(offset)

	const workoutIds = allWorkouts.map((w) => w.id)

	// Fetch related data in parallel
	const [tagsByWorkoutId, movementsByWorkoutId, scoresByWorkoutId] =
		await Promise.all([
			fetchTagsByWorkoutId(db, workoutIds),
			fetchMovementsByWorkoutId(db, workoutIds),
			fetchTodaysScoresByWorkoutId(db, session.user.id, workoutIds),
		])

	// Fetch remix information for workouts that have sourceWorkoutId
	const workoutsWithSource = allWorkouts.filter((w) => w.sourceWorkoutId)
	const sourceWorkoutIds = workoutsWithSource
		.map((w) => w.sourceWorkoutId)
		.filter((id): id is string => id !== null)

	let sourceWorkoutsMap = new Map<
		string,
		{ id: string; name: string; teamId: string | null }
	>()
	if (sourceWorkoutIds.length > 0) {
		const sourceWorkouts = await autochunk(
			{ items: sourceWorkoutIds },
			async (chunk) =>
				db
					.select({
						id: workouts.id,
						name: workouts.name,
						teamId: workouts.teamId,
					})
					.from(workouts)
					.where(inArray(workouts.id, chunk)),
		)

		sourceWorkoutsMap = new Map(sourceWorkouts.map((w) => [w.id, w]))
	}

	// Fetch team names for source workouts (batched)
	const sourceTeamIds = Array.from(sourceWorkoutsMap.values())
		.map((w) => w.teamId)
		.filter((id): id is string => id !== null)

	let teamsMap = new Map<string, { name: string }>()
	if (sourceTeamIds.length > 0) {
		const teams = await autochunk({ items: sourceTeamIds }, async (chunk) =>
			db
				.select({ id: teamTable.id, name: teamTable.name })
				.from(teamTable)
				.where(inArray(teamTable.id, chunk)),
		)

		teamsMap = new Map(teams.map((t) => [t.id, { name: t.name }]))
	}

	// Fetch remix counts for all workouts (batched)
	const remixCounts = await autochunk(
		{ items: workoutIds, otherParametersCount: 1 }, // +1 for isNotNull
		async (chunk) =>
			db
				.select({
					sourceWorkoutId: workouts.sourceWorkoutId,
					count: count(),
				})
				.from(workouts)
				.where(
					and(
						isNotNull(workouts.sourceWorkoutId),
						inArray(workouts.sourceWorkoutId, chunk),
					),
				)
				.groupBy(workouts.sourceWorkoutId),
	)

	const remixCountsMap = new Map(
		remixCounts.map((rc) => [rc.sourceWorkoutId, rc.count]),
	)

	// Compose final structure
	return allWorkouts.map((w) => {
		const sourceWorkoutData = w.sourceWorkoutId
			? sourceWorkoutsMap.get(w.sourceWorkoutId)
			: null
		const teamData = sourceWorkoutData?.teamId
			? teamsMap.get(sourceWorkoutData.teamId)
			: null

		return {
			...w,
			tags: tagsByWorkoutId.get(w.id) || [],
			movements: movementsByWorkoutId.get(w.id) || [],
			resultsToday: scoresByWorkoutId.get(w.id) || [],
			sourceWorkout: sourceWorkoutData
				? {
						id: sourceWorkoutData.id,
						name: sourceWorkoutData.name,
						teamName: teamData?.name,
					}
				: null,
			remixCount: remixCountsMap.get(w.id) || 0,
		}
	})
}

/**
 * Create a new workout with tags and movements
 */
export async function createWorkout({
	workout,
	tagIds,
	movementIds,
	teamId,
}: {
	workout: Omit<
		Workout,
		"id" | "createdAt" | "updatedAt" | "updateCounter" | "teamId"
	>
	tagIds: string[]
	movementIds: string[]
	teamId: string
}) {
	try {
		const db = getDb()

		// Create the workout first
		const newWorkout = await db
			.insert(workouts)
			.values({
				id: `workout_${createId()}`,
				name: workout.name,
				description: workout.description,
				scheme: workout.scheme,
				scoreType: workout.scoreType,
				scope: workout.scope,
				repsPerRound: workout.repsPerRound,
				roundsToScore: workout.roundsToScore,
				sugarId: workout.sugarId,
				tiebreakScheme: workout.tiebreakScheme,
				scalingGroupId: workout.scalingGroupId,
				teamId,
				// Let database defaults handle timestamps
				updateCounter: 0,
			})
			.returning()
			.get()

		// Insert workout-tag relationships
		if (tagIds.length > 0) {
			await db.insert(workoutTags).values(
				tagIds.map((tagId) => ({
					id: `workout_tag_${createId()}`,
					workoutId: newWorkout.id,
					tagId,
				})),
			)
		}

		// Insert workout-movement relationships
		if (movementIds.length > 0) {
			await db.insert(workoutMovements).values(
				movementIds.map((movementId) => ({
					id: `workout_movement_${createId()}`,
					workoutId: newWorkout.id,
					movementId,
				})),
			)
		}

		return newWorkout
	} catch (error) {
		logError({
			message: "[createWorkout] Failed to create workout",
			error,
		})
		// Re-throw with a more specific error message
		if (error instanceof Error && error.message.includes("ECONNRESET")) {
			throw new Error("Database connection error. Please try again.")
		}
		throw error
	}
}

/**
 * Get a single workout by ID with its tags and movements, including remix information
 */
export async function getWorkoutById(id: string): Promise<
	| (Workout & {
			tags: Array<{
				id: string
				name: string
				createdAt: Date
				updatedAt: Date
				updateCounter: number | null
			}>
			movements: Array<{
				id: string
				name: string
				type: string
				createdAt: Date
				updatedAt: Date
				updateCounter: number | null
			}>
			// Optional remix information
			sourceWorkout?: {
				id: string
				name: string
				teamName?: string
			} | null
			remixCount?: number
			// Scaling information
			scalingLevels?: Array<{
				id: string
				label: string
				position: number
			}>
			scalingDescriptions?: Array<{
				scalingLevelId: string
				description: string | null
			}>
	  })
	| null
> {
	const db = getDb()

	const workout = await db
		.select()
		.from(workouts)
		.where(eq(workouts.id, id))
		.get()

	if (!workout) return null

	const workoutTagRows = await db
		.select()
		.from(workoutTags)
		.where(eq(workoutTags.workoutId, id))
	const tagIds = workoutTagRows.map((wt) => wt.tagId)
	const tagObjs = tagIds.length
		? await db.select().from(tags).where(inArray(tags.id, tagIds))
		: []

	const workoutMovementRows = await db
		.select()
		.from(workoutMovements)
		.where(eq(workoutMovements.workoutId, id))
	const movementIds = workoutMovementRows
		.map((wm) => wm.movementId)
		.filter((id): id is string => id !== null)
	const movementObjs = movementIds.length
		? await db
				.select()
				.from(movements)
				.where(inArray(movements.id, movementIds))
		: []

	// Fetch source workout info if this is a remix
	let sourceWorkout = null
	if (workout.sourceWorkoutId) {
		const source = await db
			.select({
				id: workouts.id,
				name: workouts.name,
				teamId: workouts.teamId,
			})
			.from(workouts)
			.where(eq(workouts.id, workout.sourceWorkoutId))
			.get()

		if (source) {
			// Get team name for source workout
			const teamInfo = source.teamId
				? await db
						.select({ name: teamTable.name })
						.from(teamTable)
						.where(eq(teamTable.id, source.teamId))
						.get()
				: null

			sourceWorkout = {
				id: source.id,
				name: source.name,
				teamName: teamInfo?.name,
			}
		}
	}

	// Count how many times this workout has been remixed
	const remixCountResult = await db
		.select({ count: count() })
		.from(workouts)
		.where(eq(workouts.sourceWorkoutId, id))
		.get()

	const remixCount = remixCountResult?.count || 0

	// Fetch scaling levels and descriptions if workout has a scaling group
	let scalingLevels: Array<{ id: string; label: string; position: number }> = []
	let scalingDescriptions: Array<{
		scalingLevelId: string
		description: string | null
	}> = []

	if (workout.scalingGroupId) {
		// Get scaling levels for this group
		scalingLevels = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
			})
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, workout.scalingGroupId))
			.orderBy(asc(scalingLevelsTable.position))

		// Get workout-specific scaling descriptions
		if (scalingLevels.length > 0) {
			const levelIds = scalingLevels.map((l) => l.id)
			scalingDescriptions = await db
				.select({
					scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
					description: workoutScalingDescriptionsTable.description,
				})
				.from(workoutScalingDescriptionsTable)
				.where(
					and(
						eq(workoutScalingDescriptionsTable.workoutId, id),
						inArray(workoutScalingDescriptionsTable.scalingLevelId, levelIds),
					),
				)
		}
	}

	return {
		...workout,
		tags: tagObjs,
		movements: movementObjs,
		sourceWorkout,
		remixCount,
		scalingLevels,
		scalingDescriptions,
	}
}

/**
 * Update a workout with tags and movements
 */
export async function updateWorkout({
	id,
	workout,
	tagIds,
	movementIds,
}: {
	id: string
	workout: Partial<
		Pick<
			Workout,
			| "name"
			| "description"
			| "scheme"
			| "scoreType"
			| "scope"
			| "repsPerRound"
			| "roundsToScore"
			| "scalingGroupId"
		>
	>
	tagIds: string[]
	movementIds: string[]
}) {
	const db = getDb()

	await db
		.update(workouts)
		.set({
			...workout,
			updatedAt: new Date(),
		})
		.where(eq(workouts.id, id))

	await db.delete(workoutTags).where(eq(workoutTags.workoutId, id))
	await db.delete(workoutMovements).where(eq(workoutMovements.workoutId, id))

	if (tagIds.length) {
		await db.insert(workoutTags).values(
			tagIds.map((tagId) => ({
				id: `workout_tag_${createId()}`,
				workoutId: id,
				tagId,
			})),
		)
	}
	if (movementIds.length) {
		await db.insert(workoutMovements).values(
			movementIds.map((movementId) => ({
				id: `workout_movement_${createId()}`,
				workoutId: id,
				movementId,
			})),
		)
	}
}

/**
 * Get user workouts with track scheduling information
 */
export async function getUserWorkoutsWithTrackScheduling({
	trackId,
	teamId,
}: {
	trackId: string
	teamId: string
}) {
	const db = getDb()

	// Get all team workouts
	const userWorkouts = await getUserWorkouts({ teamId, trackId: undefined })

	// Get scheduling information for workouts in this track
	const scheduledWorkouts = await db
		.select({
			workoutId: trackWorkoutsTable.workoutId,
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
		})
		.from(trackWorkoutsTable)
		.leftJoin(
			scheduledWorkoutInstancesTable,
			eq(scheduledWorkoutInstancesTable.trackWorkoutId, trackWorkoutsTable.id),
		)
		.where(
			and(
				eq(trackWorkoutsTable.trackId, trackId),
				eq(scheduledWorkoutInstancesTable.teamId, teamId),
			),
		)

	// Create a map of workout ID to last scheduled date
	const schedulingMap = new Map<string, Date>()
	for (const row of scheduledWorkouts) {
		if (row.workoutId && row.scheduledDate) {
			const existingDate = schedulingMap.get(row.workoutId)
			if (!existingDate || row.scheduledDate > existingDate) {
				schedulingMap.set(row.workoutId, row.scheduledDate)
			}
		}
	}

	// Combine user workouts with scheduling information
	return userWorkouts.map((workout) => {
		const { resultsToday: _resultsToday, ...workoutWithoutResults } = workout
		return {
			...workoutWithoutResults,
			lastScheduledAt: schedulingMap.get(workout.id) ?? null,
		}
	})
}

/**
 * Get all available tags for workouts accessible to a team
 */
export async function getAvailableWorkoutTags(
	teamId: string,
): Promise<string[]> {
	const db = getDb()

	// Get tags from workouts that are either team-owned or public
	const result = await db
		.selectDistinct({ name: tags.name })
		.from(tags)
		.innerJoin(workoutTags, eq(workoutTags.tagId, tags.id))
		.innerJoin(workouts, eq(workouts.id, workoutTags.workoutId))
		.where(or(eq(workouts.teamId, teamId), eq(workouts.scope, "public")))
		.orderBy(tags.name)

	return result.map((r) => r.name).filter(Boolean) as string[]
}

/**
 * Get all available movements for workouts accessible to a team
 */
export async function getAvailableWorkoutMovements(
	teamId: string,
): Promise<string[]> {
	const db = getDb()

	// Get movements from workouts that are either team-owned or public
	const result = await db
		.selectDistinct({ name: movements.name })
		.from(movements)
		.innerJoin(workoutMovements, eq(workoutMovements.movementId, movements.id))
		.innerJoin(workouts, eq(workouts.id, workoutMovements.workoutId))
		.where(or(eq(workouts.teamId, teamId), eq(workouts.scope, "public")))
		.orderBy(movements.name)

	return result.map((r) => r.name).filter(Boolean) as string[]
}

/**
 * Create a remix of an existing workout
 * Copies all workout data and assigns it to the specified team with sourceWorkoutId reference
 */
export async function createWorkoutRemix({
	sourceWorkoutId,
	teamId,
}: {
	sourceWorkoutId: string
	teamId: string
}) {
	const db = getDb()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Validate that the user is a member of the target team
	const isMember = await isTeamMember(teamId)
	if (!isMember) {
		throw new ZSAError(
			"FORBIDDEN",
			"You are not authorized to create workouts for this team",
		)
	}

	// First, get the source workout with all related data
	const sourceWorkout = await getWorkoutById(sourceWorkoutId)

	if (!sourceWorkout) {
		throw new ZSAError("NOT_FOUND", "Source workout not found")
	}

	// Check if user can view the source workout
	// User can view if: it's public OR they belong to the workout's team OR they're subscribed to the programming track
	logInfo({
		message: "[createWorkoutRemix] Permission check start",
		attributes: {
			sourceWorkoutId,
			targetTeamId: teamId,
			sourceScope: sourceWorkout.scope,
			sourceTeamId: sourceWorkout.teamId,
			sourceTrackId: sourceWorkout.sourceTrackId,
			userId: session.user?.id,
			userTeams: session.teams?.map((t) => ({ id: t.id, name: t.name })),
		},
	})

	let canViewSource =
		sourceWorkout.scope === "public" ||
		sourceWorkout.teamId === teamId ||
		session.teams?.some((team) => team.id === sourceWorkout.teamId)

	logInfo({
		message: "[createWorkoutRemix] Initial permission check",
		attributes: {
			isPublic: sourceWorkout.scope === "public",
			isOwnedByTeam: sourceWorkout.teamId === teamId,
			isInUserTeams: session.teams?.some(
				(team) => team.id === sourceWorkout.teamId,
			),
			canViewSource,
		},
	})

	// If not already allowed, check if this workout is in any programming track the team is subscribed to
	if (!canViewSource) {
		// First try the sourceTrackId approach if available
		if (sourceWorkout.sourceTrackId) {
			canViewSource = await isTeamSubscribedToProgrammingTrack(
				teamId,
				sourceWorkout.sourceTrackId,
			)

			logInfo({
				message: "[createWorkoutRemix] Source track subscription result",
				attributes: {
					canViewSource,
					sourceTrackId: sourceWorkout.sourceTrackId,
					teamId,
				},
			})
		}

		// If still not allowed, check if this workout exists in any subscribed programming track
		if (!canViewSource) {
			canViewSource = await isWorkoutInTeamSubscribedTrack(
				teamId,
				sourceWorkout.id,
			)

			logInfo({
				message: "[createWorkoutRemix] Workout in subscribed track result",
				attributes: { canViewSource, teamId, workoutId: sourceWorkout.id },
			})
		}
	}

	logInfo({
		message: "[createWorkoutRemix] Final permission result",
		attributes: { canViewSource, teamId, sourceWorkoutId },
	})

	if (!canViewSource) {
		throw new ZSAError(
			"FORBIDDEN",
			"You don't have permission to view the source workout",
		)
	}

	// Extract tag and movement IDs from the source workout
	const tagIds = sourceWorkout.tags.map((tag) => tag.id)
	const movementIds = sourceWorkout.movements.map((movement) => movement.id)

	// Create the remixed workout (D1 doesn't support transactions)
	// Create the workout first
	const newWorkout = await db
		.insert(workouts)
		.values({
			id: `workout_${createId()}`,
			name: sourceWorkout.name,
			description: sourceWorkout.description,
			scheme: sourceWorkout.scheme,
			scoreType: sourceWorkout.scoreType,
			scope: "private", // Remixes start as private
			repsPerRound: sourceWorkout.repsPerRound,
			roundsToScore: sourceWorkout.roundsToScore,
			sugarId: sourceWorkout.sugarId,
			tiebreakScheme: sourceWorkout.tiebreakScheme,
			teamId,
			sourceWorkoutId, // Reference to the original workout
			// Let database defaults handle timestamps
			updateCounter: 0,
		})
		.returning()
		.get()

	// Insert workout-tag relationships
	if (tagIds.length > 0) {
		await db.insert(workoutTags).values(
			tagIds.map((tagId) => ({
				id: `workout_tag_${createId()}`,
				workoutId: newWorkout.id,
				tagId,
			})),
		)
	}

	// Insert workout-movement relationships
	if (movementIds.length > 0) {
		await db.insert(workoutMovements).values(
			movementIds.map((movementId) => ({
				id: `workout_movement_${createId()}`,
				workoutId: newWorkout.id,
				movementId,
			})),
		)
	}

	const remixedWorkout = newWorkout

	// Return the newly created workout with all related data
	const result = await getWorkoutById(remixedWorkout.id)
	return result
}

/**
 * Create a remix of a programming track workout
 * Copies all workout data and assigns it to the specified team with both sourceWorkoutId and sourceTrackId references
 */
export async function createProgrammingTrackWorkoutRemix({
	sourceWorkoutId,
	sourceTrackId,
	teamId,
}: {
	sourceWorkoutId: string
	sourceTrackId: string
	teamId: string
}) {
	const db = getDb()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Validate that the user is a member of the target team
	const isMember = await isTeamMember(teamId)
	if (!isMember) {
		throw new ZSAError(
			"FORBIDDEN",
			"You are not authorized to create workouts for this team",
		)
	}

	// First, get the source workout with all related data
	const sourceWorkout = await getWorkoutById(sourceWorkoutId)

	if (!sourceWorkout) {
		throw new ZSAError("NOT_FOUND", "Source workout not found")
	}

	// Check if user can view the source workout
	// User can view if: it's public OR they belong to the workout's team OR they're subscribed to the programming track
	logInfo({
		message: "[createProgrammingTrackWorkoutRemix] Permission check start",
		attributes: {
			sourceWorkoutId,
			sourceTrackId,
			teamId,
			sourceScope: sourceWorkout.scope,
			sourceTeamId: sourceWorkout.teamId,
			sourceWorkoutTrackId: sourceWorkout.sourceTrackId,
			userId: session.user?.id,
			userTeams: session.teams?.map((t) => ({ id: t.id, name: t.name })),
		},
	})

	let canViewSource =
		sourceWorkout.scope === "public" ||
		sourceWorkout.teamId === teamId ||
		session.teams?.some((team) => team.id === sourceWorkout.teamId)

	logInfo({
		message: "[createProgrammingTrackWorkoutRemix] Initial permission check",
		attributes: {
			isPublic: sourceWorkout.scope === "public",
			isOwnedByTeam: sourceWorkout.teamId === teamId,
			isInUserTeams: session.teams?.some(
				(team) => team.id === sourceWorkout.teamId,
			),
			canViewSource,
		},
	})

	// If not already allowed, check programming track subscription
	if (!canViewSource) {
		canViewSource = await isTeamSubscribedToProgrammingTrack(
			teamId,
			sourceTrackId,
		)

		logInfo({
			message:
				"[createProgrammingTrackWorkoutRemix] Source track subscription result",
			attributes: { canViewSource, teamId, sourceTrackId },
		})

		// If still not allowed, check if this workout exists in any subscribed programming track
		if (!canViewSource) {
			canViewSource = await isWorkoutInTeamSubscribedTrack(
				teamId,
				sourceWorkout.id,
			)

			logInfo({
				message:
					"[createProgrammingTrackWorkoutRemix] Workout in subscribed track result",
				attributes: { canViewSource, teamId, workoutId: sourceWorkout.id },
			})
		}
	}

	logInfo({
		message: "[createProgrammingTrackWorkoutRemix] Final permission result",
		attributes: { canViewSource, teamId, sourceWorkoutId, sourceTrackId },
	})

	if (!canViewSource) {
		throw new ZSAError(
			"FORBIDDEN",
			"You don't have permission to view the source workout",
		)
	}

	// Extract tag and movement IDs from the source workout
	const tagIds = sourceWorkout.tags.map((tag) => tag.id)
	const movementIds = sourceWorkout.movements.map((movement) => movement.id)

	// Create the remixed workout (D1 doesn't support transactions)
	// Create the workout first
	const newWorkout = await db
		.insert(workouts)
		.values({
			id: `workout_${createId()}`,
			name: sourceWorkout.name,
			description: sourceWorkout.description,
			scheme: sourceWorkout.scheme,
			scoreType: sourceWorkout.scoreType,
			scope: "private", // Remixes start as private
			repsPerRound: sourceWorkout.repsPerRound,
			roundsToScore: sourceWorkout.roundsToScore,
			sugarId: sourceWorkout.sugarId,
			tiebreakScheme: sourceWorkout.tiebreakScheme,
			teamId,
			sourceWorkoutId, // Reference to the original workout
			sourceTrackId, // Reference to the original programming track
			// Let database defaults handle timestamps
			updateCounter: 0,
		})
		.returning()
		.get()

	// Insert workout-tag relationships
	if (tagIds.length > 0) {
		await db.insert(workoutTags).values(
			tagIds.map((tagId) => ({
				id: `workout_tag_${createId()}`,
				workoutId: newWorkout.id,
				tagId,
			})),
		)
	}

	// Insert workout-movement relationships
	if (movementIds.length > 0) {
		await db.insert(workoutMovements).values(
			movementIds.map((movementId) => ({
				id: `workout_movement_${createId()}`,
				workoutId: newWorkout.id,
				movementId,
			})),
		)
	}

	console.info("INFO: Created programming track workout remix", {
		originalWorkoutId: sourceWorkoutId,
		sourceTrackId,
		newWorkoutId: newWorkout.id,
		teamId,
	})

	// Return the newly created workout with all related data
	const result = await getWorkoutById(newWorkout.id)
	return result
}

/**
 * Get team-specific workout for a given original workout
 * Checks if the team has a remix of the workout, otherwise returns the original
 */
export async function getTeamSpecificWorkout({
	originalWorkoutId,
	teamId,
	preferOriginal = false,
}: {
	originalWorkoutId: string
	teamId: string
	preferOriginal?: boolean
}) {
	const db = getDb()

	// If preferOriginal is true, skip remix lookup and return the original workout directly
	if (preferOriginal) {
		const originalWorkoutResult = await db
			.select()
			.from(workouts)
			.where(eq(workouts.id, originalWorkoutId))
		const originalWorkout = originalWorkoutResult[0]

		if (!originalWorkout) {
			throw new ZSAError("NOT_FOUND", "Original workout not found")
		}

		return originalWorkout
	}

	// Check if team has a remix of this workout
	const teamRemixResult = await db
		.select()
		.from(workouts)
		.where(
			and(
				eq(workouts.sourceWorkoutId, originalWorkoutId),
				eq(workouts.teamId, teamId),
			),
		)
	const teamRemix = teamRemixResult[0]

	if (teamRemix) {
		console.info("INFO: Using team-specific remix for workout", {
			originalWorkoutId,
			remixWorkoutId: teamRemix.id,
			teamId,
		})
		return teamRemix
	}

	// Return original workout if no team remix exists
	const originalWorkoutResult = await db
		.select()
		.from(workouts)
		.where(eq(workouts.id, originalWorkoutId))
	const originalWorkout = originalWorkoutResult[0]

	if (!originalWorkout) {
		throw new ZSAError("NOT_FOUND", "Original workout not found")
	}

	return originalWorkout
}

/**
 * Get workouts that are remixes of a given workout
 */
export async function getRemixedWorkouts(sourceWorkoutId: string) {
	const db = getDb()
	const session = await getSessionFromCookie()
	if (!session) throw new ZSAError("NOT_AUTHORIZED", "No session found")

	// Guard against missing user information
	const userId = session.userId || session.user?.id
	if (!userId) {
		throw new ZSAError("NOT_AUTHORIZED", "User ID not found in session")
	}

	const remixedWorkouts = await db
		.select({
			id: workouts.id,
			name: workouts.name,
			description: workouts.description,
			scheme: workouts.scheme,
			scope: workouts.scope,
			scalingGroupId: workouts.scalingGroupId,
			createdAt: workouts.createdAt,
			teamId: workouts.teamId,
			teamName: teamTable.name,
		})
		.from(workouts)
		.innerJoin(teamTable, eq(workouts.teamId, teamTable.id))
		.where(
			and(
				eq(workouts.sourceWorkoutId, sourceWorkoutId),
				// Only show public remixes or remixes from teams the user has access to
				or(
					eq(workouts.scope, "public"),
					inArray(
						workouts.teamId,
						db
							.select({ teamId: teamMembershipTable.teamId })
							.from(teamMembershipTable)
							.where(eq(teamMembershipTable.userId, userId)),
					),
				),
			),
		)
		.orderBy(desc(workouts.updatedAt))

	return remixedWorkouts
}

/**
 * Get the last time a workout was scheduled
 */
export async function getWorkoutLastScheduled(workoutId: string): Promise<{
	scheduledDate: Date
	teamName: string
} | null> {
	const db = getDb()

	const lastScheduled = await db
		.select({
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
			teamName: teamTable.name,
		})
		.from(scheduledWorkoutInstancesTable)
		.innerJoin(
			teamTable,
			eq(scheduledWorkoutInstancesTable.teamId, teamTable.id),
		)
		.where(eq(scheduledWorkoutInstancesTable.workoutId, workoutId))
		.orderBy(desc(scheduledWorkoutInstancesTable.scheduledDate))
		.limit(1)

	return lastScheduled[0] || null
}

/**
 * Get the scheduled history for a workout, filtered by user's teams
 * Includes schedule history for original workout and its remixes
 */
export async function getWorkoutScheduleHistory(
	workoutId: string,
	userTeamIds: string[],
): Promise<
	Array<{
		id: string
		scheduledDate: Date
		teamId: string
		teamName: string
		workoutId: string
		workoutName: string
		isRemix: boolean
	}>
> {
	if (userTeamIds.length === 0) return []

	const db = getDb()

	// Get the workout to check if it's a remix or has remixes
	const workout = await db
		.select({
			id: workouts.id,
			name: workouts.name,
			sourceWorkoutId: workouts.sourceWorkoutId,
		})
		.from(workouts)
		.where(eq(workouts.id, workoutId))
		.limit(1)

	if (!workout[0]) return []

	// Get all related workout IDs (original + remixes)
	const relatedWorkoutIds = [workoutId]

	// If this is a remix, include the original
	if (workout[0].sourceWorkoutId) {
		relatedWorkoutIds.push(workout[0].sourceWorkoutId)
	}

	// Find all remixes of this workout (or remixes of the original if this is a remix) - batched
	const baseWorkoutId = workout[0].sourceWorkoutId || workoutId
	const remixes = await autochunk(
		{ items: userTeamIds, otherParametersCount: 1 }, // +1 for sourceWorkoutId
		async (chunk) =>
			db
				.select({ id: workouts.id })
				.from(workouts)
				.where(
					and(
						eq(workouts.sourceWorkoutId, baseWorkoutId),
						inArray(workouts.teamId, chunk),
					),
				),
	)

	for (const remix of remixes) {
		if (!relatedWorkoutIds.includes(remix.id)) {
			relatedWorkoutIds.push(remix.id)
		}
	}

	// Get all scheduled instances for these workouts, filtered by user's teams (batched)
	// Note: We batch on userTeamIds which is potentially larger, assuming relatedWorkoutIds is small
	const scheduleHistory = await autochunk(
		{ items: userTeamIds, otherParametersCount: 1 + relatedWorkoutIds.length }, // +1 for isNotNull
		async (chunk) =>
			db
				.select({
					id: scheduledWorkoutInstancesTable.id,
					scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
					teamId: scheduledWorkoutInstancesTable.teamId,
					teamName: teamTable.name,
					workoutId: scheduledWorkoutInstancesTable.workoutId,
					workoutName: workouts.name,
				})
				.from(scheduledWorkoutInstancesTable)
				.innerJoin(
					teamTable,
					eq(scheduledWorkoutInstancesTable.teamId, teamTable.id),
				)
				.innerJoin(
					workouts,
					eq(scheduledWorkoutInstancesTable.workoutId, workouts.id),
				)
				.where(
					and(
						isNotNull(scheduledWorkoutInstancesTable.workoutId),
						inArray(
							scheduledWorkoutInstancesTable.workoutId,
							relatedWorkoutIds,
						),
						inArray(scheduledWorkoutInstancesTable.teamId, chunk),
					),
				)
				.orderBy(desc(scheduledWorkoutInstancesTable.scheduledDate)),
	)

	return scheduleHistory
		.filter((row) => row.workoutId !== null)
		.map((row) => ({
			...row,
			workoutId: row.workoutId as string,
			isRemix: row.workoutId !== workoutId,
		}))
}
