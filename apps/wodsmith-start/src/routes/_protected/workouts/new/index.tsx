import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {WorkoutForm, type WorkoutFormData} from '@/components/workout-form'
import {createWorkoutFn} from '@/server-fns/workout-fns'

export const Route = createFileRoute('/_protected/workouts/new/')({
  component: CreateWorkoutPage,
})

function CreateWorkoutPage() {
  const navigate = useNavigate()
  const {session} = Route.useRouteContext()
  const teamId = session?.teams?.[0]?.id

  const handleSubmit = async (data: WorkoutFormData) => {
    if (!teamId) {
      throw new Error('No team selected')
    }

    const result = await createWorkoutFn({
      data: {
        ...data,
        teamId,
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

  return (
    <WorkoutForm mode="create" onSubmit={handleSubmit} backUrl="/workouts" />
  )
}
