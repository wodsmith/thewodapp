/**
 * Competition Leaderboard Preview Route (Cohost)
 *
 * Cohost mirror of the organizer leaderboard-preview. Bypasses the
 * division-results publishing filter so cohosts with the leaderboardPreview
 * permission can see aggregated standings as scores come in — before hitting
 * publish. Renders the shared organizer LeaderboardPreviewPage with cohost
 * alert copy so the page stays in sync with the organizer route.
 */
// @lat: [[organizer-dashboard#Leaderboard Preview]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import {
  LeaderboardPreviewPage,
  leaderboardPreviewSearchSchema,
} from "../../organizer/$competitionId/-pages/leaderboard-preview-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/leaderboard-preview",
)({
  staleTime: 10_000,
  validateSearch: leaderboardPreviewSearchSchema,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    if (!competition.competitionTeamId) {
      throw new Error("Competition is missing competitionTeamId")
    }

    const divisionsResult = await cohostGetDivisionsWithCountsFn({
      data: {
        competitionId: params.competitionId,
        competitionTeamId: competition.competitionTeamId,
      },
    })

    return {
      divisions: divisionsResult.divisions,
    }
  },
})

function RouteComponent() {
  const { competition } = parentRoute.useLoaderData()
  const { divisions } = Route.useLoaderData()

  return (
    <LeaderboardPreviewPage
      competition={competition}
      divisions={divisions}
      isCohost
    />
  )
}
