import { notFound, redirect } from "next/navigation"
import {
	getWorkoutByIdAction,
	updateWorkoutAction,
} from "@/actions/workout-actions"
import { getAllMovements } from "@/server/movements"
import { getAllTags } from "@/server/tags"
import type { WorkoutUpdate } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import {
	canUserEditWorkout,
	shouldCreateRemix,
} from "@/utils/workout-permissions"
import type { WorkoutWithTagsAndMovements } from "@/types"
import EditWorkoutClient from "./_components/edit-workout-client"

export const dynamic = "force-dynamic"

export default async function EditWorkoutPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	const myParams = await params
	const mySearchParams = await searchParams
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

	// Extract workout data, filtering out remix information for component compatibility
	const workout = workoutResult.data as WorkoutWithTagsAndMovements

	// Check if user explicitly wants to remix (via query param)
	const forceRemix = mySearchParams.remix === "true"

	// Determine if user can edit or should create a remix
	const canEdit = await canUserEditWorkout(myParams.id)
	const shouldRemix = forceRemix || (await shouldCreateRemix(myParams.id))

	// If user cannot edit and should not remix, redirect to workout detail
	if (!canEdit && !shouldRemix) {
		redirect(`/workouts/${workout?.id}`)
	}

	async function updateWorkoutServerAction(data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
		remixTeamId?: string
	}) {
		"use server"
		try {
			const [result, error] = await updateWorkoutAction({
				id: data.id,
				workout: data.workout,
				tagIds: data.tagIds,
				movementIds: data.movementIds,
				remixTeamId: data.remixTeamId,
			})

			if (error || !result?.success) {
				console.error("[EditWorkoutPage] Error updating workout", error)
				throw new Error("Error updating workout")
			}

			// Determine redirect URL based on action type
			let redirectId = data.id // Default to original workout ID
			if (result.action === "remixed" && result.data?.id) {
				// If it was a remix, redirect to the new workout
				redirectId = result.data.id
			}

			redirect(`/workouts/${redirectId}`)
		} catch (error) {
			// Check if this is a Next.js redirect (which is expected behavior)
			if (error instanceof Error && error.message === "NEXT_REDIRECT") {
				throw error // Re-throw the redirect
			}
			console.error("[EditWorkoutPage] Error updating workout", error)
			throw new Error("Error updating workout")
		}
	}

	// Get user teams for remix team selection
	const userTeams = session.teams || []

	return (
		<EditWorkoutClient
			workout={workout}
			movements={movements}
			tags={tags}
			workoutId={myParams.id}
			isRemixMode={shouldRemix}
			updateWorkoutAction={updateWorkoutServerAction}
			userTeams={userTeams}
		/>
	)
}
