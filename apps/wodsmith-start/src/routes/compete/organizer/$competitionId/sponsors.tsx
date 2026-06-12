/**
 * Competition Sponsors Route
 *
 * Organizer page for managing competition sponsors.
 * Fetches sponsors and groups, passes to SponsorManager component.
 * Uses parent route loader data for competition data.
 */
// @lat: [[organizer-dashboard#Sponsors]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"
import { SponsorsPage } from "./-pages/sponsors-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/sponsors",
)({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params }) => {
    // Fetch sponsors with groups
    const { groups, ungroupedSponsors } = await getCompetitionSponsorsFn({
      data: { competitionId: params.competitionId },
    })

    return {
      groups,
      ungroupedSponsors,
    }
  },
})

function RouteComponent() {
  const { groups, ungroupedSponsors } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()

  return (
    <SponsorsPage
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      groups={groups}
      ungroupedSponsors={ungroupedSponsors}
    />
  )
}
