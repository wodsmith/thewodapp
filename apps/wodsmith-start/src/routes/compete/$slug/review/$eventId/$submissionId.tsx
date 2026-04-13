/**
 * Volunteer Video Submission Review Detail Route
 *
 * Single submission review page where volunteers can watch the video,
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
	MessageSquare,
	ArrowDownUp,
	Pencil,
	ThumbsDown,
	ThumbsUp,
	Trash2,
	Trophy,
	Undo2,
	User,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
	VideoPlayerEmbed,
	supportsInteractivePlayer,
	getVideoPlatformName,
	type VideoPlayerRef,
} from "@/components/compete/video-player-embed"
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
import { decodeScore, isLowerBetter, type WorkoutScheme } from "@/lib/scoring"
import {
	type EventDetails,
	getSubmissionDetailFn,
	getVerificationLogsFn,
	type SubmissionDetail,
	type VerificationLogEntry,
	verifySubmissionScoreFn,
	deleteVerificationLogFn,
	updateVerificationLogFn,
} from "@/server-fns/submission-verification-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	createReviewNoteFn,
	deleteReviewNoteFn,
	getReviewNotesForRegistrationFn,
	getWorkoutMovementsFn,
	updateReviewNoteFn,
} from "@/server-fns/review-note-fns"
import {
	getOrganizerSubmissionDetailFn,
	getSiblingSubmissionsFn,
	markSubmissionReviewedFn,
	unmarkSubmissionReviewedFn,
} from "@/server-fns/video-submission-fns"
import { getSubmissionVoteDetailsFn } from "@/server-fns/video-vote-fns"
import {
	DOWNVOTE_REASON_LABELS,
	type DownvoteReason,
} from "@/db/schemas/video-votes"
import { isSafeUrl } from "@/utils/url"

const parentRoute = getRouteApi("/compete/$slug/review")

export const Route = createFileRoute(
	"/compete/$slug/review/$eventId/$submissionId",
)({
	component: SubmissionDetailPage,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		// The review layout route returns competition in its loader data
		const reviewData = parentMatch.loaderData
		const competition = reviewData?.competition
		if (!competition) throw new Error("Competition not found")
		const competitionId = competition.id

		// Fetch review data (required)
		const reviewResult = await getOrganizerSubmissionDetailFn({
			data: {
				submissionId: params.submissionId,
				competitionId,
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
							competitionId,
							trackWorkoutId: params.eventId,
							scoreId,
						},
					}),
					getVerificationLogsFn({
						data: {
							scoreId,
							competitionId,
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

		// Fetch siblings for tabbed video UI
		const siblingsResult = await getSiblingSubmissionsFn({
			data: {
				submissionId: params.submissionId,
				competitionId,
			},
		})

		// Fetch review notes for ALL sibling submissions (aggregated tally)
		let allReviewNotes: Array<{
			id: string
			type: string
			content: string
			timestampSeconds: number | null
			movementId: string | null
			movementName: string | null
			videoSubmissionId: string
			createdAt: Date
			reviewer: {
				id: string
				firstName: string | null
				lastName: string | null
				avatar: string | null
			}
		}> = []

		if (reviewResult.submission.registrationId) {
			try {
				const notesResult = await getReviewNotesForRegistrationFn({
					data: {
						registrationId: reviewResult.submission.registrationId,
						trackWorkoutId: reviewResult.submission.trackWorkoutId,
						competitionId,
					},
				})
				allReviewNotes = notesResult.notes
			} catch {
				// Fall back gracefully if registration notes fetch fails
			}
		}

		// Fetch workout movements and vote details in parallel
		let workoutMovements: Array<{ id: string; name: string; type: string }> = []
		let voteDetails: {
			upvotes: number
			downvotes: number
			reasonBreakdown: Array<{ reason: string | null; count: number }>
			downvoteDetails: Array<{
				reason: string | null
				reasonDetail: string | null
				votedAt: Date
			}>
		} | null = null

		const [movementsSettled, votesSettled] = await Promise.allSettled([
			getWorkoutMovementsFn({
				data: {
					trackWorkoutId: params.eventId,
					competitionId,
				},
			}),
			getSubmissionVoteDetailsFn({
				data: {
					videoSubmissionId: params.submissionId,
					competitionId,
				},
			}),
		])

		if (movementsSettled.status === "fulfilled") {
			workoutMovements = movementsSettled.value.movements
		}
		if (votesSettled.status === "fulfilled") {
			voteDetails = votesSettled.value
		}

		return {
			submission: reviewResult.submission,
			siblings: siblingsResult.siblings,
			verificationSubmission,
			event,
			verificationLogs,
			allReviewNotes,
			workoutMovements,
			voteDetails,
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
 *
 * Lower-is-better schemes (time, time-with-cap scored): ADD to score (higher = worse)
 * Higher-is-better schemes (reps, emom, load, etc.): SUBTRACT from score (lower = worse)
 *
 * For time-with-cap with cap status, the penalty applies to secondaryValue (reps)
 * not the time, so this function isn't used for that case — see handleApplyPenalty.
 */
