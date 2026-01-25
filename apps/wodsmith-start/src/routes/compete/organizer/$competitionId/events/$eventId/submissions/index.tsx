/**
 * Event Submissions List Route
 *
 * Organizer page for viewing all athlete video submissions for an event.
 * Lists all submissions with quick status indicators and links to detail view.
 */

// @ts-nocheck - Route types will be generated when dev server runs

import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
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
import { ArrowLeft, Video, VideoOff } from "lucide-react"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import {
	getEventDetailsForVerificationFn,
	getEventSubmissionsFn,
} from "@/server-fns/submission-verification-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId/submissions/",
)({
	component: SubmissionsListPage,
	loader: async ({ params }) => {
		// Get competition for context
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Fetch event details and submissions in parallel
		const [eventResult, submissionsResult] = await Promise.all([
			getEventDetailsForVerificationFn({
				data: {
					competitionId: params.competitionId,
					trackWorkoutId: params.eventId,
				},
			}),
			getEventSubmissionsFn({
				data: {
					competitionId: params.competitionId,
					trackWorkoutId: params.eventId,
				},
			}),
		])

		if (!eventResult.event) {
			throw new Error("Event not found")
		}

		return {
			event: eventResult.event,
			submissions: submissionsResult.submissions,
		}
	},
})

function SubmissionsListPage() {
	const { event, submissions } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const params = Route.useParams()

	const submissionsWithVideo = submissions.filter((s) => s.hasVideo)
	const submissionsWithoutVideo = submissions.filter((s) => !s.hasVideo)

	return (
		<>
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link
						to="/compete/organizer/$competitionId/events/$eventId"
						params={{
							competitionId: params.competitionId,
							eventId: params.eventId,
						}}
					>
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div>
					<h1 className="text-3xl font-bold">Submissions</h1>
					<p className="text-muted-foreground mt-1">
						Event #{event.trackOrder} - {event.workout.name}
					</p>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Submissions</CardDescription>
						<CardTitle className="text-4xl">{submissions.length}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>With Video</CardDescription>
						<CardTitle className="text-4xl text-green-600">
							{submissionsWithVideo.length}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Without Video</CardDescription>
						<CardTitle className="text-4xl text-yellow-600">
							{submissionsWithoutVideo.length}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{/* Submissions Table */}
			<Card>
				<CardHeader>
					<CardTitle>All Submissions</CardTitle>
					<CardDescription>
						Click on a submission to view details and verify the video
					</CardDescription>
				</CardHeader>
				<CardContent>
					{submissions.length === 0 ? (
						<div className="text-muted-foreground py-8 text-center">
							No submissions yet for this event.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Athlete</TableHead>
									<TableHead>Team</TableHead>
									<TableHead>Division</TableHead>
									<TableHead>Score</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Video</TableHead>
									<TableHead className="w-[100px]">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{submissions.map((submission) => (
									<TableRow key={submission.id}>
										<TableCell className="font-medium">
											{submission.athleteName}
										</TableCell>
										<TableCell>
											{submission.teamName || (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell>
											<Badge variant="outline">{submission.divisionLabel}</Badge>
										</TableCell>
										<TableCell className="font-mono">
											{submission.scoreDisplay || "-"}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													submission.status === "scored"
														? "default"
														: submission.status === "cap"
															? "secondary"
															: "destructive"
												}
											>
												{submission.status}
											</Badge>
										</TableCell>
										<TableCell>
											{submission.hasVideo ? (
												<Video className="h-4 w-4 text-green-600" />
											) : (
												<VideoOff className="text-muted-foreground h-4 w-4" />
											)}
										</TableCell>
										<TableCell>
											<Button variant="outline" size="sm" asChild>
												<Link
													to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
													params={{
														competitionId: params.competitionId,
														eventId: params.eventId,
														submissionId: submission.id,
													}}
												>
													View
												</Link>
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</>
	)
}
