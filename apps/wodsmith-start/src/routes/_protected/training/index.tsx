import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AthleteTraining } from "@/components/training/athlete-training"
import { trainingDateSchema } from "@/server/training-validation"
import { getTrainingContextFn } from "@/server-fns/training-fns"

export const Route = createFileRoute("/_protected/training/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    view: "training" | "team" | "progress"
    teamId?: string
    date?: string
    workoutId?: string
  } => ({
    teamId: typeof search.teamId === "string" ? search.teamId : undefined,
    date:
      typeof search.date === "string" &&
      trainingDateSchema.safeParse(search.date).success
        ? search.date
        : undefined,
    workoutId:
      typeof search.workoutId === "string" ? search.workoutId : undefined,
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
  const navigate = useNavigate({ from: Route.fullPath })
  const { view, teamId, date, workoutId } = Route.useSearch()
  return (
    <AthleteTraining
      context={context}
      initialView={view}
      initialTeamId={teamId}
      initialDate={date}
      libraryWorkoutId={workoutId}
      onLibraryWorkoutHandled={() => {
        void navigate({
          search: (previous) => ({ ...previous, workoutId: undefined }),
          replace: true,
        })
      }}
    />
  )
}
