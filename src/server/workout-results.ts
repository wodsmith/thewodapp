import "server-only"
import { and, eq, gte, lte, desc, asc } from "drizzle-orm"
import { getDd } from "@/db"
import {
	results,
	sets,
	scalingLevelsTable,
	scalingGroupsTable,
	workoutScalingDescriptionsTable,
} from "@/db/schema"
import type {
	ResultSet,
	WorkoutResult,
	WorkoutResultWithWorkoutName,
} from "@/types"

// Simple in-memory cache for scaling group data with TTL
const scalingGroupCache = new Map<
	string,
	{
		data: any
		timestamp: number
	}
>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached scaling group data or fetch from database
 */
async function getCachedScalingGroup(scalingGroupId: string) {
	const cacheKey = `scaling-group:${scalingGroupId}`
	const cached = scalingGroupCache.get(cacheKey)

	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data
	}

	const db = getDd()
	const groupData = await db
		.select({
			id: scalingGroupsTable.id,
			title: scalingGroupsTable.title,
			description: scalingGroupsTable.description,
			levels: scalingLevelsTable,
		})
		.from(scalingGroupsTable)
		.leftJoin(
			scalingLevelsTable,
			eq(scalingLevelsTable.scalingGroupId, scalingGroupsTable.id),
		)
		.where(eq(scalingGroupsTable.id, scalingGroupId))
		.orderBy(asc(scalingLevelsTable.position))

	const processedData = {
		id: groupData[0]?.id,
		title: groupData[0]?.title,
		description: groupData[0]?.description,
		levels: groupData.filter((row) => row.levels).map((row) => row.levels),
	}

	scalingGroupCache.set(cacheKey, {
		data: processedData,
		timestamp: Date.now(),
	})

	return processedData
}

/**
 * Clear scaling group cache
 */
export function clearScalingGroupCache(scalingGroupId?: string) {
	if (scalingGroupId) {
		scalingGroupCache.delete(`scaling-group:${scalingGroupId}`)
	} else {
		scalingGroupCache.clear()
	}
}

/**
 * Get scaling information for a workout with caching
 */
export async function getWorkoutScalingInfo({
	workoutId,
	scalingGroupId,
}: {
	workoutId: string
	scalingGroupId?: string
}): Promise<{
	scalingGroup: any
	scalingDescriptions: Record<string, string>
}> {
	const db = getDd()

	// If no scaling group ID provided, try to get from workout
	if (!scalingGroupId) {
		const { workouts } = await import("@/db/schema")
		const workout = await db
			.select({ scalingGroupId: workouts.scalingGroupId })
			.from(workouts)
			.where(eq(workouts.id, workoutId))
			.limit(1)

		scalingGroupId = workout[0]?.scalingGroupId || undefined
	}

	if (!scalingGroupId) {
		return {
			scalingGroup: null,
			scalingDescriptions: {},
		}
	}

	// Get cached scaling group data
	const scalingGroup = await getCachedScalingGroup(scalingGroupId)

	// Get workout-specific scaling descriptions
	const descriptions = await db
		.select({
			scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
			description: workoutScalingDescriptionsTable.description,
		})
		.from(workoutScalingDescriptionsTable)
		.where(eq(workoutScalingDescriptionsTable.workoutId, workoutId))

	const scalingDescriptions = descriptions.reduce(
		(acc, desc) => {
			if (desc.description) {
				acc[desc.scalingLevelId] = desc.description
			}
			return acc
		},
		{} as Record<string, string>,
	)

	return {
		scalingGroup,
		scalingDescriptions,
	}
}

/**
 * Get workout results by workout ID and user ID
 */
export async function getWorkoutResultsByWorkoutAndUser(
	workoutId: string,
	userId: string,
): Promise<WorkoutResult[]> {
	const db = getDd()
	console.log(
		`Fetching workout results for workoutId: ${workoutId}, userId: ${userId}`,
	)
	try {
		const workoutResultsData = await db
			.select()
			.from(results)
			.where(
				and(
					eq(results.workoutId, workoutId),
					eq(results.userId, userId),
					eq(results.type, "wod"),
				),
			)
			.orderBy(results.date)
		console.log(`Found ${workoutResultsData.length} results.`)
		return workoutResultsData
	} catch (error) {
		console.error("Error fetching workout results:", error)
		return []
	}
}

