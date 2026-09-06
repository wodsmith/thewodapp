import { createFileRoute } from "@tanstack/react-router"
import { AthleteTraining } from "@/components/training/athlete-training"
import { getTrainingContextFn } from "@/server-fns/training-fns"

export const Route = createFileRoute("/_protected/training/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view:
      search.view === "team" || search.view === "progress"
        ? search.view
        : ("training" as "training" | "team" | "progress"),
  }),
  loader: () => getTrainingContextFn(),
  component: TrainingPage,
})

function TrainingPage() {
  const context = Route.useLoaderData()
  const { view } = Route.useSearch()
  return <AthleteTraining context={context} initialView={view} />
}
