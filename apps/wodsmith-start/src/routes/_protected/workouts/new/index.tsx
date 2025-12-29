import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {WorkoutForm, type WorkoutFormData} from '@/components/workout-form'
import {getAllMovementsFn} from '@/server-fns/movement-fns'
import {createWorkoutFn, getWorkoutByIdFn} from '@/server-fns/workout-fns'

export const Route = createFileRoute('/_protected/workouts/new/')({
  component: CreateWorkoutPage,
  validateSearch: (search: Record<string, unknown>) => ({
    remixFrom: (search.remixFrom as string) || undefined,
  }),
  loaderDeps: ({search}) => ({remixFrom: search.remixFrom}),
  loader: async ({deps}) => {
    const {movements} = await getAllMovementsFn()

    // If remixFrom is provided, fetch the source workout data
    let sourceWorkout = null
    if (deps.remixFrom) {
      const result = await getWorkoutByIdFn({data: {id: deps.remixFrom}})
      sourceWorkout = result.workout
    }

    return {movements, sourceWorkout, sourceWorkoutId: deps.remixFrom}
  },
})

function CreateWorkoutPage() {
  const navigate = useNavigate()
  const {session} = Route.useRouteContext()
  const {movements, sourceWorkout, sourceWorkoutId} = Route.useLoaderData()
  const teamId = session?.teams?.[0]?.id

  const handleSubmit = async (data: WorkoutFormData) => {
    if (!teamId) {
      throw new Error('No team selected')
    }

    const result = await createWorkoutFn({
      data: {
        ...data,
        teamId,
        // Include sourceWorkoutId if this is a remix
        ...(sourceWorkoutId ? {sourceWorkoutId} : {}),
      },
    })

    if (result.workout) {
      navigate({
        to: '/workouts/$workoutId',
        params: {workoutId: result.workout.id},
      })
    }
  }

  if (!teamId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Team Selected</h1>
          <p className="text-muted-foreground">
            Please select a team to create a workout.
          </p>
        </div>
      </div>
    )
  }

  // Prepare initial data from source workout if this is a remix
  const initialData = sourceWorkout
    ? {
        name: sourceWorkout.name,
        description: sourceWorkout.description ?? '',
        scheme: sourceWorkout.scheme,
        scoreType: sourceWorkout.scoreType ?? undefined,
        scope: 'private' as const, // Remixes always start as private
        timeCap: sourceWorkout.timeCap ?? undefined,
        roundsToScore: sourceWorkout.roundsToScore ?? undefined,
      }
    : undefined

  return (
    <WorkoutForm
      mode="create"
      movements={movements}
      onSubmit={handleSubmit}
      backUrl="/workouts"
      initialData={initialData}
      isRemix={!!sourceWorkoutId}
    />
  )
}
