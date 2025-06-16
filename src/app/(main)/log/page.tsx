import {
	getLogsByUserAction,
	getResultSetsByIdAction,
} from "@/actions/log-actions"
import { formatSecondsToTime } from "@/lib/utils"
import type { ResultSet, WorkoutResultWithWorkoutName } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import LogCalendarClient from "./_components/log-calendar-client" // Import new calendar

import type { Metadata } from "next"
import { Button } from "@/components/ui/button"

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
					<h2 className="mb-4 font-semibold text-xl dark:text-white">
						RECENT RESULTS
					</h2>
					{/* Placeholder for recent results if needed, or remove if calendar is sufficient */}
					{logs.length > 0 ? (
						<div className="space-y-4">
							{
								await Promise.all(
									logs.map(async (log) => {
										return (
											<div
												key={log.id}
												className="rounded-none border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]"
											>
												<div className="flex items-start justify-between p-4">
													<div>
														<Link href={`/workouts/${log.workoutId}`}>
															<h3 className="font-bold text-xl uppercase tracking-tight hover:underline dark:text-white">
																{log.workoutName || "Workout"}
															</h3>
														</Link>
														<p className="font-mono text-neutral-600 text-xs dark:text-neutral-400">
															{new Date(log.date).toLocaleDateString()}
														</p>
													</div>
													<div className="text-right font-mono text-xs dark:text-neutral-300">
														{log.type && (
															<p>
																<span className="font-semibold">Type:</span>{" "}
																{log.type}
															</p>
														)}
														{log.scale && (
															<p>
																<span className="font-semibold">Scale:</span>{" "}
																{log.scale.toUpperCase()}
															</p>
														)}
													</div>
												</div>

												<div className="space-y-2 p-4">
													{log.notes && (
														<div className="border border-neutral-300 bg-neutral-100 p-2 dark:border-neutral-600 dark:bg-neutral-700">
															<p className="font-mono text-sm dark:text-neutral-200">
																{log.notes}
															</p>
														</div>
													)}

													<div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm dark:text-neutral-300">
														{log.wodScore && (
															<p>
																<span className="font-semibold">Score:</span>{" "}
																{log.wodScore}
															</p>
														)}
														{log.setCount && (
															<p>
																<span className="font-semibold">Sets:</span>{" "}
																{log.setCount}
															</p>
														)}
														{log.distance && (
															<p>
																<span className="font-semibold">Distance:</span>{" "}
																{log.distance}m
															</p>
														)}
														{log.time && (
															<p>
																<span className="font-semibold">Time:</span>{" "}
																{formatSecondsToTime(log.time)}
															</p>
														)}
													</div>
												</div>
												<Suspense
													fallback={
														<div className="border-black border-t-2 p-4 font-mono text-sm dark:border-neutral-700 dark:text-neutral-400">
															Loading details...
														</div>
													}
												>
													<SetDetails log={log} />
												</Suspense>
											</div>
										)
									}),
								)
							}
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

async function SetDetails({ log }: { log: WorkoutResultWithWorkoutName }) {
	const [result, error] = await getResultSetsByIdAction({ resultId: log.id })
	const setDetails: ResultSet[] = result?.success ? result.data : []

	// console.log({ setDetails }); // Keep console.log commented out or remove for production

	return (
		setDetails.length > 1 && (
			<div className="border-black border-t-2 p-4 dark:border-neutral-700">
				<h4 className="mb-2 font-bold text-sm uppercase tracking-wider dark:text-white">
					Set Details
				</h4>
				<ul className="list-none space-y-1">
					{setDetails.map((set, index) => {
						const setInfo = []
						if (set.reps) {
							setInfo.push(`${set.reps} reps`)
						}
						if (set.weight !== null && set.weight !== undefined) {
							setInfo.push(`@ ${set.weight}kg`)
						}
						if (set.distance) {
							setInfo.push(`${set.distance}m`)
						}
						if (set.time) {
							setInfo.push(formatSecondsToTime(set.time))
						}
						if (set.score) {
							setInfo.push(`Score: ${set.score}`)
						}
						return (
							<li
								key={set.id || index}
								className="flex font-mono text-xs dark:text-neutral-300"
							>
								<span className="w-16 shrink-0">Set {set.setNumber}:</span>
								<span className="flex-1">{setInfo.join(" / ")}</span>
							</li>
						)
					})}
				</ul>
			</div>
		)
	)
}
