// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Confirmation Emails And Reminders]]
import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  BellRing,
  Download,
  Loader2,
  Mail,
  MessageSquareWarning,
  UserCheck,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  getCrewAssignmentConfirmationStatusBadgeClassName,
  getCrewAssignmentConfirmationStatusLabel,
} from "@/lib/crew/assignment-confirmation-display"
import type {
  CrewAssignmentCommunicationDashboard,
  CrewAssignmentCommunicationRow,
  CrewAssignmentCommunicationState,
  CrewAssignmentEmailSendPreview,
  QueueCrewAssignmentConfirmationEmailsResult,
} from "@/server-fns/crew-confirmation-fns"
import {
  getCrewAssignmentCommunicationDashboardFn,
  queueCrewAssignmentConfirmationEmailsFn,
} from "@/server-fns/crew-confirmation-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/messages")({
  loader: async ({ params }) =>
    await getCrewAssignmentCommunicationDashboardFn({
      data: { eventId: params.eventId },
    }),
  component: CrewMessagesPage,
})

const parentRoute = getRouteApi("/events/$eventId")

type QueueMode = "confirmations" | "reminders"

const RESPONSE_BUCKETS = [
  {
    key: "no_response",
    title: "No response",
    states: ["not_ready", "pending", "sent"],
  },
  { key: "declined", title: "Declined", states: ["declined"] },
  {
    key: "change_requested",
    title: "Change requested",
    states: ["change_requested"],
  },
  { key: "confirmed", title: "Confirmed", states: ["confirmed"] },
  {
    key: "event_day_outcomes",
    title: "Event-day outcomes",
    states: ["no_show", "replaced"],
  },
] as const satisfies readonly {
  key: string
  title: string
  states: readonly CrewAssignmentCommunicationState[]
}[]

function CrewMessagesPage() {
  const { eventId } = parentRoute.useParams()
  const dashboard = Route.useLoaderData()
  const router = useRouter()
  const queueAssignmentEmails = useServerFn(
    queueCrewAssignmentConfirmationEmailsFn,
  )
  const [queueingMode, setQueueingMode] = useState<QueueMode | null>(null)
  const rowsByBucket = useMemo(() => bucketRows(dashboard.rows), [dashboard])
  const noResponseRows = rowsByBucket.get("no_response") ?? []
  const declineRows = rowsByBucket.get("declined") ?? []
  const changeRows = rowsByBucket.get("change_requested") ?? []

  async function handleQueue(mode: QueueMode) {
    setQueueingMode(mode)
    try {
      const result = await queueAssignmentEmails({
        data: { eventId, mode },
      })
      toast.success(formatQueueResult(result))
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Assignment emails failed",
      )
    } finally {
      setQueueingMode(null)
    }
  }

  function handleExportNoResponses() {
    if (noResponseRows.length === 0) return
    downloadNoResponseCsv(dashboard.event.name, noResponseRows, timezone)
  }

  const timezone = dashboard.event.timezone ?? "America/Denver"

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold">Confirmations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.summary.totalAssignments} assignments,{" "}
            {dashboard.summary.noResponse} awaiting a volunteer response
          </p>
        </div>
        <Link
          to="/events/$eventId/assignments"
          params={{ eventId }}
          className="inline-flex h-10 w-fit items-center rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Assignments
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatusPanel label="Pending" value={dashboard.summary.pending} />
        <StatusPanel label="Sent" value={dashboard.summary.sent} />
        <StatusPanel label="Confirmed" value={dashboard.summary.confirmed} />
        <StatusPanel label="Declined" value={dashboard.summary.declined} />
        <StatusPanel
          label="Change requested"
          value={dashboard.summary.changeRequested}
        />
        <StatusPanel label="No response" value={dashboard.summary.noResponse} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EmailPreviewPanel
          title="Send assignment emails"
          description={`${dashboard.previews.assignmentEmails.eligible} assignment email${plural(dashboard.previews.assignmentEmails.eligible)} ready to send`}
          icon="mail"
          preview={dashboard.previews.assignmentEmails}
          isBusy={queueingMode === "confirmations"}
          disabled={queueingMode !== null}
          onSend={() => void handleQueue("confirmations")}
        />
        <EmailPreviewPanel
          title="Send reminder emails"
          description={`${dashboard.previews.reminderEmails.eligible} reminder email${plural(dashboard.previews.reminderEmails.eligible)} ready to send`}
          icon="bell"
          preview={dashboard.previews.reminderEmails}
          isBusy={queueingMode === "reminders"}
          disabled={queueingMode !== null}
          onSend={() => void handleQueue("reminders")}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <ActionCard
          title="Send all unsent"
          detail={`${dashboard.previews.assignmentEmails.eligible} ready`}
          enabled={
            dashboard.previews.assignmentEmails.eligible > 0 &&
            queueingMode === null
          }
          onClick={() => void handleQueue("confirmations")}
        />
        <ActionCard
          title="Remind no responses"
          detail={`${dashboard.previews.reminderEmails.eligible} due now`}
          enabled={
            dashboard.previews.reminderEmails.eligible > 0 &&
            queueingMode === null
          }
          onClick={() => void handleQueue("reminders")}
        />
        <ActionLink
          title="Review declines"
          detail={`${declineRows.length} assignment${plural(declineRows.length)}`}
          href="#declined"
          enabled={declineRows.length > 0}
        />
        <ActionLink
          title="Review change requests"
          detail={`${changeRows.length} assignment${plural(changeRows.length)}`}
          href="#change_requested"
          enabled={changeRows.length > 0}
        />
      </section>

      <section className="rounded-md border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">No-response list</h3>
            <p className="text-sm text-muted-foreground">
              {noResponseRows.length} assignment{plural(noResponseRows.length)}
            </p>
          </div>
          <button
            type="button"
            disabled={noResponseRows.length === 0}
            onClick={handleExportNoResponses}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="size-4" />
            Export no-response list
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {RESPONSE_BUCKETS.map((bucket) => {
          const rows = rowsByBucket.get(bucket.key) ?? []
          if (bucket.key === "event_day_outcomes" && rows.length === 0) {
            return null
          }
          return (
            <AssignmentBucket
              key={bucket.key}
              id={bucket.key}
              title={bucket.title}
              rows={rows}
              timezone={timezone}
            />
          )
        })}
      </section>
    </section>
  )
}

