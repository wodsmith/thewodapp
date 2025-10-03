import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
	getWorkoutByIdAction,
	updateWorkoutAction,
} from "@/actions/workout-actions"
import { getAllMovements } from "@/server/movements"
import { getAllTags } from "@/server/tags"
import { listScalingGroups } from "@/server/scaling-groups"
import type { WorkoutUpdate } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import {
	canUserEditWorkout,
	shouldCreateRemix,
} from "@/utils/workout-permissions"
import type { WorkoutWithTagsAndMovements } from "@/types"
import EditWorkoutClient from "./_components/edit-workout-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
	title: "Edit Workout",
	description: "Edit your workout details and movements.",
	openGraph: {
		type: "website",
		title: "Edit Workout",
		description: "Edit your workout details and movements.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Edit Workout")}`,
				width: 1200,
				height: 630,
				alt: "Edit Workout",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Edit Workout",
		description: "Edit your workout details and movements.",
		images: [`/api/og?title=${encodeURIComponent("Edit Workout")}`],
	},
}

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

	// Get user teams for remix team selection and scaling groups
	const userTeams = session.teams || []

	// Get scaling groups for all user teams
	let scalingGroups: Array<{
		id: string
		title: string
		description: string | null
		teamId: string | null
		teamName: string
		isSystem: number
		isDefault: number
	}> = []

	if (userTeams.length > 0) {
		try {
			// Get scaling groups from all teams the user belongs to
			const scalingGroupsPromises = userTeams.map(async (team) => {
				try {
					const groups = await listScalingGroups({
						teamId: team.id,
						includeSystem: true,
					})
					return groups.map((group) => ({
						...group,
						teamName: team.name,
					}))
				} catch (error) {
					console.error(
						`Failed to fetch scaling groups for team ${team.id}:`,
						error,
					)
					return []
				}
			})

			const allGroups = await Promise.all(scalingGroupsPromises)
			scalingGroups = allGroups.flat()
		} catch (error) {
			console.error("Failed to fetch scaling groups:", error)
		}
	}

	if (workoutError || !workoutResult?.success || !workoutResult.data) {
		return notFound()
	}

	// Extract workout data, filtering out remix information for component compatibility
	const workout = workoutResult.data as WorkoutWithTagsAndMovements

	// Check if user explicitly wants to remix (via query param)
	const forceRemix = mySearchParams.remix === "true"

	// Determine if user can edit or should create a remix
	const canEdit = await canUserEditWorkout(myParams.id)
	// If forceRemix is true, always create a remix regardless of permissions
	const shouldRemix = forceRemix ? true : await shouldCreateRemix(myParams.id)

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

	return (
		<EditWorkoutClient
			workout={workout}
			movements={movements}
			tags={tags}
			workoutId={myParams.id}
			isRemixMode={shouldRemix}
			updateWorkoutAction={updateWorkoutServerAction}
			userTeams={userTeams}
			scalingGroups={scalingGroups}
		/>
	)
}
