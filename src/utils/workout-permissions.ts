import "server-only"
import { cache } from "react"
import { eq } from "drizzle-orm"
import { TEAM_PERMISSIONS, workouts } from "@/db/schema"
import { getDd } from "@/db"
import { requireVerifiedEmail } from "./auth"
import { hasTeamPermission } from "./team-auth"

/**
 * Permission context for workout operations
 */
export interface WorkoutPermissionContext {
	userId: string
	workoutId: string
	teamId?: string
}

/**
 * Result of workout permission check
 */
export interface WorkoutPermissionResult {
	canEdit: boolean
	canRemix: boolean
	reason?: string
}

/**
 * Get workout details for permission checking
 */
const getWorkoutDetails = cache(async (workoutId: string) => {
	const db = getDd()
	return await db.query.workouts.findFirst({
		where: eq(workouts.id, workoutId),
		columns: {
			id: true,
			teamId: true,
			sourceWorkoutId: true,
			sourceTrackId: true,
			scope: true,
		},
	})
})

/**
 * Determine if a user can directly edit a workout
 *
 * A user can edit a workout if:
 * 1. They have edit permissions in the workout's team
 * 2. The workout belongs to a team they're a member of
 *
 * Note: Users can edit remixed workouts if they belong to their team
 */
export const canUserEditWorkout = async (
	workoutId: string,
): Promise<boolean> => {
	const session = await requireVerifiedEmail({ doNotThrowError: true })

	if (!session) {
		return false
	}

	const workout = await getWorkoutDetails(workoutId)

	if (!workout) {
		return false
	}

	// If workout doesn't belong to a team, deny access
	if (!workout.teamId) {
		return false
	}

	// Check if user is a member of the workout's team
	const isTeamMember = session.teams?.some((team) => team.id === workout.teamId)
	if (!isTeamMember) {
		return false
	}

	// Check if user has edit permissions for components in the team
	const hasEditPermission = await hasTeamPermission(
		workout.teamId,
		TEAM_PERMISSIONS.EDIT_COMPONENTS,
	)

	if (!hasEditPermission) {
		return false
	}

	// Users can edit any workout in their team, including remixes
	return true
}

/**
 * Determine if a user should create a remix instead of editing directly
 *
 * A user should create a remix if:
 * 1. They don't have direct edit permissions for the workout
 * 2. The workout belongs to a different team
 * 3. They only have view permissions for the workout's team
 *
 * Note: Users with edit permissions can edit remixes in their own team
 */
export const shouldCreateRemix = async (
	workoutId: string,
): Promise<boolean> => {
	const session = await requireVerifiedEmail({ doNotThrowError: true })

	if (!session) {
		return true // No session means they can't edit, so they should remix
	}

	const workout = await getWorkoutDetails(workoutId)

	if (!workout) {
		return true // Workout doesn't exist, can't edit
	}

	// If workout doesn't belong to a team, they can't edit it
	if (!workout.teamId) {
		return true
	}

	// Check if user is a member of the workout's team
	const isTeamMember = session.teams?.some((team) => team.id === workout.teamId)
	if (!isTeamMember) {
		return true // Not a team member, should create remix
	}

	// Check if user has edit permissions for components in the team
	const hasEditPermission = await hasTeamPermission(
		workout.teamId,
		TEAM_PERMISSIONS.EDIT_COMPONENTS,
	)

	// If they have edit permissions for the team, they can edit directly (even remixes)
	// Otherwise, they should create a remix
	return !hasEditPermission
}

/**
 * Get comprehensive workout permissions for a user
 */
export const getWorkoutPermissions = async (
	workoutId: string,
): Promise<WorkoutPermissionResult> => {
	const canEdit = await canUserEditWorkout(workoutId)
	const shouldRemix = await shouldCreateRemix(workoutId)

	let reason: string | undefined

	if (!canEdit && !shouldRemix) {
		reason = "Unable to determine appropriate action for workout"
	} else if (canEdit) {
		reason = "User has direct edit permissions for this workout"
	} else if (shouldRemix) {
		reason = "User should create a remix instead of editing directly"
	}

	return {
		canEdit,
		canRemix: shouldRemix, // Use the computed shouldCreateRemix result
		reason,
	}
}
