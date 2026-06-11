import { createFileRoute } from "@tanstack/react-router"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import { ScoringPage } from "./-pages/scoring-page"

// @lat: [[organizer-dashboard#Scoring Configuration]]
export const Route = createFileRoute(
  "/compete/organizer/$competitionId/scoring",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    // Fetch events for head-to-head tiebreaker selection
    const workoutsResult = await getCompetitionWorkoutsFn({
      data: {
        competitionId: params.competitionId,
        teamId: competition.organizingTeamId,
      },
    })

    const events = workoutsResult.workouts.map((w) => ({
      id: w.id,
      name: w.workout.name,
    }))

    return { competition, events }
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
  const { competition, events } = Route.useLoaderData()

  return <ScoringPage competition={competition} events={events} />
}
