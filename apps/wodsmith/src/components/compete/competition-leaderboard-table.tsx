"use client"

import {
	type ColumnDef,
	type SortingState,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table"
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Medal, Trophy, ArrowUpDown, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import type { CompetitionLeaderboardEntry, TeamMemberInfo } from "@/server/competition-leaderboard"
import { getSortDirection } from "@/lib/scoring"

interface CompetitionLeaderboardTableProps {
	leaderboard: CompetitionLeaderboardEntry[]
	events: Array<{ id: string; name: string; trackOrder: number; scheme: string }>
	selectedEventId: string | null // null = overall view
}

// Note: Sort direction is now determined by getSortDirection() from @/lib/scoring

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

function EventResultCell({
	result,
}: {
	result: CompetitionLeaderboardEntry["eventResults"][number]
}) {
	if (result.rank === 0) {
		return <span className="text-muted-foreground italic">—</span>
	}

	return (
		<div className="flex flex-col gap-0.5">
			{/* Primary: Score value - medium weight for emphasis */}
			<span className="font-medium tabular-nums">{result.formattedScore}</span>
			{/* Secondary: Rank & points - lighter, smaller */}
			<span className="text-xs text-muted-foreground tabular-nums">
				<span className="font-medium">#{result.rank}</span>
				<span className="mx-1">·</span>
				<span>+{result.points}</span>
			</span>
		</div>
	)
}

function SortableHeader({
	column,
	children,
}: {
	column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: () => void }
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

/** Format member name with optional captain indicator */
function formatMemberName(member: TeamMemberInfo): string {
	const name = `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"
	return member.isCaptain ? `${name} (C)` : name
}

/** Team cell for team divisions - shows team name with members underneath */
function TeamCell({ entry }: { entry: CompetitionLeaderboardEntry }) {
	if (!entry.isTeamDivision) {
		return <span className="font-medium">{entry.athleteName}</span>
	}

	return (
		<div className="flex flex-col gap-0.5">
			<span className="font-medium">{entry.teamName || "Unknown Team"}</span>
			{entry.teamMembers.length > 0 && (
				<span className="text-[10px] text-muted-foreground leading-tight">
					{entry.teamMembers.map((m) => formatMemberName(m)).join(", ")}
				</span>
			)}
		</div>
	)
}

/** Mobile expandable row for leaderboard */
function MobileLeaderboardRow({
	entry,
	events,
}: {
	entry: CompetitionLeaderboardEntry
	events: Array<{ id: string; name: string; trackOrder: number; scheme: string }>
}) {
	const [isOpen, setIsOpen] = useState(false)
	const icon = getRankIcon(entry.overallRank)
	const isPodium = entry.overallRank <= 3

	// Sort events by trackOrder
	const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="w-full flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors text-left"
				>
					{/* Rank with icon */}
					<div className="flex items-center gap-1.5 w-12 shrink-0">
						{icon}
						<span className={cn("tabular-nums", isPodium ? "font-bold" : "font-semibold")}>
							{entry.overallRank}
						</span>
					</div>

					{/* Points */}
					<div className="w-14 shrink-0">
						<span className="text-xs text-muted-foreground tabular-nums">
							{entry.totalPoints} pts
						</span>
					</div>

					{/* Athlete/Team name - takes remaining space, right-aligned */}
					<div className="flex-1 min-w-0 text-right">
						{entry.isTeamDivision ? (
							<>
								<span className="font-medium truncate block">{entry.teamName || "Unknown Team"}</span>
								{entry.teamMembers.length > 0 && (
									<span className="text-[10px] text-muted-foreground truncate block">
										{entry.teamMembers.map((m) => formatMemberName(m)).join(", ")}
									</span>
								)}
							</>
						) : (
							<span className="font-medium truncate block">{entry.athleteName}</span>
						)}
					</div>

					{/* Expand indicator */}
					<ChevronDown
						className={cn(
							"h-4 w-4 text-muted-foreground shrink-0 transition-transform",
							isOpen && "rotate-180",
						)}
					/>
				</button>
			</CollapsibleTrigger>

			<CollapsibleContent>
				<div className="bg-muted/30 px-3 py-2 border-b">
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
										<div className="flex items-baseline gap-2">
											<span className="font-medium tabular-nums">
												{result.formattedScore}
											</span>
											<span className="text-xs text-muted-foreground tabular-nums">
												#{result.rank} +{result.points}
											</span>
										</div>
									) : (
										<span className="text-muted-foreground italic">—</span>
									)}
								</div>
							)
						})}
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

export function CompetitionLeaderboardTable({
	leaderboard,
	events,
	selectedEventId,
}: CompetitionLeaderboardTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: selectedEventId ? "eventRank" : "overallRank", desc: false },
	])

	// Reset sorting when view changes between overall and single event
	// biome-ignore lint/correctness/useExhaustiveDependencies: we only want to reset on selectedEventId change
	useEffect(() => {
		setSorting([{ id: selectedEventId ? "eventRank" : "overallRank", desc: false }])
	}, [selectedEventId])

	// Transform data for single event view
	const tableData = useMemo(() => {
		if (!selectedEventId) {
			return leaderboard
		}

		// For single event view, sort by that event's rank
		return [...leaderboard].sort((a, b) => {
			const aResult = a.eventResults.find(
				(r) => r.trackWorkoutId === selectedEventId,
			)
			const bResult = b.eventResults.find(
				(r) => r.trackWorkoutId === selectedEventId,
			)

			// No result sorts to bottom
			if (!aResult || aResult.rank === 0) return 1
			if (!bResult || bResult.rank === 0) return -1

			return aResult.rank - bResult.rank
		})
	}, [leaderboard, selectedEventId])

	// Determine if this is a team division leaderboard
	const isTeamLeaderboard = useMemo(
		() => leaderboard.some((entry) => entry.isTeamDivision),
		[leaderboard],
	)

	// Build columns dynamically based on view mode
	const columns = useMemo<ColumnDef<CompetitionLeaderboardEntry>[]>(() => {
		// Column header label: "Team" for team divisions, "Athlete" for individual
		const athleteColumnLabel = isTeamLeaderboard ? "Team" : "Athlete"

		if (selectedEventId) {
			// Single event view
			return [
			{
				id: "eventRank",
				header: "Rank",
				accessorFn: (row) => {
					const result = row.eventResults.find(
						(r) => r.trackWorkoutId === selectedEventId,
					)
					// No result or rank 0 sorts to bottom
					return result?.rank && result.rank > 0 ? result.rank : 999
				},
					cell: ({ row }) => {
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
					cell: ({ row }) => <TeamCell entry={row.original} />,
				},
				{
					id: "score",
					header: "Score",
					accessorFn: (row) => {
						const result = row.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						return result?.formattedScore ?? ""
					},
					cell: ({ row }) => {
						const result = row.original.eventResults.find(
							(r) => r.trackWorkoutId === selectedEventId,
						)
						if (!result || result.rank === 0) {
							return <span className="text-muted-foreground italic">—</span>
						}
						return <span className="font-medium tabular-nums">{result.formattedScore}</span>
					},
				},
			]
		}

		// Overall view with all events
		const baseColumns: ColumnDef<CompetitionLeaderboardEntry>[] = [
			{
				id: "overallRank",
				header: ({ column }) => (
					<SortableHeader column={column}>Rank</SortableHeader>
				),
				accessorKey: "overallRank",
				cell: ({ row }) => (
					<RankCell
						rank={row.original.overallRank}
						points={row.original.totalPoints}
					/>
				),
				sortingFn: "basic",
			},
			{
				id: "athlete",
				header: ({ column }) => (
					<SortableHeader column={column}>{athleteColumnLabel}</SortableHeader>
				),
				accessorKey: isTeamLeaderboard ? "teamName" : "athleteName",
				cell: ({ row }) => <TeamCell entry={row.original} />,
			},
		]

		// Add event columns sorted by trackOrder
		const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

		for (const event of sortedEvents) {
			baseColumns.push({
				id: `event-${event.id}`,
				header: ({ column }) => (
					<SortableHeader column={column}>
						<span className="truncate max-w-[100px]" title={event.name}>
							{event.name}
						</span>
					</SortableHeader>
				),
				accessorFn: (row) => {
					const result = row.eventResults.find(
						(r) => r.trackWorkoutId === event.id,
					)
					// No result or rank 0 sorts to bottom
					return result?.rank && result.rank > 0 ? result.rank : 999
				},
				cell: ({ row }) => {
					const result = row.original.eventResults.find(
						(r) => r.trackWorkoutId === event.id,
					)
					if (!result) {
						return <span className="text-muted-foreground">-</span>
					}
					return <EventResultCell result={result} />
				},
				sortingFn: "basic",
			})
		}

		return baseColumns
	}, [events, selectedEventId, isTeamLeaderboard])

	const table = useReactTable({
		data: tableData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		state: { sorting },
		onSortingChange: setSorting,
	})

	// Build sort options for mobile (include scheme for smart defaults)
	const sortOptions = useMemo(() => {
		const options: Array<{ id: string; label: string; scheme?: string }> = []

		if (selectedEventId) {
			// Single event view - rank is the primary sort
			const selectedEvent = events.find((e) => e.id === selectedEventId)
			options.push({ id: "eventRank", label: "Rank" })
			options.push({ id: "athlete", label: "Athlete" })
			options.push({ id: "score", label: "Score", scheme: selectedEvent?.scheme })
		} else {
			// Overall view - rank (by points) is the primary sort
			options.push({ id: "overallRank", label: "Rank" })
			options.push({ id: "athlete", label: "Athlete" })
			// Add event columns with their schemes
			for (const event of events) {
				options.push({ id: `event-${event.id}`, label: event.name, scheme: event.scheme })
			}
		}

		return options
	}, [selectedEventId, events])

	const currentSortId = sorting[0]?.id ?? (selectedEventId ? "eventRank" : "overallRank")
	const currentSortDesc = sorting[0]?.desc ?? false

	const handleSortChange = (columnId: string) => {
		// If clicking the same column, toggle direction
		if (columnId === currentSortId) {
			setSorting([{ id: columnId, desc: !currentSortDesc }])
		} else {
			// New column - determine default based on type
			let defaultDesc = true // Default: descending (higher is better)

			if (columnId.includes("Rank")) {
				// Rank: ascending (1st place first)
				defaultDesc = false
			} else if (columnId === "athlete") {
				// Athlete: alphabetical ascending
				defaultDesc = false
			} else if (columnId === "score" || columnId.startsWith("event-")) {
				// Score/Event: check scheme - time-based is ascending (lower is better)
				const option = sortOptions.find((o) => o.id === columnId)
				if (option?.scheme) {
					const sortDirection = getSortDirection(option.scheme as any)
					defaultDesc = sortDirection === "desc" // desc = higher is better
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
			{/* Mobile view - expandable list */}
			<div className="md:hidden">
				{/* Mobile sort controls */}
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

				{/* Mobile list */}
				{tableData.length === 0 ? (
					<div className="p-8 text-center text-muted-foreground">
						No results yet
					</div>
				) : (
					<div>
						{tableData.map((entry) => (
							<MobileLeaderboardRow
								key={entry.registrationId}
								entry={entry}
								events={events}
							/>
						))}
					</div>
				)}
			</div>

			{/* Desktop view - full table */}
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="table-row">
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
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
								<TableRow key={row.id} className="table-row">
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id} className="table-cell">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	)
}
