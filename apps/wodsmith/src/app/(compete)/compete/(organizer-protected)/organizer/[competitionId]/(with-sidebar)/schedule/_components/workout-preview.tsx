"use client"

import { ChevronDown, ChevronUp, Target } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CompetitionWorkout } from "@/server/competition-workouts"

interface WorkoutPreviewProps {
	event: CompetitionWorkout
	className?: string
}

// Map scheme to display text and estimated duration hint
const SCHEME_INFO: Record<string, { label: string; hint?: string }> = {
	time: { label: "For Time" },
	"time-with-cap": { label: "For Time (Capped)" },
	"rounds-reps": { label: "AMRAP" },
	reps: { label: "Max Reps" },
	emom: { label: "EMOM" },
	load: { label: "Max Load" },
	calories: { label: "Max Calories" },
	meters: { label: "Max Distance" },
	feet: { label: "Max Distance" },
	points: { label: "Points" },
	"pass-fail": { label: "Pass/Fail" },
}

export function WorkoutPreview({ event, className }: WorkoutPreviewProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const { workout, notes, pointsMultiplier, trackOrder } = event

	const schemeInfo = SCHEME_INFO[workout.scheme] ?? { label: workout.scheme }
	const hasMultiplier = pointsMultiplier && pointsMultiplier !== 100

	return (
		<div
			className={cn("border rounded-lg bg-muted/30 overflow-hidden", className)}
		>
			{/* Always visible header */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
			>
				<div className="flex items-center gap-3 min-w-0">
					<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
						{trackOrder}
					</div>
					<div className="min-w-0">
						<div className="font-medium truncate">{workout.name}</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Badge variant="outline" className="text-xs px-1.5 py-0">
								{schemeInfo.label}
							</Badge>
							{hasMultiplier && (
								<span className="text-primary font-medium">
									{pointsMultiplier / 100}x pts
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{isExpanded ? (
						<ChevronUp className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					)}
				</div>
			</button>

			{/* Expandable content */}
			{isExpanded && (
				<div className="px-4 pb-4 border-t bg-background">
					{/* Description */}
					{workout.description && (
						<div className="pt-3">
							<p className="text-sm whitespace-pre-wrap text-muted-foreground">
								{workout.description}
							</p>
						</div>
					)}

					{/* Meta info row */}
					<div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
						<div className="flex items-center gap-1">
							<Target className="h-3.5 w-3.5" />
							<span>Score: {workout.scoreType ?? "Time"}</span>
						</div>
						{workout.roundsToScore && workout.roundsToScore > 1 && (
							<div>Rounds: {workout.roundsToScore}</div>
						)}
						{workout.tiebreakScheme && (
							<div>Tiebreak: {workout.tiebreakScheme}</div>
						)}
					</div>

					{/* Event notes */}
					{notes && (
						<div className="mt-3 pt-3 border-t">
							<p className="text-xs text-muted-foreground">
								<span className="font-medium">Notes:</span> {notes}
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
