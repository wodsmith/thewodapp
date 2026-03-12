"use client"

import {
	type CellContext,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getSortedRowModel,
	type HeaderContext,
	type Row,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import {
	AlertTriangle,
	ArrowDownNarrowWide,
	ArrowUpDown,
	ArrowUpNarrowWide,
	ChevronDown,
	Medal,
	Trophy,
	Video,
} from "lucide-react"
import { Fragment, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { VideoEmbed } from "@/components/video-embed"
import { getSortDirection } from "@/lib/scoring"
import type { WorkoutScheme } from "@/lib/scoring/types"
import { cn } from "@/lib/utils"
import type {
	CompetitionLeaderboardEntry,
	TeamMemberInfo,
} from "@/server-fns/leaderboard-fns"
import type { ScoringAlgorithm } from "@/types/scoring"

// Type aliases for cleaner column definitions
type LeaderboardCellContext = CellContext<CompetitionLeaderboardEntry, unknown>
type LeaderboardHeaderContext = HeaderContext<
	CompetitionLeaderboardEntry,
	unknown
>

interface OnlineCompetitionLeaderboardTableProps {
	leaderboard: CompetitionLeaderboardEntry[]
	events: Array<{
		id: string
		name: string
		trackOrder: number
		scheme: string
	}>
	selectedEventId: string | null
	scoringAlgorithm: ScoringAlgorithm
}

function getRankIcon(rank: number) {
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

function RankCell({ rank, points }: { rank: number; points?: number }) {
	const icon = getRankIcon(rank)
	const isPodium = rank <= 3
	return (
		<div className="flex flex-col gap-0.5">
			<div className="flex items-center gap-1.5">
				{icon}
				<span
					className={cn(
						"tabular-nums",
						isPodium ? "font-bold text-base" : "font-semibold",
					)}
				>
					{rank}
				</span>
			</div>
			{points !== undefined && (
				<span className="text-xs text-muted-foreground tabular-nums">
					{points} pts
				</span>
			)}
		</div>
	)
}

function formatPoints(points: number, algorithm: ScoringAlgorithm): string {
	if (algorithm === "online" || algorithm === "p_score") {
		return String(points)
	}
	if (points < 0) {
		return String(points)
	}
	return `+${points}`
}

function formatMemberName(member: TeamMemberInfo): string {
	const name =
		`${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"
	return member.isCaptain ? `${name} (C)` : name
}

/** Subtle warning icon indicating a penalty or score adjustment */
function PenaltyIndicator({
	result,
}: {
	result: CompetitionLeaderboardEntry["eventResults"][number]
}) {
	if (!result.penaltyType && !result.isDirectlyModified) return null

	const label = result.penaltyType
		? `${result.penaltyType === "major" ? "Major" : "Minor"} Penalty${result.penaltyPercentage != null ? ` (${result.penaltyPercentage}%)` : ""}`
		: "Score Adjusted"

	return (
		<span title={label}>
			<AlertTriangle className="h-3 w-3 text-muted-foreground" />
		</span>
	)
}


function TeamCell({ entry }: { entry: CompetitionLeaderboardEntry }) {
	if (!entry.isTeamDivision) {
		return (
			<div className="flex flex-col gap-0.5">
				<span className="font-medium">{entry.athleteName}</span>
				{entry.affiliate && (
					<span className="text-[10px] text-muted-foreground leading-tight">
						{entry.affiliate}
					</span>
				)}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-0.5">
			<span className="font-medium">{entry.teamName || "Unknown Team"}</span>
			{entry.affiliate && (
				<span className="text-[10px] text-muted-foreground leading-tight">
					{entry.affiliate}
				</span>
			)}
			{entry.teamMembers.length > 0 && (
				<span className="text-[10px] text-muted-foreground leading-tight">
					{entry.teamMembers.map((m) => formatMemberName(m)).join(", ")}
				</span>
			)}
		</div>
	)
}

function SortableHeader({
	column,
	children,
}: {
	column: {
		getIsSorted: () => false | "asc" | "desc"
		toggleSorting: () => void
	}
	children: React.ReactNode
}) {
	const sorted = column.getIsSorted()
	return (
		<button
			type="button"
			className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-medium hover:text-foreground transition-colors"
			onClick={() => column.toggleSorting()}
		>
			{children}
			<ArrowUpDown
				className={cn(
					"h-3 w-3 transition-colors",
					sorted ? "text-foreground" : "text-muted-foreground/40",
				)}
			/>
		</button>
	)
}

/** Check if an entry has expandable content (videos or penalties) */
function hasExpandableContent(entry: CompetitionLeaderboardEntry): boolean {
	return entry.eventResults.some(
		(r) => r.videoUrl || r.penaltyType || r.isDirectlyModified,
	)
}

/** Desktop expanded row showing videos and penalty details */
function ExpandedVideoRow({
	row,
	selectedEventId,
	columnsCount,
}: {
	row: Row<CompetitionLeaderboardEntry>
	selectedEventId: string | null
	columnsCount: number
}) {
	const entry = row.original

	const resultsToShow = selectedEventId
		? entry.eventResults.filter(
				(r) =>
					r.trackWorkoutId === selectedEventId &&
					(r.videoUrl || r.penaltyType || r.isDirectlyModified),
			)
		: entry.eventResults.filter(
				(r) => r.videoUrl || r.penaltyType || r.isDirectlyModified,
			)

	if (resultsToShow.length === 0) return null

	return (
		<TableRow className="table-row bg-muted/30 hover:bg-muted/30">
			<TableCell colSpan={columnsCount} className="table-cell p-4">
				<div
					className={cn(
						"grid gap-4",
						resultsToShow.length === 1
							? "max-w-2xl"
							: "grid-cols-1 md:grid-cols-2",
					)}
				>
					{resultsToShow.map((result) => (
						<div key={result.trackWorkoutId} className="space-y-2">
							{!selectedEventId && (
								<span className="text-sm font-medium text-muted-foreground block">
									{result.eventName}
								</span>
							)}
							{result.penaltyType && (
								<div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
									<AlertTriangle className="h-3 w-3" />
									{result.penaltyType === "major" ? "Major" : "Minor"} Penalty
									{result.penaltyPercentage != null && ` · ${result.penaltyPercentage}% deduction`}
								</div>
							)}
							{!result.penaltyType && result.isDirectlyModified && (
								<div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
									<AlertTriangle className="h-3 w-3" />
									Score adjusted by organizer
								</div>
							)}
							{result.videoUrl && (
								<VideoEmbed url={result.videoUrl} />
							)}
						</div>
					))}
				</div>
			</TableCell>
		</TableRow>
	)
}

/** Mobile expandable row for online leaderboard */
function MobileOnlineLeaderboardRow({
	entry,
	events,
	scoringAlgorithm,
}: {
	entry: CompetitionLeaderboardEntry
	events: Array<{
		id: string
		name: string
		trackOrder: number
		scheme: string
	}>
	scoringAlgorithm: ScoringAlgorithm
}) {
	const [isOpen, setIsOpen] = useState(false)
	const icon = getRankIcon(entry.overallRank)
	const isPodium = entry.overallRank <= 3

	const sortedEvents = useMemo(
		() => [...events].sort((a, b) => a.trackOrder - b.trackOrder),
		[events],
	)

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="w-full flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors text-left"
				>
					<div className="flex items-center gap-1.5 w-12 shrink-0">
						{icon}
						<span
							className={cn(
								"tabular-nums",
								isPodium ? "font-bold" : "font-semibold",
							)}
						>
							{entry.overallRank}
						</span>
					</div>

					<div className="w-14 shrink-0">
						<span className="text-xs text-muted-foreground tabular-nums">
							{entry.totalPoints} pts
						</span>
					</div>

					<div className="flex-1 min-w-0 text-right">
						{entry.isTeamDivision ? (
							<>
								<span className="font-medium truncate block">
									{entry.teamName || "Unknown Team"}
								</span>
								{entry.affiliate && (
									<span className="text-[10px] text-muted-foreground truncate block">
										{entry.affiliate}
									</span>
								)}
								{entry.teamMembers.length > 0 && (
									<span className="text-[10px] text-muted-foreground truncate block">
										{entry.teamMembers
											.map((m) => formatMemberName(m))
											.join(", ")}
									</span>
								)}
							</>
						) : (
							<>
								<span className="font-medium truncate block">
									{entry.athleteName}
								</span>
								{entry.affiliate && (
									<span className="text-[10px] text-muted-foreground truncate block">
										{entry.affiliate}
									</span>
								)}
							</>
						)}
					</div>

					{entry.eventResults.some((r) => r.videoUrl) && (
						<Video className="h-4 w-4 text-muted-foreground shrink-0" />
					)}
					{entry.eventResults.some((r) => r.penaltyType || r.isDirectlyModified) && (
						<AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
					)}

					<ChevronDown
						className={cn(
							"h-4 w-4 text-muted-foreground shrink-0 transition-transform",
							isOpen && "rotate-180",
						)}
					/>
				</button>
			</CollapsibleTrigger>

			<CollapsibleContent>
				<div className="bg-muted/30 px-3 py-2 border-b space-y-3">
					{/* Event scores */}
					<div className="grid grid-cols-2 gap-x-4 gap-y-2">
						{sortedEvents.map((event) => {
							const result = entry.eventResults.find(
								(r) => r.trackWorkoutId === event.id,
							)
							return (
								<div key={event.id} className="flex flex-col gap-0.5">
									<span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground/70">
										{event.name}
									</span>
									{result && result.rank > 0 ? (
										<div className="flex flex-col gap-0.5">
											<span className="font-medium tabular-nums">
												{result.formattedScore}
												{result.formattedTiebreak && (
													<span className="text-muted-foreground font-normal ml-1">
														(TB: {result.formattedTiebreak})
													</span>
												)}
											</span>
											<span className="text-xs text-muted-foreground tabular-nums">
												#{result.rank}{" "}
												{formatPoints(result.points, scoringAlgorithm)}
											</span>
											{result.penaltyType && (
												<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
													<AlertTriangle className="h-2.5 w-2.5" />
													{result.penaltyType === "major" ? "Major" : "Minor"} Penalty
													{result.penaltyPercentage != null && ` · ${result.penaltyPercentage}% deduction`}
												</span>
											)}
											{!result.penaltyType && result.isDirectlyModified && (
												<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
													<AlertTriangle className="h-2.5 w-2.5" />
													Score adjusted by organizer
												</span>
											)}
										</div>
									) : (
										<span className="text-muted-foreground italic">—</span>
									)}
								</div>
							)
						})}
					</div>

					{/* Video embeds */}
					{entry.eventResults
						.filter((r) => r.videoUrl)
						.map((result) => (
							<div key={result.trackWorkoutId} className="space-y-1">
								<span className="text-xs font-medium text-muted-foreground">
									{result.eventName} Video
								</span>
								<VideoEmbed url={result.videoUrl} />
							</div>
						))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

export function OnlineCompetitionLeaderboardTable({
	leaderboard,
	events,
	selectedEventId,
	scoringAlgorithm,
}: OnlineCompetitionLeaderboardTableProps) {
	const defaultSortColumn = selectedEventId ? "eventRank" : "overallRank"

	const [sorting, setSorting] = useState<SortingState>([
		{ id: defaultSortColumn, desc: false },
	])

	useEffect(() => {
		const validSortColumn = selectedEventId ? "eventRank" : "overallRank"
		setSorting([{ id: validSortColumn, desc: false }])
	}, [selectedEventId])

	const tableData = useMemo(() => {
		if (!selectedEventId) {
			return leaderboard
		}

		return [...leaderboard].sort((a, b) => {
			const aResult = a.eventResults.find(
				(r) => r.trackWorkoutId === selectedEventId,
			)
			const bResult = b.eventResults.find(
				(r) => r.trackWorkoutId === selectedEventId,
			)

			if (!aResult || aResult.rank === 0) return 1
			if (!bResult || bResult.rank === 0) return -1

			return aResult.rank - bResult.rank
		})
	}, [leaderboard, selectedEventId])

	const isTeamLeaderboard = useMemo(
		() => leaderboard.some((entry) => entry.isTeamDivision),
		[leaderboard],
	)

	const hasAffiliates = useMemo(
		() => leaderboard.some((entry) => entry.affiliate),
		[leaderboard],
	)

	const columns = useMemo<ColumnDef<CompetitionLeaderboardEntry>[]>(() => {
		const athleteColumnLabel = isTeamLeaderboard ? "Team" : "Athlete"

		if (selectedEventId) {
			return [
				{
					id: "expand",
					header: "",
					cell: ({ row }: LeaderboardCellContext) => {
						const result = row.original.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						if (!result?.videoUrl) return null
						return (
							<button
								type="button"
								className="p-1 hover:bg-muted rounded transition-colors"
								onClick={() => row.toggleExpanded()}
							>
								<ChevronDown
									className={cn(
										"h-4 w-4 text-muted-foreground transition-transform",
										row.getIsExpanded() && "rotate-180",
									)}
								/>
							</button>
						)
					},
					size: 40,
				},
				{
					id: "eventRank",
					header: "Rank",
					accessorFn: (row: CompetitionLeaderboardEntry) => {
						const result = row.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						return result?.rank && result.rank > 0 ? result.rank : 999
					},
					cell: ({ row }: LeaderboardCellContext) => {
						const result = row.original.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						if (!result || result.rank === 0) {
							return <span className="text-muted-foreground italic">—</span>
						}
						return <RankCell rank={result.rank} points={result.points} />
					},
					sortingFn: "basic",
				},
				{
					id: "athlete",
					header: athleteColumnLabel,
					accessorKey: isTeamLeaderboard ? "teamName" : "athleteName",
					cell: ({ row }: LeaderboardCellContext) => (
						<TeamCell entry={row.original} />
					),
				},
				...(hasAffiliates
					? [
							{
								id: "affiliate",
								header: "Affiliate",
								accessorKey: "affiliate" as const,
								cell: ({ row }: LeaderboardCellContext) => (
									<span className="text-sm text-muted-foreground">
										{row.original.affiliate ?? "—"}
									</span>
								),
							} satisfies ColumnDef<CompetitionLeaderboardEntry>,
						]
					: []),
				{
					id: "score",
					header: "Score",
					accessorFn: (row: CompetitionLeaderboardEntry) => {
						const result = row.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						return result?.formattedScore ?? ""
					},
					cell: ({ row }: LeaderboardCellContext) => {
						const result = row.original.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						if (!result || result.rank === 0) {
							return <span className="text-muted-foreground italic">—</span>
						}
						return (
							<span className="font-medium tabular-nums inline-flex items-center gap-1">
								{result.formattedScore}
								<PenaltyIndicator result={result} />
								{result.formattedTiebreak && (
									<span className="text-muted-foreground font-normal ml-1">
										(TB: {result.formattedTiebreak})
									</span>
								)}
							</span>
						)
					},
				},
				{
					id: "video",
					header: "",
					cell: ({ row }: LeaderboardCellContext) => {
						const result = row.original.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						if (!result?.videoUrl) return null
						return <Video className="h-4 w-4 text-muted-foreground" />
					},
					size: 40,
				},
			]
		}

		// Overall view
		const baseColumns: ColumnDef<CompetitionLeaderboardEntry>[] = [
			{
				id: "expand",
				header: "",
				cell: ({ row }: LeaderboardCellContext) => {
					if (!hasExpandableContent(row.original)) return null
					return (
						<button
							type="button"
							className="p-1 hover:bg-muted rounded transition-colors"
							onClick={() => row.toggleExpanded()}
						>
							<ChevronDown
								className={cn(
									"h-4 w-4 text-muted-foreground transition-transform",
									row.getIsExpanded() && "rotate-180",
								)}
							/>
						</button>
					)
				},
				size: 40,
			},
			{
				id: "overallRank",
				header: ({ column }: LeaderboardHeaderContext) => (
					<SortableHeader column={column}>Rank</SortableHeader>
				),
				accessorKey: "overallRank",
				cell: ({ row }: LeaderboardCellContext) => (
					<RankCell
						rank={row.original.overallRank}
						points={row.original.totalPoints}
					/>
				),
				sortingFn: "basic",
			},
			{
				id: "athlete",
				header: ({ column }: LeaderboardHeaderContext) => (
					<SortableHeader column={column}>{athleteColumnLabel}</SortableHeader>
				),
				accessorKey: isTeamLeaderboard ? "teamName" : "athleteName",
				cell: ({ row }: LeaderboardCellContext) => (
					<TeamCell entry={row.original} />
				),
			},
		]

		if (hasAffiliates) {
			baseColumns.push({
				id: "affiliate",
				header: ({ column }: LeaderboardHeaderContext) => (
					<SortableHeader column={column}>Affiliate</SortableHeader>
				),
				accessorKey: "affiliate",
				cell: ({ row }: LeaderboardCellContext) => (
					<span className="text-sm text-muted-foreground">
						{row.original.affiliate ?? "—"}
					</span>
				),
			})
		}

		const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

		for (const event of sortedEvents) {
			baseColumns.push({
				id: `event-${event.id}`,
				header: ({ column }: LeaderboardHeaderContext) => (
					<SortableHeader column={column}>
						<span className="truncate max-w-[100px]" title={event.name}>
							{event.name}
						</span>
					</SortableHeader>
				),
				accessorFn: (row: CompetitionLeaderboardEntry) => {
					const result = row.eventResults.find(
						(r) => r.trackWorkoutId === event.id,
					)
					return result?.rank && result.rank > 0 ? result.rank : 999
				},
				cell: ({ row }: LeaderboardCellContext) => {
					const result = row.original.eventResults.find(
						(r) => r.trackWorkoutId === event.id,
					)
					if (!result || result.rank === 0) {
						return <span className="text-muted-foreground">-</span>
					}
					return (
						<div className="flex flex-col gap-0.5">
							<span className="font-medium tabular-nums inline-flex items-center gap-1">
								{result.formattedScore}
								<PenaltyIndicator result={result} />
								{result.formattedTiebreak && (
									<span className="text-muted-foreground font-normal ml-1">
										(TB: {result.formattedTiebreak})
									</span>
								)}
							</span>
							<div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
								<span className="font-medium">#{result.rank}</span>
								<span>·</span>
								<span>{formatPoints(result.points, scoringAlgorithm)}</span>
								{result.videoUrl && (
									<Video className="h-3 w-3 ml-0.5" />
								)}
							</div>
						</div>
					)
				},
				sortingFn: "basic",
			})
		}

		return baseColumns
	}, [events, selectedEventId, isTeamLeaderboard, hasAffiliates, scoringAlgorithm])

	const validatedSorting = useMemo<SortingState>(() => {
		const columnIds = new Set(
			columns.map((c) => c.id).filter((id): id is string => Boolean(id)),
		)
		const validSorting = sorting.filter((s) => columnIds.has(s.id))

		if (validSorting.length === 0) {
			const defaultColumn = selectedEventId ? "eventRank" : "overallRank"
			return [{ id: defaultColumn, desc: false }]
		}

		return validSorting
	}, [sorting, columns, selectedEventId])

	const table = useReactTable({
		data: tableData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		state: { sorting: validatedSorting },
		onSortingChange: setSorting,
		getRowCanExpand: (row) => hasExpandableContent(row.original),
	})

	// Mobile sort options
	const sortOptions = useMemo(() => {
		const options: Array<{ id: string; label: string; scheme?: string }> = []

		if (selectedEventId) {
			const selectedEvent = events.find((e) => e.id === selectedEventId)
			options.push({ id: "eventRank", label: "Rank" })
			options.push({ id: "athlete", label: "Athlete" })
			options.push({
				id: "score",
				label: "Score",
				scheme: selectedEvent?.scheme,
			})
		} else {
			options.push({ id: "overallRank", label: "Rank" })
			options.push({ id: "athlete", label: "Athlete" })
			for (const event of events) {
				options.push({
					id: `event-${event.id}`,
					label: event.name,
					scheme: event.scheme,
				})
			}
		}

		return options
	}, [selectedEventId, events])

	const currentSortId =
		validatedSorting[0]?.id ?? (selectedEventId ? "eventRank" : "overallRank")
	const currentSortDesc = validatedSorting[0]?.desc ?? false

	const handleSortChange = (columnId: string) => {
		if (columnId === currentSortId) {
			setSorting([{ id: columnId, desc: !currentSortDesc }])
		} else {
			let defaultDesc = true

			if (columnId.includes("Rank")) {
				defaultDesc = false
			} else if (columnId === "athlete") {
				defaultDesc = false
			} else if (columnId === "score" || columnId.startsWith("event-")) {
				const option = sortOptions.find((o) => o.id === columnId)
				if (option?.scheme) {
					const sortDirection = getSortDirection(option.scheme as WorkoutScheme)
					defaultDesc = sortDirection === "desc"
				}
			}

			setSorting([{ id: columnId, desc: defaultDesc }])
		}
	}

	const toggleSortDirection = () => {
		setSorting([{ id: currentSortId, desc: !currentSortDesc }])
	}

	return (
		<div>
			{/* Mobile view */}
			<div className="md:hidden">
				<div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
					<span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground/70 shrink-0">
						Sort
					</span>
					<Select value={currentSortId} onValueChange={handleSortChange}>
						<SelectTrigger className="h-7 flex-1 text-sm font-medium">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{sortOptions.map((option) => (
								<SelectItem key={option.id} value={option.id}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0 shrink-0"
						onClick={toggleSortDirection}
						title={currentSortDesc ? "Sorted descending" : "Sorted ascending"}
					>
						{currentSortDesc ? (
							<ArrowDownNarrowWide className="h-4 w-4" />
						) : (
							<ArrowUpNarrowWide className="h-4 w-4" />
						)}
					</Button>
				</div>

				{tableData.length === 0 ? (
					<div className="p-8 text-center text-muted-foreground">
						No results yet
					</div>
				) : (
					<div>
						{tableData.map((entry) => (
							<MobileOnlineLeaderboardRow
								key={entry.registrationId}
								entry={entry}
								events={events}
								scoringAlgorithm={scoringAlgorithm}
							/>
						))}
					</div>
				)}
			</div>

			{/* Desktop view */}
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="table-row">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										style={
											header.column.getSize() !== 150
												? { width: header.column.getSize() }
												: undefined
										}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length === 0 ? (
							<TableRow className="table-row">
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center text-muted-foreground table-cell"
								>
									No results yet
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => (
								<Fragment key={row.id}>
									<TableRow
										key={row.id}
										className={cn(
											"table-row",
											row.getIsExpanded() && "border-b-0",
											hasExpandableContent(row.original) && "cursor-pointer",
										)}
										onClick={() => {
											if (hasExpandableContent(row.original)) {
												row.toggleExpanded()
											}
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="table-cell">
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
									{row.getIsExpanded() && (
										<ExpandedVideoRow
											row={row}
											selectedEventId={selectedEventId}
											columnsCount={columns.length}
										/>
									)}
								</Fragment>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	)
}
