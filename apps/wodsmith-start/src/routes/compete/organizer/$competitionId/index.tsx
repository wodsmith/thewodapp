/**
 * Competition Organizer Overview Route
 *
 * Dashboard/overview route for organizers. Fetches stats, events, heats,
 * and division results, then renders the shared OverviewPage with organizer
 * defaults (full access, organizer server fns, organizer links).
 *
 * This file uses top-level imports for server-only modules.
 */
// @lat: [[organizer-dashboard#Overview Page]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionRevenueStatsFn } from "@/server-fns/commerce-fns"
import { getCompetitionRegistrationsFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
  type AllEventsResultsStatusResponse,
  getDivisionResultsStatusFn,
} from "@/server-fns/division-results-fns"
import { OverviewPage } from "./-pages/overview-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute("/compete/organizer/$competitionId/")({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const isOnline = competition.competitionType === "online"

    // Parallel fetch: registrations, revenue stats, events, heats/submission windows, and division results
    const [
      registrationsResult,
      revenueResult,
      eventsResult,
      heatsResult,
      divisionResultsResult,
      competitionEventsResult,
    ] = await Promise.all([
      getCompetitionRegistrationsFn({
        data: { competitionId: params.competitionId },
      }),
      getCompetitionRevenueStatsFn({
        data: { competitionId: params.competitionId },
      }),
      getCompetitionWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      // Only fetch heats for in-person competitions
      isOnline
        ? Promise.resolve({ heats: [] })
        : getHeatsForCompetitionFn({
            data: { competitionId: params.competitionId },
          }),
      getDivisionResultsStatusFn({
        data: {
          competitionId: params.competitionId,
          organizingTeamId: competition.organizingTeamId,
        },
      }),
      // Fetch competition events (submission windows) for online competitions
      isOnline
        ? getCompetitionEventsFn({
            data: { competitionId: params.competitionId },
          })
        : Promise.resolve({ events: [] }),
    ])

    return {
      registrations: registrationsResult.registrations,
      revenueStats: revenueResult.stats,
      events: eventsResult.workouts,
      heats: heatsResult.heats,
      // When called without eventId, the server returns AllEventsResultsStatusResponse
      divisionResults: divisionResultsResult as AllEventsResultsStatusResponse,
      organizingTeamId: competition.organizingTeamId,
      competitionEvents: competitionEventsResult.events,
      isOnline,
      timezone: competition.timezone || "America/Denver",
    }
  },
})

function RouteComponent() {
  const {
    registrations,
    revenueStats,
    events,
    heats,
    divisionResults,
    organizingTeamId,
    competitionEvents,
    isOnline,
    timezone,
  } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()

  return (
    <OverviewPage
      teamId={organizingTeamId}
      competition={competition}
      registrations={registrations}
      revenueStats={revenueStats}
      events={events}
      heats={heats}
      divisionResults={divisionResults}
      competitionEvents={competitionEvents}
      isOnline={isOnline}
      timezone={timezone}
    />
  )
}
