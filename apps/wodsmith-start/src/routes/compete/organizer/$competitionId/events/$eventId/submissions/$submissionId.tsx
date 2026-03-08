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
	AlertTriangle,
	ArrowLeft,
	Ban,
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
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { decodeScore, type WorkoutScheme } from "@/lib/scoring"
import {
	type EventDetails,
	getSubmissionDetailFn,
	getVerificationLogsFn,
	type SubmissionDetail,
	type VerificationLogEntry,
	verifySubmissionScoreFn,
} from "@/server-fns/submission-verification-fns"
import {
	getOrganizerSubmissionDetailFn,
	markSubmissionReviewedFn,
	unmarkSubmissionReviewedFn,
} from "@/server-fns/video-submission-fns"
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

/**
 * Calculates the adjusted score after applying a penalty percentage.
 * For rep-based workouts: deduction = totalReps * percentage / 100
 * For time-based workouts: addition = originalTime * percentage / 100
 */
function calculatePenaltyScore(
	rawValue: number,
	percentage: number,
	scheme: string,
): number {
	const isTimeBased = scheme === "time"
	if (isTimeBased) {
		// Time-based: add percentage of time as penalty
		return Math.round(rawValue + rawValue * (percentage / 100))
	}
	// Rep-based: deduct percentage of reps
	return Math.max(0, Math.round(rawValue - rawValue * (percentage / 100)))
}

