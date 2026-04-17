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
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ChevronDown,
  Medal,
  Trophy,
} from "lucide-react"
import { Fragment, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

interface CompetitionLeaderboardTableProps {
  leaderboard: CompetitionLeaderboardEntry[]
  events: Array<{
    id: string
    name: string
    trackOrder: number
    scheme: string
    parentEventId?: string | null
    parentEventName?: string | null
  }>
  selectedEventId: string | null // null = overall view
  scoringAlgorithm: ScoringAlgorithm
  cutoffRank: number | null
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

/**
 * Format points display based on scoring algorithm
 * - Online scoring: show raw points (lower is better)
 * - P-Score: show raw points (can be negative)
 * - Other algorithms: show "+points" for positive (higher is better)
 */
function formatPoints(points: number, algorithm: ScoringAlgorithm): string {
  // Online and p_score show raw points
  if (algorithm === "online" || algorithm === "p_score") {
    return String(points)
  }
  // Don't add + to negative numbers
  if (points < 0) {
    return String(points)
  }
  return `+${points}`
}

/**
 * Badge showing how many individual rounds were capped for a multi-round score.
 * Hidden for single-round scores and for scores with zero capped rounds.
 */
function CappedRoundsIndicator({
  result,
}: {
  result: CompetitionLeaderboardEntry["eventResults"][number]
}) {
  if (result.totalRoundCount <= 1) return null
  if (result.cappedRoundCount <= 0) return null

  const allCapped = result.cappedRoundCount === result.totalRoundCount
  const label = allCapped
    ? `All ${result.totalRoundCount} rounds capped`
    : `${result.cappedRoundCount}/${result.totalRoundCount} rounds capped`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          aria-label={label}
        >
          {result.cappedRoundCount}/{result.totalRoundCount} cap
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[240px] p-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          At least one round hit the per-round time cap. The summed total
          above includes penalty time from each capped round.
        </p>
      </PopoverContent>
    </Popover>
  )
}

/** Clickable icon for any score modification (penalty or direct adjust) */
function PenaltyIndicator({
  result,
}: {
  result: CompetitionLeaderboardEntry["eventResults"][number]
}) {
  if (!result.penaltyType && !result.isDirectlyModified) return null

  const label = result.penaltyType
    ? `${result.penaltyType === "major" ? "Major" : "Minor"} Penalty`
    : "Score Adjusted"

  const detail =
    result.penaltyPercentage != null
      ? `${result.penaltyPercentage}% deduction applied`
      : "This score was modified by an organizer."

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
          aria-label={label}
        >
          <AlertTriangle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[220px] p-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
      </PopoverContent>
    </Popover>
  )
}