function calculatePenaltyScore(
	rawValue: number,
	percentage: number,
	scheme: string,
	scoreStatus?: string,
): number {
	// Time-with-cap capped scores are rep-based (secondary value) — higher reps is better
	// Time-with-cap scored (finished) scores are time-based — lower time is better
	const lowerIsBetter =
		scheme === "time-with-cap"
			? scoreStatus !== "cap"
			: isLowerBetter(scheme as WorkoutScheme)

	if (lowerIsBetter) {
		// Lower-is-better: add percentage as penalty (higher = worse)
		return Math.round(rawValue + rawValue * (percentage / 100))
	}
	// Higher-is-better: deduct percentage as penalty (lower = worse)
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
			const penaltyScheme = event.workout.scheme as WorkoutScheme
			const isCapped =
				penaltyScheme === "time-with-cap" && submission.score.status === "cap"

			// For capped time-with-cap: penalty applies to secondaryValue (reps)
			// For everything else: penalty applies to the primary score
			let finalScore: string
			let finalSecondaryScore: string | undefined

			if (useDirectOverride) {
				finalScore = directOverrideScore
			} else if (isCapped && submission.score.secondaryValue !== null) {
				// Capped: keep time as-is, subtract reps from secondary
				const penalizedReps = calculatePenaltyScore(
					submission.score.secondaryValue,
					penaltyPercentage,
					"reps",
					"cap",
				)
				finalScore = submission.score.displayValue
				finalSecondaryScore = String(penalizedReps)
			} else if (submission.score.rawValue !== null) {
				// Normal: apply penalty to the encoded value, then decode for display
				const penalizedEncoded = calculatePenaltyScore(
					submission.score.rawValue,
					penaltyPercentage,
					penaltyScheme,
					submission.score.status,
				)
				finalScore = decodeScore(penalizedEncoded, penaltyScheme)
			} else {
				finalScore = submission.score.displayValue
			}

			await verifyFn({
				data: {
					competitionId,
					trackWorkoutId,
					scoreId: submission.id,
					action: "adjust",
					adjustedScore: finalScore,
					adjustedScoreStatus:
						submission.score.status === "cap" ? "cap" : "scored",
					secondaryScore: finalSecondaryScore,
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
	const scheme = event.workout.scheme as WorkoutScheme
	const scoreStatus = submission.score.status
	// For time-with-cap capped scores, penalty applies to secondaryValue (reps)
	const isCappedTimeWithCap =
		scheme === "time-with-cap" && scoreStatus === "cap"
	const penaltyBaseValue = isCappedTimeWithCap
		? submission.score.secondaryValue
		: submission.score.rawValue

	const previewPenaltyScore =
		penaltyBaseValue !== null
			? calculatePenaltyScore(
					penaltyBaseValue,
					penaltyPercentage,
					isCappedTimeWithCap ? "reps" : scheme,
					scoreStatus,
				)
			: null
	const previewDeduction =
		penaltyBaseValue !== null && previewPenaltyScore !== null
			? Math.abs(penaltyBaseValue - previewPenaltyScore)
			: null

	// Determine if penalty direction is "add" (lower-is-better) or "subtract" (higher-is-better)
	const penaltyAddsToScore =
		scheme === "time-with-cap" ? scoreStatus !== "cap" : isLowerBetter(scheme)

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
				<Badge
					variant="outline"
					className="bg-orange-500 text-white border-orange-500"
				>
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
					<div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 space-y-1">
						<p className="text-xs font-medium text-orange-700 dark:text-orange-300">
							{submission.verification.penaltyType === "major"
								? "Major"
								: "Minor"}{" "}
							Penalty Applied
						</p>
						<div className="flex gap-4 text-xs text-orange-600 dark:text-orange-400">
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
					<div className="grid grid-cols-2 gap-2">
						<Button
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
							variant="outline"
							disabled={isSubmitting}
							onClick={() => setIsAdjusting(true)}
						>
							Adjust Score
						</Button>
						<Button
							variant="outline"
							disabled={isSubmitting}
							onClick={() => setIsPenalizing(true)}
						>
							<AlertTriangle className="h-4 w-4 mr-2" />
							Apply Penalty
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="outline" disabled={isSubmitting}>
									<Ban className="h-4 w-4 mr-2" />
									Mark Invalid
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Mark Submission Invalid</AlertDialogTitle>
									<AlertDialogDescription>
										This will zero the athlete&apos;s score for this workout
										only. Their other competition scores will remain unaffected.
										Use this for wrong movements, wrong weight/equipment, edited
										video, or an unacceptable volume of no-reps.
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
				)}

				{/* Penalty form */}
				{isPenalizing && (
					<div className="space-y-3 rounded-md border border-orange-200 p-3">
						<p className="text-sm font-medium">Apply Penalty</p>

						{/* Penalty guidance */}
						<div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
							<p className="font-medium">Penalty Guidance</p>
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
									className="flex-1 range-visible-track"
								/>
								<span className="text-sm font-mono w-10 text-right">
									{penaltyPercentage}%
								</span>
							</div>
						</div>

						{/* Before/after preview */}
						{penaltyBaseValue !== null && (
							<div className="rounded-md border bg-muted/30 p-3 space-y-2">
								<p className="text-xs font-medium">
									Score Preview
									{isCappedTimeWithCap && (
										<span className="text-muted-foreground font-normal ml-1">
											(reps at cap)
										</span>
									)}
								</p>
								<div className="flex items-center gap-3 text-sm font-mono">
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											Original
										</p>
										<p className="font-semibold">
											{isCappedTimeWithCap
												? `${penaltyBaseValue} reps`
												: submission.score.displayValue}
										</p>
									</div>
									<span className="text-muted-foreground">&rarr;</span>
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											{penaltyAddsToScore ? "Addition" : "Deduction"}
										</p>
										<p className="text-orange-600 font-semibold">
											{penaltyAddsToScore ? "+" : "-"}
											{previewDeduction !== null
												? isCappedTimeWithCap
													? previewDeduction
													: decodeScore(previewDeduction, scheme)
												: "\u2014"}
										</p>
									</div>
									<span className="text-muted-foreground">&rarr;</span>
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											Adjusted
										</p>
										<p className="font-bold text-orange-700">
											{useDirectOverride
												? directOverrideScore || "\u2014"
												: previewPenaltyScore !== null
													? isCappedTimeWithCap
														? `${previewPenaltyScore} reps`
														: decodeScore(previewPenaltyScore, scheme)
													: "\u2014"}
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
									<AuditLogEntry
										key={log.id}
										log={log}
										competitionId={competitionId}
									/>
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
// Audit Log Entry Component
// ============================================================================

function AuditLogEntry({
	log,
	competitionId,
}: {
	log: VerificationLogEntry
	competitionId: string
}) {
	const router = useRouter()
	const deleteFn = useServerFn(deleteVerificationLogFn)
	const updateFn = useServerFn(updateVerificationLogFn)
	const [isEditing, setIsEditing] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [editPenaltyType, setEditPenaltyType] = useState<
		"minor" | "major" | null
	>((log.penaltyType as "minor" | "major") ?? null)
	const [editPenaltyPct, setEditPenaltyPct] = useState(
		log.penaltyPercentage ?? 0,
	)
	const [editNoRepCount, setEditNoRepCount] = useState(
		log.noRepCount?.toString() ?? "",
	)

	async function handleDelete() {
		setIsDeleting(true)
		try {
			await deleteFn({ data: { logId: log.id, competitionId } })
			await router.invalidate()
		} catch {
			setIsDeleting(false)
		}
	}

	async function handleUpdate() {
		try {
			await updateFn({
				data: {
					logId: log.id,
					competitionId,
					penaltyType: editPenaltyType,
					penaltyPercentage: editPenaltyType !== null ? editPenaltyPct : null,
					noRepCount: editNoRepCount
						? Number.parseInt(editNoRepCount, 10)
						: null,
				},
			})
			setIsEditing(false)
			await router.invalidate()
		} catch {
			// keep editing open on error
		}
	}

	const [isSaving, setIsSaving] = useState(false)

	if (isEditing) {
		return (
			<div className="space-y-3 rounded-md border border-orange-200 p-3">
				<p className="text-sm font-medium">Edit Penalty</p>

				{/* Penalty guidance */}
				<div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
					<p className="font-medium">Penalty Guidance</p>
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
						value={editPenaltyType ?? "none"}
						onValueChange={(v) => {
							if (v === "none") {
								setEditPenaltyType(null)
								return
							}
							const type = v as "minor" | "major"
							setEditPenaltyType(type)
							if (type === "major" && editPenaltyPct < 15) {
								setEditPenaltyPct(15)
							}
						}}
						className="flex gap-4"
					>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="none" id={`edit-penalty-none-${log.id}`} />
							<Label
								htmlFor={`edit-penalty-none-${log.id}`}
								className="text-xs font-normal"
							>
								None
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem
								value="minor"
								id={`edit-penalty-minor-${log.id}`}
							/>
							<Label
								htmlFor={`edit-penalty-minor-${log.id}`}
								className="text-xs font-normal"
							>
								Minor
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem
								value="major"
								id={`edit-penalty-major-${log.id}`}
							/>
							<Label
								htmlFor={`edit-penalty-major-${log.id}`}
								className="text-xs font-normal"
							>
								Major
							</Label>
						</div>
					</RadioGroup>
				</div>

				{editPenaltyType && (
					<>
						{/* No-rep count */}
						<div className="space-y-2">
							<Label htmlFor={`edit-norep-${log.id}`} className="text-xs">
								No-rep count (optional)
							</Label>
							<Input
								id={`edit-norep-${log.id}`}
								value={editNoRepCount}
								onChange={(e) => setEditNoRepCount(e.target.value)}
								placeholder="e.g. 12"
								type="number"
								min="0"
								className="font-mono"
							/>
						</div>

						{/* Percentage */}
						<div className="space-y-2">
							<Label htmlFor={`edit-pct-${log.id}`} className="text-xs">
								Deduction percentage
								{editPenaltyType === "major" && (
									<span className="text-muted-foreground ml-1">
										(15-40% recommended)
									</span>
								)}
							</Label>
							<div className="flex items-center gap-2">
								<input
									type="range"
									id={`edit-pct-${log.id}`}
									min={editPenaltyType === "major" ? 15 : 1}
									max={editPenaltyType === "major" ? 40 : 100}
									value={editPenaltyPct}
									onChange={(e) => setEditPenaltyPct(Number(e.target.value))}
									className="flex-1 range-visible-track"
								/>
								<span className="text-sm font-mono w-10 text-right">
									{editPenaltyPct}%
								</span>
							</div>
						</div>
					</>
				)}

				{/* Score preview */}
				{editPenaltyType && log.originalScoreValue !== null && log.scheme && (
					<div className="rounded-md border bg-muted/30 p-3 space-y-2">
						<p className="text-xs font-medium">Score Preview</p>
						{(() => {
							const scheme = log.scheme as WorkoutScheme
							const lowerBetter =
								scheme === "time-with-cap"
									? log.originalStatus !== "cap"
									: isLowerBetter(scheme)
							const previewScore = calculatePenaltyScore(
								log.originalScoreValue!,
								editPenaltyPct,
								scheme,
								log.originalStatus ?? undefined,
							)
							const deduction = Math.abs(log.originalScoreValue! - previewScore)
							return (
								<div className="flex flex-wrap items-center gap-2 text-xs font-mono">
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											Original
										</p>
										<p className="font-semibold">
											{decodeScore(log.originalScoreValue!, scheme, {
												compact: false,
											})}
										</p>
									</div>
									<span className="text-muted-foreground">&rarr;</span>
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											{lowerBetter ? "Addition" : "Deduction"}
										</p>
										<p className="text-orange-600 font-semibold">
											{lowerBetter ? "+" : "-"}
											{decodeScore(deduction, scheme, { compact: false })}
										</p>
									</div>
									<span className="text-muted-foreground">&rarr;</span>
									<div className="text-center">
										<p className="text-muted-foreground text-[10px] uppercase">
											Adjusted
										</p>
										<p className="font-bold text-orange-700">
											{decodeScore(previewScore, scheme, { compact: false })}
										</p>
									</div>
								</div>
							)
						})()}
					</div>
				)}

				<div className="flex gap-2">
					<Button
						className="flex-1"
						size="sm"
						disabled={isSaving}
						onClick={async () => {
							setIsSaving(true)
							await handleUpdate()
							setIsSaving(false)
						}}
					>
						{isSaving ? "Saving..." : "Save Changes"}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						disabled={isSaving}
						onClick={() => {
							setIsEditing(false)
							// Reset to original values
							setEditPenaltyType((log.penaltyType as "minor" | "major") ?? null)
							setEditPenaltyPct(log.penaltyPercentage ?? 0)
							setEditNoRepCount(log.noRepCount?.toString() ?? "")
						}}
					>
						Cancel
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="group rounded border px-3 py-2 text-xs space-y-1">
			<div className="flex items-center justify-between">
				<span className="font-medium capitalize">
					{log.action}
					{log.penaltyType && (
						<Badge
							variant="outline"
							className="text-[10px] px-1.5 py-0 bg-orange-500 text-white border-orange-500"
						>
							{log.penaltyType} penalty
						</Badge>
					)}
				</span>
				<div className="flex items-center gap-1">
					<span className="text-muted-foreground">
						{new Intl.DateTimeFormat("en-US", {
							dateStyle: "medium",
							timeStyle: "short",
						}).format(new Date(log.performedAt))}
					</span>
					<Button
						size="sm"
						variant="ghost"
						className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
						onClick={() => setIsEditing(true)}
					>
						<Pencil className="h-3 w-3" />
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								size="sm"
								variant="ghost"
								className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
							>
								<Trash2 className="h-3 w-3" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete log entry?</AlertDialogTitle>
								<AlertDialogDescription>
									This will permanently remove this audit log entry. This action
									cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
									{isDeleting ? "Deleting..." : "Delete"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
			<p className="text-muted-foreground">by {log.performedByName}</p>
			{(log.action === "adjusted" || log.action === "invalid") &&
				log.newScoreValue !== null && (
					<p className="text-muted-foreground">
						{log.originalScoreValue !== null && log.scheme
							? decodeScore(
									log.originalScoreValue,
									log.scheme as WorkoutScheme,
									{ compact: false },
								)
							: "\u2014"}{" "}
						&rarr;{" "}
						{log.scheme
							? decodeScore(log.newScoreValue, log.scheme as WorkoutScheme, {
									compact: false,
								})
							: log.newScoreValue}
						{log.newStatus && log.newStatus !== log.originalStatus
							? ` (${log.newStatus})`
							: ""}
					</p>
				)}
			{log.penaltyPercentage !== null && (
				<p className="text-muted-foreground">
					{log.penaltyPercentage}% deduction
					{log.noRepCount !== null && ` \u00b7 ${log.noRepCount} no-reps`}
				</p>
			)}
		</div>
	)
}

// ============================================================================
// Review Notes Helpers & Components
// ============================================================================

function formatTimestamp(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = seconds % 60
	return `${mins}:${secs.toString().padStart(2, "0")}`
}

interface ReviewNoteFormProps {
	videoSubmissionId: string
	competitionId: string
	movements: Array<{ id: string; name: string; type: string }>
	playerRef: React.RefObject<VideoPlayerRef | null>
	formTextareaRef: React.RefObject<HTMLTextAreaElement | null>
	onNoteCreated: () => void
}

function ReviewNoteForm({
	videoSubmissionId,
	competitionId,
	movements,
	playerRef,
	formTextareaRef,
	onNoteCreated,
}: ReviewNoteFormProps) {
	const createNote = useServerFn(createReviewNoteFn)
	const [noteType, setNoteType] = useState<"general" | "no-rep">("general")
	const [content, setContent] = useState("")
	const [timestampSeconds, setTimestampSeconds] = useState<number | null>(null)
	const [selectedMovementId, setSelectedMovementId] = useState<string>("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const captureTimestamp = useCallback(() => {
		if (playerRef.current) {
			const time = Math.round(playerRef.current.getCurrentTime())
			setTimestampSeconds(time)
		}
	}, [playerRef])

	const handleFocus = useCallback(() => {
		if (playerRef.current) {
			playerRef.current.pauseVideo()
			captureTimestamp()
		}
	}, [playerRef, captureTimestamp])

	const handleSubmit = async () => {
		if (!content.trim()) return
		setIsSubmitting(true)
		try {
			await createNote({
				data: {
					videoSubmissionId,
					competitionId,
					type: noteType,
					content: content.trim(),
					timestampSeconds: timestampSeconds ?? undefined,
					movementId:
						selectedMovementId && selectedMovementId !== "none"
							? selectedMovementId
							: undefined,
				},
			})
			setContent("")
			setTimestampSeconds(null)
			onNoteCreated()
			playerRef.current?.playVideo()
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSubmit()
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<MessageSquare className="h-4 w-4" />
					Add Review Note
				</CardTitle>
				<CardDescription>
					Press{" "}
					<kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
						n
					</kbd>{" "}
					to pause video and add a note
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex gap-1">
					<Button
						type="button"
						size="sm"
						variant={noteType === "general" ? "default" : "outline"}
						className="h-7 text-xs"
						onClick={() => setNoteType("general")}
					>
						General
					</Button>
					<Button
						type="button"
						size="sm"
						variant={noteType === "no-rep" ? "destructive" : "outline"}
						className="h-7 text-xs"
						onClick={() => setNoteType("no-rep")}
					>
						No Rep
					</Button>
				</div>
				{timestampSeconds !== null && (
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="font-mono">
							{formatTimestamp(timestampSeconds)}
						</Badge>
						<button
							type="button"
							className="text-xs text-muted-foreground hover:text-foreground"
							onClick={() => setTimestampSeconds(null)}
						>
							Clear timestamp
						</button>
					</div>
				)}
				<Textarea
					ref={formTextareaRef}
					value={content}
					onChange={(e) => setContent(e.target.value)}
					onFocus={handleFocus}
					onKeyDown={handleKeyDown}
					placeholder="No rep, bad form, movement standard..."
					rows={2}
					className="text-sm"
				/>
				{movements.length > 0 && (
					<div className="space-y-1">
						<Label className="text-xs">Movement (optional)</Label>
						<Select
							value={selectedMovementId}
							onValueChange={setSelectedMovementId}
						>
							<SelectTrigger className="h-8 text-sm">
								<SelectValue placeholder="Select movement..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">None</SelectItem>
								{movements.map((m) => (
									<SelectItem key={m.id} value={m.id}>
										{m.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
				<div className="flex items-center justify-between">
					<span className="text-xs text-muted-foreground">
						{typeof navigator !== "undefined" &&
						navigator.platform?.includes("Mac")
							? "\u2318"
							: "Ctrl"}
						+Enter to submit
					</span>
					<Button
						size="sm"
						disabled={isSubmitting || !content.trim()}
						onClick={handleSubmit}
					>
						{isSubmitting ? "Adding..." : "Add Note"}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}

interface ReviewNotesListProps {
	notes: Array<{
		id: string
		type: string
		content: string
		timestampSeconds: number | null
		movementId: string | null
		movementName: string | null
		createdAt: Date
		reviewer: {
			id: string
			firstName: string | null
			lastName: string | null
			avatar: string | null
		}
	}>
	movements: Array<{ id: string; name: string }>
	competitionId: string
	playerRef: React.RefObject<VideoPlayerRef | null>
	onNoteUpdated: () => void
}

type SortOrder = "timestamp-asc" | "timestamp-desc"
type TypeFilter = "all" | "general" | "no-rep"

function ReviewNotesList({
	notes,
	movements,
	competitionId,
	playerRef,
	onNoteUpdated,
}: ReviewNotesListProps) {
	const deleteFn = useServerFn(deleteReviewNoteFn)
	const updateFn = useServerFn(updateReviewNoteFn)
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editContent, setEditContent] = useState("")
	const [editType, setEditType] = useState<"general" | "no-rep">("general")
	const [isSaving, setIsSaving] = useState(false)
	const [sortOrder, setSortOrder] = useState<SortOrder>("timestamp-asc")
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
	const [movementFilter, setMovementFilter] = useState<string>("all")

	const handleSeek = (seconds: number) => {
		if (playerRef.current) {
			playerRef.current.seekTo(seconds, true)
			playerRef.current.playVideo()
		}
	}

	const handleDelete = async (noteId: string) => {
		setDeletingId(noteId)
		try {
			await deleteFn({ data: { noteId, competitionId } })
			onNoteUpdated()
		} finally {
			setDeletingId(null)
		}
	}

	const startEdit = (note: ReviewNotesListProps["notes"][0]) => {
		setEditingId(note.id)
		setEditContent(note.content)
		setEditType((note.type as "general" | "no-rep") || "general")
	}

	const cancelEdit = () => {
		setEditingId(null)
		setEditContent("")
	}

	const saveEdit = async () => {
		if (!editingId || !editContent.trim()) return
		setIsSaving(true)
		try {
			await updateFn({
				data: {
					noteId: editingId,
					competitionId,
					content: editContent.trim(),
					type: editType,
				},
			})
			setEditingId(null)
			setEditContent("")
			onNoteUpdated()
		} finally {
			setIsSaving(false)
		}
	}

	const handleEditKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			saveEdit()
		}
		if (e.key === "Escape") {
			cancelEdit()
		}
	}

	// Reset movement filter when type filter changes away from no-rep
	const effectiveMovementFilter =
		typeFilter === "no-rep" ? movementFilter : "all"

	const filteredNotes = notes.filter((note) => {
		if (typeFilter !== "all" && note.type !== typeFilter) return false
		if (
			effectiveMovementFilter !== "all" &&
			note.movementId !== effectiveMovementFilter
		)
			return false
		return true
	})

	const sortedNotes = [...filteredNotes].sort((a, b) => {
		if (a.timestampSeconds === null && b.timestampSeconds === null) return 0
		if (a.timestampSeconds === null) return 1
		if (b.timestampSeconds === null) return -1
		return sortOrder === "timestamp-asc"
			? a.timestampSeconds - b.timestampSeconds
			: b.timestampSeconds - a.timestampSeconds
	})

	if (notes.length === 0) return null

	const toggleSortOrder = () => {
		setSortOrder(
			sortOrder === "timestamp-asc" ? "timestamp-desc" : "timestamp-asc",
		)
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">
						Review Notes ({filteredNotes.length}
						{filteredNotes.length !== notes.length ? ` / ${notes.length}` : ""})
					</CardTitle>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs gap-1"
						onClick={toggleSortOrder}
					>
						<ArrowDownUp className="h-3 w-3" />
						{sortOrder === "timestamp-asc" ? "Time \u2191" : "Time \u2193"}
					</Button>
				</div>
				<div className="flex flex-wrap items-center gap-2 pt-1">
					<div className="flex gap-1">
						{(["all", "general", "no-rep"] as const).map((t) => (
							<Button
								key={t}
								type="button"
								size="sm"
								variant={
									typeFilter === t
										? t === "no-rep"
											? "destructive"
											: "default"
										: "outline"
								}
								className="h-6 text-xs px-2"
								onClick={() => {
									setTypeFilter(t)
									if (t !== "no-rep") setMovementFilter("all")
								}}
							>
								{t === "all" ? "All" : t === "general" ? "General" : "No Rep"}
							</Button>
						))}
					</div>
					{typeFilter === "no-rep" && movements.length > 0 && (
						<Select
							value={effectiveMovementFilter}
							onValueChange={setMovementFilter}
						>
							<SelectTrigger className="h-6 text-xs w-auto min-w-[120px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All movements</SelectItem>
								{movements.map((m) => (
									<SelectItem key={m.id} value={m.id}>
										{m.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-2">
				{sortedNotes.length === 0 ? (
					<p className="text-xs text-muted-foreground text-center py-2">
						No matching notes
					</p>
				) : (
					sortedNotes.map((note) => (
						<div
							key={note.id}
							className="group rounded border px-3 py-2 text-sm space-y-1"
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									{editingId === note.id ? (
										<div className="flex gap-1">
											<Button
												type="button"
												size="sm"
												variant={editType === "general" ? "default" : "outline"}
												className="h-5 text-xs px-1.5"
												onClick={() => setEditType("general")}
											>
												General
											</Button>
											<Button
												type="button"
												size="sm"
												variant={
													editType === "no-rep" ? "destructive" : "outline"
												}
												className="h-5 text-xs px-1.5"
												onClick={() => setEditType("no-rep")}
											>
												No Rep
											</Button>
										</div>
									) : (
										<>
											{note.type === "no-rep" && (
												<Badge
													variant="outline"
													className="bg-orange-500 text-white border-orange-500 text-xs"
												>
													No Rep
												</Badge>
											)}
											{note.timestampSeconds !== null && (
												<button
													type="button"
													onClick={() => handleSeek(note.timestampSeconds!)}
													className="font-mono text-xs text-primary hover:underline"
												>
													{formatTimestamp(note.timestampSeconds)}
												</button>
											)}
											{note.movementName && (
												<Badge variant="secondary" className="text-xs">
													{note.movementName}
												</Badge>
											)}
										</>
									)}
								</div>
								{editingId !== note.id && (
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											onClick={() => startEdit(note)}
										>
											<Pencil className="h-3 w-3" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											disabled={deletingId === note.id}
											onClick={() => handleDelete(note.id)}
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
								)}
							</div>
							{editingId === note.id ? (
								<div className="space-y-2">
									<Textarea
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onKeyDown={handleEditKeyDown}
										rows={2}
										className="text-sm"
										autoFocus
									/>
									<div className="flex items-center justify-end gap-2">
										<Button
											size="sm"
											variant="ghost"
											className="h-7 text-xs"
											onClick={cancelEdit}
										>
											Cancel
										</Button>
										<Button
											size="sm"
											className="h-7 text-xs"
											disabled={isSaving || !editContent.trim()}
											onClick={saveEdit}
										>
											{isSaving ? "Saving..." : "Save"}
										</Button>
									</div>
								</div>
							) : (
								<>
									<p className="text-sm">{note.content}</p>
									<p className="text-xs text-muted-foreground">
										{note.reviewer.firstName} {note.reviewer.lastName}
									</p>
								</>
							)}
						</div>
					))
				)}
			</CardContent>
		</Card>
	)
}

interface MovementTallyCardProps {
	notes: Array<{
		type: string
		movementId: string | null
		movementName: string | null
	}>
}

function MovementTallyCard({ notes }: MovementTallyCardProps) {
	const noRepNotes = notes.filter((n) => n.type === "no-rep")
	const noRepCount = noRepNotes.length

	const tallies = new Map<string, { name: string; count: number }>()
	for (const note of noRepNotes) {
		if (note.movementId && note.movementName) {
			const existing = tallies.get(note.movementId)
			if (existing) {
				existing.count++
			} else {
				tallies.set(note.movementId, { name: note.movementName, count: 1 })
			}
		}
	}

	if (notes.length === 0) return null

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm flex items-center gap-2">
					<MessageSquare className="h-4 w-4" />
					Review Summary
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<div className="flex items-center justify-between text-sm font-medium">
					<span>No Reps</span>
					<Badge
						variant="outline"
						className="bg-orange-500 text-white border-orange-500 font-mono"
					>
						{noRepCount}
					</Badge>
				</div>
				{tallies.size > 0 && (
					<>
						<Separator />
						<p className="text-xs text-muted-foreground font-medium">
							By Movement
						</p>
						{Array.from(tallies.values()).map((t) => (
							<div
								key={t.name}
								className="flex items-center justify-between text-sm"
							>
								<span>{t.name}</span>
								<Badge
									variant="outline"
									className="bg-orange-500 text-white border-orange-500 font-mono"
								>
									{t.count}
								</Badge>
							</div>
						))}
					</>
				)}
				<Separator />
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>Total notes</span>
					<span>{notes.length}</span>
				</div>
			</CardContent>
		</Card>
	)
}

// ============================================================================
// Community Votes Card
// ============================================================================

interface CommunityVotesCardProps {
	voteDetails: {
		upvotes: number
		downvotes: number
		reasonBreakdown: Array<{ reason: string | null; count: number }>
		downvoteDetails: Array<{
			reason: string | null
			reasonDetail: string | null
			votedAt: Date
		}>
	} | null
}

function CommunityVotesCard({ voteDetails }: CommunityVotesCardProps) {
	if (!voteDetails) return null

	const { upvotes, downvotes, reasonBreakdown, downvoteDetails } = voteDetails
	const totalVotes = upvotes + downvotes

	if (totalVotes === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ThumbsUp className="h-4 w-4" />
						Community Votes
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No community votes yet
					</p>
				</CardContent>
			</Card>
		)
	}

	const formatVoteDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ThumbsUp className="h-4 w-4" />
					Community Votes
				</CardTitle>
				<CardDescription>{totalVotes} total votes</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Vote totals */}
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
						<ThumbsUp className="h-4 w-4" />
						<span className="font-medium">{upvotes}</span>
					</div>
					<div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
						<ThumbsDown className="h-4 w-4" />
						<span className="font-medium">{downvotes}</span>
					</div>
				</div>

				{/* Reason breakdown */}
				{reasonBreakdown.length > 0 && (
					<div className="space-y-2">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Downvote Reasons
						</p>
						<div className="space-y-1.5">
							{reasonBreakdown.map((r) => (
								<div
									key={r.reason ?? "unknown"}
									className="flex items-center justify-between text-sm"
								>
									<span>
										{r.reason
											? (DOWNVOTE_REASON_LABELS[
													r.reason as DownvoteReason
												] ?? r.reason)
											: "Unknown"}
									</span>
									<Badge variant="secondary" className="text-xs">
										{r.count}
									</Badge>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Individual downvote comments */}
				{downvoteDetails.some((d) => d.reasonDetail) && (
					<div className="space-y-2">
						<Separator />
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Voter Comments
						</p>
						<div className="space-y-2">
							{downvoteDetails
								.filter((d) => d.reasonDetail)
								.map((detail, i) => (
									<div
										key={i}
										className="rounded-md border p-2 text-sm space-y-1"
									>
										<div className="flex items-center justify-between">
											<Badge variant="outline" className="text-xs">
												{detail.reason
													? (DOWNVOTE_REASON_LABELS[
															detail.reason as DownvoteReason
														] ?? detail.reason)
													: "Other"}
											</Badge>
											<span className="text-xs text-muted-foreground">
												{formatVoteDate(detail.votedAt)}
											</span>
										</div>
										<p className="text-muted-foreground">
											{detail.reasonDetail}
										</p>
									</div>
								))}
						</div>
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
	const {
		submission,
		siblings,
		verificationSubmission,
		event,
		verificationLogs,
		allReviewNotes,
		workoutMovements,
		voteDetails,
	} = Route.useLoaderData()
	const { competition } = parentRoute.useLoaderData()
	const params = Route.useParams()
	const router = useRouter()

	const markReviewed = useServerFn(markSubmissionReviewedFn)
	const unmarkReviewed = useServerFn(unmarkSubmissionReviewedFn)

	const [activeVideoIndex, setActiveVideoIndex] = useState(
		submission.videoIndex,
	)
	// Optimistic review state: maps submissionId -> overridden reviewedAt
	const [optimisticReviews, setOptimisticReviews] = useState<
		Record<string, Date | null>
	>({})

	// Derive active sibling and per-tab notes
	const activeSubmission =
		siblings.find((s) => s.videoIndex === activeVideoIndex) ?? siblings[0]
	const activeTabNotes = activeSubmission
		? allReviewNotes.filter(
				(n) => n.videoSubmissionId === activeSubmission.id,
			)
		: allReviewNotes
	const hasMultipleVideos = siblings.length > 1

	const playerRef = useRef<VideoPlayerRef | null>(null)
	const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

	const handlePlayerReady = useCallback((player: VideoPlayerRef) => {
		playerRef.current = player
	}, [])

	// Pull focus back from iframe so keyboard shortcuts work
	useEffect(() => {
		const handleBlur = () => {
			// When focus moves to the iframe, reclaim it after a tick
			setTimeout(() => {
				if (document.activeElement?.tagName === "IFRAME") {
					window.focus()
				}
			}, 0)
		}
		window.addEventListener("blur", handleBlur)
		return () => window.removeEventListener("blur", handleBlur)
	}, [])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

			if (e.key === "n" || e.key === "N") {
				e.preventDefault()
				if (playerRef.current) {
					playerRef.current.pauseVideo()
				}
				noteTextareaRef.current?.focus()
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [])

	// Resolve review state with optimistic overrides
	const getReviewedAt = (sub: { id: string; reviewedAt: Date | null }) =>
		sub.id in optimisticReviews ? optimisticReviews[sub.id] : sub.reviewedAt
	const activeReviewed = activeSubmission
		? getReviewedAt(activeSubmission) != null
		: false
	const allReviewed = siblings.every((s) => getReviewedAt(s) != null)
	const reviewedCount = siblings.filter((s) => getReviewedAt(s) != null).length
	const isReviewed = hasMultipleVideos ? allReviewed : activeReviewed
	const activeVideoUrl = activeSubmission?.videoUrl ?? submission.videoUrl
	const hasInteractivePlayer = supportsInteractivePlayer(activeVideoUrl)
	const platformName = getVideoPlatformName(activeVideoUrl)

	const handleToggleReview = async () => {
		if (!activeSubmission) return
		const wasReviewed = activeReviewed
		// Optimistically flip UI immediately
		setOptimisticReviews((prev) => ({
			...prev,
			[activeSubmission.id]: wasReviewed ? null : new Date(),
		}))
		try {
			if (wasReviewed) {
				await unmarkReviewed({
					data: {
						submissionId: activeSubmission.id,
						competitionId: competition.id,
					},
				})
			} else {
				await markReviewed({
					data: {
						submissionId: activeSubmission.id,
						competitionId: competition.id,
					},
				})
			}
			// Await invalidation so loader data is fresh before clearing optimistic state
			await router.invalidate()
			setOptimisticReviews((prev) => {
				const next = { ...prev }
				delete next[activeSubmission.id]
				return next
			})
		} catch {
			// Revert on failure
			setOptimisticReviews((prev) => {
				const next = { ...prev }
				delete next[activeSubmission.id]
				return next
			})
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
							to="/compete/$slug/review/$eventId"
							params={{
								slug: params.slug,
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

				{/* Review action — applies to active tab's video */}
				{activeReviewed ? (
					<Button
						variant="outline"
						onClick={handleToggleReview}

						className="gap-2"
					>
						<Undo2 className="h-4 w-4" />
						Unmark Reviewed
					</Button>
				) : (
					<Button
						onClick={handleToggleReview}

						className="gap-2 bg-green-600 hover:bg-green-700"
					>
						<CheckCircle2 className="h-4 w-4" />
						Mark as Reviewed
					</Button>
				)}
			</div>

			{/* Status banner */}
			{allReviewed ? (
				<div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
						<p className="text-sm text-green-700 dark:text-green-300">
							{hasMultipleVideos
								? `All ${siblings.length} videos have been reviewed`
								: "This submission has been reviewed"}
						</p>
					</div>
				</div>
			) : (
				<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
						<p className="text-sm text-yellow-700 dark:text-yellow-300">
							{hasMultipleVideos
								? `${reviewedCount} of ${siblings.length} videos reviewed`
								: "This submission is pending review"}
						</p>
					</div>
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Video - takes 2 columns */}
				<div className="lg:col-span-2">
					{hasMultipleVideos ? (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle>Videos</CardTitle>
							</CardHeader>
							<CardContent>
								<Tabs
									value={String(activeVideoIndex)}
									onValueChange={(v) => setActiveVideoIndex(Number(v))}
								>
									<TabsList className="mb-4">
										{siblings.map((sib) => (
											<TabsTrigger
												key={sib.videoIndex}
												value={String(sib.videoIndex)}
												className="gap-1.5"
											>
												Video {sib.videoIndex + 1}
												<span className="text-xs text-muted-foreground">
													({sib.videoIndex === 0 ? "Captain" : `Teammate ${sib.videoIndex}`})
												</span>
												{getReviewedAt(sib) != null && (
													<CheckCircle2 className="h-3 w-3 text-green-600" />
												)}
											</TabsTrigger>
										))}
									</TabsList>
									{siblings.map((sib) => (
										<TabsContent
											key={sib.videoIndex}
											value={String(sib.videoIndex)}
										>
											<VideoPlayerEmbed
												url={sib.videoUrl}
												title={`Video ${sib.videoIndex + 1}`}
												onPlayerReady={
													supportsInteractivePlayer(sib.videoUrl)
														? handlePlayerReady
														: undefined
												}
											/>
											{getVideoPlatformName(sib.videoUrl) && (
												<div className="mt-3">
													<a
														href={
															isSafeUrl(sib.videoUrl) ? sib.videoUrl : "#"
														}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
													>
														<ExternalLink className="h-3.5 w-3.5" />
														Open in {getVideoPlatformName(sib.videoUrl)}
													</a>
												</div>
											)}
										</TabsContent>
									))}
								</Tabs>
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardHeader>
								<CardTitle>Video</CardTitle>
							</CardHeader>
							<CardContent>
								<VideoPlayerEmbed
									url={submission.videoUrl}
									title="Submission video"
									onPlayerReady={
										hasInteractivePlayer ? handlePlayerReady : undefined
									}
								/>
								{platformName && (
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
											Open in {platformName}
										</a>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Athlete Notes — per-video */}
					{activeSubmission?.notes && (
						<Card className="mt-6">
							<CardHeader>
								<CardTitle>Athlete Notes</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm whitespace-pre-wrap">
									{activeSubmission.notes}
								</p>
							</CardContent>
						</Card>
					)}

					{/* Review note form — targets active video */}
					{activeSubmission && (
						<ReviewNoteForm
							key={activeSubmission.id}
							videoSubmissionId={activeSubmission.id}
							competitionId={competition.id}
							movements={workoutMovements}
							playerRef={playerRef}
							formTextareaRef={noteTextareaRef}
							onNoteCreated={() => router.invalidate()}
						/>
					)}

					{/* Review notes list — filtered to active video */}
					<ReviewNotesList
						notes={activeTabNotes}
						movements={workoutMovements}
						competitionId={competition.id}
						playerRef={playerRef}
						onNoteUpdated={() => router.invalidate()}
					/>
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
									<div className="text-sm">
										<span className="text-muted-foreground">Division: </span>
										<Badge variant="outline" className="ml-1">
											{submission.division.label}
										</Badge>
									</div>
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

					{/* Community Votes */}
					<CommunityVotesCard voteDetails={voteDetails} />

					{/* Verification Controls */}
					{verificationSubmission && event ? (
						<VerificationControls
							submission={verificationSubmission}
							event={event}
							competitionId={competition.id}
							trackWorkoutId={params.eventId}
							logs={verificationLogs}
						/>
					) : (
						<Card>
							<CardHeader>
								<CardTitle>Verification Controls</CardTitle>
								<CardDescription>
									Review the video and confirm or correct the athlete&apos;s
									claimed score
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									No score submitted yet. Verification controls will be available
									once the athlete submits a score.
								</p>
							</CardContent>
						</Card>
					)}

					{allReviewNotes.length > 0 && (
						<MovementTallyCard notes={allReviewNotes} />
					)}
				</div>
			</div>
		</div>
	)
}
