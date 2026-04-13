/**
 * Volunteer Video Review Layout Route
 *
 * Allows volunteers with score access entitlement to review video submissions
 * for online competition events. Gates access with the same entitlement check
 * as the score entry route.
 */

import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useChildMatches,
} from "@tanstack/react-router"
import { ArrowLeft, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	getCompetitionWorkoutsForScoreEntryFn,
} from "@/server-fns/competition-score-fns"
import { getSubmissionCountsByEventFn } from "@/server-fns/video-submission-fns"
import { canInputScoresFn } from "@/server-fns/volunteer-fns"
import { Badge } from "@/components/ui/badge"
import { formatTrackOrder } from "@/utils/format-track-order"

export const Route = createFileRoute("/compete/$slug/review")({
	loader: async ({ params, context, parentMatchPromise }) => {
		const { slug } = params
		const session = context.session

		// Require authentication
		if (!session?.user?.id) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}/review` },
			})
		}

		// Get competition from parent
		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition

		if (!competition) {
			throw new Error("Competition not found")
		}

		if (!competition.competitionTeamId) {
			throw new Error("Competition team not found")
		}

		// Check score input entitlement (reuses same entitlement as score entry)
		const hasAccess = await canInputScoresFn({
			data: {
				userId: session.user.id,
				competitionTeamId: competition.competitionTeamId,
			},
		})

		if (!hasAccess) {
			throw redirect({
				to: "/compete/$slug",
				params: { slug },
			})
		}

		// Fetch events for this competition
		const eventsResult = await getCompetitionWorkoutsForScoreEntryFn({
			data: {
				competitionId: competition.id,
				competitionTeamId: competition.competitionTeamId,
			},
		})

		const events = eventsResult.workouts

		// Fetch submission counts for all events
		let submissionCounts: Record<
			string,
			{ total: number; reviewed: number; pending: number }
		> = {}
		if (events.length > 0) {
			const countsResult = await getSubmissionCountsByEventFn({
				data: {
					trackWorkoutIds: events.map((e) => e.id),
				},
			})
			submissionCounts = countsResult.counts
		}

		return {
			competition,
			events,
			submissionCounts,
		}
	},
	component: ReviewLayout,
})

function ReviewLayout() {
	const { competition, events, submissionCounts } = Route.useLoaderData()
	const childMatches = useChildMatches()
	const hasChildRoute = childMatches.length > 0

	if (hasChildRoute) {
		return <Outlet />
	}

	// No child route selected — show event list
	return (
		<div className="container mx-auto max-w-4xl py-6">
			<div className="mb-6 flex items-center gap-3">
				<Button variant="ghost" size="icon" asChild>
					<Link
						to="/compete/$slug"
						params={{ slug: competition.slug }}
					>
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div>
					<h1 className="text-2xl font-bold">Review Submissions</h1>
					<p className="text-muted-foreground text-sm">
						{competition.name}
					</p>
				</div>
			</div>

			{events.length === 0 ? (
				<Card>
					<CardContent className="py-8 text-center">
						<Video className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
						<p className="text-muted-foreground">
							No events found for this competition.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{events.map((event) => {
						const counts = submissionCounts[event.id]
						const total = counts?.total ?? 0
						const reviewed = counts?.reviewed ?? 0
						const pending = counts?.pending ?? 0

						return (
							<Link
								key={event.id}
								to="/compete/$slug/review/$eventId"
								params={{
									slug: competition.slug,
									eventId: event.id,
								}}
								className="block"
							>
								<Card className="hover:bg-accent/50 transition-colors">
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between">
											<CardTitle className="text-lg">
												{formatTrackOrder(
													event.trackOrder,
												)}{" "}
												{event.workout.name}
											</CardTitle>
											{total > 0 && (
												<div className="flex gap-2">
													{pending > 0 && (
														<Badge variant="secondary">
															{pending} pending
														</Badge>
													)}
													{reviewed > 0 && (
														<Badge variant="outline">
															{reviewed} reviewed
														</Badge>
													)}
												</div>
											)}
										</div>
										<CardDescription>
											{total === 0
												? "No submissions yet"
												: `${total} submission${total === 1 ? "" : "s"}`}
										</CardDescription>
									</CardHeader>
								</Card>
							</Link>
						)
					})}
				</div>
			)}
		</div>
	)
}
