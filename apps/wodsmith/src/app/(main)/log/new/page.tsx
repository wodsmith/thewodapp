import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import LogFormClient from "./_components/log-form-client"

export const metadata: Metadata = {
	title: "Log Workout",
	description: "Log your workout results and track your progress.",
	openGraph: {
		type: "website",
		title: "Log Workout",
		description: "Log your workout results and track your progress.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Log Workout")}`,
				width: 1200,
				height: 630,
				alt: "Log Workout",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Log Workout",
		description: "Log your workout results and track your progress.",
		images: [`/api/og?title=${encodeURIComponent("Log Workout")}`],
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
		date?: string // Optional date parameter for logging past workouts
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

	// Auto-detect scheduled instance if we have a workoutId but no scheduledInstanceId
	let detectedScheduledInstanceId = mySearchParams?.scheduledInstanceId
	let detectedProgrammingTrackId = mySearchParams?.programmingTrackId

	if (mySearchParams?.workoutId && !mySearchParams?.scheduledInstanceId) {
		console.log(
			"[log/new] Auto-detecting scheduled instance for workout:",
			mySearchParams.workoutId,
		)

		// Determine the date to check (use provided date or default to today)
		const targetDate = mySearchParams?.date
			? new Date(mySearchParams.date)
			: new Date()

		// Get user's teams to check for scheduled instances
		const { getUserTeams } = await import("@/server/teams")
		const userTeams = await getUserTeams()

		if (userTeams && userTeams.length > 0) {
			const { getDd } = await import("@/db")
			const { scheduledWorkoutInstancesTable, trackWorkoutsTable } =
				await import("@/db/schema")
			const { eq, and, gte, lte, inArray } = await import("drizzle-orm")

			const db = getDd()

			// Create date range for the target day
			const startOfDay = new Date(targetDate)
			startOfDay.setHours(0, 0, 0, 0)

			const endOfDay = new Date(targetDate)
			endOfDay.setHours(23, 59, 59, 999)

			// Query for scheduled instances of this workout on the target date
			const scheduledInstances = await db
				.select({
					id: scheduledWorkoutInstancesTable.id,
					workoutId: scheduledWorkoutInstancesTable.workoutId,
					trackWorkoutId: scheduledWorkoutInstancesTable.trackWorkoutId,
					teamId: scheduledWorkoutInstancesTable.teamId,
					scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
				})
				.from(scheduledWorkoutInstancesTable)
				.where(
					and(
						eq(
							scheduledWorkoutInstancesTable.workoutId,
							mySearchParams.workoutId,
						),
						gte(scheduledWorkoutInstancesTable.scheduledDate, startOfDay),
						lte(scheduledWorkoutInstancesTable.scheduledDate, endOfDay),
						inArray(
							scheduledWorkoutInstancesTable.teamId,
							userTeams.map((t) => t.id),
						),
					),
				)

			console.log(
				`[log/new] Found ${scheduledInstances.length} scheduled instances for workout on ${targetDate.toDateString()}`,
			)

			if (scheduledInstances.length === 1) {
				// Exactly one scheduled instance found - auto-select it
				detectedScheduledInstanceId = scheduledInstances[0].id
				console.log(
					"[log/new] Auto-selected scheduled instance:",
					detectedScheduledInstanceId,
				)

				// If this scheduled instance has a track workout, get the track ID
				if (scheduledInstances[0].trackWorkoutId) {
					const trackWorkout = await db
						.select({ trackId: trackWorkoutsTable.trackId })
						.from(trackWorkoutsTable)
						.where(
							eq(trackWorkoutsTable.id, scheduledInstances[0].trackWorkoutId),
						)
						.get()

					if (trackWorkout) {
						detectedProgrammingTrackId = trackWorkout.trackId
						console.log(
							"[log/new] Auto-detected programming track:",
							detectedProgrammingTrackId,
						)
					}
				}
			} else if (scheduledInstances.length > 1) {
				// Multiple instances found - for now, we'll use the first one
				// In the future, we could show a selection UI
				console.log(
					"[log/new] Multiple scheduled instances found, using first one",
				)
				detectedScheduledInstanceId = scheduledInstances[0].id

				// Get track ID if applicable
				if (scheduledInstances[0].trackWorkoutId) {
					const trackWorkout = await db
						.select({ trackId: trackWorkoutsTable.trackId })
						.from(trackWorkoutsTable)
						.where(
							eq(trackWorkoutsTable.id, scheduledInstances[0].trackWorkoutId),
						)
						.get()

					if (trackWorkout) {
						detectedProgrammingTrackId = trackWorkout.trackId
					}
				}
			} else {
				console.log(
					"[log/new] No scheduled instances found for this workout on",
					targetDate.toDateString(),
				)
			}
		}
	}

	// Merge the specific workout with the user's workouts
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

	// If we have a specific workout with scaling data, make sure to use it
	if (specificWorkout) {
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

		// Replace the workout in the list if it already exists, or add it if it doesn't
		const existingIndex = allWorkouts.findIndex(
			(w) => w.id === specificWorkout.id,
		)
		if (existingIndex >= 0) {
			console.log(
				"[log/new] Replacing existing workout in list with full scaling data",
			)
			allWorkouts[existingIndex] = workoutWithResults
		} else {
			console.log("[log/new] Adding specific workout to list")
			allWorkouts = [workoutWithResults, ...allWorkouts]
		}
	}

	// Get track scaling group if we have a programming track ID (either provided or detected)
	let trackScalingGroupId = null
	const finalProgrammingTrackId =
		detectedProgrammingTrackId || mySearchParams?.programmingTrackId
	if (finalProgrammingTrackId) {
		const { getDd } = await import("@/db")
		const { programmingTracksTable } = await import("@/db/schema")
		const { eq } = await import("drizzle-orm")

		const db = getDd()
		const [track] = await db
			.select({ scalingGroupId: programmingTracksTable.scalingGroupId })
			.from(programmingTracksTable)
			.where(eq(programmingTracksTable.id, finalProgrammingTrackId))

		trackScalingGroupId = track?.scalingGroupId || null
		console.log("[log/new] Track scaling group:", trackScalingGroupId)
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

	// Log what we're passing to the client
	if (
		detectedScheduledInstanceId &&
		detectedScheduledInstanceId !== mySearchParams?.scheduledInstanceId
	) {
		console.log(
			"[log/new] Auto-detected scheduled instance will be used:",
			detectedScheduledInstanceId,
		)
	}

	return (
		<LogFormClient
			workouts={serializedWorkouts}
			userId={session.user.id}
			teamId={teamId}
			selectedWorkoutId={mySearchParams?.workoutId}
			redirectUrl={mySearchParams?.redirectUrl}
			scheduledInstanceId={
				detectedScheduledInstanceId || mySearchParams?.scheduledInstanceId
			}
			programmingTrackId={
				detectedProgrammingTrackId || mySearchParams?.programmingTrackId
			}
			trackScalingGroupId={trackScalingGroupId}
		/>
	)
}
