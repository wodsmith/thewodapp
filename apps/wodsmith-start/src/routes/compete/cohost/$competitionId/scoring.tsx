/**
 * Competition Cohost Scoring Route
 *
 * Cohost page for configuring scoring settings.
 * Mirrors the organizer scoring page but uses cohost server functions.
 */

import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { cohostUpdateScoringConfigFn } from "@/server-fns/cohost/cohost-competition-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"
import { ScoringSettingsForm } from "../../organizer/$competitionId/-components/scoring-settings-form"

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/scoring",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Fetch events for head-to-head tiebreaker selection
    const workoutsResult = await cohostGetWorkoutsFn({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
      },
    })

    const events = workoutsResult.workouts.map((w) => ({
      id: w.id,
      name: w.workout.name,
    }))

    return { competition, events, competitionTeamId }
  },
  component: CohostScoringPage,
  head: ({ loaderData }) => {
    const competition = loaderData?.competition
    if (!competition) {
      return {
        meta: [{ title: "Competition Not Found" }],
      }
    }
    return {
      meta: [
        { title: `Scoring - ${competition.name}` },
        {
          name: "description",
          content: `Configure scoring algorithm for ${competition.name}`,
        },
      ],
    }
  },
})

function CohostScoringPage() {
  const { competition, events, competitionTeamId } = Route.useLoaderData()
  const updateScoringConfig = useServerFn(cohostUpdateScoringConfigFn)

  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Scoring Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure how athletes are ranked on the leaderboard
        </p>
      </div>

      <ScoringSettingsForm
        competition={{
          id: competition.id,
          name: competition.name,
          settings: competition.settings,
        }}
        events={events}
        onSaveScoringConfig={async (data) => {
          await updateScoringConfig({
            data: { ...data, competitionTeamId },
          })
        }}
      />
    </div>
  )
}
