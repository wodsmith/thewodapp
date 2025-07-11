import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { requireVerifiedEmail } from "@/utils/auth"
import { getAllUserScheduledWorkoutsAction } from "./_actions/all-scheduled-workouts.action"
import { WorkoutsPageClient } from "./_components/workouts-page-client"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "Spicy Wod | Explore Workouts",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "Spicy Wod | Explore Workouts",
		description: "Track your spicy workouts and progress.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent(
					"Spicy Wod | Explore Workouts",
				)}`,
				width: 1200,
				height: 630,
				alt: "Spicy Wod | Explore Workouts",
			},
		],
	},
}

export default async function WorkoutsPage({
	searchParams,
}: {
	searchParams?: Promise<{ search?: string; tag?: string; movement?: string }>
}) {
	const session = await requireVerifiedEmail()

	if (!session || !session?.user?.id) {
		console.log("[workouts/page] No user found")
		redirect("/sign-in")
	}

	// Get user's personal team ID for personal workouts
	const { getUserPersonalTeamId } = await import("@/server/user")
	const teamId = await getUserPersonalTeamId(session.user.id)

	// Fetch scheduled workouts from all teams
	const [scheduledResult, scheduledError] =
		await getAllUserScheduledWorkoutsAction()

	if (scheduledError) {
		console.error(
			"[workouts/page] Error fetching scheduled workouts:",
			scheduledError,
		)
	}

	// Fetch personal workouts
	const mySearchParams = await searchParams
	const [personalResult, personalError] = await getUserWorkoutsAction({
		teamId,
	})

	if (personalError || !personalResult?.success) {
		return notFound()
	}

	const allWorkouts = personalResult.data

	// Extract unique tags and movements for filter dropdowns
	const allTags = [
		...new Set(
			allWorkouts.flatMap((workout) => workout.tags.map((tag) => tag.name)),
		),
	].sort() as string[]
	const allMovements = [
		...new Set(
			allWorkouts.flatMap((workout) =>
				workout.movements.map((m) => m?.name).filter(Boolean),
			),
		),
	].sort() as string[]

	return (
		<WorkoutsPageClient
			scheduledWorkouts={scheduledResult?.scheduledWorkouts || []}
			personalWorkouts={allWorkouts}
			allTags={allTags}
			allMovements={allMovements}
			searchParams={mySearchParams}
		/>
	)
}
