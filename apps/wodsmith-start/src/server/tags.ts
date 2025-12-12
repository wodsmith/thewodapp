/**
 * Tags Server Module (Stub)
 * TODO: Implement full functionality
 */

import type { Tag, WorkoutTag } from "~/db/schema"

export async function getTagById(_tagId: string): Promise<Tag | null> {
	return null
}

export async function getTagsByIds(_tagIds: string[]): Promise<Tag[]> {
	return []
}

export async function getAllTags(): Promise<Tag[]> {
	return []
}

export async function getTagsForWorkout(_workoutId: string): Promise<Tag[]> {
	return []
}

export async function createTag(_name: string, _teamId?: string): Promise<Tag> {
	throw new Error("Not implemented")
}

export async function addTagToWorkout(
	_workoutId: string,
	_tagId: string,
): Promise<WorkoutTag> {
	throw new Error("Not implemented")
}

export async function removeTagFromWorkout(
	_workoutId: string,
	_tagId: string,
): Promise<void> {
	throw new Error("Not implemented")
}
