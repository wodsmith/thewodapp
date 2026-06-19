/**
 * Competition Leaderboard Preview Route (Cohost)
 *
 * Cohost mirror of the organizer leaderboard-preview. Bypasses the
 * division-results publishing filter so cohosts with the leaderboardPreview
 * permission can see aggregated standings as scores come in — before hitting
 * publish. Reuses `LeaderboardPageContent` with `preview` enabled.
 */
// @lat: [[organizer-dashboard#Leaderboard Preview]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { Eye } from "lucide-react"
import { z } from "zod"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

const leaderboardPreviewSearchSchema = z.object({
  division: z.string().optional(),
  event: z.string().optional(),
  affiliate: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/leaderboard-preview",
)({
  staleTime: 10_000,
  validateSearch: leaderboardPreviewSearchSchema,
  component: LeaderboardPreviewPage,
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

function LeaderboardPreviewPage() {
  const { competition } = parentRoute.useLoaderData()
  const { divisions } = Route.useLoaderData()

  return (
    <div className="space-y-4">
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>Co-host preview</AlertTitle>
        <AlertDescription>
          This leaderboard includes all scored events and divisions, regardless
          of whether division results have been published. Use it to review the
          aggregated standings as scores come in. Athletes will not see
          unpublished results on the public leaderboard until the organizer
          publishes them.
        </AlertDescription>
      </Alert>

      <LeaderboardPageContent
        competitionId={competition.id}
        divisions={divisions}
        competition={{
          slug: competition.slug,
          competitionType: competition.competitionType,
        }}
        preview
      />
    </div>
  )
}
