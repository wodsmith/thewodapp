/**
 * Competition Cohost Overview Route
 *
 * Renders the shared organizer OverviewPage with cohost-permissioned
 * mutation callbacks, cohost link targets, and the cohost's permissions
 * so the page stays in sync with the organizer route.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { cohostGetRegistrationsFn } from "@/server-fns/cohost/cohost-competition-fns"
import { cohostGetCompetitionEventsFn } from "@/server-fns/cohost/cohost-event-fns"
import {
  type AllEventsResultsStatusResponse,
  cohostGetDivisionResultsStatusFn,
  cohostPublishAllDivisionResultsFn,
  cohostPublishDivisionResultsFn,
} from "@/server-fns/cohost/cohost-results-fns"
import { cohostGetRevenueStatsFn } from "@/server-fns/cohost/cohost-revenue-fns"
import { cohostGetHeatsForCompetitionFn } from "@/server-fns/cohost/cohost-schedule-fns"
import {
  cohostGetWorkoutsFn,
  cohostUpdateWorkoutFn,
} from "@/server-fns/cohost/cohost-workout-fns"
import { OverviewPage } from "../../organizer/$competitionId/-pages/overview-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute("/compete/cohost/$competitionId/")({
  staleTime: 10_000,
  component: CohostOverviewPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!
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
      cohostGetRegistrationsFn({
        data: { competitionId: params.competitionId, competitionTeamId },
      }).catch(() => ({ registrations: [] })),
      cohostGetRevenueStatsFn({
        data: { competitionId: params.competitionId, competitionTeamId },
      }).catch(() => ({
        stats: {
          totalGrossCents: 0,
          totalOrganizerNetCents: 0,
          purchaseCount: 0,
        },
      })),
      cohostGetWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ workouts: [] })),
      // Only fetch heats for in-person competitions
      isOnline
        ? Promise.resolve({ heats: [] })
        : cohostGetHeatsForCompetitionFn({
            data: { competitionId: params.competitionId, competitionTeamId },
          }).catch(() => ({ heats: [] })),
      cohostGetDivisionResultsStatusFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(
        () =>
          ({
            divisions: [],
            events: [],
            totalPublishedCount: 0,
            totalCombinations: 0,
          }) as AllEventsResultsStatusResponse,
      ),
      // Fetch competition events (submission windows) for online competitions
      isOnline
        ? cohostGetCompetitionEventsFn({
            data: { competitionId: params.competitionId, competitionTeamId },
          }).catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] }),
    ])

    return {
      registrations: registrationsResult.registrations,
      revenueStats: revenueResult.stats,
      events: eventsResult.workouts,
      heats: heatsResult.heats,
      // When called without eventId, the server returns AllEventsResultsStatusResponse
      divisionResults: divisionResultsResult as AllEventsResultsStatusResponse,
      competitionTeamId,
      competitionEvents: competitionEventsResult.events,
      isOnline,
      timezone: competition.timezone || "America/Denver",
    }
  },
})

function CohostOverviewPage() {
  const {
    registrations,
    revenueStats,
    events,
    heats,
    divisionResults,
    competitionTeamId,
    competitionEvents,
    isOnline,
    timezone,
  } = Route.useLoaderData()
  // Get competition and permissions from parent layout loader data
  const { competition, permissions } = parentRoute.useLoaderData()

  // Cohost server fn wrappers — these use competitionTeamId instead of organizingTeamId
  const cohostUpdateWorkout = useServerFn(cohostUpdateWorkoutFn)
  const cohostPublishDivisionResults = useServerFn(
    cohostPublishDivisionResultsFn,
  )
  const cohostPublishAllDivisionResults = useServerFn(
    cohostPublishAllDivisionResultsFn,
  )

  const handleCohostUpdateWorkout = async (params: {
    trackWorkoutId: string
    eventStatus?: "draft" | "published"
    heatStatus?: "draft" | "published"
  }) => {
    return cohostUpdateWorkout({
      data: {
        trackWorkoutId: params.trackWorkoutId,
        competitionTeamId,
        eventStatus: params.eventStatus,
        heatStatus: params.heatStatus,
      },
    })
  }

  const handleCohostPublishDivisionResults = async (params: {
    competitionId: string
    eventId: string
    divisionId: string
    publish: boolean
  }) => {
    return cohostPublishDivisionResults({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
        eventId: params.eventId,
        divisionId: params.divisionId,
        publish: params.publish,
      },
    })
  }

  const handleCohostPublishAllDivisionResults = async (params: {
    competitionId: string
    eventId: string
    publish: boolean
  }) => {
    return cohostPublishAllDivisionResults({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
        eventId: params.eventId,
        publish: params.publish,
      },
    })
  }

  return (
    <OverviewPage
      teamId={competitionTeamId}
      competition={competition}
      registrations={registrations}
      revenueStats={revenueStats}
      events={events}
      heats={heats}
      divisionResults={divisionResults}
      competitionEvents={competitionEvents}
      isOnline={isOnline}
      timezone={timezone}
      permissions={permissions}
      onUpdateWorkout={handleCohostUpdateWorkout}
      onPublishDivisionResults={handleCohostPublishDivisionResults}
      onPublishAllDivisionResults={handleCohostPublishAllDivisionResults}
      routePrefix="/compete/cohost"
      resultsLinkTo="/compete/cohost/$competitionId/results"
      athletesLinkTo="/compete/cohost/$competitionId/athletes"
      revenueLinkTo="/compete/cohost/$competitionId/revenue"
    />
  )
}
