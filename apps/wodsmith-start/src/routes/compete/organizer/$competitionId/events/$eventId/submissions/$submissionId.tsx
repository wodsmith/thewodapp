/**
 * Submission Detail Route
 *
 * Organizer page for viewing and verifying an individual athlete video submission.
 * Displays the video, athlete info, score details, and event context.
 * Includes navigation to previous/next submissions.
 */

// @ts-nocheck - Route types will be generated when dev server runs

import { createFileRoute, getRouteApi, Link, notFound } from "@tanstack/react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { VideoEmbed } from "@/components/video-embed"
import {
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	Clock,
	ExternalLink,
	Mail,
	User,
} from "lucide-react"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import {
	getEventSubmissionsFn,
	getSubmissionDetailFn,
} from "@/server-fns/submission-verification-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId",
)({
	component: SubmissionDetailPage,
	loader: async ({ params }) => {
		// Get competition for context
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Fetch submission detail and all submissions (for navigation) in parallel
		const [detailResult, allSubmissionsResult] = await Promise.all([
			getSubmissionDetailFn({
				data: {
					competitionId: params.competitionId,
					trackWorkoutId: params.eventId,
					scoreId: params.submissionId,
				},
			}),
			getEventSubmissionsFn({
				data: {
					competitionId: params.competitionId,
					trackWorkoutId: params.eventId,
				},
			}),
		])

		if (!detailResult.submission) {
			throw notFound()
		}

		// Find current position and navigation
		const allSubmissions = allSubmissionsResult.submissions
		const currentIndex = allSubmissions.findIndex(
			(s) => s.id === params.submissionId,
		)

		const navigation = {
			previous: currentIndex > 0 ? allSubmissions[currentIndex - 1]?.id : null,
			next:
				currentIndex < allSubmissions.length - 1
					? allSubmissions[currentIndex + 1]?.id
					: null,
			current: currentIndex + 1,
			total: allSubmissions.length,
		}

		return {
			submission: detailResult.submission,
			event: detailResult.event,
			navigation,
			timezone: competition.timezone || "America/Denver",
		}
	},
})

function formatDate(date: Date, timezone: string): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: timezone,
	}).format(date)
}

