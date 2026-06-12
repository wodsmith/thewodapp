/**
 * Cohost Competition Locations Route
 *
 * Renders the shared organizer LocationsPage with cohost-permissioned venue
 * mutation overrides so the page stays in sync with the organizer route.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import type { ComponentProps } from "react"
import type { VenueManager } from "@/components/organizer/schedule/venue-manager"
import {
  cohostCreateVenueFn,
  cohostDeleteVenueFn,
  cohostGetCompetitionVenuesFn,
  cohostGetVenueHeatCountFn,
  cohostUpdateVenueFn,
} from "@/server-fns/cohost/cohost-location-fns"
import { LocationsPage } from "../../organizer/$competitionId/-pages/locations-page"

type VenueManagerOverrides = ComponentProps<typeof VenueManager>["overrides"]

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/locations",
)({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const venuesResult = await cohostGetCompetitionVenuesFn({
      data: {
        competitionTeamId: competition.competitionTeamId!,
        competitionId: params.competitionId,
      },
    }).catch(() => ({ venues: [] }))

    return { venues: venuesResult.venues }
  },
})

function RouteComponent() {
  const { venues } = Route.useLoaderData()
  const { competitionId } = Route.useParams()
  const { competition } = parentRoute.useLoaderData()
  const competitionTeamId = competition.competitionTeamId!

  const venueOverrides: VenueManagerOverrides = {
    createVenueFn: (args: { data: any }) =>
      cohostCreateVenueFn({ data: { ...args.data, competitionTeamId } }),
    updateVenueFn: (args: { data: any }) =>
      cohostUpdateVenueFn({ data: { ...args.data, competitionTeamId } }),
    deleteVenueFn: (args: { data: any }) =>
      cohostDeleteVenueFn({ data: { ...args.data, competitionTeamId } }),
    getVenueHeatCountFn: (args: { data: any }) =>
      cohostGetVenueHeatCountFn({ data: { ...args.data, competitionTeamId } }),
  }

  return (
    <LocationsPage
      competitionId={competitionId}
      competitionName={competition.name}
      venues={venues}
      primaryAddressId={competition.primaryAddressId}
      primaryAddress={competition.primaryAddress}
      overrides={venueOverrides}
    />
  )
}
