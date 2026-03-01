/**
 * Submission Windows Route
 *
 * Organizer page for managing submission windows for online competitions.
 * Only available for online competition types.
 */

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { SubmissionWindowsManager } from "@/components/compete/submission-windows-manager"
import { getCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/submission-windows",
)({
	staleTime: 10_000,
	component: SubmissionWindowsPage,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		// Only online competitions have submission windows
		if (competition.competitionType !== "online") {
			throw redirect({
				to: "/compete/organizer/$competitionId/events",
				params: { competitionId: params.competitionId },
			})
		}

		// Fetch workouts and competition events in parallel
		const [eventsResult, competitionEventsResult] = await Promise.all([
			getCompetitionWorkoutsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getCompetitionEventsFn({
				data: { competitionId: params.competitionId },
			}),
		])

		return {
			workouts: eventsResult.workouts,
			competitionEvents: competitionEventsResult.events,
			competition,
		}
	},
})

function SubmissionWindowsPage() {
	const { workouts, competitionEvents } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()

	// Map workouts to format expected by SubmissionWindowsManager
	const workoutsWithType = workouts.map((event: any) => ({
		id: event.id,
		workoutId: event.workoutId,
		name: event.workout?.name || `Event #${event.trackOrder}`,
		workoutType: event.workout?.scheme || "for-time",
		trackOrder: event.trackOrder,
	}))

	return (
		<SubmissionWindowsManager
			competitionId={competition.id}
			teamId={competition.organizingTeamId}
			workouts={workoutsWithType}
			initialEvents={competitionEvents}
			timezone={competition.timezone || "America/Denver"}
		/>
	)
}
