/**
 * Organizer Video Submission Review Detail Route
 *
 * Single submission review page where organizers can watch the video,
 * see the claimed score, and mark as reviewed.
 */

import { useState } from "react"
import {
	createFileRoute,
	getRouteApi,
	Link,
	useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	ArrowLeft,
	Calendar,
	CheckCircle2,
	Clock,
	ExternalLink,
	FileText,
	Trophy,
	Undo2,
	User,
} from "lucide-react"
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
import { YouTubeEmbed, isYouTubeUrl } from "@/components/compete/youtube-embed"
import { isSafeUrl } from "@/utils/url"
import {
	getOrganizerSubmissionDetailFn,
	markSubmissionReviewedFn,
	unmarkSubmissionReviewedFn,
} from "@/server-fns/video-submission-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId",
)({
	component: SubmissionDetailPage,
	loader: async ({ params }) => {
		const result = await getOrganizerSubmissionDetailFn({
			data: {
				submissionId: params.submissionId,
				competitionId: params.competitionId,
			},
		})

		if (!result.submission) {
			throw new Error("Submission not found")
		}

		return { submission: result.submission }
	},
})

function SubmissionDetailPage() {
	const { submission } = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const params = Route.useParams()
	const router = useRouter()

	const markReviewed = useServerFn(markSubmissionReviewedFn)
	const unmarkReviewed = useServerFn(unmarkSubmissionReviewedFn)

	const [isUpdating, setIsUpdating] = useState(false)

	const isReviewed = submission.reviewStatus === "reviewed"
	const isYouTube = isYouTubeUrl(submission.videoUrl)

	const handleToggleReview = async () => {
		setIsUpdating(true)
		try {
			if (isReviewed) {
				await unmarkReviewed({ data: { submissionId: submission.id } })
			} else {
				await markReviewed({ data: { submissionId: submission.id } })
			}
			router.invalidate()
		} finally {
			setIsUpdating(false)
		}
	}

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const getInitials = (firstName: string | null, lastName: string | null) => {
		const first = firstName?.[0] || ""
		const last = lastName?.[0] || ""
		return (first + last).toUpperCase() || "?"
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Link
						to="/compete/organizer/$competitionId/events/$eventId/submissions"
						params={{
							competitionId: competition.id,
							eventId: params.eventId,
						}}
					>
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold">Review Submission</h1>
						<p className="text-muted-foreground">
							{submission.athlete.firstName} {submission.athlete.lastName}
						</p>
					</div>
				</div>

				{/* Review action */}
				{isReviewed ? (
					<Button
						variant="outline"
						onClick={handleToggleReview}
						disabled={isUpdating}
						className="gap-2"
					>
						<Undo2 className="h-4 w-4" />
						{isUpdating ? "Updating..." : "Unmark Reviewed"}
					</Button>
				) : (
					<Button
						onClick={handleToggleReview}
						disabled={isUpdating}
						className="gap-2 bg-green-600 hover:bg-green-700"
					>
						<CheckCircle2 className="h-4 w-4" />
						{isUpdating ? "Updating..." : "Mark as Reviewed"}
					</Button>
				)}
			</div>

			{/* Status banner */}
			{isReviewed ? (
				<div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
						<p className="text-sm text-green-700 dark:text-green-300">
							This submission has been reviewed
							{submission.reviewedAt && (
								<span className="ml-1 text-green-600/70 dark:text-green-400/70">
									on {formatDate(submission.reviewedAt)}
								</span>
							)}
						</p>
					</div>
				</div>
			) : (
				<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
						<p className="text-sm text-yellow-700 dark:text-yellow-300">
							This submission is pending review
						</p>
					</div>
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Video - takes 2 columns */}
				<div className="lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>Video</CardTitle>
						</CardHeader>
						<CardContent>
							{isYouTube ? (
								<YouTubeEmbed
									url={submission.videoUrl}
									title="Submission video"
								/>
							) : (
								<div className="rounded-lg border bg-muted/50 p-6">
									<div className="flex items-center gap-3">
										<FileText className="h-5 w-5 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">
												{submission.videoUrl}
											</p>
											<p className="text-xs text-muted-foreground">
												External video link
											</p>
										</div>
										<a
											href={
												isSafeUrl(submission.videoUrl)
													? submission.videoUrl
													: "#"
											}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
										>
											<ExternalLink className="h-4 w-4" />
											Open
										</a>
									</div>
								</div>
							)}

							{/* Direct link below embed */}
							{isYouTube && (
								<div className="mt-3">
									<a
										href={
											isSafeUrl(submission.videoUrl)
												? submission.videoUrl
												: "#"
										}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
									>
										<ExternalLink className="h-3.5 w-3.5" />
										Open in YouTube
									</a>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Notes */}
					{submission.notes && (
						<Card className="mt-6">
							<CardHeader>
								<CardTitle>Athlete Notes</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm whitespace-pre-wrap">
									{submission.notes}
								</p>
							</CardContent>
						</Card>
					)}
				</div>

				{/* Sidebar */}
				<div className="flex flex-col gap-6">
					{/* Athlete info */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="h-4 w-4" />
								Athlete
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-3">
								<Avatar className="h-10 w-10">
									<AvatarImage
										src={submission.athlete.avatar ?? undefined}
										alt={`${submission.athlete.firstName ?? ""} ${submission.athlete.lastName ?? ""}`}
									/>
									<AvatarFallback>
										{getInitials(
											submission.athlete.firstName,
											submission.athlete.lastName,
										)}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-medium">
										{submission.athlete.firstName}{" "}
										{submission.athlete.lastName}
									</p>
									<p className="text-sm text-muted-foreground">
										{submission.athlete.email}
									</p>
								</div>
							</div>

							{submission.teamName && (
								<>
									<Separator className="my-3" />
									<p className="text-sm">
										<span className="text-muted-foreground">Team: </span>
										{submission.teamName}
									</p>
								</>
							)}

							{submission.division && (
								<>
									<Separator className="my-3" />
									<p className="text-sm">
										<span className="text-muted-foreground">Division: </span>
										<Badge variant="outline" className="ml-1">
											{submission.division.label}
										</Badge>
									</p>
								</>
							)}
						</CardContent>
					</Card>

					{/* Claimed score */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Trophy className="h-4 w-4 text-amber-500" />
								Claimed Score
							</CardTitle>
							<CardDescription>Self-reported by athlete</CardDescription>
						</CardHeader>
						<CardContent>
							{submission.score?.displayScore ? (
								<div>
									<p className="text-3xl font-mono font-bold">
										{submission.score.displayScore}
									</p>
									{submission.score.status === "cap" && (
										<Badge variant="secondary" className="mt-2">
											Capped
										</Badge>
									)}
								</div>
							) : (
								<p className="text-muted-foreground">No score submitted</p>
							)}
						</CardContent>
					</Card>

					{/* Submission metadata */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								Submission Info
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Submitted</span>
								<span>{formatDate(submission.submittedAt)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status</span>
								{isReviewed ? (
									<Badge
										variant="default"
										className="gap-1 bg-green-600"
									>
										<CheckCircle2 className="h-3 w-3" />
										Reviewed
									</Badge>
								) : (
									<Badge variant="secondary" className="gap-1">
										<Clock className="h-3 w-3" />
										Pending
									</Badge>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
