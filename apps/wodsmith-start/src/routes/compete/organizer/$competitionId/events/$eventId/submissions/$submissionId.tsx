/**
 * Organizer Video Submission Review Detail Route
 *
 * Single submission review page where organizers can watch the video,
 * see the claimed score, verify/adjust the score, and mark as reviewed.
 */

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
	CheckCircle,
	CheckCircle2,
	Clock,
	ExternalLink,
	FileText,
	Trophy,
	Undo2,
	User,
} from "lucide-react"
import { useState } from "react"
import { isYouTubeUrl, YouTubeEmbed } from "@/components/compete/youtube-embed"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
	getOrganizerSubmissionDetailFn,
	markSubmissionReviewedFn,
	unmarkSubmissionReviewedFn,
} from "@/server-fns/video-submission-fns"
import {
	type EventDetails,
	type SubmissionDetail,
	type VerificationLogEntry,
	getSubmissionDetailFn,
	getVerificationLogsFn,
	verifySubmissionScoreFn,
} from "@/server-fns/submission-verification-fns"
import { isSafeUrl } from "@/utils/url"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId",
)({
	component: SubmissionDetailPage,
	loader: async ({ params }) => {
		// Fetch review data (required)
		const reviewResult = await getOrganizerSubmissionDetailFn({
			data: {
				submissionId: params.submissionId,
				competitionId: params.competitionId,
			},
		})

		if (!reviewResult.submission) {
			throw new Error("Submission not found")
		}

		// If we have a score ID, fetch verification data and audit logs
		let verificationSubmission: SubmissionDetail | null = null
		let event: EventDetails | null = null
		let verificationLogs: VerificationLogEntry[] = []
		const scoreId = reviewResult.submission.scoreId
		if (scoreId) {
			try {
				const [verificationResult, logsResult] = await Promise.all([
					getSubmissionDetailFn({
						data: {
							competitionId: params.competitionId,
							trackWorkoutId: params.eventId,
							scoreId,
						},
					}),
					getVerificationLogsFn({
						data: {
							scoreId,
							competitionId: params.competitionId,
						},
					}),
				])
				verificationSubmission = verificationResult.submission
				event = verificationResult.event
				verificationLogs = logsResult.logs
			} catch {
				// Verification data not available - controls won't show
			}
		}

		return {
			submission: reviewResult.submission,
			verificationSubmission,
			event,
			verificationLogs,
		}
	},
})

// ============================================================================
// Verification Controls Component
// ============================================================================

interface VerificationControlsProps {
	submission: SubmissionDetail
	event: EventDetails
	competitionId: string
	trackWorkoutId: string
	logs: VerificationLogEntry[]
}

