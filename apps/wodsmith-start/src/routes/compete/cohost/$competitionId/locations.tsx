/**
 * Cohost Competition Locations Route
 *
 * Cohost page for managing competition venues/locations.
 * Mirrors organizer locations route with cohost auth and server fns.
 */

import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { VenueManager } from "@/components/organizer/schedule/venue-manager"
import { cohostGetCompetitionVenuesFn } from "@/server-fns/cohost/cohost-location-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/locations",
)({
  staleTime: 10_000,
  component: LocationsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const { venues } = await cohostGetCompetitionVenuesFn({
      data: {
        competitionTeamId: competition.competitionTeamId!,
        competitionId: params.competitionId,
      },
    })

    return { venues }
  },
})

function LocationsPage() {
  const { venues } = Route.useLoaderData()
  const { competitionId } = Route.useParams()
  const { competition } = parentRoute.useLoaderData()
  const router = useRouter()

  const handleVenueCreate = async () => {
    await router.invalidate()
  }

  const handleVenueUpdate = async () => {
    await router.invalidate()
  }

  const handleVenueDelete = async () => {
    await router.invalidate()
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Locations & Venues
        </h1>
        <p className="text-muted-foreground">
          Manage venues for {competition.name}. Venues are physical locations
          like "Main Floor" or "Outside Rig" where heats are scheduled.
        </p>
      </div>

      <VenueManager
        competitionId={competitionId}
        venues={venues}
        primaryAddressId={competition.primaryAddressId}
        primaryAddress={competition.primaryAddress}
        onVenueCreate={handleVenueCreate}
        onVenueUpdate={handleVenueUpdate}
        onVenueDelete={handleVenueDelete}
      />
    </div>
  )
}
