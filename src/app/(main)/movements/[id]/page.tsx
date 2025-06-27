import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
	getMovementByIdAction,
	getWorkoutsByMovementIdAction,
} from "@/actions/movement-actions"
import { getWorkoutResultsByWorkoutAndUserAction } from "@/actions/workout-actions"
import type { WorkoutResult } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import MovementDetailClient from "./_components/movement-detail-client"

export const dynamic = "force-dynamic"

type Props = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const id = (await params).id

	// fetch movement information
	const [movementResult, movementError] = await getMovementByIdAction({ id })

	if (movementError || !movementResult?.success || !movementResult.data) {
		return {
			title: "Movement not found",
			description: "Movement not found",
		}
	}

	const movement = movementResult.data

	return {
		title: `WODsmith | ${movement.name}`,
		description: `WODsmith | ${movement.name}`,
		openGraph: {
			title: `WODsmith | ${movement.name}`,
			description: `WODsmith | ${movement.name}`,
			images: [
				{
					url: `/api/og?title=${encodeURIComponent(
						`WODsmith | ${movement.name}`,
					)}`,
					width: 1200,
					height: 630,
					alt: `WODsmith | ${movement.name}`,
				},
			],
		},
	}
}

export default async function MovementDetailPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const myParams = await params
	const session = await getSessionFromCookie()

	if (!session?.userId) {
		console.log("[movements/[id]/page] User not authenticated")
		redirect("/sign-in")
	}

	const [movementResult, movementError] = await getMovementByIdAction({
		id: myParams.id,
	})

	if (movementError || !movementResult?.success || !movementResult.data) {
		console.log(
			`[movements/[id]/page] Movement not found for id: ${myParams.id}`,
		)
		return notFound()
	}

	const movement = movementResult.data

	const [workoutsResult, workoutsError] = await getWorkoutsByMovementIdAction({
		movementId: myParams.id,
	})

	if (workoutsError || !workoutsResult?.success) {
		console.error("Failed to fetch workouts for movement:", workoutsError)
		return <div>Error loading workouts for this movement.</div>
	}

	const workouts = workoutsResult.data
	console.log(
		`[movements/[id]/page] Found ${workouts.length} workouts for movement ${movement.name}`,
	)

	const workoutResultsMap: { [key: string]: WorkoutResult[] } = {}
	for (const workout of workouts) {
		const [resultsResult, resultsError] =
			await getWorkoutResultsByWorkoutAndUserAction({
				workoutId: workout.id,
				userId: session.userId,
			})

		if (resultsError || !resultsResult?.success) {
			console.error(
				`Failed to fetch results for workout ${workout.id}:`,
				resultsError,
			)
			workoutResultsMap[workout.id] = []
		} else {
			workoutResultsMap[workout.id] = resultsResult.data
			console.log(
				`[movements/[id]/page] Found ${resultsResult.data.length} results for workout ${workout.name} (ID: ${workout.id})`,
			)
		}
	}

	return (
		<MovementDetailClient
			movement={movement}
			workouts={workouts}
			workoutResults={workoutResultsMap}
		/>
	)
}
