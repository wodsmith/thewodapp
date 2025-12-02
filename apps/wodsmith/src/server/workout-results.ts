import "server-only"
/// <reference types="@cloudflare/workers-types" />
import { and, asc, desc, eq, gte, lte } from "drizzle-orm"
import { getDb } from "@/db"
import {
	results,
	scalingGroupsTable,
	scalingLevelsTable,
	sets,
	workoutScalingDescriptionsTable,
} from "@/db/schema"
import type { ResultSet, WorkoutResult } from "@/types"
import { ScalingQueryMonitor } from "@/utils/query-monitor"

// Multi-tier cache system for scaling data
type CachedScalingLevel = {
	id: string
	label: string
	position: number
	scalingGroupId: string
}

type CachedScalingGroup = {
	id: string
	title: string
	description: string | null
	levels: CachedScalingLevel[]
}

const scalingGroupCache = new Map<
	string,
	{
		data: CachedScalingGroup
		timestamp: number
	}
>()
type WorkoutResolution = {
	scalingGroupId: string | null
	levels: CachedScalingLevel[]
}

const workoutResolutionCache = new Map<
	string,
	{
		data: WorkoutResolution
		timestamp: number
	}
>()

// Cache TTL configuration
const CACHE_TTL = {
	IN_MEMORY: 5 * 60 * 1000, // 5 minutes
	KV_EDGE: 60 * 60, // 1 hour in seconds for KV
	WORKOUT_RESOLUTION: 15 * 60 * 1000, // 15 minutes
	GLOBAL_DEFAULT: Infinity, // Never expires in memory
} as const

// Global default scaling group cache (permanent in memory)
let globalDefaultScalingGroup: CachedScalingGroup | null = null
let globalDefaultTimestamp = 0

/**
 * Get the Cloudflare KV binding for caching
 */
function getKVBinding(): KVNamespace | null {
	// In Cloudflare Workers, KV is available via env.YOUR_KV_NAMESPACE
	// For development, we fall back to in-memory cache
	if (
		typeof process !== "undefined" &&
		process.env.NODE_ENV === "development"
	) {
		return null
	}

	// In production, this would be available via context/env
	// For now, return null to use in-memory fallback
	return null
}

/**
 * Get cached scaling group data with multi-tier caching (KV + memory)
 */
async function getCachedScalingGroup(scalingGroupId: string) {
	const cacheKey = `scaling-group:${scalingGroupId}`
	const kvBinding = getKVBinding()

	// 1. Check in-memory cache first (fastest)
	const memCached = scalingGroupCache.get(cacheKey)
	if (memCached && Date.now() - memCached.timestamp < CACHE_TTL.IN_MEMORY) {
		return memCached.data
	}

	// 2. Check KV cache (edge distributed)
	if (kvBinding) {
		try {
			const kvCached = await kvBinding.get(cacheKey, "json")
			if (
				kvCached &&
				typeof kvCached === "object" &&
				"id" in kvCached &&
				"levels" in kvCached
			) {
				// Update in-memory cache
				scalingGroupCache.set(cacheKey, {
					data: kvCached as CachedScalingGroup,
					timestamp: Date.now(),
				})
				return kvCached as CachedScalingGroup
			}
		} catch (error) {
			console.warn("KV cache read failed:", error)
		}
	}

	// 3. Fetch from database with monitoring
	const db = getDb()
	const groupData = (await ScalingQueryMonitor.monitorScalingGroupFetch(
		scalingGroupId,
		() =>
			db
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
				.orderBy(asc(scalingLevelsTable.position)),
	)) as Array<{
		id: string
		title: string
		description: string | null
		levels: {
			id: string
			label: string
			position: number
			scalingGroupId: string
		} | null
	}>

	const firstRow = groupData[0]
	if (!firstRow) {
		throw new Error("Scaling group not found")
	}

	const processedData: CachedScalingGroup = {
		id: firstRow.id,
		title: firstRow.title,
		description: firstRow.description,
		levels: groupData
			.filter(
				(row): row is typeof row & { levels: NonNullable<typeof row.levels> } =>
					row.levels !== null,
			)
			.map((row) => row.levels),
	}

	// 4. Update all caches
	scalingGroupCache.set(cacheKey, {
		data: processedData,
		timestamp: Date.now(),
	})

	if (kvBinding) {
		try {
			await kvBinding.put(cacheKey, JSON.stringify(processedData), {
				expirationTtl: CACHE_TTL.KV_EDGE,
			})
		} catch (error) {
			console.warn("KV cache write failed:", error)
		}
	}

	return processedData
}

/**
 * Get global default scaling group with permanent in-memory caching
 */
async function _getGlobalDefaultScalingGroup() {
	// Check if we have it cached and it's not too old (refresh every hour)
	const ONE_HOUR = 60 * 60 * 1000
	if (
		globalDefaultScalingGroup &&
		Date.now() - globalDefaultTimestamp < ONE_HOUR
	) {
		return globalDefaultScalingGroup
	}

	const db = getDb()
	const [globalDefault] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.isSystem, 1))
		.limit(1)

	if (globalDefault) {
		// Fetch the levels for the global default group
		const levels = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
				scalingGroupId: scalingLevelsTable.scalingGroupId,
			})
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, globalDefault.id))
			.orderBy(scalingLevelsTable.position)

		globalDefaultScalingGroup = {
			id: globalDefault.id,
			title: globalDefault.title,
			description: globalDefault.description,
			levels: levels,
		}
		globalDefaultTimestamp = Date.now()
	}

	return globalDefault
}

