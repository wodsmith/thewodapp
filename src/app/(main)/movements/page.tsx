import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getAllMovementsAction } from "@/actions/movement-actions"
import MovementList from "./_components/movement-list"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "WODsmith | Movements",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "WODsmith | Movements", // Default title for layout
		description: "Track your spicy workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("WODsmith | Movements")}`,
				width: 1200,
				height: 630,
				alt: "WODsmith | Movements",
			},
		],
	},
}

export default async function MovementsPage() {
	const [result, error] = await getAllMovementsAction()

	if (error || !result?.success) {
		return notFound()
	}

	const movements = result.data

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">MOVEMENTS</h1>
				<Link href="/movements/new" className="btn flex items-center gap-2">
					<Plus className="h-5 w-5" />
					<span>Create Movement</span>
				</Link>
			</div>

			<MovementList movements={movements} />
		</div>
	)
}
