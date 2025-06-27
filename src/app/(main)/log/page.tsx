import { getLogsByUserAction } from "@/actions/log-actions"
import { getSessionFromCookie } from "@/utils/auth"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import LogCalendarClient from "./_components/log-calendar-client" // Import new calendar
import { LogRowCard } from "./_components/log-row-card"

import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "WODsmith | Your Scores",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "WODsmith | Your Scores", // Default title for layout
		description: "Track your spicy workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("WODsmith | Your Scores")}`,
				width: 1200,
				height: 630,
				alt: "WODsmith | Your Scores",
			},
		],
	},
}

export default async function LogPage() {
	const session = await getSessionFromCookie()

	console.log("[log/page] session", session)

	if (!session || !session?.userId) {
		console.log("[log/page] No user found")
		redirect("/sign-in")
	}

	console.log(`[log/page] Fetching logs for user ${session.userId}`)
	const [result, error] = await getLogsByUserAction({ userId: session.userId })

	if (error || !result?.success) {
		return notFound()
	}

	const logs = result.data
	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<h1 className="dark:text-white">WORKOUT LOG</h1>
				<Button asChild>
					<Link href="/log/new">Log New Result</Link>
				</Button>
			</div>
			{/* Display recent results for now, calendar will be added here */}
			<div className="flex flex-col gap-4 md:flex-row">
				<div className="mb-8 flex-1">
					<h2 className="mb-4 font-semibold capitalize text-xl dark:text-white">
						Recent Results
					</h2>
					{logs.length > 0 ? (
						<div className="space-y-4">
							{logs.map((log) => (
								<LogRowCard key={log.id} logEntry={log} />
							))}
						</div>
					) : (
						<p className="dark:text-white">No recent results.</p>
					)}
				</div>
				<LogCalendarClient logs={logs} />
			</div>
		</div>
	)
}
