// @lat: [[crew#Staffing Page Gap Report]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { AlertCircle, CheckCircle2, CircleAlert } from "lucide-react"
import type { ReactNode } from "react"
import {
  getCrewAssignmentConfirmationStatusBadgeClassName,
  getCrewAssignmentConfirmationStatusLabel,
} from "@/lib/crew/assignment-confirmation-display"
import type {
  CrewStaffingCoverageRow,
  CrewStaffingReportIssueSummary,
  CrewStaffingReportStatus,
  CrewStaffingTimeBlock,
} from "@/lib/crew/staffing"
import {
  formatVolunteerAvailability,
  formatVolunteerRole,
} from "@/lib/crew/roster-shifts"
import { formatCrewValue } from "@/lib/crew-event-display"
import { getCrewStaffingReportPageFn } from "@/server-fns/crew-staffing-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/staffing")({
  loader: async ({ params }) =>
    await getCrewStaffingReportPageFn({ data: { eventId: params.eventId } }),
  component: EventStaffingPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventStaffingPage() {
  const { eventId } = parentRoute.useParams()
  const { matrix, report, sources, event } = Route.useLoaderData()
  const timezone = event.timezone ?? "America/Denver"
  const timeBlockById = new Map(
    matrix.timeBlocks.map((block) => [block.id, block]),
  )
  const criticalIssueCount = report.issueSummary
    .filter((issue) => issue.severity === "critical")
    .reduce((total, issue) => total + issue.count, 0)
  const responseIssueCount =
    matrix.summary.confirmationNoResponses +
    matrix.summary.confirmationDeclines +
    matrix.summary.confirmationChangeRequests +
    matrix.summary.confirmationNoShows +
    matrix.summary.confirmationReplaced

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Staffing</h2>
          <p className="text-sm text-muted-foreground">
            {report.summaryLabel}. {report.summaryDetail}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <StatusPanel
            label="Filled"
            value={`${matrix.summary.totalFilled}/${matrix.summary.totalNeeded}`}
          />
          <StatusPanel label="Open" value={matrix.summary.openCapacity} />
          <StatusPanel label="Critical" value={criticalIssueCount} />
          <StatusPanel label="Responses" value={responseIssueCount} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {report.issueSummary.map((issue) => (
          <IssuePanel key={issue.key} issue={issue} />
        ))}
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Coverage by role</h3>
            <p className="text-sm text-muted-foreground">
              Filled and needed totals across shifts and heat lanes.
            </p>
          </div>
          <Link
            to="/events/$eventId/shifts"
            params={{ eventId }}
            className="w-fit rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Manage shifts
          </Link>
        </div>
        {report.roleSummaries.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {report.roleSummaries.map((role) => (
              <article
                key={role.roleType}
                className="rounded-md border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium">{role.roleLabel}</h4>
                    <p className="text-sm text-muted-foreground">
                      {role.timeBlocks} block{plural(role.timeBlocks)}
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      role.open > 0
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    }`}
                  >
                    {role.open} open
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold">
                  {role.filled}/{role.needed}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No staffing role rows yet." />
        )}
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Coverage by time block</h3>
        <CoverageTable
          rows={matrix.coverageRows}
          timeBlockById={timeBlockById}
          timezone={timezone}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-6">
          <ActionList
            title="Open capacity"
            count={report.underfilledRows.length}
            empty="No open capacity in current coverage rows."
          >
            {report.underfilledRows.map((row) => (
              <GapRow key={row.id}>
                <span>{getTimeBlockLabel(timeBlockById, row.timeBlockId)}</span>
                <span className="text-muted-foreground">
                  {formatVolunteerRole(row.roleType)} needs {row.open} more.
                </span>
              </GapRow>
            ))}
          </ActionList>

          <ActionList
            title="Judge lane gaps"
            count={matrix.judgeLaneGaps.length}
            empty="No uncovered judge lanes."
          >
            {matrix.judgeLaneGaps.map((gap) => (
              <GapRow key={`${gap.heatId}:${gap.laneNumber}`}>
                <span>{getTimeBlockLabel(timeBlockById, gap.timeBlockId)}</span>
                <span className="text-muted-foreground">
                  Heat {gap.heatNumber}, lane {gap.laneNumber}
                </span>
              </GapRow>
            ))}
          </ActionList>

          <ActionList
            title="Volunteer conflicts"
            count={matrix.doubleBookedVolunteers.length}
            empty="No double-booked volunteers."
          >
            {matrix.doubleBookedVolunteers.map((booking) => (
              <GapRow
                key={`${booking.membershipId}:${booking.assignmentIds.join(":")}`}
              >
                <span>{booking.volunteerName}</span>
                <span className="text-muted-foreground">
                  {booking.timeBlockIds
                    .map((timeBlockId) =>
                      getTimeBlockLabel(timeBlockById, timeBlockId),
                    )
                    .join(" / ")}
                </span>
              </GapRow>
            ))}
          </ActionList>

          <ActionList
            title="Availability warnings"
            count={matrix.outsideAvailabilityAssignments.length}
            empty="No outside-availability assignments."
          >
            {matrix.outsideAvailabilityAssignments.map((warning) => (
              <GapRow key={`${warning.assignmentId}:${warning.timeBlockId}`}>
                <span>{warning.volunteerName}</span>
                <span className="text-muted-foreground">
                  {formatVolunteerAvailability(warning.availability)} /{" "}
                  {getTimeBlockLabel(timeBlockById, warning.timeBlockId)}
                </span>
              </GapRow>
            ))}
          </ActionList>

          <ActionList
            title="Role warnings"
            count={matrix.credentialWarnings.length}
            empty="No role or credential warnings."
          >
            {matrix.credentialWarnings.map((warning) => (
              <GapRow key={`${warning.assignmentId}:${warning.reason}`}>
                <span>{warning.volunteerName}</span>
                <span className="text-muted-foreground">
                  {formatCrewValue(warning.reason)} / needs{" "}
                  {formatVolunteerRole(warning.requiredRoleType)}
                </span>
              </GapRow>
            ))}
          </ActionList>

          <ActionList
            title="Confirmation gaps"
            count={matrix.confirmationGaps.length}
            empty="No assignment confirmation gaps."
          >
            {matrix.confirmationGaps.map((gap) => (
              <GapRow key={`${gap.assignmentId}:${gap.reason}`}>
                <span>{gap.volunteerName}</span>
                <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  {formatCrewValue(gap.reason)} /{" "}
                  {getTimeBlockLabel(timeBlockById, gap.timeBlockId)}
                  <ConfirmationBadge status={gap.status ?? "missing"} />
                </span>
              </GapRow>
            ))}
          </ActionList>
        </section>

        <aside className="rounded-md border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Source counts
          </h3>
          <dl className="mt-4 space-y-4 text-sm">
            <Fact label="Venues" value={sources.venues} />
            <Fact label="Workouts" value={sources.workouts} />
            <Fact label="Heats" value={sources.heats} />
            <Fact
              label="Lane assignments"
              value={sources.heatLaneAssignments}
            />
            <Fact label="Roster" value={sources.roster} />
            <Fact label="Assignable" value={sources.assignableRoster} />
            <Fact label="Shifts" value={sources.shifts} />
            <Fact label="Shift assignments" value={sources.shiftAssignments} />
            <Fact
              label="Active judge versions"
              value={sources.activeJudgeVersions}
            />
            <Fact label="Judge assignments" value={sources.judgeAssignments} />
          </dl>
        </aside>
      </div>
    </section>
  )
}

function CoverageTable({
  rows,
  timeBlockById,
  timezone,
}: {
  rows: CrewStaffingCoverageRow[]
  timeBlockById: Map<string, CrewStaffingTimeBlock>
  timezone: string
}) {
  if (rows.length === 0) {
    return <EmptyState message="No coverage rows yet." />
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-md border">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead className="bg-muted/60 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Time block</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Window</th>
            <th className="px-3 py-2 text-right font-medium">Filled</th>
            <th className="px-3 py-2 text-right font-medium">Needed</th>
            <th className="px-3 py-2 text-right font-medium">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const block = timeBlockById.get(row.timeBlockId)
            return (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-3 font-medium">
                  {block?.label ?? row.timeBlockId}
                </td>
                <td className="px-3 py-3">
                  {formatVolunteerRole(row.roleType)}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {formatTimeWindow(block, timezone)}
                </td>
                <td className="px-3 py-3 text-right">{row.filled}</td>
                <td className="px-3 py-3 text-right">{row.needed}</td>
                <td className="px-3 py-3 text-right">
                  <span
                    className={
                      row.open > 0 ? "font-semibold text-amber-700" : ""
                    }
                  >
                    {row.open}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ActionList({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium">
          {count}
        </span>
      </div>
      {count > 0 ? (
        <div className="mt-4 space-y-2">{children}</div>
      ) : (
        <EmptyState message={empty} compact />
      )}
    </section>
  )
}

function GapRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  )
}

function IssuePanel({ issue }: { issue: CrewStaffingReportIssueSummary }) {
  return (
    <article className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{issue.label}</p>
          <p className="mt-2 text-xl font-semibold">{issue.count}</p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            issue.severity === "critical"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700"
          }`}
        >
          {issue.severity}
        </span>
      </div>
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

function StatusBadge({ status }: { status: CrewStaffingReportStatus }) {
  const Icon =
    status === "covered"
      ? CheckCircle2
      : status === "critical"
        ? AlertCircle
        : CircleAlert

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
    >
      <Icon className="size-3.5" />
      {status === "covered"
        ? "Covered"
        : status === "critical"
          ? "Critical gaps"
          : "Needs attention"}
    </span>
  )
}

function ConfirmationBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${getCrewAssignmentConfirmationStatusBadgeClassName(status)}`}
    >
      {getCrewAssignmentConfirmationStatusLabel(status)}
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

function EmptyState({
  message,
  compact = false,
}: {
  message: string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-md border bg-background text-center text-sm text-muted-foreground ${
        compact ? "mt-4 p-3" : "mt-4 p-6"
      }`}
    >
      {message}
    </div>
  )
}

function getTimeBlockLabel(
  timeBlockById: Map<string, CrewStaffingTimeBlock>,
  timeBlockId: string,
) {
  return timeBlockById.get(timeBlockId)?.label ?? timeBlockId
}

function formatTimeWindow(
  block: CrewStaffingTimeBlock | undefined,
  timezone: string,
) {
  if (!block?.startTime) return "Unscheduled"
  const start = formatDateTimeInTimezone(
    block.startTime,
    timezone,
    "EEE, MMM d h:mm a",
  )
  const end = block.endTime
    ? formatDateTimeInTimezone(block.endTime, timezone, "h:mm a")
    : ""

  return end ? `${start} to ${end}` : start
}

function statusBadgeClass(status: CrewStaffingReportStatus) {
  if (status === "covered") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
  if (status === "critical") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-700"
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
