/**
 * Submission Windows Route
 *
 * Organizer page for managing submission windows for online competitions.
 * Only available for online competition types.
 */
// @lat: [[organizer-dashboard#Submission Windows]]

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { getCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import { SubmissionWindowsPage } from "./-pages/submission-windows-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/submission-windows",
)({
  staleTime: 10_000,
  component: RouteComponent,
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

function RouteComponent() {
  const { workouts, competitionEvents } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()

  return (
    <SubmissionWindowsPage
      competitionId={competition.id}
      teamId={competition.organizingTeamId}
      workouts={workouts}
      initialEvents={competitionEvents}
      timezone={competition.timezone}
    />
  )
}
