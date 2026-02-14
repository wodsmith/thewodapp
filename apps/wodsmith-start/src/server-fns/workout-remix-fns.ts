/**
 * Workout Remix Server Functions for TanStack Start
 * Handles remix tracking: source workouts, remix counts, and creating remixes
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, count, desc, eq, inArray, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { teamMembershipTable, teamTable } from "@/db/schemas/teams"
import {
	movements,
	tags,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"

// Input validation schemas
const getRemixedWorkoutsInputSchema = z.object({
	sourceWorkoutId: z.string().min(1, "Source workout ID is required"),
})

const getSourceWorkoutInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
})

const createWorkoutRemixInputSchema = z.object({
	sourceWorkoutId: z.string().min(1, "Source workout ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const getRemixCountInputSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
})

// Types
export interface RemixedWorkout {
	id: string
	name: string
	description: string
	scheme: string
	scope: string
	scalingGroupId: string | null
	createdAt: Date
	teamId: string | null
	teamName: string
}

export interface SourceWorkout {
	id: string
	name: string
	teamId: string | null
	teamName: string | null
}

/**
 * Get all workouts that are remixes of a given source workout
 * Only returns remixes that the user has access to (public or from their teams)
 */
export const getRemixedWorkoutsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getRemixedWorkoutsInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ remixes: RemixedWorkout[] }> => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const userId = session.userId

		// Get user's team IDs for access filtering
		const userMemberships = await db
			.select({ teamId: teamMembershipTable.teamId })
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.userId, userId))

		const userTeamIds = userMemberships.map((m) => m.teamId)

		// Get remixed workouts with team names
		// Filter to only show public remixes or remixes from teams the user has access to
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
					eq(workouts.sourceWorkoutId, data.sourceWorkoutId),
					// Only show public remixes or remixes from user's teams
					userTeamIds.length > 0
						? or(
								eq(workouts.scope, "public"),
								inArray(workouts.teamId, userTeamIds),
							)
						: eq(workouts.scope, "public"),
				),
			)
			.orderBy(desc(workouts.updatedAt))

		return { remixes: remixedWorkouts }
	})

/**
 * Get the source workout if the given workout is a remix
 * Returns null if the workout is not a remix
 */
export const getSourceWorkoutFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getSourceWorkoutInputSchema.parse(data))
	.handler(
		async ({ data }): Promise<{ sourceWorkout: SourceWorkout | null }> => {
			const db = getDb()

			// Verify authentication
			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			// First, get the workout to check if it has a sourceWorkoutId
			const [workout] = await db
				.select({
					sourceWorkoutId: workouts.sourceWorkoutId,
				})
				.from(workouts)
				.where(eq(workouts.id, data.workoutId))
				.limit(1)

			if (!workout?.sourceWorkoutId) {
				return { sourceWorkout: null }
			}

			// Get the source workout with team name
			const [source] = await db
				.select({
					id: workouts.id,
					name: workouts.name,
					teamId: workouts.teamId,
					teamName: teamTable.name,
				})
				.from(workouts)
				.leftJoin(teamTable, eq(workouts.teamId, teamTable.id))
				.where(eq(workouts.id, workout.sourceWorkoutId))
				.limit(1)

			if (!source) {
				return { sourceWorkout: null }
			}

			return {
				sourceWorkout: {
					id: source.id,
					name: source.name,
					teamId: source.teamId,
					teamName: source.teamName,
				},
			}
		},
	)

/**
 * Get the count of remixes for a given workout
 */
export const getRemixCountFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getRemixCountInputSchema.parse(data))
	.handler(async ({ data }): Promise<{ count: number }> => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const [result] = await db
			.select({ count: count() })
			.from(workouts)
			.where(eq(workouts.sourceWorkoutId, data.workoutId))

		return { count: result?.count || 0 }
	})

/**
 * Create a remix of an existing workout
 * Copies all workout data and assigns it to the specified team with sourceWorkoutId reference
 */