/**
 * Get result sets by result ID
 */
export async function getResultSetsById(
	resultId: string,
): Promise<ResultSet[]> {
	const db = getDd()
	console.log(`Fetching sets for resultId: ${resultId}`)
	try {
		const setDetails = await db
			.select()
			.from(sets)
			.where(eq(sets.resultId, resultId))
			.orderBy(sets.setNumber)
		console.log(`Found ${setDetails.length} sets for resultId ${resultId}.`)
		return setDetails
	} catch (error) {
		console.error(`Error fetching sets for resultId ${resultId}:`, error)
		return []
	}
}

/**
 * Get workout result for a scheduled workout instance
 */
export async function getWorkoutResultForScheduledInstance(
	scheduledInstanceId: string,
	userId: string,
	date: Date,
): Promise<WorkoutResult | null> {
	const db = getDd()

	// Create start and end of day timestamps
	const startOfDay = new Date(date)
	startOfDay.setHours(0, 0, 0, 0)

	const endOfDay = new Date(date)
	endOfDay.setHours(23, 59, 59, 999)

	console.log(
		`Fetching workout result for scheduledInstanceId: ${scheduledInstanceId}, userId: ${userId}, date: ${date.toISOString()}`,
	)

	try {
		const workoutResults = await db
			.select()
			.from(results)
			.where(
				and(
					eq(results.scheduledWorkoutInstanceId, scheduledInstanceId),
					eq(results.userId, userId),
					eq(results.type, "wod"),
					gte(results.date, startOfDay),
					lte(results.date, endOfDay),
				),
			)
			.orderBy(results.date)
			.limit(1)

		if (workoutResults.length > 0) {
			console.log(`Found result for scheduled instance ${scheduledInstanceId}`)
			return workoutResults[0]
		}

		console.log(`No result found for scheduled instance ${scheduledInstanceId}`)
		return null
	} catch (error) {
		console.error(
			"Error fetching workout result for scheduled instance:",
			error,
		)
		return null
	}
}

/**
 * Get workout results with scaling for a specific user (backward compatible)
 */
export async function getWorkoutResultsWithScalingForUser(
	workoutId: string,
	userId: string,
): Promise<
	Array<
		WorkoutResult & {
			scalingLabel?: string
			scalingPosition?: number
		}
	>
> {
	const result = await getWorkoutResultsWithScaling({
		workoutId,
		teamId: "", // Not needed for user-specific query
		userId,
	})
	return result.map((r) => ({
		...r,
		scalingLevelLabel: r.scalingLabel,
		scalingLevelPosition: r.scalingPosition,
	}))
}

/**
 * Get workout results with complete scaling information including groups and descriptions
 */
export async function getWorkoutResultsWithScaling({
	workoutId,
	teamId,
	userId,
}: {
	workoutId: string
	teamId?: string
	userId?: string
}): Promise<
	Array<
		WorkoutResult & {
			scalingLabel?: string
			scalingPosition?: number
			scalingGroupTitle?: string
			scalingDescription?: string
		}
	>
