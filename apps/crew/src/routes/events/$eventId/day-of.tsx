// @lat: [[crew#Day Of Operations Board]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  RadioTower,
  UserCheck,
  UserX,
} from "lucide-react"
import type { ReactNode } from "react"
import type {
  CrewDayOfBlockSummary,
  CrewDayOfCriticalGap,
  CrewDayOfResponseQueueItem,
} from "@/lib/crew/day-of-operations"
import { formatCrewValue } from "@/lib/crew-event-display"
import { getCrewDayOfOperationsPageFn } from "@/server-fns/crew-day-of-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/day-of")({
  loader: async ({ params }) =>
    await getCrewDayOfOperationsPageFn({
      data: { eventId: params.eventId },
    }),
  component: EventDayOfOperationsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventDayOfOperationsPage() {
  const { eventId } = parentRoute.useParams()
  const { event, board, sources } = Route.useLoaderData()
  const timezone = event.timezone ?? "America/Denver"
  const leadBlocks =
    board.currentBlocks.length > 0 ? board.currentBlocks : board.nextBlocks
  const visibleTimeBlocks = board.timeBlocks
    .filter((block) => block.timing !== "past")
    .slice(0, 12)

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Day-of operations</h2>
          <p className="text-sm text-muted-foreground">
            {formatGeneratedAt(board.generatedAt, timezone)} / {timezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/events/$eventId/shifts"
            params={{ eventId }}
            className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <UserCheck className="size-4" />
            Shifts
          </Link>
          <Link
            to="/events/$eventId/judges"
            params={{ eventId }}
            className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RadioTower className="size-4" />
            Judges
          </Link>
          <Link
            to="/events/$eventId/staffing"
            params={{ eventId }}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <AlertTriangle className="size-4" />
            Staffing
          </Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        <MetricPanel
          label="Open roles"
          value={board.summary.openRoles}
          tone={board.summary.openRoles > 0 ? "critical" : "covered"}
        />
        <MetricPanel
          label="Responses due"
          value={board.summary.noResponsesDueSoon}
          tone={board.summary.noResponsesDueSoon > 0 ? "warning" : "covered"}
        />
        <MetricPanel
          label="Declines / changes"
          value={board.summary.decisionNeeded}
          tone={board.summary.decisionNeeded > 0 ? "critical" : "covered"}
        />
        <MetricPanel
          label="No-show / replaced"
          value={board.summary.noShowOrReplaced}
          tone={board.summary.noShowOrReplaced > 0 ? "critical" : "covered"}
        />
        <MetricPanel
          label="Judge lanes open"
          value={board.judgeCoverage.openLanes}
          tone={board.judgeCoverage.openLanes > 0 ? "critical" : "covered"}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                {board.currentBlocks.length > 0 ? "Now" : "Next"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {board.currentBlocks.length} current / {board.nextBlocks.length}{" "}
                next
              </p>
            </div>
            <Clock3 className="size-5 text-muted-foreground" />
          </div>

          {leadBlocks.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {leadBlocks.map((block) => (
                <BlockPanel
                  key={block.timeBlockId}
                  block={block}
                  timezone={timezone}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No scheduled shift or heat blocks are active or upcoming." />
          )}
        </section>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">State tracking</h3>
              <p className="text-sm text-muted-foreground">
                {board.stateSummary.checkedInTracked
                  ? `${board.stateSummary.checkedIn} checked in`
                  : "Check-in is not persisted yet"}
              </p>
            </div>
            <UserX className="size-5 text-muted-foreground" />
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <Fact label="No-shows" value={board.stateSummary.noShow} />
            <Fact label="Replaced" value={board.stateSummary.replaced} />
            <Fact
              label="Active judge versions"
              value={sources.activeJudgeVersions}
            />
            <Fact label="Shift assignments" value={sources.shiftAssignments} />
          </dl>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CriticalGapList
          title="Critical unfilled roles"
          gaps={board.criticalGaps}
          timezone={timezone}
        />
        <QueueList
          title={`No-responses due in ${board.responseDueSoonHours}h`}
          items={board.noResponsesDueSoon}
          timezone={timezone}
          empty="No current or near-term no-responses."
        />
        <QueueList
          title="Declines and change requests"
          items={board.decisionQueue}
          timezone={timezone}
          empty="No declined or change-requested assignments."
        />
        <QueueList
          title="No-shows and replacements"
          items={board.noShowReplacementQueue}
          timezone={timezone}
          empty="No no-show or replaced assignments."
        />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Floor and time blocks</h3>
            <p className="text-sm text-muted-foreground">
              {visibleTimeBlocks.length}/{board.timeBlocks.length} active or
              upcoming blocks
            </p>
          </div>
          <StatusPill tone="neutral">{formatCrewValue(event.slug)}</StatusPill>
        </div>

        {visibleTimeBlocks.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleTimeBlocks.map((block) => (
              <TimeBlockRow
                key={block.timeBlockId}
                block={block}
                timezone={timezone}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No active or upcoming blocks." />
        )}
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Active judge coverage</h3>
            <p className="text-sm text-muted-foreground">
              {board.judgeCoverage.lanesFilled}/
              {board.judgeCoverage.lanesNeeded} lanes filled across{" "}
              {board.judgeCoverage.heatBlocks} heat blocks
            </p>
          </div>
          <StatusPill
            tone={board.judgeCoverage.openLanes > 0 ? "critical" : "covered"}
          >
            {board.judgeCoverage.openLanes} open
          </StatusPill>
        </div>

        {board.judgeCoverage.currentAndNext.length > 0 ? (
          <div className="mt-4 divide-y rounded-md border">
            {board.judgeCoverage.currentAndNext.map((block) => (
              <div
                key={block.timeBlockId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{block.blockLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTimeWindow(block, timezone)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span>
                    {block.filled}/{block.needed}
                  </span>
                  <StatusPill tone={block.open > 0 ? "critical" : "covered"}>
                    {block.open} open
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No current or next judge heat coverage." />
        )}
      </section>
    </section>
  )
}

function MetricPanel({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "covered" | "warning" | "critical"
}) {
  return (
    <section className={`rounded-md border p-4 shadow-sm ${metricTone(tone)}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </section>
  )
}

function BlockPanel({
  block,
  timezone,
}: {
  block: CrewDayOfBlockSummary
  timezone: string
}) {
  return (
    <article className="rounded-md border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{block.label}</h4>
            <StatusPill tone={block.status}>
              {formatCrewValue(block.timing)}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatTimeWindow(block, timezone)}
          </p>
        </div>
        <p className="text-sm font-medium">
          {block.filled}/{block.needed}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniFact label="Open" value={block.open} />
        <MiniFact label="Responses" value={block.responseNeeded} />
        <MiniFact label="Decisions" value={block.decisionNeeded} />
      </div>

      {block.coverage.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {block.coverage.map((coverage) => (
            <StatusPill
              key={coverage.rowId}
              tone={coverage.open > 0 ? "critical" : "covered"}
            >
              {coverage.roleLabel}: {coverage.filled}/{coverage.needed}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function CriticalGapList({
  title,
  gaps,
  timezone,
}: {
  title: string
  gaps: CrewDayOfCriticalGap[]
  timezone: string
}) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <ListHeader title={title} count={gaps.length} />
      {gaps.length > 0 ? (
        <div className="mt-4 divide-y rounded-md border">
          {gaps.slice(0, 8).map((gap) => (
            <div
              key={gap.rowId}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{gap.roleLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {gap.blockLabel} / {formatTimeWindow(gap, timezone)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>
                  {gap.filled}/{gap.needed}
                </span>
                <StatusPill tone="critical">{gap.open} open</StatusPill>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No unfilled role rows." />
      )}
    </section>
  )
}

function QueueList({
  title,
  items,
  timezone,
  empty,
}: {
  title: string
  items: CrewDayOfResponseQueueItem[]
  timezone: string
  empty: string
}) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <ListHeader title={title} count={items.length} />
      {items.length > 0 ? (
        <div className="mt-4 divide-y rounded-md border">
          {items.slice(0, 8).map((item) => (
            <div
              key={`${item.assignmentId}:${item.reason}`}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{item.volunteerName}</p>
                <p className="text-sm text-muted-foreground">
                  {item.blockLabel} / {formatTimeWindow(item, timezone)}
                </p>
              </div>
              <StatusPill
                tone={
                  item.reason === "missing_confirmation" ||
                  item.reason === "no_response"
                    ? "warning"
                    : "critical"
                }
              >
                {formatCrewValue(item.reason)}
              </StatusPill>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={empty} />
      )}
    </section>
  )
}

function TimeBlockRow({
  block,
  timezone,
}: {
  block: CrewDayOfBlockSummary
  timezone: string
}) {
  return (
    <article className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{block.label}</h4>
            <StatusPill tone={block.status}>
              {formatCrewValue(block.timing)}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatTimeWindow(block, timezone)}
          </p>
        </div>
        {block.status === "covered" ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : (
          <ArrowRight className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
        <MiniFact label="Open" value={block.open} />
        <MiniFact label="Resp." value={block.responseNeeded} />
        <MiniFact label="Dec." value={block.decisionNeeded} />
        <MiniFact label="Judge" value={block.judgeLaneGaps} />
      </div>
    </article>
  )
}

function ListHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="font-semibold">{title}</h3>
      <StatusPill tone={count > 0 ? "critical" : "covered"}>{count}</StatusPill>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-background px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function MiniFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  )
}

function StatusPill({
  tone,
  children,
}: {
  tone: "covered" | "attention" | "warning" | "critical" | "neutral"
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs font-medium ${pillTone(tone)}`}
    >
      {children}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-md border bg-background p-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function formatGeneratedAt(value: string, timezone: string) {
  return `Updated ${formatDateTimeInTimezone(new Date(value), timezone, "h:mm a")}`
}

function formatTimeWindow(
  value: {
    startsAt: string | null
    endsAt: string | null
  },
  timezone: string,
) {
  if (!value.startsAt) return "Unscheduled"
  const start = formatDateTimeInTimezone(
    new Date(value.startsAt),
    timezone,
    "EEE h:mm a",
  )
  const end = value.endsAt
    ? formatDateTimeInTimezone(new Date(value.endsAt), timezone, "h:mm a")
    : ""
  return end ? `${start} to ${end}` : start
}

function metricTone(tone: "covered" | "warning" | "critical") {
  if (tone === "covered") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
  }
  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900"
  }
  return "border-destructive/30 bg-destructive/10 text-destructive"
}

function pillTone(
  tone: "covered" | "attention" | "warning" | "critical" | "neutral",
) {
  if (tone === "covered") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (tone === "attention" || tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  }
  if (tone === "critical") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  return "border-muted bg-muted text-muted-foreground"
}
