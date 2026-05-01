import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
import { CompetitionTabs } from "@/components/competition-tabs"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"
import { getCompetitionLeaderboardFn } from "@/server-fns/leaderboard-fns"

const parentRoute = getRouteApi("/compete/$slug")

// Search params schema for division, event, and affiliate selection
const leaderboardSearchSchema = z.object({
  division: z.string().optional(),
  event: z.string().optional(),
  affiliate: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/leaderboard")({
  validateSearch: leaderboardSearchSchema,
  staleTime: 10_000,
  loaderDeps: ({ search }) => ({ division: search.division }),
  loader: async ({ deps, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    const divisions = parentMatch.loaderData?.divisions ?? []

    if (!competition) {
      return { initialLeaderboard: null }
    }

    const targetDivisionId = deps.division ?? divisions[0]?.id ?? null
    if (!targetDivisionId) {
      return { initialLeaderboard: null }
    }

    try {
      const result = await getCompetitionLeaderboardFn({
        data: {
          competitionId: competition.id,
          divisionId: targetDivisionId,
        },
      })
      return {
        initialLeaderboard: {
          entries: result.entries,
          scoringAlgorithm: result.scoringAlgorithm,
          divisionId: targetDivisionId,
        },
      }
    } catch {
      // Don't block the page if the leaderboard fails — component falls back to client fetch
      return { initialLeaderboard: null }
    }
  },
  head: ({ params }) => {
    const { slug } = params
    const displayName = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return {
      meta: [
        {
          title: `${displayName} Leaderboard | WODsmith`,
        },
        {
          name: "description",
          content: `View live leaderboard and results for ${displayName} on WODsmith.`,
        },
        {
          property: "og:title",
          content: `${displayName} Leaderboard | WODsmith`,
        },
        {
          property: "og:description",
          content: `View live leaderboard and results for ${displayName} on WODsmith.`,
        },
        {
          property: "og:url",
          content: `https://wodsmith.com/compete/${slug}/leaderboard`,
        },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "WODsmith" },
        { name: "twitter:card", content: "summary" },
        {
          name: "twitter:title",
          content: `${displayName} Leaderboard | WODsmith`,
        },
        {
          name: "twitter:description",
          content: `View live leaderboard and results for ${displayName} on WODsmith.`,
        },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://wodsmith.com/compete/${slug}/leaderboard`,
        },
      ],
    }
  },
  component: CompetitionLeaderboardPage,
})

function CompetitionLeaderboardPage() {
  const { competition, divisions } = parentRoute.useLoaderData()
  const { initialLeaderboard } = Route.useLoaderData()

  return (
    <div className="space-y-4">
      <div className="sticky top-4 z-10">
        <CompetitionTabs slug={competition.slug} />
      </div>
      <div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <LeaderboardPageContent
          competitionId={competition.id}
          divisions={divisions}
          competition={{
            slug: competition.slug,
            competitionType: competition.competitionType,
          }}
          initialData={initialLeaderboard}
        />
      </div>
    </div>
  )
}
