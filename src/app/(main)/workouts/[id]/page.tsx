import {
	getResultSetsByIdAction,
	getWorkoutByIdAction,
	getWorkoutResultsByWorkoutAndUserAction,
} from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import type { Metadata, ResolvingMetadata } from "next"
import { notFound, redirect } from "next/navigation"
import WorkoutDetailClient from "./_components/workout-detail-client"

type Props = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
	{ params, searchParams }: Props,
	parent: ResolvingMetadata,
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

	return {
		title: `WODsmith | ${workout.name}`,
		description: `WODsmith | ${workout.name}`,
		openGraph: {
			title: `WODsmith | ${workout.name}`,
			description: `WODsmith | ${workout.name}`,
			images: [
				{
					url: `/api/og?title=${encodeURIComponent(
						`WODsmith | ${workout.name}`,
					)}`,
					width: 1200,
					height: 630,
					alt: `WODsmith | ${workout.name}`,
				},
			],
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

	const workout = workoutResult.data

	const [resultsResult, resultsError] =
		await getWorkoutResultsByWorkoutAndUserAction({
			workoutId: myParams.id,
			userId: session.userId,
		})

	if (resultsError || !resultsResult?.success) {
		console.error("Failed to fetch workout results:", resultsError)
		return <div>Error loading workout results.</div>
	}

	const results = resultsResult.data

	const resultsWithSets = await (async () => {
		if (
			!workout?.roundsToScore ||
			workout.roundsToScore <= 1 ||
			results.length === 0
		) {
			return results.map((result) => ({ ...result, sets: null }))
		}

		const allSetsPromises = results.map(async (result) => {
			const [setsResult, setsError] = await getResultSetsByIdAction({
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

	return (
		<WorkoutDetailClient
			userId={session.userId}
			workout={workout}
			workoutId={myParams.id}
			resultsWithSets={resultsWithSets}
		/>
	)
}
