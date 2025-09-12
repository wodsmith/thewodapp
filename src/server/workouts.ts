import "server-only"
import { createId } from "@paralleldrive/cuid2"
import {
	and,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	or,
	count,
	desc,
	sql,
} from "drizzle-orm"
import { ZSAError } from "zsa"
import { getDd } from "@/db"
import type { Workout } from "@/db/schema"
import {
	movements,
	results,
	scheduledWorkoutInstancesTable,
	tags,
	workoutMovements,
	workouts,
	workoutTags,
	teamTable,
	teamMembershipTable,
} from "@/db/schema"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { requireVerifiedEmail, getSessionFromCookie } from "@/utils/auth"
import { isTeamMember } from "@/utils/team-auth"
import {
	isTeamSubscribedToProgrammingTrack,
	isWorkoutInTeamSubscribedTrack,
} from "@/server/programming"

/**
 * Helper function to fetch tags by workout IDs
 */
async function fetchTagsByWorkoutId(
	db: ReturnType<typeof getDd>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutTagsData = await db
		.select({
			workoutId: workoutTags.workoutId,
			tagId: tags.id,
			tagName: tags.name,
		})
		.from(workoutTags)
		.innerJoin(tags, eq(workoutTags.tagId, tags.id))
		.where(inArray(workoutTags.workoutId, workoutIds))

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
 * Helper function to fetch movements by workout IDs
 */
async function fetchMovementsByWorkoutId(
	db: ReturnType<typeof getDd>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string; type: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutMovementsData = await db
		.select({
			workoutId: workoutMovements.workoutId,
			movementId: movements.id,
			movementName: movements.name,
			movementType: movements.type,
		})
		.from(workoutMovements)
		.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
		.where(inArray(workoutMovements.workoutId, workoutIds))

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
 * Helper function to fetch today's results by workout IDs
 */
async function fetchTodaysResultsByWorkoutId(
	db: ReturnType<typeof getDd>,
	userId: string,
	workoutIds: string[],
): Promise<Map<string, Array<(typeof todaysResults)[0]>>> {
	if (workoutIds.length === 0) return new Map()

	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const tomorrow = new Date(today)
	tomorrow.setDate(tomorrow.getDate() + 1)

	const todaysResults = await db
		.select()
		.from(results)
		.where(
			and(
				eq(results.userId, userId),
				isNotNull(results.workoutId),
				inArray(results.workoutId, workoutIds),
				gte(results.date, today),
				lt(results.date, tomorrow),
			),
		)

	const resultsByWorkoutId = new Map<string, Array<(typeof todaysResults)[0]>>()

	for (const result of todaysResults) {
		if (result.workoutId) {
			const workoutId = result.workoutId

			if (!resultsByWorkoutId.has(workoutId)) {
				resultsByWorkoutId.set(workoutId, [])
			}
			resultsByWorkoutId.get(workoutId)?.push(result)
		}
	}

	return resultsByWorkoutId
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
	teamId: string
	trackId?: string
	search?: string
	tag?: string
	movement?: string
	type?: "all" | "original" | "remix"
}): Promise<number> {
	const db = getDd()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Build a single query with all necessary joins
	const needsTrackJoin = !!trackId
	const needsTagJoin = !!tag
	const needsMovementJoin = !!movement

	// Build conditions
	const conditions: any[] = []

	// Base condition: team-owned or public workouts
	conditions.push(or(eq(workouts.teamId, teamId), eq(workouts.scope, "public")))

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
		conditions.push(
			or(
				sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
				sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
			),
		)
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
	teamId: string
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
			resultsToday: Array<{
				id: string
				userId: string
				date: Date
				workoutId: string | null
				type: "wod" | "strength" | "monostructural"
				notes: string | null
				scale: string | null
				wodScore: string | null
				setCount: number | null
				distance: number | null
				time: number | null
			}>
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
	const db = getDd()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Determine which joins we need
	const needsTrackJoin = !!trackId
	const needsTagJoin = !!tag
	const needsMovementJoin = !!movement

	// Build conditions
	const conditions: any[] = []

	// Base condition: team-owned or public workouts
	conditions.push(or(eq(workouts.teamId, teamId), eq(workouts.scope, "public")))

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
		conditions.push(
			or(
				sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
				sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
			),
		)
	}

	// Build the complete query based on needed joins
	let baseQuery = db
		.selectDistinct({
			id: workouts.id,
			name: workouts.name,
			description: workouts.description,
			scheme: workouts.scheme,
			scope: workouts.scope,
			teamId: workouts.teamId,
			repsPerRound: workouts.repsPerRound,
			roundsToScore: workouts.roundsToScore,
			sugarId: workouts.sugarId,
			tiebreakScheme: workouts.tiebreakScheme,
			secondaryScheme: workouts.secondaryScheme,
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
		.orderBy(desc(workouts.createdAt))
		.limit(limit)
		.offset(offset)

	const workoutIds = allWorkouts.map((w) => w.id)

	// Fetch related data in parallel
	const [tagsByWorkoutId, movementsByWorkoutId, resultsByWorkoutId] =
		await Promise.all([
			fetchTagsByWorkoutId(db, workoutIds),
			fetchMovementsByWorkoutId(db, workoutIds),
			fetchTodaysResultsByWorkoutId(db, session.user.id, workoutIds),
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
		const sourceWorkouts = await db
			.select({
				id: workouts.id,
				name: workouts.name,
				teamId: workouts.teamId,
			})
			.from(workouts)
			.where(inArray(workouts.id, sourceWorkoutIds))

		sourceWorkoutsMap = new Map(sourceWorkouts.map((w) => [w.id, w]))
	}

	// Fetch team names for source workouts
	const teamIds = Array.from(sourceWorkoutsMap.values())
		.map((w) => w.teamId)
		.filter((id): id is string => id !== null)

	let teamsMap = new Map<string, { name: string }>()
	if (teamIds.length > 0) {
		const teams = await db
			.select({ id: teamTable.id, name: teamTable.name })
			.from(teamTable)
			.where(inArray(teamTable.id, teamIds))

		teamsMap = new Map(teams.map((t) => [t.id, { name: t.name }]))
	}

	// Fetch remix counts for all workouts
	const remixCounts = await db
		.select({
			sourceWorkoutId: workouts.sourceWorkoutId,
			count: count(),
		})
		.from(workouts)
		.where(
			and(
				isNotNull(workouts.sourceWorkoutId),
				inArray(workouts.sourceWorkoutId, workoutIds),
			),
		)
		.groupBy(workouts.sourceWorkoutId)

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
			resultsToday: resultsByWorkoutId.get(w.id) || [],
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
	workout: Omit<Workout, "id" | "updatedAt" | "updateCounter" | "teamId"> & {
		createdAt: Date
	}
	tagIds: string[]
	movementIds: string[]
	teamId: string
}) {
	const db = getDd()

	// Create the workout first
	const newWorkout = await db
		.insert(workouts)
		.values({
			id: `workout_${createId()}`,
			name: workout.name,
			description: workout.description,
			scheme: workout.scheme,
			scope: workout.scope,
			repsPerRound: workout.repsPerRound,
			roundsToScore: workout.roundsToScore,
			sugarId: workout.sugarId,
			tiebreakScheme: workout.tiebreakScheme,
			secondaryScheme: workout.secondaryScheme,
			teamId,
			createdAt: workout.createdAt,
			updatedAt: new Date(),
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
	  })
	| null
> {
	const db = getDd()

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

	return {
		...workout,
		tags: tagObjs,
		movements: movementObjs,
		sourceWorkout,
		remixCount,
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
			| "scope"
			| "repsPerRound"
			| "roundsToScore"
		>
	>
	tagIds: string[]
	movementIds: string[]
}) {
	const db = getDd()

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
	const db = getDd()

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
	const db = getDd()

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
	const db = getDd()

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
	const db = getDd()
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
	console.log("🔍 Permission Debug - createWorkoutRemix:", {
		sourceWorkoutId,
		teamId,
		sourceWorkout: {
			id: sourceWorkout.id,
			scope: sourceWorkout.scope,
			teamId: sourceWorkout.teamId,
			sourceTrackId: sourceWorkout.sourceTrackId,
		},
		session: {
			userId: session.user?.id,
			teams: session.teams?.map((t) => ({ id: t.id, name: t.name })),
		},
	})

	let canViewSource =
		sourceWorkout.scope === "public" ||
		sourceWorkout.teamId === teamId ||
		session.teams?.some((team) => team.id === sourceWorkout.teamId)

	console.log("🔍 Initial permission check:", {
		isPublic: sourceWorkout.scope === "public",
		isOwnedByTeam: sourceWorkout.teamId === teamId,
		isInUserTeams: session.teams?.some(
			(team) => team.id === sourceWorkout.teamId,
		),
		canViewSource,
	})

	// If not already allowed, check if this workout is in any programming track the team is subscribed to
	if (!canViewSource) {
		// First try the sourceTrackId approach if available
		if (sourceWorkout.sourceTrackId) {
			console.log("🔍 Checking programming track subscription:", {
				teamId,
				sourceTrackId: sourceWorkout.sourceTrackId,
			})

			canViewSource = await isTeamSubscribedToProgrammingTrack(
				teamId,
				sourceWorkout.sourceTrackId,
			)

			console.log("🔍 Programming track subscription result:", {
				canViewSource,
			})
		}

		// If still not allowed, check if this workout exists in any subscribed programming track
		if (!canViewSource) {
			console.log(
				"🔍 Checking if workout is in any subscribed programming track",
			)

			canViewSource = await isWorkoutInTeamSubscribedTrack(
				teamId,
				sourceWorkout.id,
			)

			console.log("🔍 Workout in subscribed track result:", { canViewSource })
		}
	}

	console.log("🔍 Final permission result:", { canViewSource })

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
			scope: "private", // Remixes start as private
			repsPerRound: sourceWorkout.repsPerRound,
			roundsToScore: sourceWorkout.roundsToScore,
			sugarId: sourceWorkout.sugarId,
			tiebreakScheme: sourceWorkout.tiebreakScheme,
			secondaryScheme: sourceWorkout.secondaryScheme,
			teamId,
			sourceWorkoutId, // Reference to the original workout
			createdAt: new Date(),
			updatedAt: new Date(),
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
	const db = getDd()
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
	console.log("🔍 Permission Debug - createProgrammingTrackWorkoutRemix:", {
		sourceWorkoutId,
		sourceTrackId,
		teamId,
		sourceWorkout: {
			id: sourceWorkout.id,
			scope: sourceWorkout.scope,
			teamId: sourceWorkout.teamId,
			sourceTrackId: sourceWorkout.sourceTrackId,
		},
		session: {
			userId: session.user?.id,
			teams: session.teams?.map((t) => ({ id: t.id, name: t.name })),
		},
	})

	let canViewSource =
		sourceWorkout.scope === "public" ||
		sourceWorkout.teamId === teamId ||
		session.teams?.some((team) => team.id === sourceWorkout.teamId)

	console.log("🔍 Initial permission check (Programming Track):", {
		isPublic: sourceWorkout.scope === "public",
		isOwnedByTeam: sourceWorkout.teamId === teamId,
		isInUserTeams: session.teams?.some(
			(team) => team.id === sourceWorkout.teamId,
		),
		canViewSource,
	})

	// If not already allowed, check programming track subscription
	if (!canViewSource) {
		console.log("🔍 Checking programming track subscription:", {
			teamId,
			sourceTrackId,
		})

		canViewSource = await isTeamSubscribedToProgrammingTrack(
			teamId,
			sourceTrackId,
		)

		console.log("🔍 Programming track subscription result:", { canViewSource })

		// If still not allowed, check if this workout exists in any subscribed programming track
		if (!canViewSource) {
			console.log(
				"🔍 Checking if workout is in any subscribed programming track",
			)

			canViewSource = await isWorkoutInTeamSubscribedTrack(
				teamId,
				sourceWorkout.id,
			)

			console.log("🔍 Workout in subscribed track result:", { canViewSource })
		}
	}

	console.log("🔍 Final permission result (Programming Track):", {
		canViewSource,
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
			scope: "private", // Remixes start as private
			repsPerRound: sourceWorkout.repsPerRound,
			roundsToScore: sourceWorkout.roundsToScore,
			sugarId: sourceWorkout.sugarId,
			tiebreakScheme: sourceWorkout.tiebreakScheme,
			secondaryScheme: sourceWorkout.secondaryScheme,
			teamId,
			sourceWorkoutId, // Reference to the original workout
			sourceTrackId, // Reference to the original programming track
			createdAt: new Date(),
			updatedAt: new Date(),
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
	const db = getDd()

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
	const db = getDd()
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
		.orderBy(desc(workouts.createdAt))

	return remixedWorkouts
}
