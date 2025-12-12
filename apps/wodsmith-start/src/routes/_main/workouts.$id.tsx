import { createFileRoute } from "@tanstack/react-router"
import { getWorkoutDetailFn } from "~/server-functions/workouts"
import WorkoutDetailClient from "~/components/workouts/workout-detail-client"

export const Route = createFileRoute("/_main/workouts/$id")({
	loader: async ({ params }) => {
		return getWorkoutDetailFn({ id: params.id })
	},
	component: WorkoutDetailComponent,
})

function WorkoutDetailComponent() {
	const {
		workout,
		resultsWithSets,
		remixedWorkouts,
		sourceWorkout,
		scheduleHistory,
		canEdit,
	} = Route.useLoaderData()
	const { id } = Route.useParams()

	return (
		<WorkoutDetailClient
			canEdit={canEdit}
			sourceWorkout={sourceWorkout}
			workout={workout}
			workoutId={id}
			resultsWithSets={resultsWithSets}
			remixedWorkouts={remixedWorkouts}
			scheduleHistory={scheduleHistory}
		/>
	)
}
