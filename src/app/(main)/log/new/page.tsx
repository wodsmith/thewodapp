import { redirect } from "next/navigation"
import LogFormClient from "./_components/log-form-client"

import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import type { Metadata } from "next"

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
	searchParams?: Promise<{ workoutId?: string; redirectUrl?: string }>
}) {
	console.log("[log/new] Fetching workouts for log form")
	const session = await getSessionFromCookie()
	const mySearchParams = await searchParams

	if (!session || !session?.user?.id) {
		console.log("[log/page] No user found")
		redirect("/login")
	}

	// Get user's personal team ID
	const { getUserPersonalTeamId } = await import("@/server/user")
	const teamId = await getUserPersonalTeamId(session.user.id)

	const [result, error] = await getUserWorkoutsAction({
		teamId,
	})

	if (error || !result?.success) {
		console.error("[log/new] Failed to fetch workouts")
		redirect("/login")
	}

	return (
		<LogFormClient
			workouts={result.data}
			userId={session.user.id}
			selectedWorkoutId={mySearchParams?.workoutId}
			redirectUrl={mySearchParams?.redirectUrl}
		/>
	)
}
