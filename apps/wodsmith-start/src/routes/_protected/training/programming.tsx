import { createFileRoute } from "@tanstack/react-router"
import { CoachPlanner } from "@/components/training/coach-planner"
import { getTrainingContextFn } from "@/server-fns/training-fns"

export const Route = createFileRoute("/_protected/training/programming")({
  validateSearch: (search: Record<string, unknown>) => ({
    teamId: typeof search.teamId === "string" ? search.teamId : undefined,
  }),
  loader: () => getTrainingContextFn(),
  component: TrainingProgrammingPage,
})

function TrainingProgrammingPage() {
  const { teamId } = Route.useSearch()
  return <CoachPlanner context={Route.useLoaderData()} initialTeamId={teamId} />
}
