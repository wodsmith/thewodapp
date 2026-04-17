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
  type ExpandedState,
} from "@tanstack/react-table"
import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  ArrowDownNarrowWide,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ChevronDown,
  Loader2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoEmbed } from "@/components/video-embed"
import { VideoVoteButtons } from "@/components/compete/video-vote-buttons"
import { getLeaderboardVideosFn } from "@/server-fns/video-submission-fns"
import { getVideoVoteCountsFn } from "@/server-fns/video-vote-fns"
import { useSession } from "@/utils/auth-client"
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
    parentEventId?: string | null
    parentEventName?: string | null
  }>
  selectedEventId: string | null
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

/**
 * Compact badge showing how many rounds were capped on a multi-round score.
 * Hidden for single-round and fully-scored multi-round results.
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
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
    >
      {result.cappedRoundCount}/{result.totalRoundCount} cap
    </span>
  )
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
      className="flex w-full items-center justify-between gap-1.5 text-xs uppercase tracking-wide font-medium hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting()}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ArrowUpDown
        className={cn(
          "h-3 w-3 shrink-0 transition-colors",
          sorted ? "text-foreground" : "text-muted-foreground/40",
        )}
      />
    </button>
  )
}

/** Check if an entry has expandable content (videos or penalties) for a specific event */
function hasExpandableContent(
  entry: CompetitionLeaderboardEntry,
  selectedEventId: string | null,
): boolean {
  if (!selectedEventId) return false
  return entry.eventResults.some(
    (r) =>
      r.trackWorkoutId === selectedEventId &&
      (r.videoUrl || r.penaltyType || r.isDirectlyModified),
  )
}

/** Vote counts cache type */
type VoteCounts = Record<
  string,
  { upvotes: number; downvotes: number; userVote: "upvote" | "downvote" | null }
>

/** Video data returned by the public siblings endpoint */
type LeaderboardVideo = {
  id: string
  videoIndex: number
  videoUrl: string
  athleteName: string
}

