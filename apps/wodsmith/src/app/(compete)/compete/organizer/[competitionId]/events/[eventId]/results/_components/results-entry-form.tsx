"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
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
import { Filter, Save, UserX } from "lucide-react"
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

	// Mark all remaining as DNS
	const handleMarkAllDNS = async () => {
		const unscoredAthletes = athletes.filter(
			(a) => !savedIds.has(a.registrationId) && !scores[a.registrationId],
		)

		if (unscoredAthletes.length === 0) {
			toast.info("All athletes already have scores")
			return
		}

		const confirmed = window.confirm(
			`Mark ${unscoredAthletes.length} athlete(s) as DNS (Did Not Start)?`,
		)
		if (!confirmed) return

		for (const athlete of unscoredAthletes) {
			await handleScoreChange(athlete, {
				score: "DNS",
				scoreStatus: "dns",
				tieBreakScore: null,
				formattedScore: "DNS",
			})
		}

		toast.success(`Marked ${unscoredAthletes.length} athlete(s) as DNS`)
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

			{/* Score Entry Table */}
			<Card>
				<CardContent className="p-0">
					{/* Table Header */}
					<div className="grid grid-cols-[60px_1fr_2fr_1fr_100px] gap-3 border-b bg-muted/30 p-3 text-sm font-medium text-muted-foreground">
						<div className="text-center">#</div>
						<div>ATHLETE</div>
						<div>SCORE</div>
						<div>TIE-BREAK</div>
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

			{/* Bottom Actions */}
			<div className="sticky bottom-0 bg-background border-t p-4 -mx-4 shadow-lg">
				<div className="container mx-auto flex items-center justify-between gap-4">
					<Button variant="outline" onClick={handleMarkAllDNS}>
						<UserX className="h-4 w-4 mr-2" />
						Mark Remaining as DNS
					</Button>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Save className="h-4 w-4" />
						Scores auto-save on Tab/Enter
					</div>
				</div>
			</div>
		</div>
	)
}
