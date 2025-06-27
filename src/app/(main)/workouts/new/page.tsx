import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getAllMovementsAction } from "@/actions/movement-actions"
import { getAllTagsAction } from "@/actions/tag-actions"
import { getSessionFromCookie } from "@/utils/auth"
import CreateWorkoutClient from "./_components/create-workout-client"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "WODsmith | Create Workout",
	description: "Track your workouts and progress.",
	openGraph: {
		title: "WODsmith | Create Workout", // Default title for layout
		description: "Track your workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("WODsmith | Create Workout")}`,
				width: 1200,
				height: 630,
				alt: "WODsmith | Create Workout",
			},
		],
	},
}

export default async function CreateWorkoutPage() {
	const [movements, movementsError] = await getAllMovementsAction()
	const [tags, tagsError] = await getAllTagsAction()

	if (movementsError || tagsError || !movements?.success || !tags?.success) {
		return notFound()
	}

	const session = await getSessionFromCookie()

	if (!session?.user?.id) {
		console.log("[log/page] No user found")
		redirect("/login")
	}

	return (
		<CreateWorkoutClient
			movements={movements.data}
			tags={tags.data}
			userId={session.user.id}
		/>
	)
}