> {
	const db = getDd()
	console.log(
		`Fetching workout results with scaling for workoutId: ${workoutId}, teamId: ${teamId}${userId ? `, userId: ${userId}` : ""}`,
	)
	try {
		const query = db
			.select({
				id: results.id,
				userId: results.userId,
				date: results.date,
				workoutId: results.workoutId,
				type: results.type,
				notes: results.notes,
				scale: results.scale,
				scalingLevelId: results.scalingLevelId,
				asRx: results.asRx,
				scalingLabel: scalingLevelsTable.label,
				scalingPosition: scalingLevelsTable.position,
				scalingGroupTitle: scalingGroupsTable.title,
				scalingDescription: workoutScalingDescriptionsTable.description,
				wodScore: results.wodScore,
				setCount: results.setCount,
				distance: results.distance,
				time: results.time,
				createdAt: results.createdAt,
				updatedAt: results.updatedAt,
				updateCounter: results.updateCounter,
				programmingTrackId: results.programmingTrackId,
				scheduledWorkoutInstanceId: results.scheduledWorkoutInstanceId,
			})
			.from(results)
			.leftJoin(
				scalingLevelsTable,
				eq(results.scalingLevelId, scalingLevelsTable.id),
			)
			.leftJoin(
				scalingGroupsTable,
				eq(scalingLevelsTable.scalingGroupId, scalingGroupsTable.id),
			)
			.leftJoin(
				workoutScalingDescriptionsTable,
				and(
					eq(workoutScalingDescriptionsTable.workoutId, results.workoutId),
					eq(
						workoutScalingDescriptionsTable.scalingLevelId,
						results.scalingLevelId,
					),
				),
			)

		const conditions = [
			eq(results.workoutId, workoutId),
			eq(results.type, "wod"),
		]

		if (userId) {
			conditions.push(eq(results.userId, userId))
		}

		const workoutResultsData = await query
			.where(and(...conditions))
			.orderBy(asc(scalingLevelsTable.position), desc(results.wodScore))

		console.log(
			`Found ${workoutResultsData.length} results with scaling information.`,
		)
		return workoutResultsData.map((result) => ({
			...result,
			scalingLabel: result.scalingLabel || undefined,
			scalingPosition: result.scalingPosition ?? undefined,
			scalingGroupTitle: result.scalingGroupTitle || undefined,
			scalingDescription: result.scalingDescription || undefined,
		}))
	} catch (error) {
		console.error("Error fetching workout results with scaling:", error)
		return []
	}
}

/**
 * Get workout results for multiple scheduled workout instances
 */
/**
 * Helper function to format a result with scaling information for display
 */
export function formatResultWithScaling(
	result: WorkoutResult & {
		scalingLabel?: string
		scalingPosition?: number
		scalingGroupTitle?: string
		scalingDescription?: string
	},
): {
	displayLabel: string
	displayDescription?: string
	position: number
	isRx: boolean
} {
	const displayLabel = result.scalingLabel || result.scale || "Unknown"
	const position = result.scalingPosition ?? 999
	const isRx = result.asRx || false

	return {
		displayLabel,
		displayDescription: result.scalingDescription,
		position,
		isRx,
	}
}

/**
 * Get workout leaderboard with results grouped and sorted by scaling level
 */
export async function getWorkoutLeaderboard({
	workoutId,
	teamId,
}: {
	workoutId: string
	teamId: string
}): Promise<
	Array<{
		scalingLabel: string
		scalingPosition: number
		scalingGroupTitle?: string
		results: Array<
			WorkoutResult & {
				userName?: string
				userAvatar?: string
				scalingDescription?: string
			}
		>
	}>
