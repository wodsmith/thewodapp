/**
 * Cohost Competition Sponsors Route
 *
 * Cohost page for managing competition sponsors.
 * Fetches sponsors and groups via cohost server fns, reuses SponsorManager component.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { SponsorManager } from "@/components/sponsors/sponsor-manager"
import { cohostGetCompetitionSponsorsFn } from "@/server-fns/cohost/cohost-sponsor-fns"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/sponsors",
)({
  staleTime: 10_000,
  component: SponsorsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    const sponsorsResult = await cohostGetCompetitionSponsorsFn({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
      },
    }).catch(() => ({ groups: [], ungroupedSponsors: [] }))

    return {
      groups: sponsorsResult.groups,
      ungroupedSponsors: sponsorsResult.ungroupedSponsors,
    }
  },
})

function SponsorsPage() {
  const { groups, ungroupedSponsors } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()

  return (
    <SponsorManager
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      groups={groups}
      ungroupedSponsors={ungroupedSponsors}
    />
  )
}
