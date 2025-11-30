"use client"

import { BarChart3, Trophy, Medal } from "lucide-react"
import { useState, useEffect } from "react"
import { useServerAction } from "@repo/zsa-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { getCompetitionLeaderboardAction } from "@/actions/competition-actions"
import type { CompetitionLeaderboardEntry } from "@/server/competition-leaderboard"

interface LeaderboardContentProps {
	competitionId: string
	divisions: Array<{ id: string; label: string }> | null
}

export function LeaderboardContent({ competitionId, divisions }: LeaderboardContentProps) {
	const [selectedDivision, setSelectedDivision] = useState<string>("all")
	const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([])

	const { execute, isPending } = useServerAction(getCompetitionLeaderboardAction, {
		onSuccess: (result) => {
			if (result.data?.data) {
				setLeaderboard(result.data.data)
			}
		},
	})

	useEffect(() => {
		execute({
			competitionId,
			divisionId: selectedDivision === "all" ? undefined : selectedDivision,
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [competitionId, selectedDivision])

	// Group leaderboard by division for display
	const leaderboardByDivision = leaderboard.reduce((acc, entry) => {
		const divisionId = entry.divisionId
		if (!acc[divisionId]) {
			acc[divisionId] = {
				label: entry.divisionLabel,
				entries: [],
			}
		}
		acc[divisionId].entries.push(entry)
		return acc
	}, {} as Record<string, { label: string; entries: CompetitionLeaderboardEntry[] }>)

	// Get event names from first entry (all entries have same events)
	const eventNames = leaderboard[0]?.eventResults.map((e) => e.eventName) || []

	const getRankIcon = (rank: number) => {
		switch (rank) {
			case 1:
				return <Trophy className="h-4 w-4 text-yellow-500" />
			case 2:
				return <Medal className="h-4 w-4 text-gray-400" />
			case 3:
				return <Medal className="h-4 w-4 text-amber-600" />
			default:
				return null
		}
	}

	if (isPending && leaderboard.length === 0) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-6xl">
					<h2 className="text-2xl font-bold mb-6">Leaderboard</h2>
					<div className="space-y-4">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-64 w-full" />
					</div>
				</div>
			</div>
		)
	}

	if (leaderboard.length === 0 && !isPending) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl">
					<h2 className="text-2xl font-bold mb-6">Leaderboard</h2>

					<Alert variant="default" className="border-dashed">
						<BarChart3 className="h-4 w-4" />
						<AlertTitle>Leaderboard not yet available</AlertTitle>
						<AlertDescription>
							Results and rankings will appear here once athletes start submitting scores.
						</AlertDescription>
					</Alert>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-6xl">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-2xl font-bold">Leaderboard</h2>

					{divisions && divisions.length > 1 && (
						<Select value={selectedDivision} onValueChange={setSelectedDivision}>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="Filter by division" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Divisions</SelectItem>
								{divisions.map((division) => (
									<SelectItem key={division.id} value={division.id}>
										{division.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>

				{Object.entries(leaderboardByDivision).map(([divisionId, { label, entries }]) => (
					<Card key={divisionId} className="mb-6">
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">{label}</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-16 text-center">Rank</TableHead>
											<TableHead>Athlete</TableHead>
											<TableHead className="text-right">Points</TableHead>
											{eventNames.map((name, i) => (
												<TableHead key={`${i}-${name}`} className="text-center min-w-[80px]">
													<span className="text-xs">{name}</span>
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{entries.map((entry) => (
											<TableRow key={entry.registrationId}>
												<TableCell className="text-center font-medium">
													<div className="flex items-center justify-center gap-1">
														{getRankIcon(entry.overallRank)}
														<span>{entry.overallRank}</span>
													</div>
												</TableCell>
												<TableCell className="font-medium">
													{entry.athleteName}
												</TableCell>
												<TableCell className="text-right font-bold">
													{entry.totalPoints}
												</TableCell>
												{entry.eventResults.map((result, i) => (
													<TableCell key={`${i}-${result.eventName}`} className="text-center">
														{result.rank > 0 ? (
															<div className="flex flex-col items-center">
																<span className="text-xs text-muted-foreground">
																	{result.formattedScore}
																</span>
																<span className="text-xs font-medium">
																	+{result.points}
																</span>
															</div>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
