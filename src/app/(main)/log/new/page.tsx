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
			console.log("[log/new] Scaling data from getWorkoutByIdAction:", {
				scalingGroupId: specificWorkout?.scalingGroupId,
				scalingLevels: specificWorkout?.scalingLevels,
				scalingDescriptions: specificWorkout?.scalingDescriptions,
				scalingLevelsLength: specificWorkout?.scalingLevels?.length || 0,
				scalingDescriptionsLength:
					specificWorkout?.scalingDescriptions?.length || 0,
			})
			console.log(
				"[log/new] Raw scaling levels:",
				JSON.stringify(specificWorkout?.scalingLevels),
			)
			console.log(
				"[log/new] Raw scaling descriptions:",
				JSON.stringify(specificWorkout?.scalingDescriptions),
			)
		} else {
			console.error("[log/new] Failed to fetch specific workout:", workoutError)
		}
	}

	// Merge the specific workout with the user's workouts if it's not already there
	// Note: getUserWorkouts doesn't include scaling info yet, so we add empty arrays
	let allWorkouts = result.data.map((w) => ({
		...w,
		scalingLevels: [] as Array<{
			id: string
			label: string
			position: number
		}>,
		scalingDescriptions: [] as Array<{
			scalingLevelId: string
			description: string | null
		}>,
	}))

	if (
		specificWorkout &&
		!result.data.some((w) => w.id === specificWorkout.id)
	) {
		console.log("[log/new] Adding specific workout to list")
		// Create a fully structured workout object with all necessary fields
		const workoutWithResults = {
			...specificWorkout,
			resultsToday: [],
			// Ensure scaling data arrays are preserved
			scalingLevels: specificWorkout.scalingLevels
				? [...specificWorkout.scalingLevels]
				: [],
			scalingDescriptions: specificWorkout.scalingDescriptions
				? [...specificWorkout.scalingDescriptions]
				: [],
		}
		console.log("[log/new] Workout with results:", {
			id: workoutWithResults.id,
			scalingGroupId: workoutWithResults.scalingGroupId,
			scalingLevels: workoutWithResults.scalingLevels,
			scalingDescriptions: workoutWithResults.scalingDescriptions,
			scalingLevelsLength: workoutWithResults.scalingLevels.length,
			scalingDescriptionsLength: workoutWithResults.scalingDescriptions.length,
		})
		console.log(
			"[log/new] Raw merged scaling levels:",
			JSON.stringify(workoutWithResults.scalingLevels),
		)
		console.log(
			"[log/new] Raw merged scaling descriptions:",
			JSON.stringify(workoutWithResults.scalingDescriptions),
		)
		allWorkouts = [workoutWithResults, ...allWorkouts]
	}

	// Get track scaling group if we have a programming track ID
	let trackScalingGroupId = null
	if (mySearchParams?.programmingTrackId) {
		const { getDd } = await import("@/db")
		const { programmingTracksTable } = await import("@/db/schema")
		const { eq } = await import("drizzle-orm")

		const db = getDd()
		const [track] = await db
			.select({ scalingGroupId: programmingTracksTable.scalingGroupId })
			.from(programmingTracksTable)
			.where(eq(programmingTracksTable.id, mySearchParams.programmingTrackId))

		trackScalingGroupId = track?.scalingGroupId || null
	}

	// Log the final workout data being passed
	if (mySearchParams?.workoutId && allWorkouts.length > 0) {
		const targetWorkout = allWorkouts.find(
			(w) => w.id === mySearchParams.workoutId,
		)
		console.log("[log/new] Final workout data being passed to LogFormClient:", {
			workoutId: targetWorkout?.id,
			name: targetWorkout?.name,
			scalingGroupId: targetWorkout?.scalingGroupId,
			hasScalingLevels: !!targetWorkout?.scalingLevels,
			hasScalingDescriptions: !!targetWorkout?.scalingDescriptions,
			scalingLevelsLength: targetWorkout?.scalingLevels?.length || 0,
			scalingDescriptionsLength:
				targetWorkout?.scalingDescriptions?.length || 0,
		})
		console.log(
			"[log/new] Final raw scaling levels:",
			JSON.stringify(targetWorkout?.scalingLevels),
		)
		console.log(
			"[log/new] Final raw scaling descriptions:",
			JSON.stringify(targetWorkout?.scalingDescriptions),
		)
	}

	// Serialize the workouts data to ensure it can cross the server/client boundary
	const serializedWorkouts = JSON.parse(JSON.stringify(allWorkouts))

	return (
		<LogFormClient
			workouts={serializedWorkouts}
			userId={session.user.id}
			teamId={teamId}
			selectedWorkoutId={mySearchParams?.workoutId}
			redirectUrl={mySearchParams?.redirectUrl}
			scheduledInstanceId={mySearchParams?.scheduledInstanceId}
			programmingTrackId={mySearchParams?.programmingTrackId}
			trackScalingGroupId={trackScalingGroupId}
		/>
	)
}
