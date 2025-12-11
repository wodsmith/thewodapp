"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { intervalToDuration } from "date-fns"
import posthog from "posthog-js"
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
import type {
	EventScoreEntryData,
	EventScoreEntryAthlete,
	HeatScoreGroup as HeatScoreGroupType,
} from "@/server/competition-scores"
import { ScoreInputRow, type ScoreEntryData } from "./score-input-row"
import { HeatScoreGroup } from "./heat-score-group"
import { isTimeBasedScheme } from "@/lib/scoring"

interface ResultsEntryFormProps {
	competitionId: string
	organizingTeamId: string
	events: Array<{ id: string; name: string; trackOrder: number }>
	selectedEventId?: string
	event: EventScoreEntryData["event"]
	athletes: EventScoreEntryAthlete[]
	heats: HeatScoreGroupType[]
	unassignedRegistrationIds: string[]
	divisions: Array<{ id: string; label: string }>
	selectedDivisionId?: string
}

export function ResultsEntryForm({
	competitionId,
	organizingTeamId,
	events,
	selectedEventId,
	event,
	athletes,
	heats,
	unassignedRegistrationIds,
	divisions,
	selectedDivisionId,
}: ResultsEntryFormProps) {
	const router = useRouter()
	const [scores, setScores] = useState<Record<string, ScoreEntryData>>({})
	const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
	const [savedIds, setSavedIds] = useState<Set<string>>(
		new Set(
			athletes.filter((a) => a.existingResult).map((a) => a.registrationId),
		),
	)
	const [focusedIndex, setFocusedIndex] = useState(0)
	const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

	// Check if we have heats to display
	const hasHeats = heats.length > 0

	// Create athlete map for quick lookup by registrationId
	const athleteMap = new Map(athletes.map((a) => [a.registrationId, a]))

	// Get unassigned athletes
	const unassignedAthletes = athletes.filter((a) =>
		unassignedRegistrationIds.includes(a.registrationId),
	)

	// Build a flat list of all athletes in heat order for focus navigation
	const allAthletesInOrder = hasHeats
		? [
				// Athletes in heats (ordered by heat, then lane)
				...heats.flatMap((heat) =>
					heat.assignments
						.sort((a, b) => a.laneNumber - b.laneNumber)
						.map((assignment) => athleteMap.get(assignment.registrationId))
						.filter((a): a is EventScoreEntryAthlete => a !== undefined),
				),
				// Unassigned athletes
				...unassignedAthletes,
			]
		: athletes

	const { execute: saveScore } = useServerAction(saveCompetitionScoreAction, {
		onError: (error) => {
			toast.error(error.err?.message || "Failed to save score")
			posthog.capture("competition_score_saved_failed", {
				competition_id: competitionId,
				event_id: event.id,
				error_message: error.err?.message,
			})
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

			// Send the original score string directly - the server will encode it properly
			// This preserves milliseconds for time-based workouts (e.g., "2:01.567")
			const scoreToSend = data.score

			const [result] = await saveScore({
				competitionId,
				organizingTeamId,
				trackWorkoutId: event.id,
				workoutId: event.workout.id,
				registrationId: athlete.registrationId,
				userId: athlete.userId,
				divisionId: athlete.divisionId,
				score: scoreToSend,
				scoreStatus: data.scoreStatus,
				tieBreakScore: data.tieBreakScore,
				secondaryScore: data.secondaryScore,
				roundScores: data.roundScores,
				workout: {
					scheme: event.workout.scheme,
					scoreType: event.workout.scoreType,
					repsPerRound: event.workout.repsPerRound,
					roundsToScore: event.workout.roundsToScore,
					timeCap: event.workout.timeCap,
					tiebreakScheme: event.workout.tiebreakScheme,
				},
			})

			setSavingIds((prev) => {
				const next = new Set(prev)
				next.delete(athlete.registrationId)
				return next
			})

			if (result) {
				setSavedIds((prev) => new Set(prev).add(athlete.registrationId))
				posthog.capture("competition_score_saved", {
					competition_id: competitionId,
					event_id: event.id,
					event_name: event.workout.name,
					division_id: athlete.divisionId,
					registration_id: athlete.registrationId,
				})
				const displayName =
					athlete.teamName || `${athlete.firstName} ${athlete.lastName}`
				toast.success(`Score saved for ${displayName}`)
			}
		},
		[
			competitionId,
			organizingTeamId,
			event.id,
			event.workout.id,
			event.workout.scheme,
			event.workout.scoreType,
			event.workout.repsPerRound,
			event.workout.roundsToScore,
			event.workout.timeCap,
			event.workout.tiebreakScheme,
			event.workout.name,
			saveScore,
		],
	)

	// Handle tab to next athlete (uses allAthletesInOrder for consistent navigation)
	const handleTabNext = useCallback(
		(currentIndex: number) => {
			const athleteList = hasHeats ? allAthletesInOrder : athletes
			const nextIndex = Math.min(currentIndex + 1, athleteList.length - 1)
			setFocusedIndex(nextIndex)

			// Focus the next row's input
			const nextAthlete = athleteList[nextIndex]
			if (nextAthlete) {
				const rowEl = rowRefs.current.get(nextAthlete.registrationId)
				const input = rowEl?.querySelector("input")
				input?.focus()
			}
		},
		[athletes, hasHeats, allAthletesInOrder],
	)

	// Event filter change
	const handleEventChange = (eventId: string) => {
		const url = new URL(window.location.href)
		url.searchParams.set("event", eventId)
		// Clear division filter when changing events
		url.searchParams.delete("division")
		router.push(url.pathname + url.search)
	}

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
		const numRounds = event.workout.roundsToScore ?? 1
		const isMultiRound = numRounds > 1

		switch (event.workout.scheme) {
			case "pass-fail":
				return {
					format: `Rounds Passed (0-${numRounds})`,
					examples: ["0", String(Math.floor(numRounds / 2)), String(numRounds)],
				}
			case "time":
			case "time-with-cap":
				return {
					format: isMultiRound
						? `Time per round (${numRounds} rounds)`
						: "Time (MM:SS or M:SS)",
					examples: ["3:45", "12:30", "1:05:30"],
				}
			case "rounds-reps":
				return {
					format: isMultiRound
						? `Rounds + Reps (${numRounds} scores)`
						: "Rounds + Reps",
					examples: ["5+12", "10+0", "7+15"],
				}
			case "reps":
				return {
					format: isMultiRound
						? `Reps per round (${numRounds} rounds)`
						: "Total Reps",
					examples: ["150", "87", "203"],
				}
			case "load":
				return {
					format: "Weight (lbs or kg)",
					examples: ["225", "315", "185"],
				}
			case "calories":
				return {
					format: isMultiRound
						? `Calories per round (${numRounds} rounds)`
						: "Total Calories",
					examples: ["150", "200", "175"],
				}
			case "meters":
				return {
					format: isMultiRound
						? `Distance per round (${numRounds} rounds)`
						: "Distance (meters)",
					examples: ["5000", "2000", "1500"],
				}
			case "points":
				return {
					format: isMultiRound
						? `Points per round (${numRounds} rounds)`
						: "Total Points",
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
					<div className="flex items-center gap-6">
						<div className="flex items-center gap-3">
							<span className="text-sm font-medium">Event:</span>
							<Select value={selectedEventId} onValueChange={handleEventChange}>
								<SelectTrigger className="w-[280px]">
									<SelectValue placeholder="Select event..." />
								</SelectTrigger>
								<SelectContent>
									{events.map((e) => (
										<SelectItem key={e.id} value={e.id}>
											Event {e.trackOrder}: {e.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-3">
							<Filter className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">Division:</span>
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
								{scoreExamples.format} (e.g.,{" "}
								{scoreExamples.examples.join(", ")})
							</span>
							{isTimeCapped && (
								<>
									<span className="mx-2 text-muted-foreground">•</span>
									<span className="text-muted-foreground">
										Type <strong>CAP</strong> for{" "}
										{timeCap ? formatTimeCap(timeCap) : "time cap"}
									</span>
								</>
							)}
							<span className="mx-2 text-muted-foreground">•</span>
							<span className="text-muted-foreground">Results auto-save</span>
						</div>
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-auto py-0 px-2 text-xs"
							>
								More info
							</Button>
						</CollapsibleTrigger>
					</AlertDescription>
					<CollapsibleContent className="mt-3 pt-3 border-t">
						<div className="text-sm">
							<p className="font-medium mb-1">Entering Scores</p>
							<ul className="text-muted-foreground space-y-1 text-xs">
								<li>
									• Type the score and press{" "}
									<kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
										Tab
									</kbd>{" "}
									or{" "}
									<kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
										Enter
									</kbd>{" "}
									to move to the next athlete
								</li>
								<li>
									• Results auto-save when you move to the next field or click
									away
								</li>
								<li>• Time formats: 3:45, 12:30, or 1:05:30 for hours</li>
								{isTimeCapped && (
									<li>
										• Type <strong>CAP</strong> if the athlete hit the{" "}
										{timeCap ? formatTimeCap(timeCap) : "time"} cap
									</li>
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
					<div
						className={`grid gap-3 border-b bg-muted/30 p-3 text-sm font-medium text-muted-foreground ${hasTiebreak ? "grid-cols-[60px_1fr_2fr_1fr_100px]" : "grid-cols-[60px_1fr_2fr_100px]"}`}
					>
						<div className="text-center">{hasHeats ? "LANE" : "#"}</div>
						<div>TEAM / ATHLETE</div>
						<div>
							{(event.workout.roundsToScore ?? 1) > 1
								? `SCORES (${event.workout.roundsToScore} ROUNDS)`
								: event.workout.scheme === "pass-fail"
									? "ROUNDS PASSED"
									: "SCORE"}
						</div>
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
						) : hasHeats ? (
							/* Heat-based layout */
							<>
								{heats.map((heat) => {
									// Calculate starting index for this heat
									const startIndex = allAthletesInOrder.findIndex((a) =>
										heat.assignments.some(
											(assignment) =>
												assignment.registrationId === a.registrationId,
										),
									)
									return (
										<HeatScoreGroup
											key={heat.heatId}
											heat={heat}
											athleteMap={athleteMap}
											workoutScheme={event.workout.scheme}
											tiebreakScheme={event.workout.tiebreakScheme}
											timeCap={timeCap ?? undefined}
											roundsToScore={event.workout.roundsToScore ?? 1}
											repsPerRound={event.workout.repsPerRound}
											showTiebreak={hasTiebreak}
											scores={scores}
											savingIds={savingIds}
											savedIds={savedIds}
											onScoreChange={handleScoreChange}
											onTabNext={handleTabNext}
											rowRefs={rowRefs}
											startIndex={startIndex >= 0 ? startIndex : 0}
											defaultOpen={true}
										/>
									)
								})}

								{/* Unassigned athletes section */}
								{unassignedAthletes.length > 0 && (
									<div className="border-t">
										<div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b">
											<span className="font-medium text-amber-800 dark:text-amber-200">
												Unassigned Athletes
											</span>
											<span className="ml-2 text-sm text-amber-600 dark:text-amber-400">
												({unassignedAthletes.length} athletes not in any heat)
											</span>
										</div>
										{unassignedAthletes.map((athlete) => {
											const globalIndex = allAthletesInOrder.findIndex(
												(a) => a.registrationId === athlete.registrationId,
											)
											return (
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
													timeCap={timeCap ?? undefined}
														roundsToScore={event.workout.roundsToScore ?? 1}
														repsPerRound={event.workout.repsPerRound}
														showTiebreak={hasTiebreak}
														value={scores[athlete.registrationId]}
														isSaving={savingIds.has(athlete.registrationId)}
														isSaved={savedIds.has(athlete.registrationId)}
														onChange={(data) =>
															handleScoreChange(athlete, data)
														}
														onTabNext={() => handleTabNext(globalIndex)}
													/>
												</div>
											)
										})}
									</div>
								)}
							</>
						) : (
							/* Flat layout (no heats) */
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
									timeCap={timeCap ?? undefined}
										roundsToScore={event.workout.roundsToScore ?? 1}
										repsPerRound={event.workout.repsPerRound}
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
