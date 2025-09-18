import "server-only"
import { and, eq, gte, lte } from "drizzle-orm"
import { getDd } from "@/db"
import { results, sets, scalingLevelsTable } from "@/db/schema"
import type {
	ResultSet,
	WorkoutResult,
	WorkoutResultWithWorkoutName,
} from "@/types"

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
 * Get workout results with scaling label information by workout ID and user ID
 */
export async function getWorkoutResultsWithScaling(
	workoutId: string,
	userId: string,
): Promise<
	Array<
		WorkoutResult & {
			scalingLevelLabel?: string
			scalingLevelPosition?: number
		}
	>
> {
	const db = getDd()
	console.log(
		`Fetching workout results with scaling for workoutId: ${workoutId}, userId: ${userId}`,
	)
	try {
		const workoutResultsData = await db
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
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
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
			.where(
				and(
					eq(results.workoutId, workoutId),
					eq(results.userId, userId),
					eq(results.type, "wod"),
				),
			)
			.orderBy(results.date)

		console.log(
			`Found ${workoutResultsData.length} results with scaling information.`,
		)
		return workoutResultsData.map((result) => ({
			...result,
			scalingLevelLabel: result.scalingLevelLabel || undefined,
			scalingLevelPosition: result.scalingLevelPosition ?? undefined,
		}))
	} catch (error) {
		console.error("Error fetching workout results with scaling:", error)
		return []
	}
}

/**
 * Get workout results for multiple scheduled workout instances
 */
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
