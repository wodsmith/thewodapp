import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getAllMovementsAction } from "@/actions/movement-actions"
import MovementList from "./_components/movement-list"

export const metadata: Metadata = {
	title: "Movements",
	description: "Browse and manage CrossFit movements.",
	openGraph: {
		type: "website",
		title: "Movements",
		description: "Browse and manage CrossFit movements.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Movements")}`,
				width: 1200,
				height: 630,
				alt: "Movements",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Movements",
		description: "Browse and manage CrossFit movements.",
		images: [`/api/og?title=${encodeURIComponent("Movements")}`],
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
