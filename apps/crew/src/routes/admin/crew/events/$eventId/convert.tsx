// @lat: [[crew#Crew Admin Shell]]
// @lat: [[crew#Full WODsmith Conversion Assistant]]
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react"
import type { ReactNode } from "react"
import {
  type CrewConversionAction,
  type CrewConversionChecklistItem,
  type CrewConversionChecklistStatus,
  type CrewConversionSummary,
  crewConversionChecklistStatusLabels,
} from "@/lib/crew/conversion-assistant"
import { getCrewAdminConversionFn } from "@/server-fns/crew-admin-event-fns"

export const Route = createFileRoute("/admin/crew/events/$eventId/convert")({
  loader: async ({ params }) =>
    await getCrewAdminConversionFn({ data: { eventId: params.eventId } }),
  component: CrewAdminConversionPage,
})

function CrewAdminConversionPage() {
  const { viewModel } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Competition" value={viewModel.event.id} mono />
        <Metric
          label="Crew-only"
          value={viewModel.event.crewOnly ? "Yes" : "No"}
        />
        <Metric label="Conversion" value={viewModel.conversion.label} />
        <Metric
          label="Full setup"
          value={`${viewModel.fullSetup.summary.ready}/${viewModel.fullSetup.summary.total}`}
        />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Full WODsmith conversion
            </div>
            <h3 className="text-xl font-semibold">
              Convert without duplicating the event
            </h3>
            <p className="max-w-3xl text-sm text-muted-foreground">
              This operator assistant inventories what stays on the current
              competition and points missing full-platform setup to existing
              WODsmith organizer surfaces.
            </p>
          </div>
          <div className="rounded-md border bg-background p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <LockKeyhole className="size-4 text-muted-foreground" />
              Read-only
            </div>
            <p className="mt-2 text-muted-foreground">
              No conversion mutation, checkout, registration launch, payout
              setup, deploy, import apply, or public activation happens here.
            </p>
          </div>
        </div>
      </section>

      <ChecklistSection
        title="Missing full WODsmith setup"
        summary={viewModel.fullSetup.summary}
        items={viewModel.fullSetup.items}
      />

      <ChecklistSection
        title="Crew data preserved"
        summary={viewModel.preservation.summary}
        items={viewModel.preservation.items}
      />
    </section>
  )
}

function ChecklistSection({
  title,
  summary,
  items,
}: {
  title: string
  summary: CrewConversionSummary
  items: CrewConversionChecklistItem[]
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {summary.ready}/{summary.total} ready, {summary.blocked} blocked.
          </p>
        </div>
        <StatusBadge status={summary.highestStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <ChecklistCard item={item} key={item.key} />
        ))}
      </div>
    </section>
  )
}

function ChecklistCard({ item }: { item: CrewConversionChecklistItem }) {
  const Icon = item.status === "ready" ? CheckCircle2 : CircleAlert

  return (
    <article className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Icon
            className={`mt-0.5 size-5 shrink-0 ${statusIconClass(item.status)}`}
            aria-hidden="true"
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

      <ActionLink action={item.action} />
    </article>
  )
}

function ActionLink({ action }: { action: CrewConversionAction }) {
  if (!action.href) {
    return (
      <span className="mt-5 inline-flex rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground">
        {action.label}
      </span>
    )
  }

  const external =
    action.kind === "wodsmith_route" || action.kind === "public_route"

  return (
    <a
      href={action.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="mt-5 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {action.label}
      {external ? <ArrowUpRight className="size-4" aria-hidden="true" /> : null}
    </a>
  )
}

function Metric({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 break-words text-lg font-semibold ${mono ? "font-mono text-sm" : ""}`}
      >
        {value}
      </p>
    </section>
  )
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: CrewConversionChecklistStatus
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${statusBadgeClass(status)} ${compact ? "" : "self-start"}`}
    >
      {crewConversionChecklistStatusLabels[status]}
    </span>
  )
}

function statusBadgeClass(status: CrewConversionChecklistStatus) {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (status === "blocked") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-700"
}

function statusIconClass(status: CrewConversionChecklistStatus) {
  if (status === "ready") return "text-emerald-600"
  if (status === "blocked") return "text-destructive"
  return "text-amber-600"
}