/** Hook to fetch all sibling videos for a team submission */
function useTeamVideos(videoSubmissionId: string | null, isTeam: boolean) {
  const [videos, setVideos] = useState<LeaderboardVideo[]>([])
  const [loading, setLoading] = useState(false)
  const fetchVideos = useServerFn(getLeaderboardVideosFn)

  useEffect(() => {
    if (!videoSubmissionId || !isTeam) {
      setVideos([])
      return
    }

    let cancelled = false
    setLoading(true)

    fetchVideos({ data: { videoSubmissionId } })
      .then((result) => {
        if (!cancelled) setVideos(result.videos)
      })
      .catch(() => {
        if (!cancelled) setVideos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [videoSubmissionId, isTeam, fetchVideos])

  return { videos, loading }
}

/** Single video card with embed and voting */
function VideoCard({
  videoUrl,
  videoSubmissionId,
  voteCounts,
  isOwnSubmission,
  isLoggedIn,
}: {
  videoUrl: string
  videoSubmissionId: string | null
  voteCounts: VoteCounts
  isOwnSubmission: boolean
  isLoggedIn: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg overflow-hidden border border-border/50 shadow-sm">
        <VideoEmbed url={videoUrl} />
      </div>
      {videoSubmissionId && !isOwnSubmission && (
        <VideoVoteButtons
          videoSubmissionId={videoSubmissionId}
          userVote={voteCounts[videoSubmissionId]?.userVote ?? null}
          isLoggedIn={isLoggedIn}
        />
      )}
    </div>
  )
}

/** Desktop expanded row showing videos and penalty details */
function ExpandedVideoRow({
  row,
  selectedEventId,
  columnsCount,
  voteCounts,
  isLoggedIn,
  currentUserId,
}: {
  row: Row<CompetitionLeaderboardEntry>
  selectedEventId: string | null
  columnsCount: number
  voteCounts: VoteCounts
  isLoggedIn: boolean
  currentUserId: string | null
}) {
  const entry = row.original
  const isOwnSubmission =
    currentUserId != null &&
    (entry.userId === currentUserId ||
      entry.teamMembers.some((m) => m.userId === currentUserId))

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
      <TableCell colSpan={columnsCount} className="table-cell p-0">
        <div className="border-t border-border/40 px-6 py-5">
          <div className="mx-auto max-w-2xl space-y-4">
            {resultsToShow.map((result) => (
              <div
                key={result.trackWorkoutId}
                className="rounded-xl border border-border/50 bg-background p-4 shadow-sm space-y-3"
              >
                {!selectedEventId && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {result.eventName}
                  </span>
                )}

                {/* Penalty / adjustment notices */}
                {result.penaltyType && (
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {result.penaltyType === "major" ? "Major" : "Minor"} Penalty
                    {result.penaltyPercentage != null &&
                      ` · ${result.penaltyPercentage}% deduction`}
                  </div>
                )}
                {!result.penaltyType && result.isDirectlyModified && (
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    Score adjusted by organizer
                  </div>
                )}

                {/* Video content */}
                {result.videoUrl && result.videoSubmissionId && (
                  <ExpandedVideoContent
                    result={result}
                    isTeam={entry.isTeamDivision}
                    voteCounts={voteCounts}
                    isOwnSubmission={isOwnSubmission}
                    isLoggedIn={isLoggedIn}
                  />
                )}
                {result.videoUrl && !result.videoSubmissionId && (
                  <VideoCard
                    videoUrl={result.videoUrl}
                    videoSubmissionId={null}
                    voteCounts={voteCounts}
                    isOwnSubmission={isOwnSubmission}
                    isLoggedIn={isLoggedIn}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Handles fetching team videos and rendering tabs or single video */
function ExpandedVideoContent({
  result,
  isTeam,
  voteCounts,
  isOwnSubmission,
  isLoggedIn,
}: {
  result: CompetitionLeaderboardEntry["eventResults"][number]
  isTeam: boolean
  voteCounts: VoteCounts
  isOwnSubmission: boolean
  isLoggedIn: boolean
}) {
  const { videos, loading } = useTeamVideos(
    result.videoSubmissionId,
    isTeam,
  )

  // Team with multiple videos — show tabs
  if (isTeam && videos.length > 1) {
    return (
      <Tabs defaultValue={videos[0].id} className="w-full">
        <TabsList className="h-9 w-auto gap-1 bg-muted/50 p-1">
          {videos.map((v) => (
            <TabsTrigger
              key={v.id}
              value={v.id}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {v.videoIndex === 0 ? "Captain" : `Teammate ${v.videoIndex}`}
            </TabsTrigger>
          ))}
        </TabsList>
        {videos.map((v) => (
          <TabsContent key={v.id} value={v.id} className="mt-3 animate-in fade-in-50 duration-200">
            <VideoCard
              videoUrl={v.videoUrl}
              videoSubmissionId={v.id}
              voteCounts={voteCounts}
              isOwnSubmission={isOwnSubmission}
              isLoggedIn={isLoggedIn}
            />
          </TabsContent>
        ))}
      </Tabs>
    )
  }

  // Loading state for team fetch
  if (isTeam && loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Single video (individual or team with one video)
  return (
    <VideoCard
      videoUrl={result.videoUrl!}
      videoSubmissionId={result.videoSubmissionId}
      voteCounts={voteCounts}
      isOwnSubmission={isOwnSubmission}
      isLoggedIn={isLoggedIn}
    />
  )
}

/** Mobile expandable row for online leaderboard */
function MobileOnlineLeaderboardRow({
  entry,
  events,
  scoringAlgorithm,
  voteCounts,
  isLoggedIn,
  currentUserId,
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
  voteCounts: VoteCounts
  isLoggedIn: boolean
  currentUserId: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isOwnSubmission =
    currentUserId != null &&
    (entry.userId === currentUserId ||
      entry.teamMembers.some((m) => m.userId === currentUserId))
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
          {entry.eventResults.some(
            (r) => r.penaltyType || r.isDirectlyModified,
          ) && (
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
            {sortedEvents.map((event, index) => {
              const result = entry.eventResults.find(
                (r) => r.trackWorkoutId === event.id,
              )
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
                          {result.penaltyType === "major" ? "Major" : "Minor"}{" "}
                          Penalty
                          {result.penaltyPercentage != null &&
                            ` · ${result.penaltyPercentage}% deduction`}
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
                </Fragment>
              )
            })}
          </div>

          {/* Video embeds */}
          {entry.eventResults
            .filter((r) => r.videoUrl)
            .map((result) => (
              <div key={result.trackWorkoutId} className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {result.eventName} Video
                </span>
                {result.videoSubmissionId ? (
                  <ExpandedVideoContent
                    result={result}
                    isTeam={entry.isTeamDivision}
                    voteCounts={voteCounts}
                    isOwnSubmission={isOwnSubmission}
                    isLoggedIn={isLoggedIn}
                  />
                ) : (
                  <VideoCard
                    videoUrl={result.videoUrl!}
                    videoSubmissionId={null}
                    voteCounts={voteCounts}
                    isOwnSubmission={isOwnSubmission}
                    isLoggedIn={isLoggedIn}
                  />
                )}
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
  cutoffRank,
}: OnlineCompetitionLeaderboardTableProps) {
  const session = useSession()
  const isLoggedIn = !!session?.userId
  const currentUserId = session?.userId ?? null

  const defaultSortColumn = selectedEventId ? "eventRank" : "overallRank"

  const [sorting, setSorting] = useState<SortingState>([
    { id: defaultSortColumn, desc: false },
  ])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})

  const getVoteCounts = useServerFn(getVideoVoteCountsFn)

  // Collect all video submission IDs from leaderboard data
  const videoSubmissionIds = useMemo(() => {
    const ids: string[] = []
    for (const entry of leaderboard) {
      for (const result of entry.eventResults) {
        if (result.videoSubmissionId) {
          ids.push(result.videoSubmissionId)
        }
      }
    }
    return [...new Set(ids)]
  }, [leaderboard])

  // Fetch vote counts when leaderboard data changes
  useEffect(() => {
    if (videoSubmissionIds.length === 0) {
      setVoteCounts({})
      return
    }

    let cancelled = false

    async function fetchVotes() {
      try {
        // Batch in chunks of 100 (server limit)
        const allVotes: VoteCounts = {}
        for (let i = 0; i < videoSubmissionIds.length; i += 100) {
          const chunk = videoSubmissionIds.slice(i, i + 100)
          const result = await getVoteCounts({
            data: { videoSubmissionIds: chunk },
          })
          Object.assign(allVotes, result.votes)
        }
        if (!cancelled) {
          setVoteCounts(allVotes)
        }
      } catch (err) {
        console.error("Failed to fetch vote counts:", err)
      }
    }

    fetchVotes()
    return () => {
      cancelled = true
    }
  }, [videoSubmissionIds, getVoteCounts])

  useEffect(() => {
    const validSortColumn = selectedEventId ? "eventRank" : "overallRank"
    setSorting([{ id: validSortColumn, desc: false }])
    setExpanded({})
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
            <span title={event.name}>{event.name}</span>
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
                <CappedRoundsIndicator result={result} />
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
                {result.videoUrl && <Video className="h-3 w-3 ml-0.5" />}
              </div>
            </div>
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

  // Compute parent event group spans for the header row
  const parentGroupSpans = useMemo(() => {
    if (selectedEventId) return []

    const sortedEvents = [...events].sort(
      (a, b) => a.trackOrder - b.trackOrder,
    )
    const hasAnyParent = sortedEvents.some((e) => e.parentEventId)
    if (!hasAnyParent) return []

    // Count leading non-event columns (rank, athlete, optionally affiliate)
    const leadingCols = hasAffiliates ? 3 : 2

    const groups: Array<{
      label: string | null
      colSpan: number
    }> = []

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
    getExpandedRowModel: getExpandedRowModel(),
    state: { sorting: validatedSorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: (row) =>
      hasExpandableContent(row.original, selectedEventId),
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
            {tableData.map((entry, idx) => {
              const nextEntry = tableData[idx + 1]
              const showCutoff =
                cutoffRank != null &&
                !selectedEventId &&
                entry.overallRank <= cutoffRank &&
                (!nextEntry || nextEntry.overallRank > cutoffRank)
              return (
                <Fragment key={entry.registrationId}>
                  <MobileOnlineLeaderboardRow
                    entry={entry}
                    events={events}
                    scoringAlgorithm={scoringAlgorithm}
                    voteCounts={voteCounts}
                    isLoggedIn={isLoggedIn}
                    currentUserId={currentUserId}
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

      {/* Desktop view */}
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
                    <TableRow
                      className={cn(
                        "table-row",
                        row.getIsExpanded() && "border-b-0",
                        hasExpandableContent(row.original, selectedEventId) &&
                          "cursor-pointer",
                      )}
                      onClick={() => {
                        if (
                          hasExpandableContent(row.original, selectedEventId)
                        ) {
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
                        voteCounts={voteCounts}
                        isLoggedIn={isLoggedIn}
                        currentUserId={currentUserId}
                      />
                    )}
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
