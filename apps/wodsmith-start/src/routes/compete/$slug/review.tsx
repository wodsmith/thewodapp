/**
 * Volunteer Video Review Layout Route
 *
 * Allows volunteers with score access entitlement to review video submissions
 * for online competition events. Gates access with the same entitlement check
 * as the score entry route.
 */

import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useChildMatches,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Video,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getCompetitionWorkoutsForScoreEntryFn } from "@/server-fns/competition-score-fns"
import { getSubmissionCountsByEventFn } from "@/server-fns/video-submission-fns"
import { canInputScoresFn } from "@/server-fns/volunteer-fns"
import { cn } from "@/utils/cn"
import { formatTrackOrder } from "@/utils/format-track-order"

export const Route = createFileRoute("/compete/$slug/review")({
  loader: async ({ params, context, parentMatchPromise }) => {
    const { slug } = params
    const session = context.session

    // Require authentication
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/${slug}/review` },
      })
    }

    // Get competition from parent
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    // Check score input entitlement (reuses same entitlement as score entry)
    const hasAccess = await canInputScoresFn({
      data: {
        userId: session.user.id,
        competitionTeamId: competition.competitionTeamId,
      },
    })

    if (!hasAccess) {
      throw redirect({
        to: "/compete/$slug",
        params: { slug },
      })
    }

    // Fetch events for this competition
    const eventsResult = await getCompetitionWorkoutsForScoreEntryFn({
      data: {
        competitionId: competition.id,
        competitionTeamId: competition.competitionTeamId,
      },
    })

    const events = eventsResult.workouts

    // Fetch submission counts for all events
    let submissionCounts: Record<
      string,
      { total: number; reviewed: number; pending: number }
    > = {}
    if (events.length > 0) {
      const countsResult = await getSubmissionCountsByEventFn({
        data: {
          competitionId: competition.id,
          trackWorkoutIds: events.map((e) => e.id),
        },
      })
      submissionCounts = countsResult.counts
    }

    return {
      competition,
      events,
      submissionCounts,
    }
  },
  component: ReviewLayout,
})

type ReviewEvent = ReturnType<typeof Route.useLoaderData>["events"][number]
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

function ReviewLayout() {
  const { competition, events, submissionCounts } = Route.useLoaderData()
  const childMatches = useChildMatches()
  const hasChildRoute = childMatches.length > 0

  if (hasChildRoute) {
    return <Outlet />
  }

  // Group events into parents (no parentEventId) and their children
  const childrenByParent = new Map<string, ReviewEvent[]>()
  const topLevel: ReviewEvent[] = []
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
    <div className="container mx-auto max-w-5xl py-6">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link to="/compete/$slug" params={{ slug: competition.slug }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">
            {competition.name}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Review Submissions
          </h1>
        </div>
      </div>

      {/* Stat strip */}
      {events.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-400 sm:gap-4">
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
                slug={competition.slug}
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
  slug,
  event,
  counts,
  childEvents,
  childCountsMap,
  index = 0,
}: {
  slug: string
  event: ReviewEvent
  counts: CountEntry
  childEvents: ReviewEvent[]
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
        to: "/compete/$slug/review/$eventId",
        params: { slug, eventId: event.id },
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
                to="/compete/$slug/review/$eventId"
                params={{ slug, eventId: child.id }}
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
        No events found for this competition.
      </p>
    </div>
  )
}
