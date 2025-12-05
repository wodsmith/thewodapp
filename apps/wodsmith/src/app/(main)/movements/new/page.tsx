import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createMovementAction } from "@/actions/movement-actions"

import { getSessionFromCookie } from "@/utils/auth"
import CreateMovementForm from "./_components/create-movement-form"

export const metadata: Metadata = {
	title: "Create Movement",
	description: "Create a new CrossFit movement.",
	openGraph: {
		type: "website",
		title: "Create Movement",
		description: "Create a new CrossFit movement.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Create Movement")}`,
				width: 1200,
				height: 630,
				alt: "Create Movement",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Create Movement",
		description: "Create a new CrossFit movement.",
		images: [`/api/og?title=${encodeURIComponent("Create Movement")}`],
	},
}

export default async function CreateMovementPage() {
	const session = await getSessionFromCookie()

	if (!session || !session?.user?.id) {
		console.log("[movements/new/page] No user found")
		redirect("/sign-in")
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
			const [result, error] = await createMovementAction(data)
			if (error) {
				console.error("[movements/new/page] createMovementAction error", error)
				throw error
			}

			if (!result?.success || !result.data?.id) {
				console.error("[movements/new/page] Unexpected result", result)
				return undefined
			}

			return {
				success: true,
				data: {
					id: result.data.id,
				},
			}
		} catch (error) {
			console.error("[movements/new/page] Error creating movement", error)
			throw new Error("Error creating movement")
		}
	}

	return (
		<CreateMovementForm createMovementAction={createMovementActionHandler} />
	)
}
