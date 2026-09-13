import { createFileRoute } from "@tanstack/react-router"
import { CoachPlanner } from "@/components/training/coach-planner"
import { getTrainingContextFn } from "@/server-fns/training-fns"

export const Route = createFileRoute("/_protected/training/programming")({
  validateSearch: () => ({}),
  loader: () => getTrainingContextFn(),
  component: TrainingProgrammingPage,
})

function TrainingProgrammingPage() {
  const { activeTeamId } = Route.useRouteContext()
  const context = Route.useLoaderData()
  return <CoachPlanner context={{ ...context, activeTeamId }} />
}