function VerificationControls({
	submission,
	event,
	competitionId,
	trackWorkoutId,
}: VerificationControlsProps) {
	const router = useRouter()
	const verifyFn = useServerFn(verifySubmissionScoreFn)

	const [isAdjusting, setIsAdjusting] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Adjust form state
	const [adjustedScore, setAdjustedScore] = useState(
		submission.score.displayValue,
	)
	const [adjustedStatus, setAdjustedStatus] = useState<"scored" | "cap">(
		submission.score.status === "cap" ? "cap" : "scored",
	)
	const [secondaryScore, setSecondaryScore] = useState(
		submission.score.secondaryValue !== null
			? String(submission.score.secondaryValue)
			: "",
	)

	const verificationStatus = submission.verification.status

	async function handleVerify() {
		setIsSubmitting(true)
		setError(null)
		try {
			await verifyFn({
				data: {
					competitionId,
					trackWorkoutId,
					scoreId: submission.id,
					action: "verify",
				},
			})
			await router.invalidate()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Verification failed")
		} finally {
			setIsSubmitting(false)
		}
	}

	async function handleAdjust() {
		setIsSubmitting(true)
		setError(null)
		try {
			await verifyFn({
				data: {
					competitionId,
					trackWorkoutId,
					scoreId: submission.id,
					action: "adjust",
					adjustedScore,
					adjustedScoreStatus: adjustedStatus,
					secondaryScore: secondaryScore || undefined,
				},
			})
			setIsAdjusting(false)
			await router.invalidate()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Adjustment failed")
		} finally {
			setIsSubmitting(false)
		}
	}

	const statusBadge = () => {
		if (!verificationStatus) {
			return (
				<Badge variant="secondary" className="bg-gray-100 text-gray-600">
					Pending Review
				</Badge>
			)
		}
		if (verificationStatus === "verified") {
			return (
				<Badge className="bg-green-100 text-green-700 border-green-200">
					Verified
				</Badge>
			)
		}
		return (
			<Badge className="bg-amber-100 text-amber-700 border-amber-200">
				Adjusted
			</Badge>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Verification Controls</CardTitle>
				<CardDescription>
					Review the video and confirm or correct the athlete&apos;s claimed
					score
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Status */}
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">Status</span>
					{statusBadge()}
				</div>

				{/* Claimed score */}
				<div>
					<span className="text-sm text-muted-foreground">Athlete claimed</span>
					<p className="font-mono font-semibold">
						{submission.score.displayValue || "-"}{" "}
						{submission.score.status === "cap" && (
							<span className="text-muted-foreground text-sm font-normal">
								(capped
								{submission.score.secondaryValue !== null
									? `, ${submission.score.secondaryValue} reps`
									: ""}
								)
							</span>
						)}
					</p>
				</div>

				<Separator />

				{/* Action buttons */}
				{!isAdjusting && (
					<div className="flex gap-2">
						<Button
							className="flex-1"
							variant={
								verificationStatus === "verified" ? "secondary" : "default"
							}
							disabled={isSubmitting}
							onClick={handleVerify}
						>
							<CheckCircle className="h-4 w-4 mr-2" />
							{verificationStatus === "verified" ? "Re-verify" : "Verify Score"}
						</Button>
						<Button
							className="flex-1"
							variant="outline"
							disabled={isSubmitting}
							onClick={() => setIsAdjusting(true)}
						>
							Adjust Score
						</Button>
					</div>
				)}

				{/* Adjust form */}
				{isAdjusting && (
					<div className="space-y-3 rounded-md border p-3">
						<p className="text-sm font-medium">Adjust Score</p>
						<div className="space-y-2">
							<Label htmlFor="adjusted-score" className="text-xs">
								New score
							</Label>
							<Input
								id="adjusted-score"
								value={adjustedScore}
								onChange={(e) => setAdjustedScore(e.target.value)}
								placeholder={event.workout.timeCap ? "10:30" : "155"}
								className="font-mono"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="adjusted-status" className="text-xs">
								Status
							</Label>
							<Select
								value={adjustedStatus}
								onValueChange={(v) => setAdjustedStatus(v as "scored" | "cap")}
							>
								<SelectTrigger id="adjusted-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="scored">Scored</SelectItem>
									{event.workout.timeCap && (
										<SelectItem value="cap">Capped</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>
						{adjustedStatus === "cap" && (
							<div className="space-y-2">
								<Label htmlFor="secondary-score" className="text-xs">
									Reps at cap
								</Label>
								<Input
									id="secondary-score"
									value={secondaryScore}
									onChange={(e) => setSecondaryScore(e.target.value)}
									placeholder="e.g. 42"
									type="number"
									min="0"
								/>
							</div>
						)}
						<div className="flex gap-2">
							<Button
								className="flex-1"
								size="sm"
								disabled={isSubmitting || !adjustedScore.trim()}
								onClick={handleAdjust}
							>
								{isSubmitting ? "Saving..." : "Save Adjustment"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={isSubmitting}
								onClick={() => {
									setIsAdjusting(false)
									setError(null)
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{error && <p className="text-destructive text-sm">{error}</p>}

				{/* Reviewer info */}
				{submission.verification.verifiedAt &&
					submission.verification.verifiedByName && (
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<CheckCircle className="h-3 w-3" />
							<span>
								Reviewed by {submission.verification.verifiedByName} &middot;{" "}
								{new Intl.DateTimeFormat("en-US", {
									dateStyle: "medium",
								}).format(new Date(submission.verification.verifiedAt))}
							</span>
						</div>
					)}
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Page Component
// ============================================================================

function SubmissionDetailPage() {
	const { submission, verificationSubmission, event } = Route.useLoaderData()
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
				await unmarkReviewed({
					data: { submissionId: submission.id, competitionId: competition.id },
				})
			} else {
				await markReviewed({
					data: { submissionId: submission.id, competitionId: competition.id },
				})
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
					<Button asChild variant="ghost" size="icon">
						<Link
							to="/compete/organizer/$competitionId/events/$eventId/submissions"
							params={{
								competitionId: competition.id,
								eventId: params.eventId,
							}}
						>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
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
											isSafeUrl(submission.videoUrl) ? submission.videoUrl : "#"
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
										{submission.athlete.firstName} {submission.athlete.lastName}
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
									<Badge variant="default" className="gap-1 bg-green-600">
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

					{/* Verification Controls */}
					{verificationSubmission && event && (
						<VerificationControls
							submission={verificationSubmission}
							event={event}
							competitionId={params.competitionId}
							trackWorkoutId={params.eventId}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
