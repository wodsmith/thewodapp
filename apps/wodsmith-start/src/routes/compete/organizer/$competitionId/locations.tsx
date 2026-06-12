/**
 * Competition Locations Route
 *
 * Organizer page for managing competition venues/locations.
 * Allows CRUD operations on venues that are used for heat scheduling.
 */
// @lat: [[organizer-dashboard#Locations (Venues)]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionVenuesFn } from "@/server-fns/competition-heats-fns"
import { LocationsPage } from "./-pages/locations-page"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/locations",
)({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params }) => {
    const { venues } = await getCompetitionVenuesFn({
      data: { competitionId: params.competitionId },
    })

    return { venues }
  },
})

function RouteComponent() {
  const { venues } = Route.useLoaderData()
  const { competitionId } = Route.useParams()
  const { competition } = parentRoute.useLoaderData()

  return (
    <LocationsPage
      competitionId={competitionId}
      competitionName={competition.name}
      venues={venues}
      primaryAddressId={competition.primaryAddressId}
      primaryAddress={competition.primaryAddress}
    />
  )
}
