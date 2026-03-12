"use client"

import {
	type CellContext,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type HeaderContext,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import {
	ArrowDownNarrowWide,
	ArrowUpDown,
	ArrowUpNarrowWide,
	Medal,
	Trophy,
} from "lucide-react"
import { useMemo, useState } from "react"
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
import { cn } from "@/lib/utils"
import type { SeriesLeaderboardEntry } from "@/server-fns/series-leaderboard-fns"
import type { ScoringAlgorithm } from "@/types/scoring"

type CellCtx = CellContext<SeriesLeaderboardEntry, unknown>
type HeaderCtx = HeaderContext<SeriesLeaderboardEntry, unknown>

interface Props {
	entries: SeriesLeaderboardEntry[]
	seriesEvents: Array<{ workoutId: string; name: string; scheme: string }>
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
	return (
		<div className="flex flex-col gap-0.5">
			<div className="flex items-center gap-1.5">
				{icon}
				<span
					className={cn(
						"tabular-nums",
						rank <= 3 ? "font-bold text-base" : "font-semibold",
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
	result: SeriesLeaderboardEntry["eventResults"][number]
}) {
	if (result.rank === 0) {
		return <span className="text-muted-foreground italic">—</span>
	}
	return (
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
	column: {
		getIsSorted: () => false | "asc" | "desc"
		toggleSorting: () => void
	}
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-medium hover:text-foreground transition-colors"
			onClick={() => column.toggleSorting()}
		>
			{children}
			<ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
		</button>
	)
}

export function SeriesLeaderboardTable({
	entries,
	seriesEvents,
	scoringAlgorithm: _scoringAlgorithm,
}: Props) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "overallRank", desc: false },
	])

	const columns = useMemo<ColumnDef<SeriesLeaderboardEntry>[]>(() => {
		const cols: ColumnDef<SeriesLeaderboardEntry>[] = [
			{
				id: "overallRank",
				header: ({ column }: HeaderCtx) => (
					<SortableHeader column={column}>Rank</SortableHeader>
				),
				accessorKey: "overallRank",
				cell: ({ row }: CellCtx) => (
					<RankCell
						rank={row.original.overallRank}
						points={row.original.totalPoints}
					/>
				),
				sortingFn: "basic",
			},
			{
				id: "athlete",
				header: "Athlete",
				accessorKey: "athleteName",
				cell: ({ row }: CellCtx) => {
					const entry = row.original
					if (entry.isTeamDivision) {
						return (
							<div className="flex flex-col gap-0.5">
								<span className="font-medium">
									{entry.teamName || "Unknown Team"}
								</span>
							</div>
						)
					}
					return <span className="font-medium">{entry.athleteName}</span>
				},
			},
			{
				id: "competition",
				header: "Throwdown",
				accessorKey: "competitionName",
				cell: ({ row }: CellCtx) => (
					<span className="text-sm text-muted-foreground">
						{row.original.competitionName}
					</span>
				),
			},
		]

		for (const event of seriesEvents) {
			cols.push({
				id: `event-${event.workoutId}`,
				header: ({ column }: HeaderCtx) => (
					<SortableHeader column={column}>
						<span className="truncate max-w-[100px]" title={event.name}>
							{event.name}
						</span>
					</SortableHeader>
				),
				accessorFn: (row: SeriesLeaderboardEntry) => {
					const r = row.eventResults.find(
						(er) => er.workoutId === event.workoutId,
					)
					return r?.rank && r.rank > 0 ? r.rank : 999
				},
				cell: ({ row }: CellCtx) => {
					const r = row.original.eventResults.find(
						(er) => er.workoutId === event.workoutId,
					)
					if (!r) return <span className="text-muted-foreground">—</span>
					return <EventResultCell result={r} />
				},
				sortingFn: "basic",
			})
		}

		return cols
	}, [seriesEvents])

	const table = useReactTable({
		data: entries,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		state: { sorting },
		onSortingChange: setSorting,
	})

	const sortOptions = useMemo(() => {
		const opts: Array<{ id: string; label: string }> = [
			{ id: "overallRank", label: "Rank" },
			{ id: "athlete", label: "Athlete" },
			{ id: "competition", label: "Throwdown" },
			...seriesEvents.map((e) => ({ id: `event-${e.workoutId}`, label: e.name })),
		]
		return opts
	}, [seriesEvents])

	const currentSortId = sorting[0]?.id ?? "overallRank"
	const currentSortDesc = sorting[0]?.desc ?? false

	return (
		<div>
			{/* Mobile sort controls */}
			<div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
				<span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground/70 shrink-0">
					Sort
				</span>
				<Select
					value={currentSortId}
					onValueChange={(id) =>
						setSorting([{ id, desc: id === "overallRank" ? false : true }])
					}
				>
					<SelectTrigger className="h-7 flex-1 text-sm font-medium">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{sortOptions.map((o) => (
							<SelectItem key={o.id} value={o.id}>
								{o.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 w-7 p-0"
					onClick={() =>
						setSorting([{ id: currentSortId, desc: !currentSortDesc }])
					}
				>
					{currentSortDesc ? (
						<ArrowDownNarrowWide className="h-4 w-4" />
					) : (
						<ArrowUpNarrowWide className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Mobile list */}
			<div className="md:hidden">
				{entries.length === 0 ? (
					<div className="p-8 text-center text-muted-foreground">
						No results yet
					</div>
				) : (
					table.getRowModel().rows.map((row) => {
						const entry = row.original
						return (
							<div
								key={row.id}
								className="flex items-center gap-3 p-3 border-b"
							>
								<div className="flex items-center gap-1.5 w-12 shrink-0">
									{getRankIcon(entry.overallRank)}
									<span
										className={cn(
											"tabular-nums",
											entry.overallRank <= 3 ? "font-bold" : "font-semibold",
										)}
									>
										{entry.overallRank}
									</span>
								</div>
								<div className="flex-1 min-w-0">
									<span className="font-medium truncate block">
										{entry.isTeamDivision && entry.teamName
											? entry.teamName
											: entry.athleteName}
									</span>
									<span className="text-xs text-muted-foreground truncate block">
										{entry.competitionName}
									</span>
								</div>
								<span className="text-xs text-muted-foreground tabular-nums shrink-0">
									{entry.totalPoints} pts
								</span>
							</div>
						)
					})
				)}
			</div>

			{/* Desktop table */}
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((hg) => (
							<TableRow key={hg.id} className="table-row">
								{hg.headers.map((h) => (
									<TableHead key={h.id}>
										{h.isPlaceholder
											? null
											: flexRender(
													h.column.columnDef.header,
													h.getContext(),
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
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
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
