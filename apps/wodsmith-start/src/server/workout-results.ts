/**
 * Workout Results Server Module (Stub)
 * TODO: Implement full functionality
 */

import type { WorkoutResult, ResultSet } from "~/db/schema"

export function clearScalingGroupCache(_scalingGroupId?: string) {
	// No-op cache clear
}

export function clearWorkoutResolutionCache(
	_workoutId?: string,
	_userId?: string,
) {
	// No-op cache clear
}

export interface WorkoutScalingInfo {
	scalingGroupId: string | null
	scalingLevelId: string | null
	scalingLevelName: string | null
}

export async function getWorkoutScalingInfo(_params: {
	workoutId: string
	userId: string
}): Promise<WorkoutScalingInfo | null> {
	return null
}

export async function getWorkoutResultsByWorkoutAndUser(
	_workoutId: string,
	_userId: string,
): Promise<WorkoutResult[]> {
	return []
}

export async function getResultSetsById(
	_resultId: string,
): Promise<ResultSet[]> {
	return []
}

export async function getWorkoutResultForScheduledInstance(
	_instanceId: string,
	_userId: string,
): Promise<WorkoutResult | null> {
	return null
}

export interface WorkoutResultWithScaling extends WorkoutResult {
	scalingLevelName?: string | null
	scalingGroupName?: string | null
}

export async function getWorkoutResultsWithScalingForUser(
	_userId: string,
	_options?: { limit?: number },
): Promise<WorkoutResultWithScaling[]> {
	return []
}

export async function getWorkoutResultsWithScaling(_params: {
	workoutId: string
	limit?: number
}): Promise<WorkoutResultWithScaling[]> {
	return []
}

export function formatResultWithScaling(
	_result: WorkoutResult,
	_scalingInfo?: WorkoutScalingInfo | null,
): string {
	return ""
}

export interface LeaderboardEntry {
	rank: number
	userId: string
	userName: string
	result: WorkoutResult
	scalingInfo?: WorkoutScalingInfo | null
}

export async function getWorkoutLeaderboard(_params: {
	workoutId: string
	scalingGroupId?: string | null
	limit?: number
}): Promise<LeaderboardEntry[]> {
	return []
}

export async function getWorkoutResultsForScheduledInstances(
	_instanceIds: string[],
	_userId: string,
): Promise<Map<string, WorkoutResult>> {
	return new Map()
}