function EmailPreviewPanel({
  title,
  description,
  icon,
  preview,
  isBusy,
  disabled,
  onSend,
}: {
  title: string
  description: string
  icon: "mail" | "bell"
  preview: CrewAssignmentEmailSendPreview
  isBusy: boolean
  disabled: boolean
  onSend: () => void
}) {
  const Icon = icon === "mail" ? Mail : BellRing
  const canSend = preview.eligible > 0 && !disabled

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-md border bg-background p-2 text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <PreviewStat label="Will send" value={preview.eligible} />
        <PreviewStat label="Already sent" value={preview.skipped.alreadySent} />
        <PreviewStat label="No email" value={preview.skipped.missingEmail} />
      </dl>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <PreviewStat
          label="Already answered"
          value={preview.skipped.responded}
        />
        <PreviewStat label="Not due" value={preview.skipped.notDue} />
        <PreviewStat label="Past shift" value={preview.skipped.pastShift} />
      </dl>
      <button
        type="button"
        disabled={!canSend}
        onClick={onSend}
        className="mt-5 inline-flex h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Icon className="size-4" />
        )}
        {title}
      </button>
    </section>
  )
}

function AssignmentBucket({
  id,
  title,
  rows,
  timezone,
}: {
  id: string
  title: string
  rows: CrewAssignmentCommunicationRow[]
  timezone: string
}) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-md border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
          {rows.length}
        </span>
      </div>
      {rows.length > 0 ? (
        <div className="divide-y">
          {rows.map((row, index) => (
            <AssignmentResponseRow
              key={`${row.volunteerName}:${row.shiftName}:${row.startsAt.toString()}:${index}`}
              row={row}
              timezone={timezone}
            />
          ))}
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">No assignments</p>
      )}
    </section>
  )
}

function AssignmentResponseRow({
  row,
  timezone,
}: {
  row: CrewAssignmentCommunicationRow
  timezone: string
}) {
  return (
    <article className="grid gap-3 p-4 lg:grid-cols-[1fr_15rem]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{row.volunteerName}</p>
          <StatusBadge state={row.state} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.shiftName} · {row.roleLabel} ·{" "}
          {formatDateTimeInTimezone(
            row.startsAt,
            timezone,
            "EEE, MMM d h:mm a",
          )}
          {" - "}
          {formatDateTimeInTimezone(row.endsAt, timezone, "h:mm a")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.volunteerEmail ?? "No email on file"}
          {row.location ? ` · ${row.location}` : ""}
        </p>
        {row.responseNote ? (
          <p className="mt-2 max-w-2xl whitespace-pre-wrap rounded-md border bg-background p-3 text-sm text-muted-foreground">
            {row.responseNote}
          </p>
        ) : null}
      </div>
      <div className="text-sm text-muted-foreground lg:text-right">
        <TimestampDetail row={row} timezone={timezone} />
      </div>
    </article>
  )
}

