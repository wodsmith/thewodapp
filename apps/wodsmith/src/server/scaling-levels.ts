import "server-only"

import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	programmingTracksTable,
	scalingGroupsTable,
	scalingLevelsTable,
	TEAM_PERMISSIONS,
	teamTable,
	workoutScalingDescriptionsTable,
	workouts,
} from "@/db/schema"
import { createWorkoutRemix } from "@/server/workouts"
import { requireTeamPermission } from "@/utils/team-auth"

export interface CreateScalingLevelInput {
	teamId: string | null
	scalingGroupId: string
	label: string
	position?: number
	teamSize?: number
}

export interface UpdateScalingLevelInput {
	label?: string
	position?: number
	teamSize?: number
}

export async function listScalingLevels({
	scalingGroupId,
}: {
	scalingGroupId: string
}) {
	const db = getDb()
	const rows = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
		.orderBy(asc(scalingLevelsTable.position))
	return rows
}

export async function createScalingLevel({
	teamId,
	scalingGroupId,
	label,
	position,
	teamSize = 1,
}: CreateScalingLevelInput) {
	const db = getDb()

	// Verify access to group
	const [group] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, scalingGroupId))

	if (!group) throw new Error("Scaling group not found")

	if (group.teamId) {
		if (!teamId) throw new Error("Forbidden")
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)
		if (group.teamId !== teamId) throw new Error("Forbidden")
	}

	// Determine position (0 = hardest). If not provided, append to end.
	let newPosition = position
	if (newPosition === undefined || newPosition === null) {
		const result = (await db
			.select({ maxPos: sql<number>`max(${scalingLevelsTable.position})` })
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))) as Array<{
			maxPos: number | null
		}>
		const maxPos = result[0]?.maxPos ?? null
		newPosition = (maxPos ?? -1) + 1
	}

	const [created] = await db
		.insert(scalingLevelsTable)
		.values({
			scalingGroupId,
			label,
			position: newPosition,
			teamSize,
		})
		.returning()

	if (!created) {
		throw new Error("Failed to create scaling level")
	}
	return created
}

export async function updateScalingLevel({
	teamId,
	scalingLevelId,
	data,
}: {
	teamId: string | null
	scalingLevelId: string
	data: UpdateScalingLevelInput
}) {
	const db = getDb()

	// Load level and group
	const [level] = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.id, scalingLevelId))
	if (!level) return null

	const [group] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, level.scalingGroupId))
	if (!group) return null

	if (group.teamId) {
		if (!teamId) return null
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)
		if (group.teamId !== teamId) return null
	}

	const [updated] = await db
		.update(scalingLevelsTable)
		.set({
			label: data.label ?? level.label,
			position: data.position ?? level.position,
			teamSize: data.teamSize ?? level.teamSize,
			updatedAt: new Date(),
		})
		.where(eq(scalingLevelsTable.id, scalingLevelId))
		.returning()

	return updated
}

export async function reorderScalingLevels({
	teamId,
	scalingGroupId,
	orderedLevelIds,
}: {
	teamId: string | null
	scalingGroupId: string
	orderedLevelIds: string[]
}) {
	const db = getDb()

	const [group] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, scalingGroupId))
	if (!group) return { success: false, error: "Group not found" }

	if (group.teamId) {
		if (!teamId) return { success: false, error: "Forbidden" }
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)
		if (group.teamId !== teamId) return { success: false, error: "Forbidden" }
	}

	// Update positions according to provided order (index is new position)
	for (let i = 0; i < orderedLevelIds.length; i++) {
		const id = orderedLevelIds[i]
		if (!id) continue
		await db
			.update(scalingLevelsTable)
			.set({ position: i, updatedAt: new Date() })
			.where(
				and(
					eq(scalingLevelsTable.id, id),
					eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
				),
			)
	}

	return { success: true }
}

export async function deleteScalingLevel({
	teamId,
	scalingLevelId,
}: {
	teamId: string | null
	scalingLevelId: string
}) {
	const db = getDb()

	// Verify ownership
	const [level] = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.id, scalingLevelId))
	if (!level) return { success: true }

	const [group] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, level.scalingGroupId))
	if (!group) return { success: true }

	if (group.teamId) {
		if (!teamId) return { success: false, error: "Forbidden" }
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)
		if (group.teamId !== teamId) return { success: false, error: "Forbidden" }
	}

	await db
		.delete(scalingLevelsTable)
		.where(eq(scalingLevelsTable.id, scalingLevelId))
	return { success: true }
}

// Resolve scaling levels for a given workout using resolution order:
// 1) workout.scalingGroupId, 2) track.scalingGroupId, 3) team.defaultScalingGroupId, 4) global default (isSystem = 1)
export async function resolveScalingLevelsForWorkout({
	workoutId,
	teamId,
	trackId,
}: {
	workoutId: string
	teamId: string
	trackId?: string | null
}) {
	const db = getDb()

	// 1) Workout-specific
	const [workout] = await db
		.select({ scalingGroupId: workouts.scalingGroupId })
		.from(workouts)
		.where(eq(workouts.id, workoutId))

	let resolvedGroupId: string | null = workout?.scalingGroupId ?? null

	// 2) Track-specific
	if (!resolvedGroupId && trackId) {
		const [track] = await db
			.select({ scalingGroupId: programmingTracksTable.scalingGroupId })
			.from(programmingTracksTable)
			.where(eq(programmingTracksTable.id, trackId))
		resolvedGroupId = track?.scalingGroupId ?? null
	}

	// 3) Team default
	if (!resolvedGroupId) {
		const [team] = await db
			.select({ defaultScalingGroupId: teamTable.defaultScalingGroupId })
			.from(teamTable)
			.where(eq(teamTable.id, teamId))
		resolvedGroupId = team?.defaultScalingGroupId ?? null
	}

	// 4) Global default (isSystem = 1)
	if (!resolvedGroupId) {
		const [globalDefault] = await db
			.select({ id: scalingGroupsTable.id })
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.isSystem, 1))
			.limit(1)
		resolvedGroupId = globalDefault?.id ?? null
	}

	if (!resolvedGroupId) return { scalingGroupId: null, levels: [] as any[] }

	const levels = await db
		.select()
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.scalingGroupId, resolvedGroupId))
		.orderBy(asc(scalingLevelsTable.position))

	return { scalingGroupId: resolvedGroupId, levels }
}