export const createWorkoutRemixFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createWorkoutRemixInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Validate that the user is a member of the target team
		const [membership] = await db
			.select()
			.from(teamMembershipTable)
			.where(
				and(
					eq(teamMembershipTable.teamId, data.teamId),
					eq(teamMembershipTable.userId, session.userId),
				),
			)
			.limit(1)

		if (!membership) {
			throw new Error("You are not authorized to create workouts for this team")
		}

		// Get the source workout
		const [sourceWorkout] = await db
			.select()
			.from(workouts)
			.where(eq(workouts.id, data.sourceWorkoutId))
			.limit(1)

		if (!sourceWorkout) {
			throw new Error("Source workout not found")
		}

		// Check if user can view the source workout
		// User can view if: it's public OR they belong to the workout's team
		const userMemberships = await db
			.select({ teamId: teamMembershipTable.teamId })
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.userId, session.userId))

		const userTeamIds = userMemberships.map((m) => m.teamId)

		const canViewSource =
			sourceWorkout.scope === "public" ||
			sourceWorkout.teamId === data.teamId ||
			(sourceWorkout.teamId && userTeamIds.includes(sourceWorkout.teamId))

		if (!canViewSource) {
			throw new Error("You don't have permission to view the source workout")
		}

		// Get source workout's tags and movements
		const workoutTagRows = await db
			.select({ tagId: workoutTags.tagId })
			.from(workoutTags)
			.where(eq(workoutTags.workoutId, data.sourceWorkoutId))

		const tagIds = workoutTagRows.map((wt) => wt.tagId)

		const workoutMovementRows = await db
			.select({ movementId: workoutMovements.movementId })
			.from(workoutMovements)
			.where(eq(workoutMovements.workoutId, data.sourceWorkoutId))

		const movementIds = workoutMovementRows
			.map((wm) => wm.movementId)
			.filter((id): id is string => id !== null)

		// Create the remixed workout
		const newWorkoutId = `workout_${createId()}`
		await db.insert(workouts).values({
			id: newWorkoutId,
			name: sourceWorkout.name,
			description: sourceWorkout.description,
			scheme: sourceWorkout.scheme,
			scoreType: sourceWorkout.scoreType,
			scope: "private", // Remixes start as private
			repsPerRound: sourceWorkout.repsPerRound,
			roundsToScore: sourceWorkout.roundsToScore,
			sugarId: sourceWorkout.sugarId,
			tiebreakScheme: sourceWorkout.tiebreakScheme,
			timeCap: sourceWorkout.timeCap,
			teamId: data.teamId,
			sourceWorkoutId: data.sourceWorkoutId, // Reference to the original workout
		})

		// Insert workout-tag and workout-movement relationships in a transaction
		await db.transaction(async (tx) => {
			if (tagIds.length > 0) {
				await tx.insert(workoutTags).values(
					tagIds.map((tagId) => ({
						id: `workout_tag_${createId()}`,
						workoutId: newWorkoutId,
						tagId,
					})),
				)
			}

			if (movementIds.length > 0) {
				await tx.insert(workoutMovements).values(
					movementIds.map((movementId) => ({
						id: `workout_movement_${createId()}`,
						workoutId: newWorkoutId,
						movementId,
					})),
				)
			}
		})

		// Get the full workout with tags and movements for return
		const [createdWorkout] = await db
			.select()
			.from(workouts)
			.where(eq(workouts.id, newWorkoutId))
			.limit(1)

		// Get tags for return
		let workoutTagsData: Array<{ id: string; name: string }> = []
		if (tagIds.length > 0) {
			workoutTagsData = await db
				.select({ id: tags.id, name: tags.name })
				.from(tags)
				.where(inArray(tags.id, tagIds))
		}

		// Get movements for return
		let workoutMovementsData: Array<{
			id: string
			name: string
			type: string
		}> = []
		if (movementIds.length > 0) {
			workoutMovementsData = await db
				.select({
					id: movements.id,
					name: movements.name,
					type: movements.type,
				})
				.from(movements)
				.where(inArray(movements.id, movementIds))
		}

		return {
			workout: {
				...createdWorkout,
				tags: workoutTagsData,
				movements: workoutMovementsData,
			},
		}
	})

/**
 * Get remix info for a workout (source and count) in a single call
 * Optimized for the workout detail page loader
 */
export const getWorkoutRemixInfoFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getSourceWorkoutInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{
			sourceWorkout: SourceWorkout | null
			remixCount: number
		}> => {
			const db = getDb()

			// Verify authentication
			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			// Get the workout with its sourceWorkoutId
			const [workout] = await db
				.select({
					sourceWorkoutId: workouts.sourceWorkoutId,
				})
				.from(workouts)
				.where(eq(workouts.id, data.workoutId))
				.limit(1)

			if (!workout) {
				return { sourceWorkout: null, remixCount: 0 }
			}

			// Run both queries in parallel
			const [sourceWorkoutResult, remixCountResult] = await Promise.all([
				// Get source workout if this is a remix
				workout.sourceWorkoutId
					? db
							.select({
								id: workouts.id,
								name: workouts.name,
								teamId: workouts.teamId,
								teamName: teamTable.name,
							})
							.from(workouts)
							.leftJoin(teamTable, eq(workouts.teamId, teamTable.id))
							.where(eq(workouts.id, workout.sourceWorkoutId))
							.limit(1)
					: Promise.resolve([]),
				// Get remix count
				db
					.select({ count: count() })
					.from(workouts)
					.where(eq(workouts.sourceWorkoutId, data.workoutId)),
			])

			const source = sourceWorkoutResult[0]
			const remixCount = remixCountResult[0]?.count || 0

			return {
				sourceWorkout: source
					? {
							id: source.id,
							name: source.name,
							teamId: source.teamId,
							teamName: source.teamName,
						}
					: null,
				remixCount,
			}
		},
	)
