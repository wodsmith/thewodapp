// @lat: [[crew#Staffing Page Gap Report]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { CalendarClock, CheckCircle2, Users } from "lucide-react"
import type { ReactNode } from "react"
import { formatVolunteerRole } from "@/lib/crew/roster-shifts"
import type {
  CrewStaffingCoverageRow,
  CrewStaffingRoleSummary,
  CrewStaffingTimeBlock,
} from "@/lib/crew/staffing"
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
  const { matrix, report, event } = Route.useLoaderData()
  const timezone = event.timezone ?? "America/Denver"

  const timeBlockById = new Map(
    matrix.timeBlocks.map((block) => [block.id, block]),
  )
  const openSlots = matrix.summary.openCapacity
  const totalNeeded = matrix.summary.totalNeeded
  const totalFilled = matrix.summary.totalFilled
  const hasStaffingBlocks = matrix.timeBlocks.length > 0 && totalNeeded > 0

  const roleGaps = report.roleSummaries.filter((role) => role.open > 0)
  const blockGaps = report.underfilledRows
  const blockGapCount = new Set(blockGaps.map((row) => row.timeBlockId)).size

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Staffing gaps</h2>
        <p className="text-sm text-muted-foreground">
          The volunteer and judge slots you still need to fill.
        </p>
      </div>

      <Verdict
        eventId={eventId}
        hasStaffingBlocks={hasStaffingBlocks}
        openSlots={openSlots}
        totalFilled={totalFilled}
        totalNeeded={totalNeeded}
        blockGapCount={blockGapCount}
      />

      {openSlots > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RoleGaps eventId={eventId} roleGaps={roleGaps} />
          <BlockGaps
            blockGaps={blockGaps}
            timeBlockById={timeBlockById}
            timezone={timezone}
          />
        </div>
      )}
    </section>
  )
}

function Verdict({
  eventId,
  hasStaffingBlocks,
  openSlots,
  totalFilled,
  totalNeeded,
  blockGapCount,
}: {
  eventId: string
  hasStaffingBlocks: boolean
  openSlots: number
  totalFilled: number
  totalNeeded: number
  blockGapCount: number
}) {
  if (!hasStaffingBlocks) {
    return (
      <article className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <IconBadge tone="neutral">
            <CalendarClock className="size-6" />
          </IconBadge>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Nothing to staff yet</h3>
            <p className="text-sm text-muted-foreground">
              Add volunteer shifts or scheduled heats, then come back to see
              your gaps.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <PillLink to="/events/$eventId/shifts" eventId={eventId}>
                Add shifts
              </PillLink>
              <PillLink to="/events/$eventId/heats" eventId={eventId}>
                Schedule heats
              </PillLink>
            </div>
          </div>
        </div>
      </article>
    )
  }

  if (openSlots === 0) {
    return (
      <article className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <IconBadge tone="positive">
            <CheckCircle2 className="size-6" />
          </IconBadge>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-emerald-800">
              Fully staffed
            </h3>
            <p className="text-sm text-emerald-700/90">
              All {totalNeeded} slots are filled. No volunteer gaps to close.
            </p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <IconBadge tone="warning">
          <Users className="size-6" />
        </IconBadge>
        <div className="space-y-1">
          <h3 className="text-2xl font-semibold text-amber-900">
            {openSlots} more {openSlots === 1 ? "person" : "people"} needed
          </h3>
          <p className="text-sm text-amber-800/90">
            {totalFilled} of {totalNeeded} slots filled · gaps across{" "}
            {blockGapCount} time block{blockGapCount === 1 ? "" : "s"}.
          </p>
        </div>
      </div>
    </article>
  )
}

function RoleGaps({
  eventId,
  roleGaps,
}: {
  eventId: string
  roleGaps: CrewStaffingRoleSummary[]
}) {
  const hasJudgeGaps = roleGaps.some((role) => isJudgeRole(role.roleType))
  const hasShiftGaps = roleGaps.some((role) => !isJudgeRole(role.roleType))

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Who you need</h3>
        <div className="flex flex-wrap justify-end gap-2">
          {hasShiftGaps && (
            <PillLink to="/events/$eventId/shifts" eventId={eventId}>
              Manage shifts
            </PillLink>
          )}
          {hasJudgeGaps && (
            <PillLink to="/events/$eventId/judges" eventId={eventId}>
              Assign judges
            </PillLink>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {roleGaps.map((role) => (
          <li
            key={role.roleType}
            className="flex items-center justify-between gap-3 rounded-md border bg-background px-4 py-3"
          >
            <div>
              <p className="font-medium">{role.roleLabel}</p>
              <p className="text-sm text-muted-foreground">
                {role.filled}/{role.needed} filled
              </p>
            </div>
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-sm font-semibold text-amber-700">
              {role.open} open
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BlockGaps({
  blockGaps,
  timeBlockById,
  timezone,
}: {
  blockGaps: CrewStaffingCoverageRow[]
  timeBlockById: Map<string, CrewStaffingTimeBlock>
  timezone: string
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">When they're needed</h3>
      <ul className="mt-4 space-y-2">
        {blockGaps.map((row) => {
          const block = timeBlockById.get(row.timeBlockId)
          return (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {block?.label ?? row.timeBlockId}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatVolunteerRole(row.roleType)} ·{" "}
                  {formatTimeWindow(block, timezone)}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-sm font-semibold text-amber-700">
                {row.open} open
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function IconBadge({
  tone,
  children,
}: {
  tone: "neutral" | "positive" | "warning"
  children: ReactNode
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
        : "border-border bg-muted text-muted-foreground"

  return (
    <span
      className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${toneClass}`}
    >
      {children}
    </span>
  )
}

function PillLink({
  to,
  eventId,
  children,
}: {
  to:
    | "/events/$eventId/shifts"
    | "/events/$eventId/heats"
    | "/events/$eventId/judges"
  eventId: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      params={{ eventId }}
      className="w-fit rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  )
}

function isJudgeRole(roleType: CrewStaffingRoleSummary["roleType"]) {
  return roleType === "judge" || roleType === "head_judge"
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