function getInitials(firstName: string, lastName: string): string {
	return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function SubmissionDetailPage() {
	const { submission, event, navigation, timezone } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const params = Route.useParams()

	console.log("[SubmissionDetailPage] submission:", submission)
	console.log("[SubmissionDetailPage] submission.videoUrl:", submission.videoUrl)
	console.log("[SubmissionDetailPage] params:", params)

	return (
		<>
			{/* Header with Navigation */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link
							to="/compete/organizer/$competitionId/events/$eventId/submissions"
							params={{
								competitionId: params.competitionId,
								eventId: params.eventId,
							}}
						>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-3xl font-bold">Submission Verification</h1>
						<p className="text-muted-foreground mt-1">
							Event #{event.trackOrder} - {event.workout.name}
						</p>
					</div>
				</div>

				{/* Navigation Controls */}
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground text-sm">
						{navigation.current} of {navigation.total}
					</span>
					<Button
						variant="outline"
						size="icon"
						disabled={!navigation.previous}
						asChild={!!navigation.previous}
					>
						{navigation.previous ? (
							<Link
								to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
								params={{
									competitionId: params.competitionId,
									eventId: params.eventId,
									submissionId: navigation.previous,
								}}
							>
								<ChevronLeft className="h-4 w-4" />
							</Link>
						) : (
							<span>
								<ChevronLeft className="h-4 w-4" />
							</span>
						)}
					</Button>
					<Button
						variant="outline"
						size="icon"
						disabled={!navigation.next}
						asChild={!!navigation.next}
					>
						{navigation.next ? (
							<Link
								to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
								params={{
									competitionId: params.competitionId,
									eventId: params.eventId,
									submissionId: navigation.next,
								}}
							>
								<ChevronRight className="h-4 w-4" />
							</Link>
						) : (
							<span>
								<ChevronRight className="h-4 w-4" />
							</span>
						)}
					</Button>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main Content - Video Player */}
				<div className="lg:col-span-2 space-y-6">
					{/* Video Card */}
					<Card>
						<CardHeader>
							<CardTitle>Submission Video</CardTitle>
							{submission.videoUrl && (
								<CardDescription>
									<a
										href={submission.videoUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary inline-flex items-center gap-1 hover:underline"
									>
										Open original <ExternalLink className="h-3 w-3" />
									</a>
								</CardDescription>
							)}
						</CardHeader>
						<CardContent>
							<VideoEmbed url={submission.videoUrl} className="w-full" />
						</CardContent>
					</Card>

					{/* Event Details Card */}
					<Card>
						<CardHeader>
							<CardTitle>Event Details</CardTitle>
							<CardDescription>
								Workout standards and description for reference
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-medium">{event.workout.name}</h4>
									{event.workout.timeCap && (
										<p className="text-muted-foreground text-sm">
											Time Cap: {event.workout.timeCap} minutes
										</p>
									)}
								</div>
								<Separator />
								<div className="prose prose-sm dark:prose-invert max-w-none">
									<pre className="bg-muted whitespace-pre-wrap rounded-md p-4 text-sm">
										{event.workout.description}
									</pre>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Sidebar - Athlete & Score Info */}
				<div className="space-y-6">
					{/* Athlete Info Card */}
					<Card>
						<CardHeader>
							<CardTitle>Athlete</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-start gap-4">
								<Avatar className="h-16 w-16">
									<AvatarImage
										src={submission.athlete.avatar || undefined}
										alt={`${submission.athlete.firstName} ${submission.athlete.lastName}`}
									/>
									<AvatarFallback>
										{getInitials(
											submission.athlete.firstName,
											submission.athlete.lastName,
										)}
									</AvatarFallback>
								</Avatar>
								<div className="space-y-1">
									<h3 className="font-semibold text-lg">
										{submission.athlete.firstName} {submission.athlete.lastName}
									</h3>
									{submission.athlete.teamName && (
										<p className="text-muted-foreground text-sm">
											{submission.athlete.teamName}
										</p>
									)}
									<Badge variant="outline">
										{submission.athlete.divisionLabel}
									</Badge>
								</div>
							</div>
							<Separator className="my-4" />
							<div className="space-y-2 text-sm">
								<div className="flex items-center gap-2 text-muted-foreground">
									<Mail className="h-4 w-4" />
									<span>{submission.athlete.email}</span>
								</div>
								<div className="flex items-center gap-2 text-muted-foreground">
									<User className="h-4 w-4" />
									<span>ID: {submission.athlete.userId.slice(0, 12)}...</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Score Info Card */}
					<Card>
						<CardHeader>
							<CardTitle>Score Details</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<p className="text-muted-foreground text-sm">Score</p>
									<p className="font-mono text-2xl font-bold">
										{submission.score.displayValue || "-"}
									</p>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-muted-foreground text-sm">Status</p>
										<Badge
											variant={
												submission.score.status === "scored"
													? "default"
													: submission.score.status === "cap"
														? "secondary"
														: "destructive"
											}
											className="mt-1"
										>
											{submission.score.status}
										</Badge>
									</div>
									{submission.score.tiebreakValue && (
										<div>
											<p className="text-muted-foreground text-sm">Tiebreak</p>
											<p className="font-mono mt-1">
												{submission.score.tiebreakValue}
											</p>
										</div>
									)}
								</div>
								{submission.score.status === "cap" &&
									submission.score.secondaryValue !== null && (
										<div>
											<p className="text-muted-foreground text-sm">
												Reps Completed at Cap
											</p>
											<p className="font-mono">{submission.score.secondaryValue}</p>
										</div>
									)}
								<Separator />
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<Clock className="h-4 w-4" />
									<span>
										Submitted {formatDate(new Date(submission.submittedAt), timezone)}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Notes Card (if any) */}
					{submission.notes && (
						<Card>
							<CardHeader>
								<CardTitle>Athlete Notes</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground text-sm whitespace-pre-wrap">
									{submission.notes}
								</p>
							</CardContent>
						</Card>
					)}

					{/* Placeholder for Future Controls */}
					<Card className="border-dashed">
						<CardHeader>
							<CardTitle className="text-muted-foreground">
								Verification Controls
							</CardTitle>
							<CardDescription>
								Penalty and score verification controls will be added here
							</CardDescription>
						</CardHeader>
					</Card>
				</div>
			</div>
		</>
	)
}
