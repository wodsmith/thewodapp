import { createFileRoute } from "@tanstack/react-router"
import { getEditWorkoutDataFn } from "~/server-functions/workouts"
import EditWorkoutClient from "~/components/workouts/edit-workout-client"

export const Route = createFileRoute("/_main/workouts/$id/edit")({
	loader: async ({ params }) => {
		return getEditWorkoutDataFn({ id: params.id })
	},
	component: EditWorkoutComponent,
})

function EditWorkoutComponent() {
	const { workout, movements, tags, isRemixMode, userTeams, scalingGroups } =
		Route.useLoaderData()
	const { id } = Route.useParams()

	return (
		<EditWorkoutClient
			workout={workout}
			movements={movements}
			tags={tags}
			workoutId={id}
			isRemixMode={isRemixMode}
			userTeams={userTeams}
			scalingGroups={scalingGroups}
		/>
	)
}