function EventResultCell({
  result,
  scoringAlgorithm,
}: {
  result: CompetitionLeaderboardEntry["eventResults"][number]
  scoringAlgorithm: ScoringAlgorithm
}) {
  if (result.rank === 0) {
    return <span className="text-muted-foreground italic">—</span>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Primary: Score value - medium weight for emphasis */}
      <span className="font-medium tabular-nums inline-flex items-center gap-1">
        {result.formattedScore}
        <CappedRoundsIndicator result={result} />
        <PenaltyIndicator result={result} />
        {result.formattedTiebreak && (
          <span className="text-muted-foreground font-normal ml-1">
            (TB: {result.formattedTiebreak})
          </span>
        )}
      </span>
      {/* Secondary: Rank & points - lighter, smaller */}
      <span className="text-xs text-muted-foreground tabular-nums">
        <span className="font-medium">#{result.rank}</span>
        <span className="mx-1">·</span>
        <span>{formatPoints(result.points, scoringAlgorithm)}</span>
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
  const name =
    `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"
  return member.isCaptain ? `${name} (C)` : name
}

/** Team cell for team divisions - shows team name with members underneath */
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

/** Mobile expandable row for leaderboard */
function MobileLeaderboardRow({
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
    parentEventId?: string | null
    parentEventName?: string | null
  }>
  scoringAlgorithm: ScoringAlgorithm
}) {
  const [isOpen, setIsOpen] = useState(false)
  const icon = getRankIcon(entry.overallRank)
  const isPodium = entry.overallRank <= 3

  // Sort events by trackOrder - memoized to avoid re-sorting on every render
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
          {/* Rank with icon */}
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
            {sortedEvents.map((event, index) => {
              const result = entry.eventResults.find(
                (r) => r.trackWorkoutId === event.id,
              )
              // Show parent group header when the parent changes
              const prevEvent = index > 0 ? sortedEvents[index - 1] : null
              const showParentHeader =
                event.parentEventName &&
                event.parentEventId !== prevEvent?.parentEventId
              return (
                <Fragment key={event.id}>
                  {showParentHeader && (
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {event.parentEventName}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground/70">
                    {event.name}
                  </span>
                  {result && result.rank > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium tabular-nums inline-flex items-center gap-1">
                        {result.formattedScore}
                        <CappedRoundsIndicator result={result} />
                        <PenaltyIndicator result={result} />
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
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </div>
                </Fragment>
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
  scoringAlgorithm,
  cutoffRank,
}: CompetitionLeaderboardTableProps) {
  // Compute the correct default sort column based on view mode
  const defaultSortColumn = selectedEventId ? "eventRank" : "overallRank"

  const [sorting, setSorting] = useState<SortingState>([
    { id: defaultSortColumn, desc: false },
  ])

  // Reset sorting when view changes between overall and single event
  useEffect(() => {
    // Ensure sorting column exists in current view
    const validSortColumn = selectedEventId ? "eventRank" : "overallRank"
    setSorting([{ id: validSortColumn, desc: false }])
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

  // Show affiliate column only when at least one entry has an affiliate
  const hasAffiliates = useMemo(
    () => leaderboard.some((entry) => entry.affiliate),
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
          accessorFn: (row: CompetitionLeaderboardEntry) => {
            const result = row.eventResults.find(
              (r) => r.trackWorkoutId === selectedEventId,
            )
            // No result or rank 0 sorts to bottom
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
                <CappedRoundsIndicator result={result} />
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
      ]
    }

    // Overall view with all events
    const baseColumns: ColumnDef<CompetitionLeaderboardEntry>[] = [
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

    // Add event columns sorted by trackOrder
    const sortedEvents = [...events].sort((a, b) => a.trackOrder - b.trackOrder)

    for (const event of sortedEvents) {
      baseColumns.push({
        id: `event-${event.id}`,
        header: ({ column }: LeaderboardHeaderContext) => (
          <SortableHeader column={column}>{event.name}</SortableHeader>
        ),
        accessorFn: (row: CompetitionLeaderboardEntry) => {
          const result = row.eventResults.find(
            (r) => r.trackWorkoutId === event.id,
          )
          // No result or rank 0 sorts to bottom
          return result?.rank && result.rank > 0 ? result.rank : 999
        },
        cell: ({ row }: LeaderboardCellContext) => {
          const result = row.original.eventResults.find(
            (r) => r.trackWorkoutId === event.id,
          )
          if (!result) {
            return <span className="text-muted-foreground">-</span>
          }
          return (
            <EventResultCell
              result={result}
              scoringAlgorithm={scoringAlgorithm}
            />
          )
        },
        sortingFn: "basic",
      })
    }

    return baseColumns
  }, [
    events,
    selectedEventId,
    isTeamLeaderboard,
    hasAffiliates,
    scoringAlgorithm,
  ])

  // Ensure sorting state only references columns that exist
  // This prevents errors when switching between overall and single event views
  const validatedSorting = useMemo<SortingState>(() => {
    const columnIds = new Set(
      columns.map((c) => c.id).filter((id): id is string => Boolean(id)),
    )
    const validSorting = sorting.filter((s) => columnIds.has(s.id))

    // If no valid sorting, use default for current view
    if (validSorting.length === 0) {
      const defaultColumn = selectedEventId ? "eventRank" : "overallRank"
      return [{ id: defaultColumn, desc: false }]
    }

    return validSorting
  }, [sorting, columns, selectedEventId])

  // Compute parent event group spans for the header row.
  // Each group is a consecutive run of events sharing the same parentEventId.
  const parentGroupSpans = useMemo(() => {
    if (selectedEventId) return [] // No group headers in single-event view

    const sortedEvents = [...events].sort(
      (a, b) => a.trackOrder - b.trackOrder,
    )
    // Count leading non-event columns (rank, athlete, optionally affiliate)
    const leadingCols = hasAffiliates ? 3 : 2
    const hasAnyParent = sortedEvents.some((e) => e.parentEventId)
    if (!hasAnyParent) return []

    const groups: Array<{
      label: string | null
      colSpan: number
    }> = []

    // Add placeholder spans for leading columns
    groups.push({ label: null, colSpan: leadingCols })

    let currentParentId: string | null | undefined
    let currentSpan = 0
    let currentName: string | null = null

    for (const event of sortedEvents) {
      const pid = event.parentEventId ?? null
      if (pid === currentParentId) {
        currentSpan++
      } else {
        if (currentSpan > 0) {
          groups.push({ label: currentName, colSpan: currentSpan })
        }
        currentParentId = pid
        currentName = event.parentEventName ?? null
        currentSpan = 1
      }
    }
    if (currentSpan > 0) {
      groups.push({ label: currentName, colSpan: currentSpan })
    }

    return groups
  }, [events, selectedEventId, hasAffiliates])

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: validatedSorting },
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
      options.push({
        id: "score",
        label: "Score",
        scheme: selectedEvent?.scheme,
      })
    } else {
      // Overall view - rank (by points) is the primary sort
      options.push({ id: "overallRank", label: "Rank" })
      options.push({ id: "athlete", label: "Athlete" })
      // Add event columns with their schemes
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
          const sortDirection = getSortDirection(option.scheme as WorkoutScheme)
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
            {tableData.map((entry, idx) => {
              const nextEntry = tableData[idx + 1]
              const showCutoff =
                cutoffRank != null &&
                !selectedEventId &&
                entry.overallRank <= cutoffRank &&
                (!nextEntry || nextEntry.overallRank > cutoffRank)
              return (
                <Fragment key={entry.registrationId}>
                  <MobileLeaderboardRow
                    entry={entry}
                    events={events}
                    scoringAlgorithm={scoringAlgorithm}
                  />
                  {showCutoff && (
                    <div className="h-[3px] bg-orange-500" />
                  )}
                </Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop view - full table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            {parentGroupSpans.length > 0 && (
              <TableRow className="table-row border-b-0">
                {parentGroupSpans.map((group, i) => (
                  <TableHead
                    key={`group-${i}`}
                    colSpan={group.colSpan}
                    className={cn(
                      "text-center py-1 h-auto",
                      group.label
                        ? "text-[11px] uppercase tracking-wide font-semibold text-muted-foreground bg-muted/40 border-x border-t rounded-t-sm"
                        : "border-b-0",
                    )}
                  >
                    {group.label}
                  </TableHead>
                ))}
              </TableRow>
            )}
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
              table.getRowModel().rows.map((row, rowIdx) => {
                const entry = row.original
                const rows = table.getRowModel().rows
                const nextRow = rows[rowIdx + 1]
                const showCutoff =
                  cutoffRank != null &&
                  !selectedEventId &&
                  entry.overallRank <= cutoffRank &&
                  (!nextRow || nextRow.original.overallRank > cutoffRank)
                return (
                  <Fragment key={row.id}>
                    <TableRow className="table-row">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="table-cell">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {showCutoff && (
                      <tr>
                        <td colSpan={columns.length} className="p-0">
                          <div className="h-[3px] bg-orange-500" />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
