"use client"

import { useServerFn } from "@tanstack/react-start"
import { AlertCircle, Check, Clock, Loader2, Trophy } from "lucide-react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
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
import type { ScoreType, WorkoutScheme } from "@/db/schemas/workouts"
import { type ParseResult, parseScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import {
	type AthleteEventScore,
	getAthleteEventScoreFn,
	getEventWorkoutDetailsFn,
	getSubmissionWindowStatusFn,
	type SubmissionWindowStatus,
	submitAthleteScoreFn,
} from "@/server-fns/athlete-score-fns"

interface AthleteScoreSubmissionProps {
	competitionId: string
	trackWorkoutId: string
	competitionTimezone?: string | null
}

function formatSubmissionTime(
	isoString: string,
	timezone?: string | null,
): string {
	const date = new Date(isoString)
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone ?? undefined,
	}).format(date)
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

export function AthleteScoreSubmission({
	competitionId,
	trackWorkoutId,
	competitionTimezone,
}: AthleteScoreSubmissionProps) {
	const [windowStatus, setWindowStatus] =
		useState<SubmissionWindowStatus | null>(null)
	const [existingScore, setExistingScore] = useState<AthleteEventScore | null>(
		null,
	)
	const [workoutDetails, setWorkoutDetails] = useState<{
		workoutId: string
		name: string
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		timeCap: number | null
		tiebreakScheme: string | null
		repsPerRound: number | null
	} | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Form state
	const [scoreInput, setScoreInput] = useState("")
	const [status, setStatus] = useState<"scored" | "cap">("scored")
	const [secondaryScore, setSecondaryScore] = useState("")
	const [tiebreakScore, setTiebreakScore] = useState("")
	const [parseResult, setParseResult] = useState<ParseResult | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [submitSuccess, setSubmitSuccess] = useState(false)

	const submitScore = useServerFn(submitAthleteScoreFn)

	// Load initial data
	useEffect(() => {
		async function loadData() {
			setLoading(true)
			setError(null)
			try {
				const [windowRes, scoreRes, workoutRes] = await Promise.all([
					getSubmissionWindowStatusFn({
						data: { competitionId, trackWorkoutId },
					}),
					getAthleteEventScoreFn({
						data: { competitionId, trackWorkoutId },
					}),
					getEventWorkoutDetailsFn({
						data: { competitionId, trackWorkoutId },
					}),
				])

				setWindowStatus(windowRes)
				setExistingScore(scoreRes)
				setWorkoutDetails(workoutRes)

				// Pre-fill form if there's an existing score
				if (scoreRes.displayScore) {
					setScoreInput(scoreRes.displayScore)
					setStatus((scoreRes.status as "scored" | "cap") || "scored")
					if (scoreRes.secondaryValue !== null) {
						setSecondaryScore(String(scoreRes.secondaryValue))
					}
				}
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load submission data",
				)
			} finally {
				setLoading(false)
			}
		}

		loadData()
	}, [competitionId, trackWorkoutId])

	// Parse score input
	useEffect(() => {
		if (!workoutDetails || !scoreInput.trim()) {
			setParseResult(null)
			return
		}

		const result = parseScore(scoreInput, workoutDetails.scheme)
		setParseResult(result)
	}, [scoreInput, workoutDetails])

	const handleSubmit = async () => {
		if (!workoutDetails) return

		setSubmitting(true)
		setSubmitSuccess(false)
		setError(null)

		try {
			await submitScore({
				data: {
					competitionId,
					trackWorkoutId,
					score: scoreInput,
					status,
					secondaryScore: secondaryScore || undefined,
					tiebreakScore: tiebreakScore || undefined,
				},
			})

			setSubmitSuccess(true)
			// Refresh existing score
			const scoreRes = await getAthleteEventScoreFn({
				data: { competitionId, trackWorkoutId },
			})
			setExistingScore(scoreRes)

			// Clear success message after 3 seconds
			setTimeout(() => setSubmitSuccess(false), 3000)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit score")
		} finally {
			setSubmitting(false)
		}
	}

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		)
	}

	if (error && !windowStatus) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		)
	}

	// Not an online competition or no submission window
	if (!windowStatus || (!windowStatus.opensAt && !windowStatus.closesAt)) {
		return null
	}

	const isTimeCapped = workoutDetails?.scheme === "time-with-cap"
	const showSecondaryInput = isTimeCapped && status === "cap"

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Trophy className="h-5 w-5 text-primary" />
					<CardTitle className="text-lg">Submit Your Score</CardTitle>
				</div>
				<CardDescription>
					{windowStatus.isOpen ? (
						<span className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
							>
								Open
							</Badge>
							<span>
								Closes{" "}
								{windowStatus.closesAt &&
									formatSubmissionTime(
										windowStatus.closesAt,
										competitionTimezone,
									)}
							</span>
						</span>
					) : (
						<span className="flex items-center gap-2">
							<Badge variant="secondary">Closed</Badge>
							{windowStatus.reason && (
								<span className="text-muted-foreground">
									{windowStatus.reason}
								</span>
							)}
						</span>
					)}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Existing Score Display */}
				{existingScore?.displayScore && (
					<Alert>
						<Check className="h-4 w-4" />
						<AlertTitle>Score Submitted</AlertTitle>
						<AlertDescription>
							Your current score: <strong>{existingScore.displayScore}</strong>
							{existingScore.status === "cap" && " (Capped)"}
							{existingScore.secondaryValue !== null && (
								<> - {existingScore.secondaryValue} reps at cap</>
							)}
						</AlertDescription>
					</Alert>
				)}

				{/* Only show form if window is open */}
				{windowStatus.isOpen && workoutDetails && (
					<>
						{/* Score Input */}
						<div className="space-y-2">
							<Label htmlFor="score-input">
								{getSchemeLabel(workoutDetails.scheme)}
							</Label>
							<Input
								id="score-input"
								value={scoreInput}
								onChange={(e) => setScoreInput(e.target.value)}
								placeholder={getPlaceholder(workoutDetails.scheme)}
								className={cn(
									"font-mono",
									parseResult?.error &&
										!parseResult?.isValid &&
										"border-destructive",
								)}
							/>
							{getHelpText(workoutDetails.scheme, workoutDetails.timeCap) && (
								<p className="text-xs text-muted-foreground">
									{getHelpText(workoutDetails.scheme, workoutDetails.timeCap)}
								</p>
							)}
							{parseResult?.isValid && (
								<p className="text-xs text-green-600 dark:text-green-400">
									Parsed as: {parseResult.formatted}
								</p>
							)}
							{parseResult?.error && (
								<p className="text-xs text-destructive">{parseResult.error}</p>
							)}
						</div>

						{/* Status for time-capped workouts */}
						{isTimeCapped && (
							<div className="space-y-2">
								<Label>Status</Label>
								<Select
									value={status}
									onValueChange={(v) => setStatus(v as "scored" | "cap")}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="scored">Finished</SelectItem>
										<SelectItem value="cap">Capped (Time Cap)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

						{/* Secondary Score (reps at cap) */}
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
								/>
								<p className="text-xs text-muted-foreground">
									Total reps/work completed when the time cap hit
								</p>
							</div>
						)}

						{/* Tiebreak Score */}
						{workoutDetails.tiebreakScheme && (
							<div className="space-y-2">
								<Label htmlFor="tiebreak-input">
									Tiebreak (
									{workoutDetails.tiebreakScheme === "time" ? "Time" : "Reps"})
								</Label>
								<Input
									id="tiebreak-input"
									value={tiebreakScore}
									onChange={(e) => setTiebreakScore(e.target.value)}
									placeholder={
										workoutDetails.tiebreakScheme === "time"
											? "e.g., 3:45"
											: "e.g., 100"
									}
									className="font-mono"
								/>
								<p className="text-xs text-muted-foreground">
									{workoutDetails.tiebreakScheme === "time"
										? "Time to complete specified reps/work"
										: "Reps completed for tiebreak"}
								</p>
							</div>
						)}

						{/* Error Display */}
						{error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						{/* Success Display */}
						{submitSuccess && (
							<Alert>
								<Check className="h-4 w-4 text-green-600" />
								<AlertDescription className="text-green-600">
									Score submitted successfully!
								</AlertDescription>
							</Alert>
						)}
					</>
				)}

				{/* Submission Window Info */}
				{!windowStatus.isOpen && windowStatus.opensAt && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span>
							Opens{" "}
							{formatSubmissionTime(windowStatus.opensAt, competitionTimezone)}
						</span>
					</div>
				)}
			</CardContent>

			{windowStatus.isOpen && workoutDetails && (
				<CardFooter>
					<Button
						onClick={handleSubmit}
						disabled={submitting || !scoreInput.trim() || !parseResult?.isValid}
						className="w-full"
					>
						{submitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Submitting...
							</>
						) : existingScore?.scoreId ? (
							"Update Score"
						) : (
							"Submit Score"
						)}
					</Button>
				</CardFooter>
			)}
		</Card>
	)
}
