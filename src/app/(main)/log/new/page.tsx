import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import LogFormClient from "./_components/log-form-client"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "WODsmith | Log your Workout",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "WODsmith | Log your Workout", // Default title for layout
		description: "Track your spicy workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent(
					"WODsmith | Log your Workout",
				)}`,
				width: 1200,
				height: 630,
				alt: "WODsmith | Log your Workout",
			},
		],
	},
}

export default async function LogNewResultPage({
	searchParams,
}: {
	searchParams?: Promise<{
		workoutId?: string
		redirectUrl?: string
		scheduledInstanceId?: string
		programmingTrackId?: string
	}>
}) {
	console.log("[log/new] Fetching workouts for log form")
	const session = await getSessionFromCookie()
	const mySearchParams = await searchParams

	if (!session || !session?.user?.id) {
		console.log("[log/page] No user found")
		redirect("/sign-in")
	}

	// Get user's personal team ID
	const { getUserPersonalTeamId } = await import("@/server/user")

	let teamId: string
	try {
		teamId = await getUserPersonalTeamId(session.user.id)
	} catch (error) {
		console.error("[log/new] Failed to get user's personal team ID:", error)
		redirect("/sign-in")
	}

	const [result, error] = await getUserWorkoutsAction({
		teamId,
	})

	if (error || !result?.success) {
		console.error("[log/new] Failed to fetch workouts")
		redirect("/sign-in")
	}

	// If a specific workout ID is provided, fetch it separately
	// This ensures we can log results for workouts from other teams
	let specificWorkout = null
	if (mySearchParams?.workoutId) {
		console.log(
			"[log/new] Fetching specific workout:",
			mySearchParams.workoutId,
		)
		const { getWorkoutByIdAction } = await import("@/actions/workout-actions")
		const [workoutResult, workoutError] = await getWorkoutByIdAction({
			id: mySearchParams.workoutId,
		})

		if (!workoutError && workoutResult?.success) {
			specificWorkout = workoutResult.data
			console.log("[log/new] Found specific workout:", specificWorkout?.name)
		} else {
			console.error("[log/new] Failed to fetch specific workout:", workoutError)
		}
	}

	// Merge the specific workout with the user's workouts if it's not already there
	let allWorkouts = result.data
	if (
		specificWorkout &&
		!result.data.some((w) => w.id === specificWorkout.id)
	) {
		console.log("[log/new] Adding specific workout to list")
		// Add resultsToday field to match the type expected by LogFormClient
		const workoutWithResults = {
			...specificWorkout,
			resultsToday: [],
		}
		allWorkouts = [workoutWithResults, ...result.data]
	}

	return (
		<LogFormClient
			workouts={allWorkouts}
			userId={session.user.id}
			selectedWorkoutId={mySearchParams?.workoutId}
			redirectUrl={mySearchParams?.redirectUrl}
			scheduledInstanceId={mySearchParams?.scheduledInstanceId}
			programmingTrackId={mySearchParams?.programmingTrackId}
		/>
	)
}
