"use client"

import { BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import {
	getPublicCompetitionDivisionsFn,
	type PublicCompetitionDivision,
} from "@/server-fns/competition-divisions-fns"
import {
	getCompetitionLeaderboardFn,
	type CompetitionLeaderboardEntry,
} from "@/server-fns/leaderboard-fns"
import type { ScoringConfig, ScoringAlgorithm } from "@/types/scoring"
import { cn } from "@/lib/utils"

/**
 * Props for the LeaderboardPageContent component
 */
interface LeaderboardPageContentProps {
	competitionId: string
}

interface LeaderboardData {
	entries: CompetitionLeaderboardEntry[]
	scoringConfig: ScoringConfig
	events: Array<{ trackWorkoutId: string; name: string }>
}

/**
 * Display name mapping for scoring algorithms
 */
const ALGORITHM_DISPLAY_NAMES: Record<ScoringAlgorithm, string> = {
	traditional: "Traditional",
	p_score: "P-Score",
	custom: "Custom",
}

/**
 * Format points value based on scoring algorithm.
 * Traditional: integer (e.g., "195")
 * P-Score: decimal with sign (e.g., "+15.5" or "-3.2")
 */
function formatPoints(
	points: number,
	algorithm: ScoringAlgorithm,
): { formatted: string; isNegative: boolean; isPositive: boolean } {
	if (algorithm === "p_score") {
		// P-Score: show sign and one decimal place
		const rounded = Math.round(points * 10) / 10
		const isNegative = rounded < 0
		const isPositive = rounded > 0
		const sign = isPositive ? "+" : ""
		return {
			formatted: `${sign}${rounded.toFixed(1)}`,
			isNegative,
			isPositive,
		}
	}

	// Traditional/Custom: integer, no sign
	return {
		formatted: String(Math.round(points)),
		isNegative: false,
		isPositive: false,
	}
}

/**
 * Competition Leaderboard Page Content
 *
 * Displays competition leaderboard with configurable scoring support.
 * Supports Traditional, P-Score, and Custom scoring algorithms.
 */
export function LeaderboardPageContent({
	competitionId,
}: LeaderboardPageContentProps) {
	const [divisions, setDivisions] = useState<PublicCompetitionDivision[]>([])
	const [selectedDivision, setSelectedDivision] = useState("")
	const [leaderboardData, setLeaderboardData] =
		useState<LeaderboardData | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isDivisionsLoading, setIsDivisionsLoading] = useState(true)

	// Fetch divisions on mount
	useEffect(() => {
		async function fetchDivisions() {
			setIsDivisionsLoading(true)
			try {
				const result = await getPublicCompetitionDivisionsFn({
					data: { competitionId },
				})
				setDivisions(result.divisions)
				// Set default division to first one
				if (result.divisions.length > 0) {
					setSelectedDivision(result.divisions[0].id)
				}
			} catch (error) {
				console.error("Failed to fetch divisions:", error)
			} finally {
				setIsDivisionsLoading(false)
			}
		}
		fetchDivisions()
	}, [competitionId])

	// Fetch leaderboard when division changes
	useEffect(() => {
		async function fetchLeaderboard() {
			if (!selectedDivision) return

			setIsLoading(true)
			try {
				const result = await getCompetitionLeaderboardFn({
					data: {
						competitionId,
						divisionId: selectedDivision,
					},
				})
				setLeaderboardData(result)
			} catch (error) {
				console.error("Failed to fetch leaderboard:", error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchLeaderboard()
	}, [competitionId, selectedDivision])

	const handleDivisionChange = (divisionId: string) => {
		setSelectedDivision(divisionId)
	}

	const hasResults = leaderboardData && leaderboardData.entries.length > 0
	const algorithm = leaderboardData?.scoringConfig?.algorithm ?? "traditional"
	const events = leaderboardData?.events ?? []

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-3">
					<h2 className="text-2xl font-bold">Leaderboard</h2>
					{hasResults && (
						<Badge variant="secondary" className="text-xs">
							{ALGORITHM_DISPLAY_NAMES[algorithm]}
						</Badge>
					)}
				</div>

				{/* Division selector */}
				{divisions && divisions.length > 1 && (
					<div className="flex flex-wrap items-center gap-4">
						<Select
							value={selectedDivision}
							onValueChange={handleDivisionChange}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="Select division" />
							</SelectTrigger>
							<SelectContent>
								{divisions.map((division) => (
									<SelectItem key={division.id} value={division.id}>
										{division.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</div>

			{/* Loading state */}
			{(isLoading || isDivisionsLoading) && (
				<div className="rounded-md border p-8">
					<div className="text-center text-muted-foreground">
						{isDivisionsLoading
							? "Loading divisions..."
							: "Loading leaderboard..."}
					</div>
				</div>
			)}

			{/* Empty state */}
			{!isLoading && !isDivisionsLoading && !hasResults && (
				<Alert variant="default" className="border-dashed">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>Leaderboard not yet available</AlertTitle>
					<AlertDescription>
						Results and rankings will appear here once athletes start submitting
						scores.
					</AlertDescription>
				</Alert>
			)}

			{/* Leaderboard table */}
			{!isLoading && hasResults && (
				<div className="rounded-md border overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">Rank</TableHead>
								<TableHead>Athlete</TableHead>
								<TableHead className="text-right">Points</TableHead>
								{events.map((event) => (
									<TableHead key={event.trackWorkoutId} className="text-center">
										{event.name}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{leaderboardData.entries.map((entry) => {
								const { formatted, isNegative, isPositive } = formatPoints(
									entry.totalPoints,
									algorithm,
								)

								return (
									<TableRow key={entry.registrationId}>
										<TableCell className="font-medium">
											{entry.overallRank}
										</TableCell>
										<TableCell>
											<div className="flex flex-col">
												<span>{entry.athleteName}</span>
												{entry.isTeamDivision && entry.teamName && (
													<span className="text-xs text-muted-foreground">
														{entry.teamName}
													</span>
												)}
											</div>
										</TableCell>
										<TableCell
											className={cn(
												"text-right font-semibold tabular-nums",
												isNegative && "text-red-600 dark:text-red-400",
												isPositive &&
													algorithm === "p_score" &&
													"text-green-600 dark:text-green-400",
											)}
										>
											{formatted}
										</TableCell>
										{events.map((event) => {
											const eventResult = entry.eventResults.find(
												(r) => r.trackWorkoutId === event.trackWorkoutId,
											)

											if (!eventResult) {
												return (
													<TableCell
														key={event.trackWorkoutId}
														className="text-center text-muted-foreground"
													>
														—
													</TableCell>
												)
											}

											return (
												<TableCell
													key={event.trackWorkoutId}
													className="text-center"
												>
													<div className="flex flex-col items-center">
														<span className="text-sm">
															{eventResult.formattedScore}
														</span>
														<span className="text-xs text-muted-foreground">
															#{eventResult.rank} ({eventResult.points} pts)
														</span>
													</div>
												</TableCell>
											)
										})}
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	)
}