// Helper to fetch per-workout scaling descriptions for the resolved levels
export async function getWorkoutScalingDescriptions({
	workoutId,
	scalingLevelIds,
}: {
	workoutId: string
	scalingLevelIds: string[]
}) {
	const db = getDb()
	if (scalingLevelIds.length === 0) return []
	const rows = await db
		.select()
		.from(workoutScalingDescriptionsTable)
		.where(
			and(
				eq(workoutScalingDescriptionsTable.workoutId, workoutId),
				inArray(
					workoutScalingDescriptionsTable.scalingLevelId,
					scalingLevelIds,
				),
			),
		)
	return rows
}

// Create a team-aligned remix of a workout and set its scaling group to the provided group.
// Note: This does NOT automatically replace a track workout; UI/action integration is handled in a follow-up task.
export async function createWorkoutRemixAlignedToScalingGroup({
	sourceWorkoutId,
	teamId,
	targetScalingGroupId,
}: {
	sourceWorkoutId: string
	teamId: string
	targetScalingGroupId: string
}) {
	const db = getDb()

	// Validate access to target group
	const [group] = await db
		.select()
		.from(scalingGroupsTable)
		.where(eq(scalingGroupsTable.id, targetScalingGroupId))
	if (!group) throw new Error("Scaling group not found")

	if (group.teamId) {
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)
		if (group.teamId !== teamId) throw new Error("Forbidden")
	}

	// Create remix under team
	const remixed = await createWorkoutRemix({ sourceWorkoutId, teamId })
	if (!remixed?.id) throw new Error("Failed to create workout remix")

	// Apply target scaling group to the remixed workout
	const [updated] = await db
		.update(workouts)
		.set({ scalingGroupId: targetScalingGroupId, updatedAt: new Date() })
		.where(eq(workouts.id, remixed.id))
		.returning()

	return updated
}

// Migrate scaling descriptions from source workout to remixed workout
export async function migrateScalingDescriptions({
	remixedWorkoutId,
	mappings,
}: {
	originalWorkoutId: string
	remixedWorkoutId: string
	mappings: Array<{
		originalScalingLevelId: string
		newScalingLevelId: string
		description: string
	}>
}) {
	const db = getDb()

	// Delete any existing descriptions for the remixed workout
	await db
		.delete(workoutScalingDescriptionsTable)
		.where(eq(workoutScalingDescriptionsTable.workoutId, remixedWorkoutId))

	// Insert new descriptions based on mappings
	if (mappings.length > 0) {
		const descriptionsToInsert = mappings
			.filter((mapping) => mapping.description.trim() !== "")
			.map((mapping) => ({
				workoutId: remixedWorkoutId,
				scalingLevelId: mapping.newScalingLevelId,
				description: mapping.description,
			}))

		if (descriptionsToInsert.length > 0) {
			await db
				.insert(workoutScalingDescriptionsTable)
				.values(descriptionsToInsert)
		}
	}

	return { success: true, migratedCount: mappings.length }
}

// Get scaling descriptions for a workout with scaling level details
export async function getWorkoutScalingDescriptionsWithLevels({
	workoutId,
}: {
	workoutId: string
}) {
	const db = getDb()

	const descriptions = await db
		.select({
			id: workoutScalingDescriptionsTable.id,
			workoutId: workoutScalingDescriptionsTable.workoutId,
			scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
			description: workoutScalingDescriptionsTable.description,
			scalingLevel: {
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
				scalingGroupId: scalingLevelsTable.scalingGroupId,
			},
		})
		.from(workoutScalingDescriptionsTable)
		.innerJoin(
			scalingLevelsTable,
			eq(workoutScalingDescriptionsTable.scalingLevelId, scalingLevelsTable.id),
		)
		.where(eq(workoutScalingDescriptionsTable.workoutId, workoutId))
		.orderBy(asc(scalingLevelsTable.position))

	return descriptions
}

// Create or update workout scaling descriptions
export async function upsertWorkoutScalingDescriptions({
	workoutId,
	descriptions,
}: {
	workoutId: string
	descriptions: Array<{
		scalingLevelId: string
		description: string | null
	}>
}) {
	const db = getDb()

	// Delete existing descriptions for this workout
	await db
		.delete(workoutScalingDescriptionsTable)
		.where(eq(workoutScalingDescriptionsTable.workoutId, workoutId))

	// Insert new descriptions (only non-empty ones)
	const descriptionsToInsert = descriptions
		.filter((desc) => desc.description && desc.description.trim() !== "")
		.map((desc) => ({
			workoutId,
			scalingLevelId: desc.scalingLevelId,
			description: desc.description?.trim(),
		}))

	if (descriptionsToInsert.length > 0) {
		await db
			.insert(workoutScalingDescriptionsTable)
			.values(descriptionsToInsert)
	}

	return { success: true, count: descriptionsToInsert.length }
}