function TimestampDetail({
  row,
  timezone,
}: {
  row: CrewAssignmentCommunicationRow
  timezone: string
}) {
  if (row.state === "pending") return "Not sent"
  if (row.state === "not_ready") return "Not ready"
  if (row.respondedAt) {
    return (
      <>
        Responded{" "}
        {formatDateTimeInTimezone(row.respondedAt, timezone, "MMM d h:mm a")}
      </>
    )
  }
  if (row.lastReminderAt) {
    return (
      <>
        Reminder {row.reminderCount}{" "}
        {formatDateTimeInTimezone(row.lastReminderAt, timezone, "MMM d h:mm a")}
      </>
    )
  }
  if (row.sentAt) {
    return (
      <>Sent {formatDateTimeInTimezone(row.sentAt, timezone, "MMM d h:mm a")}</>
    )
  }
  return "Awaiting response"
}

function StatusPanel({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  )
}

function ActionCard({
  title,
  detail,
  enabled,
  onClick,
}: {
  title: string
  detail: string
  enabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className="rounded-md border bg-card p-4 text-left shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Mail className="size-4 text-muted-foreground" />
      <span className="mt-3 block font-medium">{title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
    </button>
  )
}

function ActionLink({
  title,
  detail,
  href,
  enabled,
}: {
  title: string
  detail: string
  href: string
  enabled: boolean
}) {
  const content = (
    <>
      {title === "Review declines" ? (
        <MessageSquareWarning className="size-4 text-muted-foreground" />
      ) : (
        <UserCheck className="size-4 text-muted-foreground" />
      )}
      <span className="mt-3 block font-medium">{title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
    </>
  )

  if (!enabled) {
    return (
      <span className="rounded-md border bg-card p-4 opacity-60">
        {content}
      </span>
    )
  }

  return (
    <a
      href={href}
      className="rounded-md border bg-card p-4 shadow-sm hover:bg-muted"
    >
      {content}
    </a>
  )
}

function StatusBadge({ state }: { state: CrewAssignmentCommunicationState }) {
  const status = state === "not_ready" ? "missing" : state
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${getCrewAssignmentConfirmationStatusBadgeClassName(status)}`}
    >
      {state === "not_ready"
        ? "Not ready"
        : getCrewAssignmentConfirmationStatusLabel(status)}
    </span>
  )
}

function bucketRows(rows: CrewAssignmentCommunicationDashboard["rows"]) {
  const buckets = new Map<string, CrewAssignmentCommunicationRow[]>()
  for (const bucket of RESPONSE_BUCKETS) {
    const states = new Set<CrewAssignmentCommunicationState>(bucket.states)
    buckets.set(
      bucket.key,
      rows.filter((row) => states.has(row.state)),
    )
  }
  return buckets
}

function formatQueueResult(
  result: QueueCrewAssignmentConfirmationEmailsResult,
) {
  const label =
    result.mode === "confirmations" ? "assignment emails" : "reminder emails"
  if (result.queueAvailable) {
    return `${result.queued}/${result.eligible} ${label} queued${result.failed ? `, ${result.failed} failed` : ""}`
  }
  return `${result.previewed}/${result.eligible} ${label} previewed; delivery is unavailable`
}

function downloadNoResponseCsv(
  eventName: string,
  rows: CrewAssignmentCommunicationRow[],
  timezone: string,
) {
  const header = ["Volunteer", "Email", "Shift", "Role", "Starts", "Status"]
  const csvRows = rows.map((row) => [
    row.volunteerName,
    row.volunteerEmail ?? "",
    row.shiftName,
    row.roleLabel,
    formatDateTimeInTimezone(row.startsAt, timezone, "yyyy-MM-dd h:mm a"),
    row.state === "not_ready"
      ? "Not ready"
      : getCrewAssignmentConfirmationStatusLabel(row.state),
  ])
  const csv = [header, ...csvRows]
    .map((line) => line.map(escapeCsvValue).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${slugifyFileName(eventName)}-no-response.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function escapeCsvValue(value: string) {
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${neutralized.replaceAll('"', '""')}"`
}

function slugifyFileName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "crew-confirmations"
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
