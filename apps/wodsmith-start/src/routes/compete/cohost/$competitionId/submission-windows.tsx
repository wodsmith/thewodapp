/**
 * Cohost Submission Windows Route
 *
 * Cohost page for managing submission windows for online competitions.
 * Only available for online competition types.
 * Mirrors organizer submission-windows route with cohost auth and server fns.
 * Passes override callback so upsert mutations use cohost auth.
 */

import { useMemo } from "react"
import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import type { SubmissionWindowsManagerOverrides } from "@/components/compete/submission-windows-manager"
import { SubmissionWindowsManager } from "@/components/compete/submission-windows-manager"
import {
  cohostGetCompetitionEventsFn,
  cohostUpsertCompetitionEventsFn,
} from "@/server-fns/cohost/cohost-event-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/submission-windows",
)({
  staleTime: 10_000,
  component: SubmissionWindowsPage,
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

function SubmissionWindowsPage() {
  const { workouts, competitionEvents } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const competitionTeamId = competition.competitionTeamId!

  // Map workouts to format expected by SubmissionWindowsManager
  const workoutsWithType = workouts.map((event: any) => ({
    id: event.id,
    workoutId: event.workoutId,
    name: event.workout?.name || `Event #${event.trackOrder}`,
    workoutType: event.workout?.scheme || "for-time",
    trackOrder: event.trackOrder,
    parentEventId: event.parentEventId ?? null,
  }))

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
    <SubmissionWindowsManager
      competitionId={competition.id}
      teamId={competitionTeamId}
      workouts={workoutsWithType}
      initialEvents={competitionEvents}
      timezone={competition.timezone || "America/Denver"}
      overrides={overrides}
    />
  )
}
