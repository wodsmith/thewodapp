/**
 * Competition Events Route
 *
 * Organizer page for managing competition events (workouts).
 * Fetches events, divisions, movements, and sponsors in parallel.
 * Uses parent route loader data for competition data.
 * Renders the shared EventsPage body.
 */
// @lat: [[organizer-dashboard#Event Management]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getBatchWorkoutDivisionDescriptionsFn,
  getCompetitionWorkoutsFn,
} from "@/server-fns/competition-workouts-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getCompetitionEventSeriesMappingStatusFn } from "@/server-fns/series-event-template-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"
import { EventsPage } from "../-pages/events/events-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/events/",
)({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    // biome-ignore lint/style/noNonNullAssertion: established pattern for parent route data
    const { competition } = parentMatch.loaderData!

    // Parallel fetch events, divisions, movements, sponsors, and series mapping status
    const [
      eventsResult,
      divisionsResult,
      movementsResult,
      sponsorsResult,
      seriesMappingStatus,
    ] = await Promise.all([
      getCompetitionWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      getAllMovementsFn(),
      getCompetitionSponsorsFn({
        data: { competitionId: params.competitionId },
      }),
      getCompetitionEventSeriesMappingStatusFn({
        data: { competitionId: params.competitionId },
      }),
    ])

    // Flatten sponsors from groups and ungrouped
    const allSponsors = [
      ...sponsorsResult.groups.flatMap((g) => g.sponsors),
      ...sponsorsResult.ungroupedSponsors,
    ]

    // Batch fetch division descriptions for all events in a single call
    const divisionIds = divisionsResult.divisions.map((d) => d.id)
    let divisionDescriptionsByWorkout: Record<
      string,
      Array<{
        divisionId: string
        divisionLabel: string
        description: string | null
      }>
    > = {}

    if (divisionIds.length > 0 && eventsResult.workouts.length > 0) {
      const workoutIds = eventsResult.workouts.map((e) => e.workoutId)
      const result = await getBatchWorkoutDivisionDescriptionsFn({
        data: { workoutIds, divisionIds },
      })
      divisionDescriptionsByWorkout = result.descriptionsByWorkout
    }

    return {
      events: eventsResult.workouts,
      divisions: divisionsResult.divisions,
      movements: movementsResult.movements,
      sponsors: allSponsors,
      divisionDescriptionsByWorkout,
      competition,
      seriesMappingStatus,
    }
  },
})

function RouteComponent() {
  const {
    events,
    divisions,
    movements,
    sponsors,
    divisionDescriptionsByWorkout,
    seriesMappingStatus,
  } = Route.useLoaderData()
  // Get competition from parent layout loader data (for consistency with other pages)
  const { competition } = parentRoute.useLoaderData()

  return (
    <EventsPage
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      events={events}
      movements={movements}
      divisions={divisions}
      divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
      sponsors={sponsors}
      seriesMappingStatus={seriesMappingStatus}
    />
  )
}
