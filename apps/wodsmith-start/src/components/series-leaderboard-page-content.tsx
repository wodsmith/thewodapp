"use client"

import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertTriangle, BarChart3 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SeriesLeaderboardTable } from "@/components/series-leaderboard-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
	getSeriesLeaderboardFn,
	type SeriesDivisionHealth,
	type SeriesLeaderboardEntry,
} from "@/server-fns/series-leaderboard-fns"
import type { ScoringAlgorithm } from "@/types/scoring"

interface Props {
	groupId: string
}


export function SeriesLeaderboardPageContent({ groupId }: Props) {
	const navigate = useNavigate()
	const searchParams = useSearch({ strict: false }) as { division?: string }

	const [entries, setEntries] = useState<SeriesLeaderboardEntry[]>([])
	const [seriesEvents, setSeriesEvents] = useState<
		Array<{ workoutId: string; name: string; scheme: string }>
	>([])
	const [divisionHealth, setDivisionHealth] = useState<SeriesDivisionHealth[]>(
		[],
	)
	const [availableDivisions, setAvailableDivisions] = useState<
		Array<{ id: string; label: string }>
	>([])
	const [scoringAlgorithm, setScoringAlgorithm] =
		useState<ScoringAlgorithm>("traditional")
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const selectedDivision = searchParams.division ?? ""

	const getLeaderboard = useServerFn(getSeriesLeaderboardFn)

	useEffect(() => {
		let cancelled = false
		setIsLoading(true)
		setError(null)

		getLeaderboard({
			data: {
				groupId,
				divisionId: selectedDivision || undefined,
			},
		})
			.then((result) => {
				if (cancelled) return
				setEntries(result.entries)
				setSeriesEvents(result.seriesEvents)
				setDivisionHealth(result.divisionHealth)
				setAvailableDivisions(result.availableDivisions)
				setScoringAlgorithm(result.scoringConfig.algorithm)
			})
			.catch((err) => {
				if (cancelled) return
				setError(
					err instanceof Error ? err.message : "Failed to load leaderboard",
				)
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [groupId, selectedDivision, getLeaderboard])

	const handleDivisionChange = useCallback(
		(divisionId: string) => {
			const resolved = divisionId === "__all__" ? "" : divisionId
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) => ({
					...prev,
					division: resolved || undefined,
				}),
				replace: true,
			})
		},
		[navigate],
	)

	// Filter entries for selected division
	const filteredEntries = useMemo(() => {
		if (!selectedDivision) return entries
		return entries.filter((e) => e.divisionId === selectedDivision)
	}, [entries, selectedDivision])

	// Division health mismatches
	const mismatches = divisionHealth.filter((h) => !h.matchesPrimary)

	if (isLoading && entries.length === 0) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Global Leaderboard</h2>
				<div className="space-y-4">
					<Skeleton className="h-10 w-48" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Global Leaderboard</h2>
				<Alert variant="destructive">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>Error loading leaderboard</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4">
				<h2 className="text-2xl font-bold">Global Leaderboard</h2>

				{/* Division selector */}
				{availableDivisions.length > 1 && (
					<div className="flex items-center gap-4">
						<Select
							value={selectedDivision || "__all__"}
							onValueChange={handleDivisionChange}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="All Divisions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all__">All Divisions</SelectItem>
								{availableDivisions.map((d) => (
									<SelectItem key={d.id} value={d.id}>
										{d.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{isLoading && entries.length > 0 && (
							<span className="text-sm text-muted-foreground animate-pulse">
								Updating...
							</span>
						)}
					</div>
				)}
			</div>

			{/* Division health warnings (organizer-facing) */}
			{mismatches.length > 0 && (
				<Alert
					variant="default"
					className="border-orange-200 bg-orange-50 dark:bg-orange-950/20"
				>
					<BarChart3 className="h-4 w-4 text-orange-600" />
					<AlertTitle className="text-orange-800 dark:text-orange-400">
						Division Mismatch Warning
					</AlertTitle>
					<AlertDescription className="text-orange-700 dark:text-orange-300">
						{mismatches.length} competition
						{mismatches.length !== 1 ? "s" : ""} use a different scaling group
						than the rest of the series. Athletes from these competitions may not
						appear in some division leaderboards:
						<ul className="mt-2 space-y-1">
							{mismatches.map((m) => (
								<li
									key={m.competitionId}
									className="flex items-center justify-between"
								>
									<span className="flex items-center gap-1">
										<AlertTriangle className="h-3 w-3" />
										{m.competitionName}
									</span>
									<Link
										to="/compete/organizer/$competitionId/divisions"
										params={{ competitionId: m.competitionId }}
										className="text-orange-600 dark:text-orange-400 underline text-xs font-medium hover:text-orange-800"
									>
										Fix divisions →
									</Link>
								</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}

			{filteredEntries.length === 0 && !isLoading ? (
				<Alert variant="default" className="border-dashed">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>No results yet</AlertTitle>
					<AlertDescription>
						Rankings will appear here once athletes start submitting scores
						across throwdowns.
					</AlertDescription>
				</Alert>
			) : (
				<div className="rounded-md border">
					<SeriesLeaderboardTable
						entries={filteredEntries}
						seriesEvents={seriesEvents}
						scoringAlgorithm={scoringAlgorithm}
					/>
				</div>
			)}
		</div>
	)
}
