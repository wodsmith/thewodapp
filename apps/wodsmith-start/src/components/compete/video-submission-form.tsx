"use client"

import { useServerFn } from "@tanstack/react-start"
import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	Loader2,
	Youtube,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import type { ParseResult, ScoreType, WorkoutScheme } from "@/lib/scoring"
import { decodeScore, parseScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import { submitVideoFn } from "@/server-fns/video-submission-fns"
import { SubmissionStatusBadge } from "./submission-status-badge"

interface VideoSubmissionFormProps {
	trackWorkoutId: string
	competitionId: string
	timezone?: string | null
	initialData?: {
		submission: {
			id: string
			videoUrl: string
			notes: string | null
			submittedAt: Date
			updatedAt: Date
			reviewStatus: ReviewStatus
			statusUpdatedAt: Date | null
			reviewerNotes: string | null
		} | null
		canSubmit: boolean
		reason?: string
		isRegistered: boolean
		submissionWindow?: {
			opensAt: string
			closesAt: string
		} | null
		workout?: {
			workoutId: string
			name: string
			scheme: WorkoutScheme
			scoreType: ScoreType | null
			timeCap: number | null
			tiebreakScheme: string | null
			repsPerRound: number | null
		} | null
		existingScore?: {
			scoreValue: number | null
			displayScore: string | null
			status: string | null
			secondaryValue: number | null
			tiebreakValue: number | null
		} | null
	}
}

function formatSubmissionTime(
	date: Date | string,
	timezone?: string | null,
): string {
	const d = typeof date === "string" ? new Date(date) : date
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone ?? undefined,
	}).format(d)
}

function getSchemeLabel(scheme: WorkoutScheme): string {
	switch (scheme) {
		case "time":
		case "time-with-cap":
			return "Time"
		case "rounds-reps":
			return "Rounds + Reps"
		case "reps":
			return "Reps"
		case "load":
			return "Load (lbs)"
		case "calories":
			return "Calories"
		case "meters":
			return "Meters"
		case "feet":
			return "Feet"
		case "points":
			return "Points"
		case "emom":
			return "Time"
		case "pass-fail":
			return "Rounds Passed"
		default:
			return "Score"
	}
}

function getPlaceholder(scheme: WorkoutScheme): string {
	switch (scheme) {
		case "time":
		case "time-with-cap":
		case "emom":
			return "e.g., 5:30 or 330"
		case "rounds-reps":
			return "e.g., 5+12 or 5.12"
		case "reps":
			return "e.g., 150"
		case "load":
			return "e.g., 225"
		case "calories":
			return "e.g., 50"
		case "meters":
			return "e.g., 1000"
		case "feet":
			return "e.g., 3000"
		case "points":
			return "e.g., 100"
		case "pass-fail":
			return "Rounds passed"
		default:
			return "Enter score"
	}
}

function getHelpText(scheme: WorkoutScheme, timeCap?: number | null): string {
	switch (scheme) {
		case "time":
			return "Enter as minutes:seconds (5:30) or total seconds (330)"
		case "time-with-cap":
			return timeCap
				? `Enter as minutes:seconds (5:30) or total seconds. Time cap: ${Math.floor(timeCap / 60)}:${String(timeCap % 60).padStart(2, "0")}`
				: "Enter as minutes:seconds (5:30) or total seconds"
		case "rounds-reps":
			return "Enter as rounds+reps (5+12) or rounds.reps (5.12)"
		case "emom":
			return "Enter as minutes:seconds or total seconds"
		default:
			return ""
	}
}

