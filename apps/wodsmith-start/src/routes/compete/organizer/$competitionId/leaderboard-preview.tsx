/**
 * Competition Leaderboard Preview Route (Organizer)
 *
 * Organizer-only leaderboard view that bypasses the division-results
 * publishing filter so admins can see aggregated standings as scores and
 * submissions come in — before hitting publish. Renders the shared
 * LeaderboardPreviewPage.
 */
// @lat: [[organizer-dashboard#Leaderboard Preview]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  LeaderboardPreviewPage,
  leaderboardPreviewSearchSchema,
} from "./-pages/leaderboard-preview-page"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/leaderboard-preview",
)({
  staleTime: 10_000,
  validateSearch: leaderboardPreviewSearchSchema,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const divisionsResult = await getCompetitionDivisionsWithCountsFn({
      data: {
        competitionId: params.competitionId,
        teamId: competition.organizingTeamId,
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
    <LeaderboardPreviewPage competition={competition} divisions={divisions} />
  )
}
