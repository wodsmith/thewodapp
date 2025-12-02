"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { intervalToDuration } from "date-fns"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Filter, HelpCircle } from "lucide-react"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { saveCompetitionScoreAction } from "@/actions/competition-score-actions"
import type { EventScoreEntryData, EventScoreEntryAthlete } from "@/server/competition-scores"
import { ScoreInputRow, type ScoreEntryData } from "./score-input-row"

interface ResultsEntryFormProps {
	competitionId: string
	organizingTeamId: string
	event: EventScoreEntryData["event"]
	athletes: EventScoreEntryAthlete[]
	divisions: Array<{ id: string; label: string }>
	selectedDivisionId?: string
}

export function ResultsEntryForm({
	competitionId,
	organizingTeamId,
	event,
	athletes,
	divisions,
	selectedDivisionId,
}: ResultsEntryFormProps) {
	const router = useRouter()
	const [scores, setScores] = useState<Record<string, ScoreEntryData>>({})
	const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
	const [savedIds, setSavedIds] = useState<Set<string>>(
		new Set(
			athletes
				.filter((a) => a.existingResult)
				.map((a) => a.registrationId),
		),
	)
	const [focusedIndex, setFocusedIndex] = useState(0)
	const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

	const { execute: saveScore } = useServerAction(saveCompetitionScoreAction, {
		onError: (error) => {
			toast.error(error.err?.message || "Failed to save score")
		},
	})

	// Handle score change with auto-save
	const handleScoreChange = useCallback(
		async (athlete: EventScoreEntryAthlete, data: ScoreEntryData) => {
			setScores((prev) => ({
				...prev,
				[athlete.registrationId]: data,
			}))

			// Auto-save
			setSavingIds((prev) => new Set(prev).add(athlete.registrationId))

			const [result] = await saveScore({
				competitionId,
				organizingTeamId,
				trackWorkoutId: event.id,
				workoutId: event.workout.id,
				registrationId: athlete.registrationId,
				userId: athlete.userId,
				divisionId: athlete.divisionId,
				score: data.score,
				scoreStatus: data.scoreStatus,
				tieBreakScore: data.tieBreakScore,
				secondaryScore: data.secondaryScore,
			})

			setSavingIds((prev) => {
				const next = new Set(prev)
				next.delete(athlete.registrationId)
				return next
			})

			if (result) {
				setSavedIds((prev) => new Set(prev).add(athlete.registrationId))
				toast.success(
					`Score saved for ${athlete.firstName} ${athlete.lastName}`,
				)
			}
		},
		[competitionId, organizingTeamId, event.id, event.workout.id, saveScore],
	)

	// Handle tab to next athlete
	const handleTabNext = useCallback(
		(currentIndex: number) => {
			const nextIndex = Math.min(currentIndex + 1, athletes.length - 1)
			setFocusedIndex(nextIndex)

			// Focus the next row's input
			const nextAthlete = athletes[nextIndex]
			if (nextAthlete) {
				const rowEl = rowRefs.current.get(nextAthlete.registrationId)
				const input = rowEl?.querySelector("input")
				input?.focus()
			}
		},
		[athletes],
	)

	// Division filter change
	const handleDivisionChange = (value: string) => {
		const url = new URL(window.location.href)
		if (value === "all") {
			url.searchParams.delete("division")
		} else {
			url.searchParams.set("division", value)
		}
		router.push(url.pathname + url.search)
	}

	// Stats
	const scoredCount = savedIds.size
	const totalCount = athletes.length

	// Get score format examples based on workout scheme
	const getScoreExamples = () => {
		switch (event.workout.scheme) {
			case "time":
			case "time-with-cap":
				return {
					format: "Time (MM:SS or M:SS)",
					examples: ["3:45", "12:30", "1:05:30"],
				}
			case "rounds-reps":
				return {
					format: "Rounds + Reps",
					examples: ["5+12", "10+0", "7+15"],
				}
			case "reps":
				return {
					format: "Total Reps",
					examples: ["150", "87", "203"],
				}
			case "load":
				return {
					format: "Weight (lbs or kg)",
					examples: ["225", "315", "185"],
				}
			case "calories":
				return {
					format: "Total Calories",
					examples: ["150", "200", "175"],
				}
			case "meters":
				return {
					format: "Distance (meters)",
					examples: ["5000", "2000", "1500"],
				}
			case "points":
				return {
					format: "Total Points",
					examples: ["100", "85", "92"],
				}
			default:
				return {
					format: "Score",
					examples: ["100", "3:45", "5+12"],
				}
		}
	}

	const scoreExamples = getScoreExamples()
	const isTimeCapped = event.workout.scheme === "time-with-cap"
	const hasTiebreak = !!event.workout.tiebreakScheme
	const timeCap = event.workout.timeCap

	// Format time cap for display (seconds to MM:SS or H:MM:SS)
	const formatTimeCap = (seconds: number): string => {
		const duration = intervalToDuration({ start: 0, end: seconds * 1000 })
		const hours = duration.hours ?? 0
		const mins = duration.minutes ?? 0
		const secs = duration.seconds ?? 0

		if (hours > 0) {
			return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
		}
		return `${mins}:${secs.toString().padStart(2, "0")}`
	}

	return (
		<div className="space-y-4">
			{/* Event Info & Filters */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<CardTitle>{event.workout.name}</CardTitle>
							<p className="text-sm text-muted-foreground mt-1">
								{event.workout.scheme.replace("-", " ").toUpperCase()}
								{isTimeCapped && timeCap && ` • Cap: ${formatTimeCap(timeCap)}`}
								{event.workout.tiebreakScheme &&
									` • Tie-break: ${event.workout.tiebreakScheme}`}
							</p>
						</div>
						<div className="flex items-center gap-4">
							<Badge variant="outline">
								{scoredCount}/{totalCount} Scored
							</Badge>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3">
						<Filter className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm font-medium">Filter:</span>
						<Select
							value={selectedDivisionId || "all"}
							onValueChange={handleDivisionChange}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="All Divisions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Divisions</SelectItem>
								{divisions.map((div) => (
									<SelectItem key={div.id} value={div.id}>
										{div.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Help Callout */}
			<Collapsible>
				<Alert className="bg-muted/50">
					<HelpCircle className="h-4 w-4" />
					<AlertDescription className="flex items-start justify-between">
						<div className="flex-1">
							<span className="font-medium">Format:</span>{" "}
							<span className="text-muted-foreground">
								{scoreExamples.format} (e.g., {scoreExamples.examples.join(", ")})
							</span>
							{isTimeCapped && (
								<>
									<span className="mx-2 text-muted-foreground">•</span>
									<span className="text-muted-foreground">
										Type <strong>CAP</strong> for {timeCap ? formatTimeCap(timeCap) : "time cap"}
									</span>
								</>
							)}
							<span className="mx-2 text-muted-foreground">•</span>
							<span className="text-muted-foreground">Results auto-save</span>
						</div>
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="h-auto py-0 px-2 text-xs">
								More info
							</Button>
						</CollapsibleTrigger>
					</AlertDescription>
					<CollapsibleContent className="mt-3 pt-3 border-t">
						<div className="text-sm">
							<p className="font-medium mb-1">Entering Scores</p>
							<ul className="text-muted-foreground space-y-1 text-xs">
								<li>• Type the score and press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Tab</kbd> or <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to move to the next athlete</li>
								<li>• Results auto-save when you move to the next field or click away</li>
								<li>• Time formats: 3:45, 12:30, or 1:05:30 for hours</li>
								{isTimeCapped && (
									<li>• Type <strong>CAP</strong> if the athlete hit the {timeCap ? formatTimeCap(timeCap) : "time"} cap</li>
								)}
							</ul>
						</div>
					</CollapsibleContent>
				</Alert>
			</Collapsible>

			{/* Score Entry Table */}
			<Card>
				<CardContent className="p-0">
					{/* Table Header */}
					<div className={`grid gap-3 border-b bg-muted/30 p-3 text-sm font-medium text-muted-foreground ${hasTiebreak ? "grid-cols-[60px_1fr_2fr_1fr_100px]" : "grid-cols-[60px_1fr_2fr_100px]"}`}>
						<div className="text-center">#</div>
						<div>ATHLETE</div>
						<div>SCORE</div>
						{hasTiebreak && <div>TIE-BREAK</div>}
						<div className="text-center">STATUS</div>
					</div>

					{/* Score Entry Rows */}
					<div>
						{athletes.length === 0 ? (
							<div className="py-12 text-center text-muted-foreground">
								No athletes found
								{selectedDivisionId && " for this division"}
							</div>
						) : (
							athletes.map((athlete, index) => (
								<div
									key={athlete.registrationId}
									ref={(el) => {
										if (el) {
											rowRefs.current.set(athlete.registrationId, el)
										}
									}}
								>
									<ScoreInputRow
										athlete={athlete}
										workoutScheme={event.workout.scheme}
										tiebreakScheme={event.workout.tiebreakScheme}
										secondaryScheme={event.workout.secondaryScheme}
										timeCap={timeCap ?? undefined}
										showTiebreak={hasTiebreak}
										value={scores[athlete.registrationId]}
										isSaving={savingIds.has(athlete.registrationId)}
										isSaved={savedIds.has(athlete.registrationId)}
										onChange={(data) => handleScoreChange(athlete, data)}
										onTabNext={() => handleTabNext(index)}
										autoFocus={index === focusedIndex && index === 0}
									/>
								</div>
							))
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
