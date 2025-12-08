"use client"

import { useServerAction } from "@repo/zsa-react"
import { BarChart3 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { getCompetitionLeaderboardAction } from "@/actions/competition-actions"
import { CompetitionLeaderboardTable } from "@/components/compete/competition-leaderboard-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { CompetitionLeaderboardEntry } from "@/server/competition-leaderboard"

interface LeaderboardPageContentProps {
	competitionId: string
	divisions: Array<{ id: string; label: string }> | null
}

export function LeaderboardPageContent({
	competitionId,
	divisions,
}: LeaderboardPageContentProps) {
	// Default to first division if available
	const defaultDivision = divisions?.[0]?.id ?? ""
	const [selectedDivision, setSelectedDivision] =
		useState<string>(defaultDivision)
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
	const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>(
		[],
	)

	const { execute, isPending } = useServerAction(
		getCompetitionLeaderboardAction,
		{
			onSuccess: (result) => {
				if (result.data?.data) {
					setLeaderboard(result.data.data)
				}
			},
		},
	)

	// Update selected division when divisions change
	useEffect(() => {
		if (divisions && divisions.length > 0 && !selectedDivision) {
			setSelectedDivision(divisions[0]?.id ?? "")
		}
	}, [divisions, selectedDivision])

	// Fetch leaderboard when division changes
	useEffect(() => {
		if (selectedDivision) {
			execute({
				competitionId,
				divisionId: selectedDivision,
			})
		}
	}, [competitionId, selectedDivision, execute])

	// Extract events from leaderboard data
	const events = useMemo(() => {
		if (leaderboard.length === 0) return []

		const firstEntry = leaderboard[0]
		if (!firstEntry) return []

		return firstEntry.eventResults
			.map((r) => ({
				id: r.trackWorkoutId,
				name: r.eventName,
				trackOrder: r.trackOrder,
				scheme: r.scheme,
			}))
			.sort((a, b) => a.trackOrder - b.trackOrder)
	}, [leaderboard])

	if (isPending && leaderboard.length === 0) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Leaderboard</h2>
				<div className="space-y-4">
					<div className="flex gap-4">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-10 w-48" />
					</div>
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		)
	}

	if (leaderboard.length === 0 && !isPending) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Leaderboard</h2>

				{/* Division selector even when empty */}
				{divisions && divisions.length > 1 && (
					<div className="mb-6">
						<Select
							value={selectedDivision}
							onValueChange={setSelectedDivision}
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

				<Alert variant="default" className="border-dashed">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>Leaderboard not yet available</AlertTitle>
					<AlertDescription>
						Results and rankings will appear here once athletes start
						submitting scores.
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4">
				<h2 className="text-2xl font-bold">Leaderboard</h2>

				<div className="flex flex-wrap items-center gap-4">
					{/* Division selector */}
					{divisions && divisions.length > 1 && (
						<Select
							value={selectedDivision}
							onValueChange={setSelectedDivision}
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
					)}

					{/* View selector (Overall vs individual events) */}
					{events.length > 0 && (
						<Select
							value={selectedEventId ?? "overall"}
							onValueChange={(value) =>
								setSelectedEventId(value === "overall" ? null : value)
							}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="View" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="overall">Overall</SelectItem>
								{events.map((event) => (
									<SelectItem key={event.id} value={event.id}>
										{event.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			</div>

			<div className="rounded-md border">
				<CompetitionLeaderboardTable
					leaderboard={leaderboard}
					events={events}
					selectedEventId={selectedEventId}
				/>
			</div>
		</div>
	)
}
