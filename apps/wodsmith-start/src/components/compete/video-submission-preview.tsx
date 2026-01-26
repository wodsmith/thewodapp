"use client"

import {
	Calendar,
	CheckCircle2,
	Clock,
	Edit3,
	ExternalLink,
	FileText,
	Trophy,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring"
import { YouTubeEmbed, isYouTubeUrl } from "./youtube-embed"

interface VideoSubmissionPreviewProps {
	submission: {
		id: string
		videoUrl: string
		notes: string | null
		submittedAt: Date
		updatedAt: Date
	}
	score?: {
		scoreValue: number | null
		displayScore: string | null
		status: string | null
		secondaryValue: number | null
		tiebreakValue: number | null
	} | null
	workout?: {
		name: string
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		timeCap: number | null
		tiebreakScheme: string | null
	} | null
	canEdit: boolean
	editReason?: string
	timezone?: string | null
	onEdit?: () => void
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
			return "Load"
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

export function VideoSubmissionPreview({
	submission,
	score,
	workout,
	canEdit,
	editReason,
	timezone,
	onEdit,
}: VideoSubmissionPreviewProps) {
	const isYouTube = isYouTubeUrl(submission.videoUrl)
	const hasUpdated =
		submission.updatedAt.getTime() !== submission.submittedAt.getTime()

	return (
		<Card className="overflow-hidden">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
						<CardTitle className="text-lg">Submission Complete</CardTitle>
					</div>
					{canEdit && onEdit && (
						<Badge
							variant="outline"
							className="gap-1.5 cursor-pointer hover:bg-accent transition-colors"
							onClick={onEdit}
						>
							<Edit3 className="h-3 w-3" />
							Edit
						</Badge>
					)}
				</div>
				<CardDescription>
					{canEdit
						? "Your submission is recorded. You can still update it while the submission window is open."
						: editReason || "Submission window is closed."}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Video Preview */}
				<div className="space-y-2">
					{isYouTube ? (
						<YouTubeEmbed
							url={submission.videoUrl}
							title={workout?.name || "Workout submission"}
						/>
					) : (
						<div className="rounded-lg border bg-muted/50 p-4">
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
									href={submission.videoUrl}
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
				</div>

				<Separator />

				{/* Score Display */}
				{score?.displayScore && (
					<div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
						<Trophy className="h-5 w-5 text-amber-500 mt-0.5" />
						<div className="flex-1">
							<p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
								{workout
									? `Your ${getSchemeLabel(workout.scheme)}`
									: "Your Score"}
							</p>
							<p className="text-2xl font-mono font-bold">
								{score.displayScore}
								{score.status === "cap" && (
									<Badge variant="secondary" className="ml-2 text-xs">
										Capped
									</Badge>
								)}
							</p>
							{score.secondaryValue !== null && score.status === "cap" && (
								<p className="text-sm text-muted-foreground mt-1">
									{score.secondaryValue} reps completed at cap
								</p>
							)}
							{score.tiebreakValue !== null && workout?.tiebreakScheme && (
								<p className="text-sm text-muted-foreground mt-1">
									Tiebreak:{" "}
									{workout.tiebreakScheme === "time"
										? formatTiebreakTime(score.tiebreakValue)
										: score.tiebreakValue}
								</p>
							)}
						</div>
					</div>
				)}

				{/* Notes */}
				{submission.notes && (
					<div className="rounded-lg bg-muted/50 p-4">
						<p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
							Notes
						</p>
						<p className="text-sm whitespace-pre-wrap">{submission.notes}</p>
					</div>
				)}

				{/* Submission Metadata */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
					<div className="flex items-center gap-1.5">
						<Calendar className="h-3.5 w-3.5" />
						<span>
							Submitted {formatSubmissionTime(submission.submittedAt, timezone)}
						</span>
					</div>
					{hasUpdated && (
						<div className="flex items-center gap-1.5">
							<Clock className="h-3.5 w-3.5" />
							<span>
								Updated {formatSubmissionTime(submission.updatedAt, timezone)}
							</span>
						</div>
					)}
				</div>

				{/* Edit Status Banner */}
				{canEdit && (
					<div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
						<div className="flex items-center gap-2">
							<Edit3 className="h-4 w-4 text-green-600 dark:text-green-400" />
							<p className="text-sm text-green-700 dark:text-green-300">
								Submission window is open - you can still update your submission
							</p>
						</div>
					</div>
				)}

				{!canEdit && editReason && (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
							<p className="text-sm text-amber-700 dark:text-amber-300">
								{editReason}
							</p>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function formatTiebreakTime(milliseconds: number): string {
	const totalSeconds = Math.floor(milliseconds / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
