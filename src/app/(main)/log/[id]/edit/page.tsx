import type { Metadata } from "next"
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

export const metadata: Metadata = {
	title: "Edit Workout Result",
	description: "Edit your workout result and track your progress.",
	openGraph: {
		type: "website",
		title: "Edit Workout Result",
		description: "Edit your workout result and track your progress.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Edit Workout Result")}`,
				width: 1200,
				height: 630,
				alt: "Edit Workout Result",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Edit Workout Result",
		description: "Edit your workout result and track your progress.",
		images: [`/api/og?title=${encodeURIComponent("Edit Workout Result")}`],
	},
}

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

	// Get the workout details including scaling data
	const [workoutData, workoutError] = await getWorkoutByIdAction({
		id: result.workoutId || "",
	})

	if (workoutError || !workoutData?.success || !workoutData.data) {
		console.error("[EditResultPage] Workout not found:", workoutError)
		return notFound()
	}

	const workout = workoutData.data
	console.log("[EditResultPage] Workout scaling data:", {
		id: workout.id,
		name: workout.name,
		scalingGroupId: workout.scalingGroupId,
		scalingLevels: workout.scalingLevels,
		scalingDescriptions: workout.scalingDescriptions,
		scalingLevelsLength: workout.scalingLevels?.length || 0,
		scalingDescriptionsLength: workout.scalingDescriptions?.length || 0,
	})

	// Get user's team ID for scaling selector
	let teamId: string
	try {
		const { getUserPersonalTeamId } = await import("@/server/user")
		teamId = await getUserPersonalTeamId(session.userId)
	} catch (error) {
		console.warn(
			`[EditResultPage] Failed to get user personal team ID for user ${session.userId}, falling back to workout team ID:`,
			error instanceof Error ? error.message : String(error),
		)
		teamId = workout.teamId || ""
	}

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

	// Serialize the workout data to ensure it can cross the server/client boundary
	const serializedWorkout = JSON.parse(JSON.stringify(workout))

	return (
		<EditResultClient
			result={result}
			workout={serializedWorkout}
			sets={sets}
			userId={session.userId}
			teamId={teamId}
			redirectUrl={mySearchParams.redirectUrl || "/log"}
			updateResultAction={updateResultServerAction}
		/>
	)
}
