import "server-only"
import {
	getScheduledWorkoutsForTeam,
	type ScheduledWorkoutInstanceWithDetails,
} from "@/server/scheduling-service"
import { getWorkoutResultsForScheduledInstances } from "@/server/workout-results"
import { getSessionFromCookie } from "@/utils/auth"
import {
	startOfLocalDay,
	endOfLocalDay,
	startOfLocalWeek,
	endOfLocalWeek,
} from "@/utils/date-utils"

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

// Type for scheduled workout with result attached
type ScheduledWorkoutWithResult = ScheduledWorkoutInstanceWithDetails & {
	result?: any // TODO: Define proper Result type when available
}

export interface TeamWorkoutsData {
	teamId: string
	workoutsPromise: Promise<ScheduledWorkoutWithResult[]>
}

async function fetchTeamWorkoutsWithResults(
	teamId: string,
	viewMode: "daily" | "weekly",
	userId?: string,
) {
	const dateRange =
		viewMode === "daily"
			? { start: startOfLocalDay(), end: endOfLocalDay() }
			: { start: startOfLocalWeek(), end: endOfLocalWeek() }

	const scheduledWorkouts = await getScheduledWorkoutsForTeam(teamId, dateRange)

	if (!userId) {
		return scheduledWorkouts
	}

	// Prepare instances for result fetching
	const instances = scheduledWorkouts.map((workout) => ({
		id: workout.id,
		scheduledDate: workout.scheduledDate,
		workoutId:
			workout.workoutId || // Direct workoutId for standalone workouts
			workout.trackWorkout?.workoutId ||
			workout.trackWorkout?.workout?.id ||
			workout.workout?.id, // Fallback to workout.workout.id for standalone
	}))

	// Fetch results for all instances
	const workoutResults = await getWorkoutResultsForScheduledInstances(
		instances,
		userId,
	)

	// Attach results to scheduled workouts
	return scheduledWorkouts.map((workout) => ({
		...workout,
		result: workout.id ? workoutResults[workout.id] || null : null,
	}))
}

export async function getTeamWorkoutsData(
	teams: Team[],
	viewMode: "daily" | "weekly" = "daily",
): Promise<TeamWorkoutsData[]> {
	const session = await getSessionFromCookie()
	const userId = session?.id

	// Create promises for each team
	return teams.map((team) => ({
		teamId: team.id,
		workoutsPromise: fetchTeamWorkoutsWithResults(team.id, viewMode, userId),
	}))
}
