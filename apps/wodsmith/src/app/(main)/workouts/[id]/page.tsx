import type { Metadata, ResolvingMetadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
	getRemixedWorkoutsAction,
	getResultSetsByIdAction,
	getWorkoutByIdAction,
	getWorkoutResultsByWorkoutAndUserAction,
} from "@/actions/workout-actions"
import { getWorkoutScheduleHistory } from "@/server/workouts"
import type { WorkoutWithTagsAndMovements } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserTeamIds } from "@/utils/team-auth"
import { canUserEditWorkout } from "@/utils/workout-permissions"
import WorkoutDetailClient from "./_components/workout-detail-client"

type Props = {
	params: Promise<{ id: string }>
}

export async function generateMetadata(
	{ params }: Props,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const id = (await params).id

	// fetch post information
	const [workoutResult, error] = await getWorkoutByIdAction({ id })

	if (error || !workoutResult?.success || !workoutResult.data) {
		return {
			title: "workout not found",
			description: "workout not found",
		}
	}

	const workout = workoutResult.data

	// Build OG image URL with description if available
	const ogImageParams = new URLSearchParams({
		title: workout.name,
	})
	if (workout.description) {
		ogImageParams.append("description", workout.description)
	}
	const ogImageUrl = `/api/og?${ogImageParams.toString()}`

	return {
		title: workout.name,
		description:
			workout.description || `View and track results for ${workout.name}`,
		openGraph: {
			type: "website",
			title: workout.name,
			description:
				workout.description || `View and track results for ${workout.name}`,
			images: [
				{
					url: ogImageUrl,
					width: 1200,
					height: 630,
					alt: workout.name,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: workout.name,
			description:
				workout.description || `View and track results for ${workout.name}`,
			images: [ogImageUrl],
		},
	}
}

export default async function WorkoutDetailPage({
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

	if (workoutError || !workoutResult?.success || !workoutResult.data) {
		return notFound()
	}

	// Extract workout data, filtering out remix information for component compatibility
	const workout = workoutResult.data as WorkoutWithTagsAndMovements

	// Debug: Log the scaling data to verify it's present
	console.log("[WorkoutDetailPage] Workout scaling data:", {
		id: workout.id,
		name: workout.name,
		scalingGroupId: workout.scalingGroupId,
		scalingLevels: workout.scalingLevels,
		scalingDescriptions: workout.scalingDescriptions,
	})

	const [resultsResult, resultsError] =
		await getWorkoutResultsByWorkoutAndUserAction({
			workoutId: myParams.id,
		})

	if (resultsError || !resultsResult?.success) {
		console.error("Failed to fetch workout results:", resultsError)
		return <div>Error loading workout results.</div>
	}

	const results = resultsResult.data

	// Debug: Log the results to see if scaling data is present
	console.log(
		"[WorkoutDetailPage] Results from action:",
		results.map((r) => ({
			id: r.id,
			scalingLevelId: r.scalingLevelId,
			scalingLevelLabel: r.scalingLabel,
			asRx: r.asRx,
			displayScore: r.displayScore,
		})),
	)

	const resultsWithSets = await (async () => {
		if (
			!workout?.roundsToScore ||
			workout.roundsToScore <= 1 ||
			results.length === 0
		) {
			return results.map((result) => ({ ...result, sets: null }))
		}

		const allSetsPromises = results.map(async (result) => {
			const [setsResult, _setsError] = await getResultSetsByIdAction({
				resultId: result.id,
			})
			const sets =
				setsResult?.success && setsResult.data && setsResult.data.length > 0
					? setsResult.data
					: null
			return { ...result, sets }
		})

		return Promise.all(allSetsPromises)
	})()

	// Determine ownership and appropriate action
	const canEdit = await canUserEditWorkout(myParams.id)

	// Get source workout info if this is a remix
	const sourceWorkout = workout.sourceWorkout

	// Get remixed workouts (workouts that are based on this one)
	const [remixedWorkoutsResult] = await getRemixedWorkoutsAction({
		sourceWorkoutId: myParams.id,
	})

	const remixedWorkouts = remixedWorkoutsResult?.success
		? remixedWorkoutsResult.data
		: []

	// Get user's team IDs and schedule history
	const userTeamIds = await getUserTeamIds(session.userId)
	const scheduleHistory = await getWorkoutScheduleHistory(
		myParams.id,
		userTeamIds,
	)

	return (
		<WorkoutDetailClient
			canEdit={canEdit}
			sourceWorkout={sourceWorkout}
			workout={workout}
			workoutId={myParams.id}
			resultsWithSets={resultsWithSets}
			remixedWorkouts={remixedWorkouts}
			scheduleHistory={scheduleHistory}
		/>
	)
}
