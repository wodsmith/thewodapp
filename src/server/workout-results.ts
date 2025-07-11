import "server-only"
import { and, eq } from "drizzle-orm"
import { getDd } from "@/db"
import { results, sets } from "@/db/schema"
import type { ResultSet, WorkoutResult } from "@/types"

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
