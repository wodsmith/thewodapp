/**
 * Cohost Competition Schedule Route
 *
 * Cohost page for managing competition heat schedule.
 * Mirrors organizer schedule route with cohost auth and server fns.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { SchedulePageClient } from "@/components/organizer/schedule/schedule-page-client"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import {
  cohostGetCompetitionRegistrationsFn,
  cohostGetHeatsForCompetitionFn,
} from "@/server-fns/cohost/cohost-schedule-fns"
import { cohostGetCompetitionVenuesFn } from "@/server-fns/cohost/cohost-location-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/schedule",
)({
  staleTime: 10_000,
  component: SchedulePage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Parallel fetch all data needed for the schedule page
    const [
      venuesResult,
      eventsResult,
      heatsResult,
      divisionsResult,
      registrationsResult,
    ] = await Promise.all([
      cohostGetCompetitionVenuesFn({
        data: { competitionTeamId, competitionId: params.competitionId },
      }).catch(() => ({ venues: [] })),
      cohostGetWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ workouts: [] })),
      cohostGetHeatsForCompetitionFn({
        data: { competitionTeamId, competitionId: params.competitionId },
      }).catch(() => ({ heats: [] })),
      cohostGetDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ divisions: [] })),
      cohostGetCompetitionRegistrationsFn({
        data: { competitionTeamId, competitionId: params.competitionId },
      }).catch(() => ({ registrations: [] })),
    ])

    return {
      venues: venuesResult.venues,
      // Only top-level events (standalone + parents) — sub-events are not scheduled independently
      events: eventsResult.workouts.filter((e) => !e.parentEventId),
      heats: heatsResult.heats,
      divisions: divisionsResult.divisions,
      registrations: registrationsResult.registrations,
    }
  },
})

function SchedulePage() {
  const { venues, events, heats, divisions, registrations } =
    Route.useLoaderData()
  const { competitionId } = Route.useParams()

  // Get competition from parent route for startDate and organizingTeamId
  const { competition } = parentRoute.useLoaderData()

  return (
    <SchedulePageClient
      competitionId={competitionId}
      organizingTeamId={competition.organizingTeamId}
      competitionStartDate={competition.startDate}
      initialVenues={venues}
      events={events}
      initialHeats={heats}
      divisions={divisions}
      registrations={registrations}
    />
  )
}
