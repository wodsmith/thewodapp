// @lat: [[crew#Pilot Readiness Checklist]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { AlertCircle, CheckCircle2, CircleAlert } from "lucide-react"
import {
  crewReadinessStatusLabels,
  type CrewReadinessChecklistItem,
  type CrewReadinessStatus,
} from "@/lib/crew/readiness"
import { getCrewReadinessPageFn } from "@/server-fns/crew-readiness-fns"

export const Route = createFileRoute("/events/$eventId/readiness")({
  loader: async ({ params }) =>
    await getCrewReadinessPageFn({ data: { eventId: params.eventId } }),
  component: EventReadinessPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventReadinessPage() {
  const { eventId } = parentRoute.useParams()
  const { readiness, facts } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pilot readiness</h2>
          <p className="text-sm text-muted-foreground">
            Read-only operator checklist for the founding organizer pilot.
          </p>
        </div>
        <StatusBadge status={readiness.summary.highestStatus} />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <StatusPanel
            label="Ready"
            value={`${readiness.summary.ready}/${readiness.summary.total}`}
          />
          <StatusPanel
            label="Needs attention"
            value={readiness.summary.needsAttention}
          />
          <StatusPanel label="Blocked" value={readiness.summary.blocked} />
          <StatusPanel
            label="Progress"
            value={`${readiness.summary.progressPercent}%`}
          />
        </div>
        <ProgressBar value={readiness.summary.progressPercent} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {readiness.items.map((item) => (
          <ReadinessItemCard
            key={item.category}
            eventId={eventId}
            item={item}
          />
        ))}
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Source counts</h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="Setup checks"
            value={`${facts.setup.completed}/${facts.setup.total}`}
          />
          <Fact
            label="Venues and lanes"
            value={`${facts.venues.venueCount} / ${facts.venues.totalLaneCount}`}
          />
          <Fact
            label="Workouts and heats"
            value={`${facts.schedule.workoutCount} / ${facts.schedule.heatCount}`}
          />
          <Fact
            label="Roster"
            value={`${facts.roster.total} total, ${facts.roster.assignable} assignable`}
          />
          <Fact
            label="Shift coverage"
            value={`${facts.shifts.assignedSlots}/${facts.shifts.capacity}`}
          />
          <Fact
            label="Confirmations"
            value={`${facts.shifts.confirmationSummary.confirmed}/${facts.shifts.assignedSlots}`}
          />
          <Fact
            label="No response"
            value={facts.shifts.confirmationSummary.pending}
          />
          <Fact label="Judge versions" value={facts.judge.activeVersionCount} />
        </dl>
      </section>
    </section>
  )
}

function ReadinessItemCard({
  eventId,
  item,
}: {
  eventId: string
  item: CrewReadinessChecklistItem
}) {
  const Icon =
    item.status === "ready"
      ? CheckCircle2
      : item.status === "blocked"
        ? AlertCircle
        : CircleAlert

  return (
    <article className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Icon
            className={`mt-0.5 size-5 shrink-0 ${statusIconClass(item.status)}`}
          />
          <div className="min-w-0">
            <h3 className="font-semibold">{item.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
          </div>
        </div>
        <StatusBadge status={item.status} compact />
      </div>

      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {item.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>

      <Link
        to={item.action.to}
        params={{ eventId }}
        className="mt-5 inline-flex rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {item.action.label}
      </Link>
    </article>
  )
}

function StatusPanel({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <section className="rounded-md border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: CrewReadinessStatus
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${statusBadgeClass(status)} ${compact ? "" : "self-start"}`}
    >
      {crewReadinessStatusLabels[status]}
    </span>
  )
}

function Fact({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function statusBadgeClass(status: CrewReadinessStatus) {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (status === "blocked") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-700"
}

function statusIconClass(status: CrewReadinessStatus) {
  if (status === "ready") return "text-emerald-600"
  if (status === "blocked") return "text-destructive"
  return "text-amber-600"
}
