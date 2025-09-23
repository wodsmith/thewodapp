import { notFound, redirect } from "next/navigation"
import {
	getResultByIdAction,
	getResultSetsByIdAction,
	updateResultAction,
} from "@/actions/log-actions"
import { getWorkoutByIdAction } from "@/actions/workout-actions"
import type { Workout } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import EditResultClient from "./_components/edit-result-client"

export const dynamic = "force-dynamic"

export default async function EditResultPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>
	searchParams: Promise<{ redirectUrl?: string }>
}) {
	const myParams = await params
	const mySearchParams = await searchParams
	const session = await getSessionFromCookie()

	if (!session?.userId) {
		console.log("[EditResultPage] No user found")
		redirect("/sign-in")
	}

	// Get the result by ID
	const [resultData, resultError] = await getResultByIdAction({
		resultId: myParams.id,
	})

	if (resultError || !resultData?.success || !resultData.data) {
		console.error("[EditResultPage] Result not found:", resultError)
		return notFound()
	}

	const result = resultData.data

	// Check if the user owns this result
	if (result.userId !== session.userId) {
		console.error("[EditResultPage] User does not own this result")
		redirect("/log")
	}

	// Get the workout details
	const [workoutData, workoutError] = await getWorkoutByIdAction({
		id: result.workoutId || "",
	})

	if (workoutError || !workoutData?.success || !workoutData.data) {
		console.error("[EditResultPage] Workout not found:", workoutError)
		return notFound()
	}

	const workout = workoutData.data as Workout

	// Get user's team ID for scaling selector
	const { getUserPersonalTeamId } = await import("@/server/user")
	const teamId = await getUserPersonalTeamId(session.userId)

	// Get the result sets
	const [setsData] = await getResultSetsByIdAction({
		resultId: myParams.id,
	})

	const sets = setsData?.success ? setsData.data : []

	async function updateResultServerAction(data: {
		resultId: string
		userId: string
		workouts: Workout[]
		formData: FormData
	}) {
		"use server"
		const [result, error] = await updateResultAction(data)

		if (error || !result?.success) {
			console.error("[EditResultPage] Error updating result", error)
			// Return error to client instead of throwing
			return { error: error?.message || "Failed to update result" }
		}

		// Redirect happens outside of try-catch
		// This will throw internally but that's expected behavior
		const redirectUrl = mySearchParams.redirectUrl || "/log"
		redirect(redirectUrl)
	}

	return (
		<EditResultClient
			result={result}
			workout={workout}
			sets={sets}
			userId={session.userId}
			teamId={teamId}
			redirectUrl={mySearchParams.redirectUrl || "/log"}
			updateResultAction={updateResultServerAction}
		/>
	)
}