export function VideoSubmissionForm({
	trackWorkoutId,
	competitionId,
	timezone,
	initialData,
}: VideoSubmissionFormProps) {
	const [videoUrl, setVideoUrl] = useState(
		initialData?.submission?.videoUrl ?? "",
	)
	const [notes, setNotes] = useState(initialData?.submission?.notes ?? "")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [hasSubmitted, setHasSubmitted] = useState(!!initialData?.submission)

	// Score form state
	const [scoreInput, setScoreInput] = useState(
		initialData?.existingScore?.displayScore ?? "",
	)
	const [secondaryScore, setSecondaryScore] = useState(
		initialData?.existingScore?.secondaryValue?.toString() ?? "",
	)
	const [tiebreakScore, setTiebreakScore] = useState(() => {
		const tiebreakValue = initialData?.existingScore?.tiebreakValue
		const tiebreakScheme = initialData?.workout?.tiebreakScheme
		if (tiebreakValue === null || tiebreakValue === undefined) return ""
		if (tiebreakScheme === "time") {
			return decodeScore(tiebreakValue, "time", { compact: true })
		}
		return tiebreakValue.toString()
	})
	const [parseResult, setParseResult] = useState<ParseResult | null>(null)

	const submitVideo = useServerFn(submitVideoFn)

	const workout = initialData?.workout

	// Parse score input
	useEffect(() => {
		if (!workout || !scoreInput.trim()) {
			setParseResult(null)
			return
		}

		const result = parseScore(scoreInput, workout.scheme)
		setParseResult(result)
	}, [scoreInput, workout])

	// Derive status from whether time meets or exceeds time cap
	const scoreStatus: "scored" | "cap" = (() => {
		// First check if we can derive from current parse result
		if (
			parseResult?.isValid &&
			parseResult.encoded !== null &&
			workout?.scheme === "time-with-cap" &&
			workout?.timeCap
		) {
			const timeCapMs = workout.timeCap * 1000
			if (parseResult.encoded >= timeCapMs) {
				return "cap"
			}
		}

		// Fall back to existing score's status on initial load (before parseResult is ready)
		if (
			!parseResult &&
			initialData?.existingScore?.status === "cap" &&
			workout?.scheme === "time-with-cap"
		) {
			return "cap"
		}

		return "scored"
	})()

	// If user is not registered, show message
	if (!initialData?.isRegistered) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg">Submit Your Result</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Registration Required</AlertTitle>
						<AlertDescription>
							You must be registered for this competition to submit your result.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		)
	}

	// If submission window is not open, show status
	if (!initialData?.canSubmit && initialData?.reason) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg">Submit Your Result</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Submission Closed</AlertTitle>
						<AlertDescription>{initialData.reason}</AlertDescription>
					</Alert>
					{initialData?.submissionWindow && (
						<div className="text-sm text-muted-foreground space-y-1">
							<p>
								<strong>Opens:</strong>{" "}
								{formatSubmissionTime(
									initialData.submissionWindow.opensAt,
									timezone,
								)}
							</p>
							<p>
								<strong>Closes:</strong>{" "}
								{formatSubmissionTime(
									initialData.submissionWindow.closesAt,
									timezone,
								)}
							</p>
						</div>
					)}
					{(hasSubmitted || initialData?.existingScore?.displayScore) && (
						<div className="pt-2 border-t space-y-3">
							{/* Review Status Badge */}
							{initialData?.submission?.reviewStatus && (
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium">Status:</span>
									<SubmissionStatusBadge
										status={initialData.submission.reviewStatus}
										statusUpdatedAt={initialData.submission.statusUpdatedAt}
										reviewerNotes={initialData.submission.reviewerNotes}
									/>
								</div>
							)}
							{initialData?.existingScore?.displayScore && (
								<div>
									<p className="text-sm font-medium">Your claimed score:</p>
									<p className="text-lg font-mono font-bold">
										{initialData.existingScore.displayScore}
										{initialData.existingScore.status === "cap" && " (Capped)"}
									</p>
								</div>
							)}
							{initialData?.submission && (
								<div>
									<p className="text-sm font-medium mb-1">Your submitted video:</p>
									<a
										href={initialData.submission.videoUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-2 text-sm text-primary hover:underline"
									>
										<ExternalLink className="h-4 w-4" />
										{initialData.submission.videoUrl}
									</a>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSuccess(null)

		if (!videoUrl.trim()) {
			setError("Please enter a video URL")
			return
		}

		// Basic URL validation
		try {
			new URL(videoUrl)
		} catch {
			setError("Please enter a valid URL")
			return
		}

		// Validate score if provided and workout exists
		if (scoreInput.trim() && workout) {
			const scoreParseResult = parseScore(scoreInput, workout.scheme)
			if (!scoreParseResult.isValid) {
				setError(
					`Invalid score: ${scoreParseResult.error || "Please check your score entry"}`,
				)
				return
			}
		}

		setIsSubmitting(true)

		try {
			const result = await submitVideo({
				data: {
					trackWorkoutId,
					competitionId,
					videoUrl: videoUrl.trim(),
					notes: notes.trim() || undefined,
					score: scoreInput.trim() || undefined,
					scoreStatus: scoreInput.trim() ? scoreStatus : undefined,
					secondaryScore:
						scoreStatus === "cap" ? secondaryScore.trim() || undefined : undefined,
					tiebreakScore: tiebreakScore.trim() || undefined,
				},
			})

			if (result.success) {
				setSuccess(
					result.isUpdate
						? "Submission updated successfully!"
						: "Submitted successfully!",
				)
				setHasSubmitted(true)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit")
		} finally {
			setIsSubmitting(false)
		}
	}

	const isTimeCapped = workout?.scheme === "time-with-cap"
	const showSecondaryInput = isTimeCapped && scoreStatus === "cap"

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="space-y-1">
						<CardTitle className="text-lg">Submit Your Result</CardTitle>
						<CardDescription>
							{hasSubmitted
								? "Update your submission below"
								: "Submit your score and video for this event"}
						</CardDescription>
					</div>
					{hasSubmitted && initialData?.submission?.reviewStatus && (
						<SubmissionStatusBadge
							status={initialData.submission.reviewStatus}
							statusUpdatedAt={initialData.submission.statusUpdatedAt}
							reviewerNotes={initialData.submission.reviewerNotes}
						/>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Score Section */}
					{workout && (
						<>
							<div className="space-y-2">
								<Label htmlFor="score-input">
									Your {getSchemeLabel(workout.scheme)}
								</Label>
								<Input
									id="score-input"
									value={scoreInput}
									onChange={(e) => setScoreInput(e.target.value)}
									placeholder={getPlaceholder(workout.scheme)}
									className={cn(
										"font-mono",
										parseResult?.error &&
											!parseResult?.isValid &&
											"border-destructive",
									)}
									disabled={isSubmitting}
								/>
								{getHelpText(workout.scheme, workout.timeCap) && (
									<p className="text-xs text-muted-foreground">
										{getHelpText(workout.scheme, workout.timeCap)}
									</p>
								)}
								{parseResult?.isValid && (
									<p className="text-xs text-green-600 dark:text-green-400">
										Parsed as: {parseResult.formatted}
										{scoreStatus === "cap" && " (Time Cap)"}
									</p>
								)}
								{parseResult?.error && (
									<p className="text-xs text-destructive">{parseResult.error}</p>
								)}
							</div>

							{/* Secondary Score (reps at cap) - shown when time equals time cap */}
							{scoreStatus === "cap" && (
								<p className="text-xs text-amber-600 dark:text-amber-400">
									You hit the time cap. Enter the reps you completed below.
								</p>
							)}
							{showSecondaryInput && (
								<div className="space-y-2">
									<Label htmlFor="secondary-input">Reps Completed at Cap</Label>
									<Input
										id="secondary-input"
										type="number"
										value={secondaryScore}
										onChange={(e) => setSecondaryScore(e.target.value)}
										placeholder="e.g., 150"
										min="0"
										disabled={isSubmitting}
									/>
									<p className="text-xs text-muted-foreground">
										Total reps/work completed when the time cap hit
									</p>
								</div>
							)}

							{/* Tiebreak Score */}
							{workout.tiebreakScheme && (
								<div className="space-y-2">
									<Label htmlFor="tiebreak-input">
										Tiebreak (
										{workout.tiebreakScheme === "time" ? "Time" : "Reps"})
									</Label>
									<Input
										id="tiebreak-input"
										value={tiebreakScore}
										onChange={(e) => setTiebreakScore(e.target.value)}
										placeholder={
											workout.tiebreakScheme === "time"
												? "e.g., 3:45"
												: "e.g., 100"
										}
										className="font-mono"
										disabled={isSubmitting}
									/>
									<p className="text-xs text-muted-foreground">
										{workout.tiebreakScheme === "time"
											? "Time to complete specified reps/work"
											: "Reps completed for tiebreak"}
									</p>
								</div>
							)}

							<Separator />
						</>
					)}

					{/* Video URL Input */}
					<div className="space-y-2">
						<Label htmlFor="videoUrl">Video URL</Label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Youtube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="videoUrl"
									type="url"
									placeholder="https://www.youtube.com/watch?v=..."
									value={videoUrl}
									onChange={(e) => setVideoUrl(e.target.value)}
									className="pl-10"
									disabled={isSubmitting}
								/>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							Upload your video to YouTube (unlisted is fine) and paste the link
						</p>
					</div>

					{/* Notes Input */}
					<div className="space-y-2">
						<Label htmlFor="notes">Notes (Optional)</Label>
						<Textarea
							id="notes"
							placeholder="Any additional information about your submission..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={2}
							disabled={isSubmitting}
							maxLength={1000}
						/>
					</div>

					{/* Error Message */}
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Success Message */}
					{success && (
						<Alert className="border-green-500 text-green-700 dark:text-green-400">
							<CheckCircle2 className="h-4 w-4" />
							<AlertDescription>{success}</AlertDescription>
						</Alert>
					)}

					{/* Submit Button */}
					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Submitting...
							</>
						) : hasSubmitted ? (
							"Update Submission"
						) : (
							"Submit Result"
						)}
					</Button>

					{/* Previous Submission Info */}
					{hasSubmitted && initialData?.submission && (
						<div className="pt-2 border-t text-xs text-muted-foreground">
							Last submitted:{" "}
							{formatSubmissionTime(initialData.submission.submittedAt, timezone)}
						</div>
					)}
				</form>
			</CardContent>
		</Card>
	)
}
