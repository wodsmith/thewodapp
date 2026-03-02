/**
 * Video Review Index Route
 *
 * Organizer overview page showing all events with submission counts,
 * window status, and review progress. Links to per-event submission review.
 * Only available for online competitions.
 */

import { createFileRoute, getRouteApi, Link, redirect } from "@tanstack/react-router"
import { CheckCircle2, Clock, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import { getCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getSubmissionCountsByEventFn } from "@/server-fns/video-submission-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/review",
)({
	staleTime: 10_000,
	component: ReviewIndexPage,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		// Only online competitions have video review
		if (competition.competitionType !== "online") {
			throw redirect({
				to: "/compete/organizer/$competitionId/events",
				params: { competitionId: params.competitionId },
			})
		}

		// Fetch workouts and competition events in parallel
		const [workoutsResult, eventsResult] = await Promise.all([
			getCompetitionWorkoutsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getCompetitionEventsFn({
				data: { competitionId: params.competitionId },
			}),
		])

		const trackWorkoutIds = workoutsResult.workouts.map((w: any) => w.id)

		// Fetch submission counts (only if there are events)
		const countsResult =
			trackWorkoutIds.length > 0
				? await getSubmissionCountsByEventFn({
						data: { trackWorkoutIds },
					})
				: { counts: {} as Record<string, { total: number; reviewed: number; pending: number }> }

		return {
			workouts: workoutsResult.workouts,
			competitionEvents: eventsResult.events,
			submissionCounts: countsResult.counts,
		}
	},
})

function getWindowStatus(
	event: { submissionOpensAt: string | null; submissionClosesAt: string | null } | undefined,
): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
	if (!event?.submissionOpensAt || !event?.submissionClosesAt) {
		return { label: "Not Set", variant: "outline" }
	}

	const now = new Date()
	const opens = new Date(event.submissionOpensAt)
	const closes = new Date(event.submissionClosesAt)

	if (now < opens) return { label: "Upcoming", variant: "secondary" }
	if (now > closes) return { label: "Closed", variant: "destructive" }
	return { label: "Open", variant: "default" }
}

function ReviewIndexPage() {
	const { workouts, competitionEvents, submissionCounts } =
		Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()

	// Build a map of trackWorkoutId -> competition event
	const eventMap = new Map(
		competitionEvents.map((e: any) => [e.trackWorkoutId, e]),
	)

	// Sort workouts by trackOrder
	const sortedWorkouts = [...workouts].sort(
		(a: any, b: any) => a.trackOrder - b.trackOrder,
	)

	// Aggregate totals
	const aggregateTotals = Object.values(submissionCounts).reduce(
		(acc, c) => ({
			total: acc.total + c.total,
			reviewed: acc.reviewed + c.reviewed,
			pending: acc.pending + c.pending,
		}),
		{ total: 0, reviewed: 0, pending: 0 },
	)

	const overallProgress =
		aggregateTotals.total > 0
			? Math.round((aggregateTotals.reviewed / aggregateTotals.total) * 100)
			: 0

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold">Video Review</h1>
				<p className="text-muted-foreground">
					Review athlete video submissions across all events
				</p>
			</div>

			{/* Aggregate Progress */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Overall Review Progress</CardTitle>
					<CardDescription>
						{aggregateTotals.reviewed} of {aggregateTotals.total} submissions
						reviewed across all events
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4">
						<Progress value={overallProgress} className="flex-1" />
						<span className="text-sm font-medium">{overallProgress}%</span>
					</div>
					<div className="mt-3 flex gap-4 text-sm">
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-green-500" />
							<span>Reviewed: {aggregateTotals.reviewed}</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-yellow-500" />
							<span>Pending: {aggregateTotals.pending}</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Event Cards */}
			{sortedWorkouts.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No Events</CardTitle>
						<CardDescription>
							This competition has no events yet. Add events to start receiving
							video submissions.
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<div className="flex flex-col gap-3">
					{sortedWorkouts.map((tw: any) => {
						const event = eventMap.get(tw.id)
						const counts = submissionCounts[tw.id] ?? {
							total: 0,
							reviewed: 0,
							pending: 0,
						}
						const windowStatus = getWindowStatus(event)
						const eventProgress =
							counts.total > 0
								? Math.round((counts.reviewed / counts.total) * 100)
								: 0

						return (
							<Card key={tw.id}>
								<CardContent className="flex items-center gap-4 py-4">
									{/* Event info */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="font-medium">
												Event #{tw.trackOrder}
											</span>
											<span className="text-muted-foreground">—</span>
											<span className="truncate">
												{tw.workout?.name || "Unnamed Workout"}
											</span>
										</div>
										<div className="mt-2 flex items-center gap-3 text-sm">
											<Badge variant={windowStatus.variant}>
												{windowStatus.label}
											</Badge>
											<span className="text-muted-foreground">
												{counts.total} submission{counts.total !== 1 ? "s" : ""}
											</span>
											{counts.total > 0 && (
												<>
													<span className="flex items-center gap-1 text-green-600">
														<CheckCircle2 className="h-3.5 w-3.5" />
														{counts.reviewed}
													</span>
													<span className="flex items-center gap-1 text-yellow-600">
														<Clock className="h-3.5 w-3.5" />
														{counts.pending}
													</span>
												</>
											)}
										</div>
										{counts.total > 0 && (
											<div className="mt-2 flex items-center gap-3">
												<Progress
													value={eventProgress}
													className="flex-1 max-w-xs"
												/>
												<span className="text-xs text-muted-foreground">
													{eventProgress}%
												</span>
											</div>
										)}
									</div>

									{/* Review link */}
									<Link
										to="/compete/organizer/$competitionId/events/$eventId/submissions"
										params={{
											competitionId: competition.id,
											eventId: tw.id,
										}}
									>
										<Button variant="outline" size="sm" className="gap-1.5">
											<Eye className="h-4 w-4" />
											Review
										</Button>
									</Link>
								</CardContent>
							</Card>
						)
					})}
				</div>
			)}
		</div>
	)
}
