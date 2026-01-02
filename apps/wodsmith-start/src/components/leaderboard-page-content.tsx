"use client"

import { getRouteApi, useNavigate, useSearch } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { BarChart3 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CompetitionLeaderboardTable } from "@/components/competition-leaderboard-table"
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
	type CompetitionLeaderboardEntry,
	getCompetitionLeaderboardFn,
} from "@/server-fns/leaderboard-fns"

// Get parent route API to access divisions from loader
const parentRoute = getRouteApi("/compete/$slug")

/**
 * Props for the LeaderboardPageContent component
 */
interface LeaderboardPageContentProps {
	competitionId: string
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
	const navigate = useNavigate()
	// Get search params from URL - using strict: false since we're in a child component
	const searchParams = useSearch({ strict: false }) as {
		division?: string
		event?: string
	}

	// Get divisions from parent route loader
	const { divisions } = parentRoute.useLoaderData()

	// Default to first division if available
	const defaultDivision = divisions?.[0]?.id ?? ""

	// URL state for shareable leaderboard views
	const selectedDivision = searchParams.division ?? defaultDivision
	const selectedEventId = searchParams.event ?? null

	const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>(
		[],
	)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Server function for fetching leaderboard
	const getLeaderboard = useServerFn(getCompetitionLeaderboardFn)

	// Fetch leaderboard when division changes
	useEffect(() => {
		let cancelled = false

		async function fetchLeaderboard() {
			if (!selectedDivision) {
				setIsLoading(false)
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				const result = await getLeaderboard({
					data: {
						competitionId,
						divisionId: selectedDivision,
					},
				})

				if (!cancelled) {
					setLeaderboard(result)
				}
			} catch (err) {
				if (!cancelled) {
					console.error("Failed to fetch leaderboard:", err)
					setError(
						err instanceof Error
							? err.message
							: "Failed to load leaderboard. Please try again.",
					)
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		fetchLeaderboard()

		return () => {
			cancelled = true
		}
	}, [competitionId, selectedDivision, getLeaderboard])

	// Handle division change - update URL
	const handleDivisionChange = useCallback(
		(divisionId: string) => {
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) => ({
					...prev,
					division: divisionId,
					// Reset event when changing divisions
					event: undefined,
				}),
				replace: true,
			})
		},
		[navigate],
	)

	// Handle event change - update URL
	const handleEventChange = useCallback(
		(value: string) => {
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) => ({
					...prev,
					event: value === "overall" ? undefined : value,
				}),
				replace: true,
			})
		},
		[navigate],
	)

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

	// Loading state - initial load
	if (isLoading && leaderboard.length === 0) {
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

	// Error state
	if (error) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Leaderboard</h2>

				{/* Division selector even on error */}
				{divisions && divisions.length > 1 && (
					<div className="mb-6">
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

				<Alert variant="destructive">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>Error loading leaderboard</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			</div>
		)
	}

	// Empty state - no results yet
	if (leaderboard.length === 0 && !isLoading) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Leaderboard</h2>

				{/* Division selector even when empty */}
				{divisions && divisions.length > 1 && (
					<div className="mb-6">
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

				<Alert variant="default" className="border-dashed">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>Leaderboard not yet available</AlertTitle>
					<AlertDescription>
						Results and rankings will appear here once athletes start submitting
						scores.
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
					)}

					{/* View selector (Overall vs individual events) */}
					{events.length > 0 && (
						<Select
							value={selectedEventId ?? "overall"}
							onValueChange={handleEventChange}
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

					{/* Loading indicator for background refetches */}
					{isLoading && leaderboard.length > 0 && (
						<span className="text-sm text-muted-foreground animate-pulse">
							Updating...
						</span>
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
