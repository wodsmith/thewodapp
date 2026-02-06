"use client"

import { getRouteApi, useNavigate, useSearch } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { BarChart3, Eye, EyeOff } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { CompetitionLeaderboardTable } from "@/components/competition-leaderboard-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
} from "@/components/ui/collapsible"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
	type CompetitionLeaderboardEntry,
	getCompetitionLeaderboardFn,
} from "@/server-fns/leaderboard-fns"
import {
	type DivisionDescription,
	getPublicEventDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { WorkoutPreview } from "@/components/workout-preview"
import type { ScoringAlgorithm } from "@/types/scoring"

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
	const isMobile = useIsMobile()
	// Get search params from URL - using strict: false since we're in a child component
	const searchParams = useSearch({ strict: false }) as {
		division?: string
		event?: string
	}

	// Get divisions and competition from parent route loader
	const { divisions, competition } = parentRoute.useLoaderData()

	// Default to first division if available
	const defaultDivision = divisions?.[0]?.id ?? ""

	// URL state for shareable leaderboard views
	const selectedDivision = searchParams.division ?? defaultDivision
	const selectedEventId = searchParams.event ?? null

	const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>(
		[],
	)
	const [scoringAlgorithm, setScoringAlgorithm] =
		useState<ScoringAlgorithm>("traditional")
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Workout preview state
	const [isPreviewOpen, setIsPreviewOpen] = useState(false)
	const [previewData, setPreviewData] = useState<{
		name: string
		description: string | null
		scheme: string
		timeCap: number | null
		movements: Array<{ id: string; name: string }>
		tags: Array<{ id: string; name: string }>
		workoutId: string
		divisionDescriptions: DivisionDescription[]
	} | null>(null)
	const [isPreviewLoading, setIsPreviewLoading] = useState(false)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const previewCache = useRef(
		new Map<
			string,
			{
				name: string
				description: string | null
				scheme: string
				timeCap: number | null
				movements: Array<{ id: string; name: string }>
				tags: Array<{ id: string; name: string }>
				workoutId: string
				divisionDescriptions: DivisionDescription[]
			}
		>(),
	)
	const getEventDetails = useServerFn(getPublicEventDetailsFn)
	const getDivisionDescriptions = useServerFn(getWorkoutDivisionDescriptionsFn)

	// Close preview when event changes
	useEffect(() => {
		setIsPreviewOpen(false)
		setPreviewData(null)
		setPreviewError(null)
	}, [selectedEventId])

	const handleTogglePreview = useCallback(async () => {
		if (isPreviewOpen) {
			setIsPreviewOpen(false)
			return
		}

		if (!selectedEventId) return

		// Check cache first
		const cached = previewCache.current.get(selectedEventId)
		if (cached) {
			setPreviewData(cached)
			setIsPreviewOpen(true)
			return
		}

		// Fetch workout details
		setIsPreviewLoading(true)
		setPreviewError(null)
		setIsPreviewOpen(true)

		try {
			const result = await getEventDetails({
				data: {
					eventId: selectedEventId,
					competitionId,
				},
			})

			if (result.event) {
				// Fetch division descriptions in parallel if divisions exist
				const divisionIds = divisions?.map((d) => d.id) ?? []
				let divisionDescriptions: DivisionDescription[] = []

				if (divisionIds.length > 0) {
					const descResult = await getDivisionDescriptions({
						data: {
							workoutId: result.event.workout.id,
							divisionIds,
						},
					})
					divisionDescriptions = descResult.descriptions
				}

				const data = {
					name: result.event.workout.name,
					description: result.event.workout.description,
					scheme: result.event.workout.scheme,
					timeCap: result.event.workout.timeCap,
					movements: result.event.workout.movements ?? [],
					tags: result.event.workout.tags ?? [],
					workoutId: result.event.workout.id,
					divisionDescriptions,
				}
				previewCache.current.set(selectedEventId, data)
				setPreviewData(data)
			} else {
				setPreviewError("Workout details not found.")
			}
		} catch {
			setPreviewError("Failed to load workout details.")
		} finally {
			setIsPreviewLoading(false)
		}
	}, [isPreviewOpen, selectedEventId, competitionId, divisions, getEventDetails, getDivisionDescriptions])

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
					setLeaderboard(result.entries)
					setScoringAlgorithm(result.scoringAlgorithm)
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

	// Derive division-specific description for preview
	const selectedDivisionDesc = useMemo(() => {
		if (!previewData?.divisionDescriptions || !selectedDivision) return null
		return previewData.divisionDescriptions.find(
			(d) => d.divisionId === selectedDivision,
		) ?? null
	}, [previewData?.divisionDescriptions, selectedDivision])

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

					{/* View Workout button */}
					{selectedEventId && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleTogglePreview}
						>
							{isPreviewOpen ? (
								<EyeOff className="h-4 w-4 mr-1.5" />
							) : (
								<Eye className="h-4 w-4 mr-1.5" />
							)}
							{isPreviewOpen ? "Hide Workout" : "View Workout"}
						</Button>
					)}

					{/* Loading indicator for background refetches */}
					{isLoading && leaderboard.length > 0 && (
						<span className="text-sm text-muted-foreground animate-pulse">
							Updating...
						</span>
					)}
				</div>
			</div>

			{/* Desktop: Collapsible workout preview */}
			{selectedEventId && !isMobile && (
				<Collapsible open={isPreviewOpen}>
					<CollapsibleContent>
						{previewError ? (
							<div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
								{previewError}
							</div>
						) : (
							<WorkoutPreview
								name={previewData?.name ?? ""}
								description={previewData?.description ?? null}
								scheme={previewData?.scheme ?? ""}
								timeCap={previewData?.timeCap ?? null}
								movements={previewData?.movements ?? []}
								tags={previewData?.tags ?? []}
								eventDetailUrl={{
									slug: competition.slug,
									eventId: selectedEventId,
								}}
								isLoading={isPreviewLoading}
								divisionScale={selectedDivisionDesc?.description}
								divisionLabel={selectedDivisionDesc?.divisionLabel}
							/>
						)}
					</CollapsibleContent>
				</Collapsible>
			)}

			<div className="rounded-md border">
				<CompetitionLeaderboardTable
					leaderboard={leaderboard}
					events={events}
					selectedEventId={selectedEventId}
					scoringAlgorithm={scoringAlgorithm}
				/>
			</div>

			{/* Mobile: Bottom Sheet workout preview */}
			{selectedEventId && isMobile && (
				<Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
					<SheetContent
						side="bottom"
						className="max-h-[70vh] overflow-y-auto rounded-t-2xl"
					>
						<SheetHeader>
							<SheetTitle>Workout Details</SheetTitle>
						</SheetHeader>
						{previewError ? (
							<div className="p-4 text-sm text-muted-foreground">
								{previewError}
							</div>
						) : (
							<WorkoutPreview
								name={previewData?.name ?? ""}
								description={previewData?.description ?? null}
								scheme={previewData?.scheme ?? ""}
								timeCap={previewData?.timeCap ?? null}
								movements={previewData?.movements ?? []}
								tags={previewData?.tags ?? []}
								eventDetailUrl={{
									slug: competition.slug,
									eventId: selectedEventId,
								}}
								isLoading={isPreviewLoading}
								divisionScale={selectedDivisionDesc?.description}
								divisionLabel={selectedDivisionDesc?.divisionLabel}
							/>
						)}
					</SheetContent>
				</Sheet>
			)}
		</div>
	)
}
