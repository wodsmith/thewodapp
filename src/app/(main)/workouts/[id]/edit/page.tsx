import {
	getWorkoutByIdAction,
	updateWorkoutAction,
} from "@/actions/workout-actions"
import { getAllMovements } from "@/server/movements"
import { getAllTags } from "@/server/tags"
import type { WorkoutUpdate } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import { notFound, redirect } from "next/navigation"
import EditWorkoutClient from "./_components/edit-workout-client"

export const dynamic = "force-dynamic"

export default async function EditWorkoutPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const myParams = await params
	const session = await getSessionFromCookie()

	if (!session?.userId) {
		console.log("[log/page] No user found")
		redirect("/sign-in")
	}

	const [workoutResult, workoutError] = await getWorkoutByIdAction({
		id: myParams.id,
	})
	const movements = await getAllMovements()
	const tags = await getAllTags()

	if (workoutError || !workoutResult?.success || !workoutResult.data) {
		return notFound()
	}

	const workout = workoutResult.data

	if (workout?.userId !== session.userId) {
		redirect(`/workouts/${workout?.id}`)
	}

	async function updateWorkoutServerAction(data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
	}) {
		"use server"
		try {
			const [result, error] = await updateWorkoutAction({
				id: data.id,
				workout: data.workout,
				tagIds: data.tagIds,
				movementIds: data.movementIds,
			})

			if (error || !result?.success) {
				console.error("[EditWorkoutPage] Error updating workout", error)
				throw new Error("Error updating workout")
			}
		} catch (error) {
			console.error("[EditWorkoutPage] Error updating workout", error)
			throw new Error("Error updating workout")
		}
		redirect(`/workouts/${data.id}`)
	}

	return (
		<EditWorkoutClient
			workout={workout}
			movements={movements}
			tags={tags}
			workoutId={myParams.id}
			updateWorkoutAction={updateWorkoutServerAction}
		/>
	)
}
