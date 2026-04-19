/**
 * Competition Results Route
 *
 * For in-person competitions: Organizer page for entering competition results/scores.
 * For online competitions: Shows submissions overview with links to video verification.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/page.tsx
 */
// @lat: [[organizer-dashboard#Results Entry]]

import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  Video,
} from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { ResultsEntryForm } from "@/components/organizer/results/results-entry-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getEventScoreEntryDataWithHeatsFn,
  saveCompetitionScoreFn,
} from "@/server-fns/competition-score-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
  type AllEventsResultsStatusResponse,
  getDivisionResultsStatusFn,
  publishDivisionResultsFn,
} from "@/server-fns/division-results-fns"
import { getSubmissionCountsByEventFn } from "@/server-fns/video-submission-fns"
import { cn } from "@/utils/cn"
import { formatTrackOrder } from "@/utils/format-track-order"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Search params schema for event and division selection
const searchParamsSchema = z.object({
  event: z.string().optional(),
  division: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/results",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  component: ResultsPage,
  loaderDeps: ({ search }) => ({
    eventId: search.event,
    divisionId: search.division,
  }),
  loader: async ({ params, deps, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const isOnline = competition.competitionType === "online"

    // Fetch events and divisions in parallel
    const [eventsResult, divisionsResult] = await Promise.all([
      getCompetitionWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
    ])

    const events = eventsResult.workouts
    const divisions = divisionsResult.divisions

    // For online competitions, fetch submission counts in a single aggregate
    // query for every reviewable event (sub-events when present, otherwise the
    // standalone event itself) instead of materializing per-event submission
    // rows just to count them.
    if (isOnline) {
      const reviewableEventIds: string[] = []
      for (const event of events) {
        if (event.parentEventId) {
          reviewableEventIds.push(event.id)
          continue
        }
        const hasChildren = events.some((e) => e.parentEventId === event.id)
        if (!hasChildren) reviewableEventIds.push(event.id)
      }

      const submissionCounts =
        reviewableEventIds.length > 0
          ? (
              await getSubmissionCountsByEventFn({
                data: {
                  competitionId: params.competitionId,
                  trackWorkoutIds: reviewableEventIds,
                },
              })
            ).counts
          : {}

      return {
        isOnline: true as const,
        events,
        submissionCounts,
      }
    }

    // For in-person competitions, fetch score entry data
    const divisionResultsStatus = await getDivisionResultsStatusFn({
      data: {
        competitionId: params.competitionId,
        organizingTeamId: competition.organizingTeamId,
      },
    })

    // Determine which event to show (from URL or first event)
    // Filter top-level events for the dropdown (exclude sub-events)
    const topLevelEvents = events.filter((e) => !e.parentEventId)
    // Normalize: if URL points to a child event, resolve to its parent
    const requestedEvent = deps.eventId
      ? events.find((e) => e.id === deps.eventId)
      : undefined
    const selectedEventId =
      requestedEvent?.parentEventId ??
      requestedEvent?.id ??
      topLevelEvents[0]?.id

    // Check if selected event is a parent (has children)
    const childEvents = events
      .filter((e) => e.parentEventId === selectedEventId)
      .sort((a, b) => a.trackOrder - b.trackOrder)
    const isParentEvent = childEvents.length > 0

    // For parent events, load score data for ALL child events in parallel
    let childScoreDataList: Array<
      Awaited<ReturnType<typeof getEventScoreEntryDataWithHeatsFn>>
    > = []
    let scoreEntryData: Awaited<
      ReturnType<typeof getEventScoreEntryDataWithHeatsFn>
    > | null = null

    if (isParentEvent && childEvents.length > 0) {
      childScoreDataList = await Promise.all(
        childEvents.map((child) =>
          getEventScoreEntryDataWithHeatsFn({
            data: {
              competitionId: params.competitionId,
              organizingTeamId: competition.organizingTeamId,
              trackWorkoutId: child.id,
              divisionId: deps.divisionId,
            },
          }),
        ),
      )
    } else if (selectedEventId && !isParentEvent) {
      // Standalone event - load single score entry data
      const effectiveEvent = events.find((e) => e.id === selectedEventId)
      if (effectiveEvent) {
        scoreEntryData = await getEventScoreEntryDataWithHeatsFn({
          data: {
            competitionId: params.competitionId,
            organizingTeamId: competition.organizingTeamId,
            trackWorkoutId: effectiveEvent.id,
            divisionId: deps.divisionId,
          },
        })
      }
    }

    return {
      isOnline: false as const,
      events: topLevelEvents,
      divisions,
      selectedEventId,
      selectedDivisionId: deps.divisionId,
      scoreEntryData,
      childEvents,
      isParentEvent,
      childScoreDataList,
      // When called without eventId, returns AllEventsResultsStatusResponse
      divisionResultsStatus:
        divisionResultsStatus as AllEventsResultsStatusResponse,
    }
  },
})

function ResultsPage() {
  const loaderData = Route.useLoaderData()

  // Route to appropriate component based on competition type
  if (loaderData.isOnline) {
    return <OnlineSubmissionsOverview data={loaderData} />
  }

  return <InPersonResultsEntry data={loaderData} />
}

type OverviewEvent = {
  id: string
  workout: { name: string }
  trackOrder: number | string
  parentEventId: string | null
}
type CountEntry = { total: number; reviewed: number; pending: number }

const EMPTY_COUNTS: CountEntry = { total: 0, reviewed: 0, pending: 0 }

function sumCounts(entries: CountEntry[]): CountEntry {
  return entries.reduce(
    (acc, c) => ({
      total: acc.total + c.total,
      reviewed: acc.reviewed + c.reviewed,
      pending: acc.pending + c.pending,
    }),
    { ...EMPTY_COUNTS },
  )
}

/**
 * Online competition submissions overview
 * Shows all events with submission counts and links to verification pages.
 * Mirrors the volunteer review page (`/compete/$slug/review`) layout.
 */
function OnlineSubmissionsOverview({
  data,
}: {
  data: {
    isOnline: true
    events: OverviewEvent[]
    submissionCounts: Record<string, CountEntry>
  }
}) {
  const { competitionId } = Route.useParams()
  const { events, submissionCounts } = data

  // Group events into parents (no parentEventId) and their children
  const childrenByParent = new Map<string, OverviewEvent[]>()
  const topLevel: OverviewEvent[] = []
  for (const event of events) {
    if (event.parentEventId) {
      const existing = childrenByParent.get(event.parentEventId) ?? []
      existing.push(event)
      childrenByParent.set(event.parentEventId, existing)
    } else {
      topLevel.push(event)
    }
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => Number(a.trackOrder) - Number(b.trackOrder))
  }

  // Aggregate totals across every real submission bucket (children where
  // present, otherwise the standalone event).
  const eventTotals: CountEntry = sumCounts(
    topLevel.flatMap((event) => {
      const children = childrenByParent.get(event.id)
      if (children && children.length > 0) {
        return children.map((c) => submissionCounts[c.id] ?? EMPTY_COUNTS)
      }
      return [submissionCounts[event.id] ?? EMPTY_COUNTS]
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Submissions</h2>
        <p className="text-muted-foreground text-sm">
          Review athlete video submissions for each event
        </p>
      </div>

      {/* Stat strip */}
      {events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-400 sm:gap-4">
          <StatTile
            label="Events"
            value={topLevel.length}
            icon={<Video className="h-4 w-4" />}
            delay={0}
          />
          <StatTile
            label="Pending"
            value={eventTotals.pending}
            icon={<Clock3 className="h-4 w-4" />}
            tone="pending"
            delay={50}
          />
          <StatTile
            label="Reviewed"
            value={eventTotals.reviewed}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="reviewed"
            delay={100}
          />
        </div>
      )}

      {/* Event list */}
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3 animate-in fade-in-0 duration-400 delay-150">
          {topLevel.map((event, index) => {
            const children = childrenByParent.get(event.id) ?? []
            const hasChildren = children.length > 0
            const counts = hasChildren
              ? sumCounts(
                  children.map((c) => submissionCounts[c.id] ?? EMPTY_COUNTS),
                )
              : (submissionCounts[event.id] ?? EMPTY_COUNTS)

            return (
              <EventRow
                key={event.id}
                competitionId={competitionId}
                event={event}
                counts={counts}
                childEvents={children}
                childCountsMap={submissionCounts}
                index={index}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
  tone,
  delay = 0,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: "pending" | "reviewed"
  delay?: number
}) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "rounded-2xl border bg-black/5 p-4 backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-2 duration-350 dark:bg-white/5",
        tone === "pending" &&
          "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10",
        tone === "reviewed" &&
          "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10",
        !tone && "border-black/10 dark:border-white/10",
      )}
    >
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
        {icon}
        {label}
      </div>
      <div
        style={{ animationDelay: `${delay + 100}ms` }}
        className="text-3xl font-bold tabular-nums animate-in fade-in-0 duration-300"
      >
        {value}
      </div>
    </div>
  )
}

function EventRow({
  competitionId,
  event,
  counts,
  childEvents,
  childCountsMap,
  index = 0,
}: {
  competitionId: string
  event: OverviewEvent
  counts: CountEntry
  childEvents: OverviewEvent[]
  childCountsMap: Record<string, CountEntry>
  index?: number
}) {
  const hasChildren = childEvents.length > 0
  const progress = counts.total > 0 ? (counts.reviewed / counts.total) * 100 : 0
  const baseDelay = 200 + index * 60

  const Wrapper: React.ElementType = hasChildren ? "div" : Link
  const wrapperProps = hasChildren
    ? {}
    : {
        to: "/compete/organizer/$competitionId/events/$eventId/submissions",
        params: { competitionId, eventId: event.id },
      }

  return (
    <div
      style={{ animationDelay: `${baseDelay}ms` }}
      className="rounded-2xl border border-black/10 bg-black/5 p-4 backdrop-blur-md transition-colors animate-in fade-in-0 slide-in-from-bottom-2 duration-350 dark:border-white/10 dark:bg-white/5 sm:p-5"
    >
      <Wrapper
        {...wrapperProps}
        className={cn(
          "flex items-center gap-4",
          !hasChildren &&
            "group -m-1 rounded-xl p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5",
        )}
      >
        <TrackOrderChip trackOrder={event.trackOrder} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {event.workout.name}
            </h2>
            {hasChildren && (
              <Badge
                variant="secondary"
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wider"
              >
                {childEvents.length} sub-events
              </Badge>
            )}
          </div>
          <CountsLine
            counts={counts}
            hasChildren={hasChildren}
            childCount={childEvents.length}
          />
          {counts.total > 0 && (
            <div
              style={{ animationDelay: `${baseDelay + 100}ms` }}
              className="mt-3 animate-in fade-in-0 duration-400"
            >
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </div>
        {!hasChildren && (
          <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        )}
      </Wrapper>

      {hasChildren && (
        <div
          style={{ animationDelay: `${baseDelay + 150}ms` }}
          className="mt-4 space-y-1.5 border-t border-black/10 pt-4 animate-in fade-in-0 duration-300 dark:border-white/10"
        >
          {childEvents.map((child) => {
            const childCounts = childCountsMap[child.id] ?? EMPTY_COUNTS
            return (
              <Link
                key={child.id}
                to="/compete/organizer/$competitionId/events/$eventId/submissions"
                params={{ competitionId, eventId: child.id }}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="text-muted-foreground w-12 shrink-0 font-mono text-xs tabular-nums">
                  {formatTrackOrder(child.trackOrder)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {child.workout.name}
                </span>
                <ChildCountsPills counts={childCounts} />
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TrackOrderChip({ trackOrder }: { trackOrder: number | string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 font-mono text-base font-bold tabular-nums shadow-sm dark:border-white/10 dark:bg-black/30">
      {formatTrackOrder(trackOrder)}
    </div>
  )
}

function CountsLine({
  counts,
  hasChildren,
  childCount,
}: {
  counts: CountEntry
  hasChildren: boolean
  childCount: number
}) {
  if (hasChildren && counts.total === 0) {
    return (
      <p className="text-muted-foreground mt-0.5 text-sm">
        Submissions split across {childCount} sub-events
      </p>
    )
  }
  if (counts.total === 0) {
    return (
      <p className="text-muted-foreground mt-0.5 text-sm">No submissions yet</p>
    )
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {counts.pending > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <Clock3 className="h-3.5 w-3.5" />
          {counts.pending} pending
        </span>
      )}
      {counts.reviewed > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {counts.reviewed} reviewed
        </span>
      )}
      <span className="text-muted-foreground tabular-nums">
        {counts.total} total
      </span>
    </div>
  )
}

function ChildCountsPills({ counts }: { counts: CountEntry }) {
  if (counts.total === 0) {
    return (
      <span className="text-muted-foreground shrink-0 text-xs">
        No submissions
      </span>
    )
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-xs">
      {counts.pending > 0 && (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700 tabular-nums dark:text-amber-300">
          {counts.pending}
        </span>
      )}
      {counts.reviewed > 0 && (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
          {counts.reviewed}
        </span>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-12 text-center backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-400 dark:border-white/15 dark:bg-white/[0.02]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white/60 animate-in fade-in-0 zoom-in-95 duration-300 delay-100 dark:border-white/10 dark:bg-black/30">
        <Video className="text-muted-foreground h-5 w-5" />
      </div>
      <p className="font-semibold">Nothing to review yet</p>
      <p className="text-muted-foreground mt-1 text-sm">
        No events found for this competition. Add events first.
      </p>
    </div>
  )
}

/**
 * In-person competition results entry
 * Original results entry form for manual score input
 */
function InPersonResultsEntry({
  data,
}: {
  data: {
    isOnline: false
    events: Array<{
      id: string
      workout: { name: string }
      trackOrder: number
      parentEventId: string | null
    }>
    divisions: Array<{ id: string; label: string }>
    selectedEventId: string | undefined
    selectedDivisionId: string | undefined
    scoreEntryData: Awaited<
      ReturnType<typeof getEventScoreEntryDataWithHeatsFn>
    > | null
    isParentEvent: boolean
    childScoreDataList: Array<
      Awaited<ReturnType<typeof getEventScoreEntryDataWithHeatsFn>>
    >
    divisionResultsStatus: AllEventsResultsStatusResponse
  }
}) {
  const {
    events,
    divisions,
    selectedEventId,
    selectedDivisionId,
    scoreEntryData,
    divisionResultsStatus,
    isParentEvent,
    childScoreDataList,
  } = data
  const { competitionId } = Route.useParams()
  const router = useRouter()

  // Get competition from parent route for organizingTeamId
  const { competition } = parentRoute.useLoaderData()

  // Wrap server function for client-side publishing
  const publishDivisionResults = useServerFn(publishDivisionResultsFn)
  const [isPublishing, setIsPublishing] = useState(false)

  // Find the current division's publish status for the selected event
  const currentDivisionStatus =
    selectedEventId && selectedDivisionId
      ? divisionResultsStatus.events
          .find((e) => e.eventId === selectedEventId)
          ?.divisions.find((d) => d.divisionId === selectedDivisionId)
      : null

  // Handle publishing/unpublishing current division results
  const handleTogglePublish = async (publish: boolean) => {
    if (!selectedEventId || !selectedDivisionId) return

    setIsPublishing(true)
    try {
      await publishDivisionResults({
        data: {
          competitionId,
          organizingTeamId: competition.organizingTeamId,
          eventId: selectedEventId,
          divisionId: selectedDivisionId,
          publish,
        },
      })
      toast.success(
        publish
          ? "Division results published - athletes can now see results"
          : "Division results unpublished",
      )
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update results",
      )
    } finally {
      setIsPublishing(false)
    }
  }

  // Handle saving scores - wraps the server function with required params
  const handleSaveScore = useCallback(
    async (params: {
      competitionId: string
      organizingTeamId: string
      trackWorkoutId: string
      workoutId: string
      registrationId: string
      userId: string
      divisionId: string | null
      score: string
      scoreStatus: string
      tieBreakScore: string | null
      secondaryScore: string | null
      roundScores?: Array<{ score: string }>
      workout: {
        scheme: string
        scoreType: string | null
        repsPerRound: number | null
        roundsToScore: number | null
        timeCap: number | null
        tiebreakScheme: string | null
      }
    }) => {
      const result = await saveCompetitionScoreFn({
        data: {
          competitionId: params.competitionId,
          organizingTeamId: params.organizingTeamId,
          trackWorkoutId: params.trackWorkoutId,
          workoutId: params.workoutId,
          registrationId: params.registrationId,
          userId: params.userId,
          divisionId: params.divisionId,
          score: params.score,
          scoreStatus: params.scoreStatus as
            | "scored"
            | "cap"
            | "dq"
            | "withdrawn"
            | "dns"
            | "dnf",
          tieBreakScore: params.tieBreakScore,
          secondaryScore: params.secondaryScore,
          roundScores: params.roundScores,
          workout: params.workout,
        },
      })
      await router.invalidate()
      return result.data
    },
    [router],
  )

  // No events - show empty state
  if (events.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Enter Results</h2>
          <p className="text-muted-foreground text-sm">
            Enter scores for competition events
          </p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No events found for this competition. Add events first before entering
          results.
        </div>
      </div>
    )
  }

  // No score entry data for non-parent events (shouldn't happen if events exist, but handle gracefully)
  if (!isParentEvent && !scoreEntryData) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Enter Results</h2>
          <p className="text-muted-foreground text-sm">
            Enter scores for competition events
          </p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Unable to load score entry data. Please try again.
        </div>
      </div>
    )
  }

  // Athlete count for display
  const athleteCount = isParentEvent
    ? (childScoreDataList[0]?.athletes.length ?? 0)
    : (scoreEntryData?.athletes.length ?? 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Warning banner for unpublished division results */}
      {selectedDivisionId &&
        currentDivisionStatus &&
        !currentDivisionStatus.isPublished && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              Results Not Published
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Results for{" "}
                  <span className="font-medium">
                    {currentDivisionStatus.label}
                  </span>{" "}
                  are not yet published. Athletes cannot see these results.
                </span>
                <Button
                  size="sm"
                  onClick={() => handleTogglePublish(true)}
                  disabled={isPublishing}
                  className="shrink-0"
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-1.5" />
                  )}
                  Publish Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Enter Results</h2>
            {/* Published/Draft badge for selected division */}
            {selectedDivisionId && currentDivisionStatus && (
              <Badge
                className={
                  currentDivisionStatus.isPublished
                    ? "border-green-500/50 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                    : "border-gray-500/50 bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200"
                }
              >
                {currentDivisionStatus.isPublished ? (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Published
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Draft
                  </>
                )}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {athleteCount} athlete
            {athleteCount !== 1 ? "s" : ""}
            {selectedDivisionId ? " in selected division" : ""}
          </p>
        </div>

        {/* Quick publish/unpublish button when division is selected */}
        {selectedDivisionId && currentDivisionStatus && (
          <Button
            size="sm"
            variant={currentDivisionStatus.isPublished ? "outline" : "default"}
            onClick={() =>
              handleTogglePublish(!currentDivisionStatus.isPublished)
            }
            disabled={isPublishing}
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : currentDivisionStatus.isPublished ? (
              <EyeOff className="h-4 w-4 mr-1.5" />
            ) : (
              <Eye className="h-4 w-4 mr-1.5" />
            )}
            {currentDivisionStatus.isPublished ? "Unpublish" : "Publish"}{" "}
            Results
          </Button>
        )}
      </div>

      {isParentEvent && childScoreDataList.length > 0 ? (
        <ResultsEntryForm
          key={`${selectedEventId}-${selectedDivisionId}`}
          competitionId={competitionId}
          organizingTeamId={competition.organizingTeamId}
          events={events.map((e) => ({
            id: e.id,
            name: e.workout.name,
            trackOrder: e.trackOrder,
          }))}
          selectedEventId={selectedEventId}
          event={{
            ...childScoreDataList[0].event,
            workout: {
              ...childScoreDataList[0].event.workout,
              name:
                events.find((e) => e.id === selectedEventId)?.workout.name ??
                childScoreDataList[0].event.workout.name,
            },
          }}
          athletes={childScoreDataList[0].athletes}
          heats={childScoreDataList[0].heats}
          unassignedRegistrationIds={
            childScoreDataList[0].unassignedRegistrationIds
          }
          divisions={divisions.map((d) => ({
            id: d.id,
            label: d.label,
          }))}
          selectedDivisionId={selectedDivisionId}
          saveScore={handleSaveScore}
          subEventScoreData={childScoreDataList.map((child) => ({
            event: child.event,
            athletes: child.athletes,
          }))}
        />
      ) : (
        scoreEntryData && (
          <ResultsEntryForm
            key={`${selectedEventId}-${selectedDivisionId}`}
            competitionId={competitionId}
            organizingTeamId={competition.organizingTeamId}
            events={events.map((e) => ({
              id: e.id,
              name: e.workout.name,
              trackOrder: e.trackOrder,
            }))}
            selectedEventId={selectedEventId}
            event={scoreEntryData.event}
            athletes={scoreEntryData.athletes}
            heats={scoreEntryData.heats}
            unassignedRegistrationIds={scoreEntryData.unassignedRegistrationIds}
            divisions={divisions.map((d) => ({
              id: d.id,
              label: d.label,
            }))}
            selectedDivisionId={selectedDivisionId}
            saveScore={handleSaveScore}
          />
        )
      )}
    </div>
  )
}