function VerificationControls({
	submission,
	event,
	competitionId,
	trackWorkoutId,
	logs,
}: VerificationControlsProps) {
	const router = useRouter()
	const verifyFn = useServerFn(verifySubmissionScoreFn)

	const [isAdjusting, setIsAdjusting] = useState(false)
	const [isPenalizing, setIsPenalizing] = useState(false)
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
	const [reviewerNotes, setReviewerNotes] = useState("")

	// Penalty form state
	const [penaltyType, setPenaltyType] = useState<"minor" | "major">("minor")
	const [penaltyPercentage, setPenaltyPercentage] = useState(10)
	const [noRepCount, setNoRepCount] = useState("")
	const [useDirectOverride, setUseDirectOverride] = useState(false)
	const [directOverrideScore, setDirectOverrideScore] = useState("")

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
					reviewerNotes: reviewerNotes.trim() || undefined,
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

	async function handleApplyPenalty() {
		setIsSubmitting(true)
		setError(null)
		try {
			// Calculate the penalized score or use direct override
			const finalScore = useDirectOverride
				? directOverrideScore
				: submission.score.rawValue !== null
					? String(
							calculatePenaltyScore(
								submission.score.rawValue,
								penaltyPercentage,
								event.workout.scheme,
							),
						)
					: submission.score.displayValue

			await verifyFn({
				data: {
					competitionId,
					trackWorkoutId,
					scoreId: submission.id,
					action: "adjust",
					adjustedScore: finalScore,
					adjustedScoreStatus:
						submission.score.status === "cap" ? "cap" : "scored",
					reviewerNotes: reviewerNotes.trim() || undefined,
					penaltyType,
					penaltyPercentage,
					noRepCount: noRepCount ? Number.parseInt(noRepCount, 10) : undefined,
				},
			})
			setIsPenalizing(false)
			await router.invalidate()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Penalty failed")
		} finally {
			setIsSubmitting(false)
		}
	}

	async function handleMarkInvalid() {
		setIsSubmitting(true)
		setError(null)
		try {
			await verifyFn({
				data: {
					competitionId,
					trackWorkoutId,
					scoreId: submission.id,
					action: "invalid",
					reviewerNotes: reviewerNotes.trim() || undefined,
				},
			})
			await router.invalidate()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to mark invalid")
		} finally {
			setIsSubmitting(false)
		}
	}

	// Compute live preview for penalty
	const previewPenaltyScore =
		submission.score.rawValue !== null
			? calculatePenaltyScore(
					submission.score.rawValue,
					penaltyPercentage,
					event.workout.scheme,
				)
			: null
	const previewDeduction =
		submission.score.rawValue !== null && previewPenaltyScore !== null
			? Math.abs(submission.score.rawValue - previewPenaltyScore)
			: null
	const isTimeBased = event.workout.scheme === "time"

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
		if (verificationStatus === "invalid") {
			return (
				<Badge className="bg-gray-100 text-gray-700 border-gray-300">
					<Ban className="h-3 w-3 mr-1" />
					Invalid
				</Badge>
			)
		}
		if (submission.verification.penaltyType) {
			return (
				<Badge className="bg-red-100 text-red-700 border-red-200">
					<AlertTriangle className="h-3 w-3 mr-1" />
					{submission.verification.penaltyType === "major"
						? "Major Penalty"
						: "Minor Penalty"}
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

				{/* Penalty info display (when already penalized) */}
				{submission.verification.penaltyType && (
					<div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 space-y-1">
						<p className="text-xs font-medium text-red-700 dark:text-red-300">
							{submission.verification.penaltyType === "major"
								? "Major"
								: "Minor"}{" "}
							Penalty Applied
						</p>
						<div className="flex gap-4 text-xs text-red-600 dark:text-red-400">
							{submission.verification.penaltyPercentage !== null && (
								<span>
									{submission.verification.penaltyPercentage}% deduction
								</span>
							)}
							{submission.verification.noRepCount !== null && (
								<span>{submission.verification.noRepCount} no-reps</span>
							)}
						</div>
					</div>
				)}

				{/* Invalid info display */}
				{verificationStatus === "invalid" && (
					<div className="rounded-md border border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 p-3">
						<p className="text-xs font-medium text-gray-700 dark:text-gray-300">
							This submission has been marked invalid. The workout score has
							been zeroed.
						</p>
					</div>
				)}

				<Separator />

				{/* Action buttons */}
				{!isAdjusting && !isPenalizing && (
					<div className="space-y-2">
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
								{verificationStatus === "verified"
									? "Re-verify"
									: "Verify Score"}
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
						<div className="flex gap-2">
							<Button
								className="flex-1"
								variant="outline"
								disabled={isSubmitting}
								onClick={() => setIsPenalizing(true)}
							>
								<AlertTriangle className="h-4 w-4 mr-2" />
								Apply Penalty
							</Button>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										className="flex-1"
										variant="outline"
										disabled={isSubmitting}
									>
										<Ban className="h-4 w-4 mr-2" />
										Mark Invalid
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Mark Submission Invalid</AlertDialogTitle>
										<AlertDialogDescription>
											This will zero the athlete&apos;s score for this workout
											only. Their other competition scores will remain
											unaffected. Use this for wrong movements, wrong
											weight/equipment, edited video, or an unacceptable volume
											of no-reps.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<div className="space-y-2">
										<Label htmlFor="invalid-notes" className="text-xs">
											Reason (optional)
										</Label>
										<Textarea
											id="invalid-notes"
											value={reviewerNotes}
											onChange={(e) => setReviewerNotes(e.target.value)}
											placeholder="e.g. Wrong movement performed, edited video..."
											rows={2}
											className="text-sm"
										/>
									</div>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={handleMarkInvalid}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											Mark Invalid
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>
				)}

				{/* Penalty form */}
				{isPenalizing && (
					<div className="space-y-3 rounded-md border border-red-200 p-3">
						<p className="text-sm font-medium">Apply Penalty</p>

						{/* Penalty guidance */}
						<div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
							<p className="font-medium">
								Penalty Guidance (CrossFit framework)
							</p>
							<p className="text-muted-foreground">
								<strong>Minor:</strong> Small number of no-reps. Discretionary
								deduction at your judgment.
							</p>
							<p className="text-muted-foreground">
								<strong>Major:</strong> Significant no-reps. Typical 15-40%
								deduction.
							</p>
						</div>

						{/* Penalty type selector */}
						<div className="space-y-2">
							<Label className="text-xs">Penalty type</Label>
							<RadioGroup
								value={penaltyType}
								onValueChange={(v) => {
									const type = v as "minor" | "major"
									setPenaltyType(type)
									if (type === "major" && penaltyPercentage < 15) {
										setPenaltyPercentage(15)
									}
								}}
								className="flex gap-4"
							>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="minor" id="penalty-minor" />
									<Label
										htmlFor="penalty-minor"
										className="text-xs font-normal"
									>
										Minor
									</Label>
								</div>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="major" id="penalty-major" />
									<Label
										htmlFor="penalty-major"
										className="text-xs font-normal"
									>
										Major
									</Label>
								</div>
							</RadioGroup>
						</div>

						{/* No-rep count */}
						<div className="space-y-2">
							<Label htmlFor="no-rep-count" className="text-xs">
								No-rep count (optional)
							</Label>
							<Input
								id="no-rep-count"
								value={noRepCount}
								onChange={(e) => setNoRepCount(e.target.value)}
								placeholder="e.g. 12"
								type="number"
								min="0"
								className="font-mono"
							/>
						</div>

						{/* Percentage */}
						<div className="space-y-2">
							<Label htmlFor="penalty-pct" className="text-xs">
								Deduction percentage
								{penaltyType === "major" && (
									<span className="text-muted-foreground ml-1">
										(15-40% recommended)
									</span>
								)}
							</Label>
							<div className="flex items-center gap-2">
								<input
									type="range"
									id="penalty-pct"
									min={penaltyType === "major" ? 15 : 1}
									max={penaltyType === "major" ? 40 : 100}
									value={penaltyPercentage}
									onChange={(e) => setPenaltyPercentage(Number(e.target.value))}
									className="flex-1 accent-red-600"
								/>
								<span className="text-sm font-mono w-10 text-right">
									{penaltyPercentage}%
								</span>
							</div>
						</div>

						{/* Before/after preview */}
						{submission.score.rawValue !== null && (
							<div className="rounded-md border bg-muted/30 p-3 space-y-2">
								<p className="text-xs font-medium">Score Preview</p>
								<div className="flex items-center gap-3 text-sm font-mono">
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											Original
										</p>
										<p className="font-semibold">
											{submission.score.displayValue}
										</p>
									</div>
									<span className="text-muted-foreground">&rarr;</span>
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											{isTimeBased ? "Addition" : "Deduction"}
										</p>
										<p className="text-red-600 font-semibold">
											{isTimeBased ? "+" : "-"}
											{previewDeduction}
										</p>
									</div>
									<span className="text-muted-foreground">&rarr;</span>
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											Adjusted
										</p>
										<p className="font-bold text-red-700">
											{useDirectOverride
												? directOverrideScore || "—"
												: previewPenaltyScore}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Direct override */}
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="use-override"
									checked={useDirectOverride}
									onChange={(e) => setUseDirectOverride(e.target.checked)}
									className="rounded border-gray-300"
								/>
								<Label htmlFor="use-override" className="text-xs font-normal">
									Override with a specific score instead
								</Label>
							</div>
							{useDirectOverride && (
								<Input
									value={directOverrideScore}
									onChange={(e) => setDirectOverrideScore(e.target.value)}
									placeholder={event.workout.timeCap ? "10:30" : "155"}
									className="font-mono"
								/>
							)}
						</div>

						{/* Reviewer notes */}
						<div className="space-y-2">
							<Label htmlFor="penalty-notes" className="text-xs">
								Note to athlete (optional)
							</Label>
							<Textarea
								id="penalty-notes"
								value={reviewerNotes}
								onChange={(e) => setReviewerNotes(e.target.value)}
								placeholder="Explain the penalty reason..."
								rows={2}
								className="text-sm"
							/>
						</div>

						<div className="flex gap-2">
							<Button
								className="flex-1"
								size="sm"
								variant="destructive"
								disabled={
									isSubmitting ||
									(useDirectOverride && !directOverrideScore.trim())
								}
								onClick={handleApplyPenalty}
							>
								{isSubmitting ? "Applying..." : "Apply Penalty"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={isSubmitting}
								onClick={() => {
									setIsPenalizing(false)
									setError(null)
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{/* Adjust form (score correction, no penalty) */}
				{isAdjusting && (
					<div className="space-y-3 rounded-md border p-3">
						<p className="text-sm font-medium">Adjust Score</p>
						<p className="text-xs text-muted-foreground">
							Correct the rep count without applying a penalty deduction.
						</p>
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
						<div className="space-y-2">
							<Label htmlFor="reviewer-notes" className="text-xs">
								Note to athlete (optional)
							</Label>
							<Textarea
								id="reviewer-notes"
								value={reviewerNotes}
								onChange={(e) => setReviewerNotes(e.target.value)}
								placeholder="Explain the reason for the adjustment..."
								rows={2}
								className="text-sm"
							/>
						</div>
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

				{/* Audit Log */}
				{logs.length > 0 && (
					<>
						<Separator />
						<div className="space-y-2">
							<p className="text-sm font-medium">Audit Log</p>
							<div className="space-y-2">
								{logs.map((log) => (
									<div
										key={log.id}
										className="rounded border px-3 py-2 text-xs space-y-1"
									>
										<div className="flex items-center justify-between">
											<span className="font-medium capitalize">
												{log.action}
												{log.penaltyType && (
													<Badge
														variant="outline"
														className="ml-1.5 text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200"
													>
														{log.penaltyType} penalty
													</Badge>
												)}
											</span>
											<span className="text-muted-foreground">
												{new Intl.DateTimeFormat("en-US", {
													dateStyle: "medium",
													timeStyle: "short",
												}).format(new Date(log.performedAt))}
											</span>
										</div>
										<p className="text-muted-foreground">
											by {log.performedByName}
										</p>
										{(log.action === "adjusted" || log.action === "invalid") &&
											log.newScoreValue !== null && (
												<p className="text-muted-foreground">
													{log.originalScoreValue !== null && log.scheme
														? decodeScore(
																log.originalScoreValue,
																log.scheme as WorkoutScheme,
																{ compact: false },
															)
														: "—"}{" "}
													&rarr;{" "}
													{log.scheme
														? decodeScore(
																log.newScoreValue,
																log.scheme as WorkoutScheme,
																{ compact: false },
															)
														: log.newScoreValue}
													{log.newStatus && log.newStatus !== log.originalStatus
														? ` (${log.newStatus})`
														: ""}
												</p>
											)}
										{log.penaltyPercentage !== null && (
											<p className="text-muted-foreground">
												{log.penaltyPercentage}% deduction
												{log.noRepCount !== null &&
													` · ${log.noRepCount} no-reps`}
											</p>
										)}
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Page Component
// ============================================================================

function SubmissionDetailPage() {
	const { submission, verificationSubmission, event, verificationLogs } =
		Route.useLoaderData()
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
							logs={verificationLogs}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
