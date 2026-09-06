import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkoutForm, type WorkoutFormData } from "@/components/workout-form"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getWorkoutByIdFn, updateWorkoutFn } from "@/server-fns/workout-fns"

export const Route = createFileRoute("/_protected/workouts/$workoutId/edit/")({
  component: EditWorkoutPage,
  loader: async ({ params }) => {
    const [workoutResult, movementsResult] = await Promise.all([
      getWorkoutByIdFn({ data: { id: params.workoutId } }),
      getAllMovementsFn(),
    ])
    return {
      workout: workoutResult.workout,
      movements: movementsResult.movements,
    }
  },
})

function EditWorkoutPage() {
  const navigate = useNavigate()
  const { workout, movements } = Route.useLoaderData()
  const { workoutId } = Route.useParams()

  const initialMovementIds =
    workout?.movements?.map((movement) => movement.id) ?? []

  const handleSubmit = async (data: WorkoutFormData) => {
    await updateWorkoutFn({
      data: {
        id: workoutId,
        ...data,
        timeCap: data.timeCap ?? null,
        roundsToScore: data.roundsToScore ?? 1,
        repsPerRound: data.repsPerRound ?? null,
        tiebreakScheme: data.tiebreakScheme ?? null,
        scalingGroupId: data.scalingGroupId ?? null,
        movementIds: data.movementIds ?? [],
      },
    })

    navigate({
      to: "/workouts/$workoutId",
      params: { workoutId },
    })
  }

  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate({ to: "/workouts", search: { view: "row", q: "" } })
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Workout Not Found</h1>
        </div>
        <p className="text-muted-foreground">
          The workout you're trying to edit doesn't exist or has been removed.
        </p>
      </div>
    )
  }

  return (
    <WorkoutForm
      mode="edit"
      initialData={{
        name: workout.name,
        description: workout.description,
        scheme: workout.scheme,
        scoreType: workout.scoreType ?? undefined,
        scope: workout.scope,
        timeCap: workout.timeCap ?? undefined,
        roundsToScore: workout.roundsToScore ?? undefined,
        repsPerRound: workout.repsPerRound ?? undefined,
        tiebreakScheme: workout.tiebreakScheme ?? undefined,
        scalingGroupId: workout.scalingGroupId ?? undefined,
      }}
      onSubmit={handleSubmit}
      backUrl={`/workouts/${workoutId}`}
      movements={movements}
      initialMovementIds={initialMovementIds}
    />
  )
}