/**
 * Get cached workout scaling resolution
 */
async function _getCachedWorkoutResolution(
	workoutId: string,
	teamId: string,
	trackId?: string,
) {
	const cacheKey = `workout-resolution:${workoutId}:${teamId}:${
		trackId || "none"
	}`
	const cached = workoutResolutionCache.get(cacheKey)

	if (cached && Date.now() - cached.timestamp < CACHE_TTL.WORKOUT_RESOLUTION) {
		return cached.data
	}

	// Import here to avoid circular dependency
	const { resolveScalingLevelsForWorkout } = await import(
		"@/server/scaling-levels"
	)

	const resolution = await resolveScalingLevelsForWorkout({
		workoutId,
		teamId,
		trackId,
	})

	// Transform the resolution to match our cache format
	const transformedResolution: WorkoutResolution = {
		scalingGroupId: resolution.scalingGroupId,
		levels: resolution.levels.map((level) => ({
			id: level.id,
			label: level.label,
			position: level.position,
			scalingGroupId: level.scalingGroupId,
		})),
	}

	workoutResolutionCache.set(cacheKey, {
		data: transformedResolution,
		timestamp: Date.now(),
	})

	return resolution
}

/**
 * Clear scaling group cache with KV support
 */
export function clearScalingGroupCache(scalingGroupId?: string) {
	if (scalingGroupId) {
		scalingGroupCache.delete(`scaling-group:${scalingGroupId}`)
		// Also clear from KV if available
		const kvBinding = getKVBinding()
		if (kvBinding) {
			kvBinding
				.delete(`scaling-group:${scalingGroupId}`)
				.catch((error: unknown) => {
					console.warn("KV cache delete failed:", error)
				})
		}
	} else {
		scalingGroupCache.clear()
		workoutResolutionCache.clear()
		globalDefaultScalingGroup = null
		globalDefaultTimestamp = 0
	}
}

/**
 * Clear workout resolution cache for specific workout or team
 */
export function clearWorkoutResolutionCache(
	workoutId?: string,
	teamId?: string,
) {
	if (workoutId && teamId) {
		// Clear specific workout-team combinations
		for (const [key] of workoutResolutionCache) {
			if (key.includes(`${workoutId}:${teamId}`)) {
				workoutResolutionCache.delete(key)
			}
		}
	} else if (workoutId) {
		// Clear all resolutions for a workout
		for (const [key] of workoutResolutionCache) {
			if (key.startsWith(`workout-resolution:${workoutId}:`)) {
				workoutResolutionCache.delete(key)
			}
		}
	} else if (teamId) {
		// Clear all resolutions for a team
		for (const [key] of workoutResolutionCache) {
			if (key.includes(`:${teamId}:`)) {
				workoutResolutionCache.delete(key)
			}
		}
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
	scalingGroup: CachedScalingGroup | null
	scalingDescriptions: Record<string, string>
}> {
	const db = getDb()

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
	const db = getDb()
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
	const db = getDb()
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
	const db = getDb()

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
			const result = workoutResults[0]
			if (!result) return null
			console.log(`Found result for scheduled instance ${scheduledInstanceId}`)
			return result
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
	const mappedResults = result.map((r) => ({
		...r,
		scalingLevelLabel: r.scalingLabel,
		scalingLevelPosition: r.scalingPosition,
	}))

	console.log(
		"[getWorkoutResultsWithScalingForUser] Mapped results:",
		mappedResults.map((r) => ({
			id: r.id,
			scalingLevelId: r.scalingLevelId,
			scalingLevelLabel: r.scalingLevelLabel,
			scale: r.scale,
		})),
	)

	return mappedResults
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
	const db = getDb()
	console.log(
		`Fetching workout results with scaling for workoutId: ${workoutId}, teamId: ${teamId}${
			userId ? `, userId: ${userId}` : ""
		}`,
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
				// Competition-specific fields
				competitionEventId: results.competitionEventId,
				competitionRegistrationId: results.competitionRegistrationId,
				scoreStatus: results.scoreStatus,
				tieBreakScore: results.tieBreakScore,
				secondaryScore: results.secondaryScore,
				enteredBy: results.enteredBy,
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
		console.log(
			"[getWorkoutResultsWithScaling] Sample result:",
			workoutResultsData[0]
				? {
						id: workoutResultsData[0].id,
						scalingLevelId: workoutResultsData[0].scalingLevelId,
						scalingLabel: workoutResultsData[0].scalingLabel,
						scale: workoutResultsData[0].scale,
					}
				: "No results",
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
	const db = getDb()
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
				// Competition-specific fields
				competitionEventId: results.competitionEventId,
				competitionRegistrationId: results.competitionRegistrationId,
				scoreStatus: results.scoreStatus,
				tieBreakScore: results.tieBreakScore,
				secondaryScore: results.secondaryScore,
				enteredBy: results.enteredBy,
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
				results: Array<WorkoutResult>
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
				group.results.push(result)
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
	const db = getDb()
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
			`Found ${Object.keys(resultsMap).length} results out of ${
				scheduledInstances.length
			} instances`,
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
