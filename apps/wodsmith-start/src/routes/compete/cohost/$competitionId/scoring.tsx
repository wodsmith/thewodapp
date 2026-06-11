/**
 * Competition Cohost Scoring Route
 *
 * Renders the shared organizer ScoringPage with a cohost-permissioned save
 * callback so the page stays in sync with the organizer route.
 */

import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { cohostUpdateScoringConfigFn } from "@/server-fns/cohost/cohost-competition-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"
import { ScoringPage } from "../../organizer/$competitionId/-pages/scoring-page"

export const Route = createFileRoute("/compete/cohost/$competitionId/scoring")({
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
  component: RouteComponent,
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

function RouteComponent() {
  const { competition, events, competitionTeamId } = Route.useLoaderData()
  const updateScoringConfig = useServerFn(cohostUpdateScoringConfigFn)

  return (
    <ScoringPage
      competition={competition}
      events={events}
      onSaveScoringConfig={async (data) => {
        await updateScoringConfig({
          data: { ...data, competitionTeamId },
        })
      }}
    />
  )
}
