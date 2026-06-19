/**
 * Competition Leaderboard Preview Route (Organizer)
 *
 * Organizer-only leaderboard view that bypasses the division-results
 * publishing filter so admins can see aggregated standings as scores and
 * submissions come in — before hitting publish. Reuses the public
 * `LeaderboardPageContent` component with `preview` enabled.
 */
// @lat: [[organizer-dashboard#Leaderboard Preview]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { Eye } from "lucide-react"
import { z } from "zod"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Match the public leaderboard search schema so existing filters work
const leaderboardPreviewSearchSchema = z.object({
  division: z.string().optional(),
  event: z.string().optional(),
  affiliate: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/leaderboard-preview",
)({
  staleTime: 10_000,
  validateSearch: leaderboardPreviewSearchSchema,
  component: LeaderboardPreviewPage,
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

function LeaderboardPreviewPage() {
  const { competition } = parentRoute.useLoaderData()
  const { divisions } = Route.useLoaderData()

  return (
    <div className="space-y-4">
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>Organizer preview</AlertTitle>
        <AlertDescription>
          This leaderboard includes all scored events and divisions, regardless
          of whether division results have been published. Use it to review the
          aggregated standings as scores come in. Athletes will not see
          unpublished results on the public leaderboard until you publish them.
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
