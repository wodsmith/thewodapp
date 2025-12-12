import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Link } from '@tanstack/react-router'
import { getWorkoutsFn } from '~/server-functions/workouts'
import WorkoutList from '~/components/workouts/workout-list'

export const Route = createFileRoute('/_main/workouts/')({
  loader: async () => {
    return getWorkoutsFn()
  },
  component: WorkoutsIndexComponent,
})

function WorkoutsIndexComponent() {
  const { workouts, stats } = Route.useLoaderData()

  return (
    <div>
      <div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
        <h1 className="text-4xl font-bold mb-6 tracking-tight">WORKOUTS</h1>
        <Button asChild>
          <Link
            to="/workouts/new"
            className="btn flex w-fit items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Create Workout
          </Link>
        </Button>
      </div>

      <WorkoutList workouts={workouts} />

      {stats?.totalCount > 50 && (
        <div className="mt-8 text-sm text-gray-600">
          Showing {workouts.length} of {stats.totalCount} workouts
        </div>
      )}
    </div>
  )
}
