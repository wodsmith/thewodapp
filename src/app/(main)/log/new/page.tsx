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
	searchParams?: Promise<{ workoutId?: string; redirectUrl?: string }>
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

	return (
		<LogFormClient
			workouts={result.data}
			userId={session.user.id}
			selectedWorkoutId={mySearchParams?.workoutId}
			redirectUrl={mySearchParams?.redirectUrl}
		/>
	)
}
