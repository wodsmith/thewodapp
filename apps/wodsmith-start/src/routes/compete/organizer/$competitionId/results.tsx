/**
 * Competition Results Route
 *
 * For in-person competitions: Organizer page for entering competition results/scores.
 * For online competitions: Shows submissions overview with links to video verification.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/page.tsx
 */

import { createFileRoute, getRouteApi, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertTriangle, Eye, EyeOff, Loader2, Video, VideoOff } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { ResultsEntryForm } from "@/components/organizer/results/results-entry-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getEventScoreEntryDataWithHeatsFn,
	saveCompetitionScoreFn,
} from "@/server-fns/competition-score-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
	getDivisionResultsStatusFn,
	publishDivisionResultsFn,
	type AllEventsResultsStatusResponse,
} from "@/server-fns/division-results-fns"
import { getEventSubmissionsFn } from "@/server-fns/submission-verification-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Search params schema for event and division selection
const searchParamsSchema = z.object({
	event: z.string().optional(),
	division: z.string().optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/results",
)({
	validateSearch: searchParamsSchema,
	component: ResultsPage,
	loaderDeps: ({ search }) => ({
		eventId: search.event,
		divisionId: search.division,
	}),
	loader: async ({ params, deps }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		const isOnline = competition.competitionType === "online"

		// Fetch events and divisions in parallel
		const [eventsResult, divisionsResult] = await Promise.all([
			getCompetitionWorkoutsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getCompetitionDivisionsWithCountsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
		])

		const events = eventsResult.workouts
		const divisions = divisionsResult.divisions

		// For online competitions, fetch submission stats for each event
		if (isOnline) {
			const eventSubmissionStats = await Promise.all(
				events.map(async (event) => {
					const { submissions } = await getEventSubmissionsFn({
						data: {
							competitionId: params.competitionId,
							trackWorkoutId: event.id,
						},
					})
					const withVideo = submissions.filter((s) => s.hasVideo).length
					return {
						eventId: event.id,
						eventName: event.workout.name,
						trackOrder: event.trackOrder,
						totalSubmissions: submissions.length,
						withVideo,
						withoutVideo: submissions.length - withVideo,
					}
				}),
			)

			return {
				isOnline: true as const,
				events,
				eventSubmissionStats,
			}
		}

		// For in-person competitions, fetch score entry data
		const divisionResultsStatus = await getDivisionResultsStatusFn({
			data: {
				competitionId: params.competitionId,
				organizingTeamId: competition.organizingTeamId,
			},
		})

		// Determine which event to show (from URL or first event)
		const selectedEventId = deps.eventId || events[0]?.id
		const selectedEvent = events.find((e) => e.id === selectedEventId)

		// Fetch score entry data if we have a selected event
		let scoreEntryData = null
		if (selectedEvent) {
			scoreEntryData = await getEventScoreEntryDataWithHeatsFn({
				data: {
					competitionId: params.competitionId,
					organizingTeamId: competition.organizingTeamId,
					trackWorkoutId: selectedEvent.id,
					divisionId: deps.divisionId,
				},
			})
		}

		return {
			isOnline: false as const,
			events,
			divisions,
			selectedEventId,
			selectedDivisionId: deps.divisionId,
			scoreEntryData,
			// When called without eventId, returns AllEventsResultsStatusResponse
			divisionResultsStatus:
				divisionResultsStatus as AllEventsResultsStatusResponse,
		}
	},
})

function ResultsPage() {
	const loaderData = Route.useLoaderData()

	// Route to appropriate component based on competition type
	if (loaderData.isOnline) {
		return <OnlineSubmissionsOverview data={loaderData} />
	}

	return <InPersonResultsEntry data={loaderData} />
}

/**
 * Online competition submissions overview
 * Shows all events with submission counts and links to verification pages
 */
function OnlineSubmissionsOverview({
	data,
}: {
	data: {
		isOnline: true
		events: Array<{
			id: string
			workout: { name: string }
			trackOrder: number
		}>
		eventSubmissionStats: Array<{
			eventId: string
			eventName: string
			trackOrder: number
			totalSubmissions: number
			withVideo: number
			withoutVideo: number
		}>
	}
}) {
	const { competitionId } = Route.useParams()

	// Calculate totals
	const totals = data.eventSubmissionStats.reduce(
		(acc, stat) => ({
			totalSubmissions: acc.totalSubmissions + stat.totalSubmissions,
			withVideo: acc.withVideo + stat.withVideo,
			withoutVideo: acc.withoutVideo + stat.withoutVideo,
		}),
		{ totalSubmissions: 0, withVideo: 0, withoutVideo: 0 },
	)

	if (data.events.length === 0) {
		return (
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="text-xl font-semibold">Submissions</h2>
					<p className="text-muted-foreground text-sm">
						Review athlete video submissions
					</p>
				</div>
				<div className="text-center py-12 text-muted-foreground">
					No events found for this competition. Add events first.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-xl font-semibold">Submissions</h2>
				<p className="text-muted-foreground text-sm">
					Review athlete video submissions for each event
				</p>
			</div>

			{/* Summary Stats */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Submissions</CardDescription>
						<CardTitle className="text-4xl">{totals.totalSubmissions}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>With Video</CardDescription>
						<CardTitle className="text-4xl text-green-600">
							{totals.withVideo}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Without Video</CardDescription>
						<CardTitle className="text-4xl text-yellow-600">
							{totals.withoutVideo}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{/* Events Table */}
			<Card>
				<CardHeader>
					<CardTitle>Events</CardTitle>
					<CardDescription>
						Click on an event to review submissions
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[80px]">Event</TableHead>
								<TableHead>Name</TableHead>
								<TableHead className="text-center">Submissions</TableHead>
								<TableHead className="text-center">With Video</TableHead>
								<TableHead className="text-center">Without Video</TableHead>
								<TableHead className="w-[120px]">Action</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.eventSubmissionStats
								.sort((a, b) => a.trackOrder - b.trackOrder)
								.map((stat) => (
									<TableRow key={stat.eventId}>
										<TableCell className="font-medium">
											#{stat.trackOrder}
										</TableCell>
										<TableCell>{stat.eventName}</TableCell>
										<TableCell className="text-center">
											{stat.totalSubmissions}
										</TableCell>
										<TableCell className="text-center">
											<div className="flex items-center justify-center gap-1">
												<Video className="h-4 w-4 text-green-600" />
												<span className="text-green-600">{stat.withVideo}</span>
											</div>
										</TableCell>
										<TableCell className="text-center">
											<div className="flex items-center justify-center gap-1">
												<VideoOff className="h-4 w-4 text-yellow-600" />
												<span className="text-yellow-600">
													{stat.withoutVideo}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Button variant="outline" size="sm" asChild>
												<Link
													to="/compete/organizer/$competitionId/events/$eventId/submissions"
													params={{
														competitionId,
														eventId: stat.eventId,
													}}
												>
													Review
												</Link>
											</Button>
										</TableCell>
									</TableRow>
								))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	)
}

/**
 * In-person competition results entry
 * Original results entry form for manual score input
 */
function InPersonResultsEntry({
	data,
}: {
	data: {
		isOnline: false
		events: Array<{
			id: string
			workout: { name: string }
			trackOrder: number
		}>
		divisions: Array<{ id: string; label: string }>
		selectedEventId: string | undefined
		selectedDivisionId: string | undefined
		scoreEntryData: Awaited<
			ReturnType<typeof getEventScoreEntryDataWithHeatsFn>
		> | null
		divisionResultsStatus: AllEventsResultsStatusResponse
	}
}) {
	const {
		events,
		divisions,
		selectedEventId,
		selectedDivisionId,
		scoreEntryData,
		divisionResultsStatus,
	} = data
	const { competitionId } = Route.useParams()
	const router = useRouter()

	// Get competition from parent route for organizingTeamId
	const { competition } = parentRoute.useLoaderData()

	// Wrap server function for client-side publishing
	const publishDivisionResults = useServerFn(publishDivisionResultsFn)
	const [isPublishing, setIsPublishing] = useState(false)

	// Find the current division's publish status for the selected event
	const currentDivisionStatus =
		selectedEventId && selectedDivisionId
			? divisionResultsStatus.events
					.find((e) => e.eventId === selectedEventId)
					?.divisions.find((d) => d.divisionId === selectedDivisionId)
			: null

	// Handle publishing/unpublishing current division results
	const handleTogglePublish = async (publish: boolean) => {
		if (!selectedEventId || !selectedDivisionId) return

		setIsPublishing(true)
		try {
			await publishDivisionResults({
				data: {
					competitionId,
					organizingTeamId: competition.organizingTeamId,
					eventId: selectedEventId,
					divisionId: selectedDivisionId,
					publish,
				},
			})
			toast.success(
				publish
					? "Division results published - athletes can now see results"
					: "Division results unpublished",
			)
			await router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update results",
			)
		} finally {
			setIsPublishing(false)
		}
	}

	// Handle saving scores - wraps the server function with required params
	const handleSaveScore = useCallback(
		async (params: {
			competitionId: string
			organizingTeamId: string
			trackWorkoutId: string
			workoutId: string
			registrationId: string
			userId: string
			divisionId: string | null
			score: string
			scoreStatus: string
			tieBreakScore: string | null
			secondaryScore: string | null
			roundScores?: Array<{ score: string }>
			workout: {
				scheme: string
				scoreType: string | null
				repsPerRound: number | null
				roundsToScore: number | null
				timeCap: number | null
				tiebreakScheme: string | null
			}
		}) => {
			const result = await saveCompetitionScoreFn({
				data: {
					competitionId: params.competitionId,
					organizingTeamId: params.organizingTeamId,
					trackWorkoutId: params.trackWorkoutId,
					workoutId: params.workoutId,
					registrationId: params.registrationId,
					userId: params.userId,
					divisionId: params.divisionId,
					score: params.score,
					scoreStatus: params.scoreStatus as
						| "scored"
						| "cap"
						| "dq"
						| "withdrawn"
						| "dns"
						| "dnf",
					tieBreakScore: params.tieBreakScore,
					secondaryScore: params.secondaryScore,
					roundScores: params.roundScores,
					workout: params.workout,
				},
			})
			return result.data
		},
		[],
	)

	// No events - show empty state
	if (events.length === 0) {
		return (
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="text-xl font-semibold">Enter Results</h2>
					<p className="text-muted-foreground text-sm">
						Enter scores for competition events
					</p>
				</div>
				<div className="text-center py-12 text-muted-foreground">
					No events found for this competition. Add events first before entering
					results.
				</div>
			</div>
		)
	}

	// No score entry data (shouldn't happen if events exist, but handle gracefully)
	if (!scoreEntryData) {
		return (
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="text-xl font-semibold">Enter Results</h2>
					<p className="text-muted-foreground text-sm">
						Enter scores for competition events
					</p>
				</div>
				<div className="text-center py-12 text-muted-foreground">
					Unable to load score entry data. Please try again.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Warning banner for unpublished division results */}
			{selectedDivisionId &&
				currentDivisionStatus &&
				!currentDivisionStatus.isPublished && (
					<Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
						<AlertTriangle className="h-4 w-4 text-amber-600" />
						<AlertTitle className="text-amber-800 dark:text-amber-200">
							Results Not Published
						</AlertTitle>
						<AlertDescription className="text-amber-700 dark:text-amber-400">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span>
									Results for{" "}
									<span className="font-medium">
										{currentDivisionStatus.label}
									</span>{" "}
									are not yet published. Athletes cannot see these results.
								</span>
								<Button
									size="sm"
									onClick={() => handleTogglePublish(true)}
									disabled={isPublishing}
									className="shrink-0"
								>
									{isPublishing ? (
										<Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
									) : (
										<Eye className="h-4 w-4 mr-1.5" />
									)}
									Publish Now
								</Button>
							</div>
						</AlertDescription>
					</Alert>
				)}

			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<div className="flex items-center gap-2">
						<h2 className="text-xl font-semibold">Enter Results</h2>
						{/* Published/Draft badge for selected division */}
						{selectedDivisionId && currentDivisionStatus && (
							<Badge
								className={
									currentDivisionStatus.isPublished
										? "border-green-500/50 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
										: "border-gray-500/50 bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200"
								}
							>
								{currentDivisionStatus.isPublished ? (
									<>
										<Eye className="h-3 w-3 mr-1" />
										Published
									</>
								) : (
									<>
										<EyeOff className="h-3 w-3 mr-1" />
										Draft
									</>
								)}
							</Badge>
						)}
					</div>
					<p className="text-muted-foreground text-sm">
						{scoreEntryData.athletes.length} athlete
						{scoreEntryData.athletes.length !== 1 ? "s" : ""}
						{selectedDivisionId ? " in selected division" : ""}
					</p>
				</div>

				{/* Quick publish/unpublish button when division is selected */}
				{selectedDivisionId && currentDivisionStatus && (
					<Button
						size="sm"
						variant={currentDivisionStatus.isPublished ? "outline" : "default"}
						onClick={() =>
							handleTogglePublish(!currentDivisionStatus.isPublished)
						}
						disabled={isPublishing}
					>
						{isPublishing ? (
							<Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
						) : currentDivisionStatus.isPublished ? (
							<EyeOff className="h-4 w-4 mr-1.5" />
						) : (
							<Eye className="h-4 w-4 mr-1.5" />
						)}
						{currentDivisionStatus.isPublished ? "Unpublish" : "Publish"}{" "}
						Results
					</Button>
				)}
			</div>

			<ResultsEntryForm
				key={`${selectedEventId}-${selectedDivisionId}`}
				competitionId={competitionId}
				organizingTeamId={competition.organizingTeamId}
				events={events.map((e) => ({
					id: e.id,
					name: e.workout.name,
					trackOrder: e.trackOrder,
				}))}
				selectedEventId={selectedEventId}
				event={scoreEntryData.event}
				athletes={scoreEntryData.athletes}
				heats={scoreEntryData.heats}
				unassignedRegistrationIds={scoreEntryData.unassignedRegistrationIds}
				divisions={divisions.map((d) => ({
					id: d.id,
					label: d.label,
				}))}
				selectedDivisionId={selectedDivisionId}
				saveScore={handleSaveScore}
			/>
		</div>
	)
}
