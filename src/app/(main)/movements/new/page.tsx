import { createMovementAction } from "@/actions/movement-actions"
import { redirect } from "next/navigation"
import CreateMovementForm from "./_components/create-movement-form"

import { getSessionFromCookie } from "@/utils/auth"
import type { Metadata } from "next"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "WODsmith | Create Movement",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "WODsmith | Create Movement", // Default title for layout
		description: "Track your spicy workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent(
					"WODsmith | Create Movement",
				)}`,
				width: 1200,
				height: 630,
				alt: "WODsmith | Create Movement",
			},
		],
	},
}

export default async function CreateMovementPage() {
	const session = await getSessionFromCookie()

	if (!session || !session?.user?.id) {
		console.log("[movements/new/page] No user found")
		redirect("/login")
	}

	async function createMovementActionHandler(data: {
		name: string
		type: "weightlifting" | "gymnastic" | "monostructural"
	}) {
		"use server"
		if (!session?.user?.id) {
			console.log("[movements/new/page] No user found")
			throw new Error("No user found")
		}
		try {
			await createMovementAction(data)
		} catch (error) {
			console.error("[movements/new/page] Error creating movement", error)
			throw new Error("Error creating movement")
		}
	}

	return (
		<CreateMovementForm createMovementAction={createMovementActionHandler} />
	)
}