> {
	const db = getDd()
	console.log(
		`Fetching leaderboard for workoutId: ${workoutId}, teamId: ${teamId}`,
	)

	try {
		const { userTable } = await import("@/db/schema")

		const leaderboardData = await db
			.select({
				id: results.id,
				userId: results.userId,
				userFirstName: userTable.firstName,
				userLastName: userTable.lastName,
				userAvatar: userTable.avatar,
				date: results.date,
				workoutId: results.workoutId,
				type: results.type,
				notes: results.notes,
				scale: results.scale,
				scalingLevelId: results.scalingLevelId,
				asRx: results.asRx,
				scalingLabel: scalingLevelsTable.label,
				scalingPosition: scalingLevelsTable.position,
				scalingGroupTitle: scalingGroupsTable.title,
				scalingDescription: workoutScalingDescriptionsTable.description,
				wodScore: results.wodScore,
				setCount: results.setCount,
				distance: results.distance,
				time: results.time,
				createdAt: results.createdAt,
				updatedAt: results.updatedAt,
				updateCounter: results.updateCounter,
				programmingTrackId: results.programmingTrackId,
				scheduledWorkoutInstanceId: results.scheduledWorkoutInstanceId,
			})
			.from(results)
			.leftJoin(userTable, eq(results.userId, userTable.id))
			.leftJoin(
				scalingLevelsTable,
				eq(results.scalingLevelId, scalingLevelsTable.id),
			)
			.leftJoin(
				scalingGroupsTable,
				eq(scalingLevelsTable.scalingGroupId, scalingGroupsTable.id),
			)
			.leftJoin(
				workoutScalingDescriptionsTable,
				and(
					eq(workoutScalingDescriptionsTable.workoutId, results.workoutId),
					eq(
						workoutScalingDescriptionsTable.scalingLevelId,
						results.scalingLevelId,
					),
				),
			)
			.where(and(eq(results.workoutId, workoutId), eq(results.type, "wod")))
			.orderBy(asc(scalingLevelsTable.position), desc(results.wodScore))

		const groupedResults = new Map<
			string,
			{
				scalingLabel: string
				scalingPosition: number
				scalingGroupTitle?: string
				results: Array<any>
			}
		>()

		for (const result of leaderboardData) {
			const scalingKey = result.scalingLevelId || result.scale || "unknown"
			const scalingLabel = result.scalingLabel || result.scale || "Unknown"
			const scalingPosition = result.scalingPosition ?? 999

			if (!groupedResults.has(scalingKey)) {
				groupedResults.set(scalingKey, {
					scalingLabel,
					scalingPosition,
					scalingGroupTitle: result.scalingGroupTitle || undefined,
					results: [],
				})
			}

			const group = groupedResults.get(scalingKey)
			if (group) {
				const userName = result.userFirstName
					? `${result.userFirstName}${result.userLastName ? ` ${result.userLastName}` : ""}`
					: undefined
				group.results.push({
					...result,
					userName,
					userAvatar: result.userAvatar || undefined,
					scalingDescription: result.scalingDescription || undefined,
				})
			}
		}

		const sortedGroups = Array.from(groupedResults.values()).sort(
			(a, b) => a.scalingPosition - b.scalingPosition,
		)

		console.log(
			`Leaderboard has ${leaderboardData.length} results in ${sortedGroups.length} scaling groups`,
		)
		return sortedGroups
	} catch (error) {
		console.error("Error fetching workout leaderboard:", error)
		return []
	}
}

export async function getWorkoutResultsForScheduledInstances(
	scheduledInstances: Array<{
		id: string
		scheduledDate: Date
		workoutId?: string
	}>,
	userId: string,
): Promise<Record<string, WorkoutResult>> {
	const db = getDd()
	const resultsMap: Record<string, WorkoutResult> = {}

	if (scheduledInstances.length === 0) {
		return resultsMap
	}

	console.log(
		`Fetching workout results for ${scheduledInstances.length} scheduled instances for user ${userId}`,
	)

	try {
		// Group instances by date for efficient querying
		const instancesByDate = new Map<
			string,
			Array<{ id: string; workoutId?: string }>
		>()

		for (const instance of scheduledInstances) {
			const dateKey = instance.scheduledDate.toDateString()
			if (!instancesByDate.has(dateKey)) {
				instancesByDate.set(dateKey, [])
			}
			instancesByDate.get(dateKey)?.push({
				id: instance.id,
				workoutId: instance.workoutId,
			})
		}

		// Query for each date group
		for (const [dateKey, instances] of instancesByDate.entries()) {
			const date = new Date(dateKey)
			const startOfDay = new Date(date)
			startOfDay.setHours(0, 0, 0, 0)

			const endOfDay = new Date(date)
			endOfDay.setHours(23, 59, 59, 999)

			const dayResults = await db
				.select()
				.from(results)
				.where(
					and(
						eq(results.userId, userId),
						eq(results.type, "wod"),
						gte(results.date, startOfDay),
						lte(results.date, endOfDay),
					),
				)

			// Map results to their scheduled instance IDs
			for (const result of dayResults) {
				// First try to match by scheduledWorkoutInstanceId
				const matchedInstance = instances.find(
					(inst) => result.scheduledWorkoutInstanceId === inst.id,
				)

				if (matchedInstance) {
					resultsMap[matchedInstance.id] = result
				} else {
					// If no scheduledWorkoutInstanceId match, try to match by workoutId
					const matchedByWorkout = instances.find(
						(inst) => inst.workoutId && result.workoutId === inst.workoutId,
					)
					if (matchedByWorkout) {
						resultsMap[matchedByWorkout.id] = result
					}
				}
			}
		}

		console.log(
			`Found ${Object.keys(resultsMap).length} results out of ${scheduledInstances.length} instances`,
		)
		return resultsMap
	} catch (error) {
		console.error(
			"Error fetching workout results for scheduled instances:",
			error,
		)
		return resultsMap
	}
}
