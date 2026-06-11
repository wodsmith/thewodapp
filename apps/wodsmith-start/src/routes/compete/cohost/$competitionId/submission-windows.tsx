/**
 * Cohost Submission Windows Route
 *
 * Renders the shared organizer SubmissionWindowsPage with a
 * cohost-permissioned upsert override so the page stays in sync with the
 * organizer route. Only available for online competition types.
 */

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { useMemo } from "react"
import type { SubmissionWindowsManagerOverrides } from "@/components/compete/submission-windows-manager"
import {
  cohostGetCompetitionEventsFn,
  cohostUpsertCompetitionEventsFn,
} from "@/server-fns/cohost/cohost-event-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"
import { SubmissionWindowsPage } from "../../organizer/$competitionId/-pages/submission-windows-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/submission-windows",
)({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Only online competitions have submission windows
    if (competition.competitionType !== "online") {
      throw redirect({
        to: "/compete/cohost/$competitionId/events",
        params: { competitionId: params.competitionId },
      })
    }

    // Fetch workouts and competition events in parallel
    const [eventsResult, competitionEventsResult] = await Promise.all([
      cohostGetWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ workouts: [] })),
      cohostGetCompetitionEventsFn({
        data: {
          competitionTeamId,
          competitionId: params.competitionId,
        },
      }).catch(() => ({ events: [] })),
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
  const competitionTeamId = competition.competitionTeamId!

  // Build override callback that maps teamId -> competitionTeamId for cohost server fn
  const overrides = useMemo(
    (): SubmissionWindowsManagerOverrides => ({
      upsertCompetitionEvents: async (opts) =>
        cohostUpsertCompetitionEventsFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId,
            events: opts.data.events,
          },
        }),
    }),
    [competitionTeamId],
  )

  return (
    <SubmissionWindowsPage
      competitionId={competition.id}
      teamId={competitionTeamId}
      workouts={workouts}
      initialEvents={competitionEvents}
      timezone={competition.timezone}
      overrides={overrides}
    />
  )
}
