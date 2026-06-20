// @lat: [[crew#Pilot Exports]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { Download, FileSpreadsheet, Printer } from "lucide-react"
import type { ReactNode } from "react"
import type {
  CrewPilotExports,
  CrewPilotFloorLeadSheet,
  CrewPilotJudgeHeatLaneSheet,
  CrewPilotRoleSheet,
} from "@/lib/crew/exports/pilot-exports"
import { formatCrewValue } from "@/lib/crew-event-display"
import { getCrewPilotExportsPageFn } from "@/server-fns/crew-pilot-export-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/exports")({
  loader: async ({ params }) =>
    await getCrewPilotExportsPageFn({
      data: { eventId: params.eventId },
    }),
  component: EventPilotExportsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventPilotExportsPage() {
  const { eventId } = parentRoute.useParams()
  const { event, exports, sources } = Route.useLoaderData()
  const timezone = event.timezone ?? "America/Denver"

  return (
    <>
      <section className="space-y-5 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Pilot exports</h2>
            <p className="text-sm text-muted-foreground">
              {formatExportDate(exports.generatedAt, timezone)} / {timezone}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() =>
                downloadCsv(
                  `${event.slug || event.id}-master-schedule.csv`,
                  exports.masterScheduleCsv,
                )
              }
            >
              <Download className="size-4" />
              Master CSV
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() =>
                downloadCsv(
                  `${event.slug || event.id}-responses.csv`,
                  exports.responseCsv,
                )
              }
            >
              <FileSpreadsheet className="size-4" />
              Responses CSV
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.print()}
            >
              <Printer className="size-4" />
              Print sheets
            </button>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-6">
          <MetricPanel
            label="Rows"
            value={exports.summary.masterScheduleRows}
          />
          <MetricPanel label="Role sheets" value={exports.summary.roleSheets} />
          <MetricPanel
            label="Judge sheets"
            value={exports.summary.judgeHeatSheets}
          />
          <MetricPanel label="Responses" value={exports.summary.responseRows} />
          <MetricPanel label="Floors" value={exports.summary.floorLeadSheets} />
          <MetricPanel label="Versions" value={sources.activeJudgeVersions} />
        </section>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold">Master schedule</h3>
              <p className="text-sm text-muted-foreground">
                {sources.shifts} shifts / {sources.heats} heats
              </p>
            </div>
            <StatusPill>{formatCrewValue(event.slug)}</StatusPill>
          </div>
          {exports.masterScheduleRows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Block</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Coverage</th>
                    <th className="py-2 pr-3">People</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exports.masterScheduleRows.map((row) => (
                    <tr key={`${row.blockType}:${row.blockId}`}>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {formatRange(row.startsAt, row.endsAt, timezone)}
                      </td>
                      <td className="py-3 pr-3 font-medium">{row.label}</td>
                      <td className="py-3 pr-3">{row.location}</td>
                      <td className="py-3 pr-3">{row.role}</td>
                      <td className="py-3 pr-3">
                        {row.assigned}/{row.needed}
                        {row.open > 0 ? ` (${row.open} open)` : ""}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {row.people || "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No shift or heat rows are ready to export." />
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-md border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">No-response and declines</h3>
                <p className="text-sm text-muted-foreground">
                  {sources.shiftAssignments + sources.judgeAssignments} active
                  assignments
                </p>
              </div>
              <Link
                to="/events/$eventId/day-of"
                params={{ eventId }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Day-of
              </Link>
            </div>
            {exports.responseRows.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {exports.responseRows.slice(0, 12).map((row) => (
                  <div
                    key={`${row.assignmentType}:${row.assignmentId}`}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{row.volunteerName}</p>
                        <p className="text-muted-foreground">
                          {row.blockLabel} / {row.role}
                        </p>
                      </div>
                      <StatusPill>{formatCrewValue(row.reason)}</StatusPill>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {formatRange(row.startsAt, row.endsAt, timezone)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No missing, pending, declined, or change-requested responses." />
            )}
          </section>

          <section className="rounded-md border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Judge heat sheets</h3>
                <p className="text-sm text-muted-foreground">
                  {sources.judgeAssignments}/{sources.heatLaneAssignments} lanes
                  assigned
                </p>
              </div>
              <Link
                to="/events/$eventId/judges"
                params={{ eventId }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Judges
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {exports.judgeHeatLaneSheets.slice(0, 4).map((sheet) => (
                <JudgeHeatSheetPreview
                  key={sheet.heatId}
                  sheet={sheet}
                  timezone={timezone}
                />
              ))}
            </div>
          </section>
        </div>

        <section className="space-y-4">
          <h3 className="font-semibold">Role sheets</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {exports.roleSheets.map((sheet) => (
              <RoleSheetPreview
                key={sheet.roleType}
                sheet={sheet}
                timezone={timezone}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold">Floor lead sheets</h3>
          <div className="grid gap-4">
            {exports.floorLeadSheets.map((sheet) => (
              <FloorLeadSheetPreview
                key={sheet.floorName}
                sheet={sheet}
                timezone={timezone}
              />
            ))}
          </div>
        </section>
      </section>
      <PrintSheets
        eventName={event.name}
        exports={exports}
        timezone={timezone}
      />
    </>
  )
}

function PrintSheets({
  eventName,
  exports,
  timezone,
}: {
  eventName: string
  exports: CrewPilotExports
  timezone: string
}) {
  return (
    <section className="hidden space-y-8 bg-white text-black print:block">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold">{eventName}</h1>
        <p className="text-sm">
          Pilot exports / {formatExportDate(exports.generatedAt, timezone)}
        </p>
      </header>

      <PrintSection title="Master schedule">
        <PrintTable
          headers={["Time", "Block", "Location", "Role", "Coverage", "People"]}
          rows={exports.masterScheduleRows.map((row) => [
            formatRange(row.startsAt, row.endsAt, timezone),
            row.label,
            row.location,
            row.role,
            `${row.assigned}/${row.needed}${row.open > 0 ? ` (${row.open} open)` : ""}`,
            row.people || "Unassigned",
          ])}
        />
      </PrintSection>

      <PrintSection title="No-response and decline list">
        <PrintTable
          headers={["Time", "Volunteer", "Block", "Role", "Status", "Note"]}
          rows={exports.responseRows.map((row) => [
            formatRange(row.startsAt, row.endsAt, timezone),
            `${row.volunteerName}${row.email ? ` <${row.email}>` : ""}`,
            row.blockLabel,
            row.role,
            formatCrewValue(row.reason),
            row.responseNote,
          ])}
          empty="No missing, pending, declined, or change-requested responses."
        />
      </PrintSection>

      {exports.roleSheets.map((sheet) => (
        <PrintSection key={sheet.roleType} title={`${sheet.roleLabel} sheet`}>
          <PrintTable
            headers={[
              "Time",
              "Volunteer",
              "Email",
              "Block",
              "Location",
              "Status",
            ]}
            rows={sheet.rows.map((row) => [
              formatRange(row.startsAt, row.endsAt, timezone),
              row.volunteerName,
              row.email,
              row.blockLabel,
              row.location,
              formatCrewValue(row.confirmationStatus),
            ])}
          />
        </PrintSection>
      ))}

      {exports.judgeHeatLaneSheets.map((sheet) => (
        <PrintSection key={sheet.heatId} title={`${sheet.label} judge lanes`}>
          <p className="mb-2 text-sm">
            {formatExportDate(sheet.startsAt, timezone)} / {sheet.venueName}
          </p>
          <PrintTable
            headers={["Lane", "Judge", "Email", "Position", "Status"]}
            rows={sheet.rows.map((row) => [
              row.laneNumber,
              row.judgeName,
              row.email,
              row.position,
              formatCrewValue(row.confirmationStatus),
            ])}
          />
        </PrintSection>
      ))}

      {exports.floorLeadSheets.map((sheet) => (
        <PrintSection
          key={sheet.floorName}
          title={`${sheet.floorName} floor lead`}
        >
          <PrintTable
            headers={["Time", "Block", "Role", "Coverage", "People"]}
            rows={sheet.rows.map((row) => [
              formatRange(row.startsAt, row.endsAt, timezone),
              row.label,
              row.role,
              `${row.assigned}/${row.needed}${row.open > 0 ? ` (${row.open} open)` : ""}`,
              row.people || "Unassigned",
            ])}
          />
          <div className="mt-4">
            <PrintTable
              headers={["Time", "Heat", "Lane", "Judge", "Status"]}
              rows={sheet.judgeRows.map((row) => [
                formatRange(row.startsAt, row.endsAt, timezone),
                `${row.workoutName} heat ${row.heatNumber}`,
                row.laneNumber,
                row.judgeName,
                formatCrewValue(row.confirmationStatus),
              ])}
              empty="No judge lanes for this floor."
            />
          </div>
        </PrintSection>
      ))}
    </section>
  )
}

function PrintSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="break-inside-avoid space-y-3 print:break-before-page first:print:break-before-auto">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function PrintTable({
  headers,
  rows,
  empty = "No rows.",
}: {
  headers: string[]
  rows: Array<Array<ReactNode>>
  empty?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm">{empty}</p>
  }

  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} className="border px-2 py-1 font-semibold">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.map(toPrintKeyPart).join("|")}>
            {headers.map((header, cellIndex) => (
              <td key={header} className="border px-2 py-1 align-top">
                {row[cellIndex]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function toPrintKeyPart(value: ReactNode) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }
  return ""
}

function JudgeHeatSheetPreview({
  sheet,
  timezone,
}: {
  sheet: CrewPilotJudgeHeatLaneSheet
  timezone: string
}) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{sheet.label}</p>
          <p className="text-muted-foreground">
            {formatExportDate(sheet.startsAt, timezone)} / {sheet.venueName}
          </p>
        </div>
        <StatusPill>{sheet.rows.length} lanes</StatusPill>
      </div>
      <div className="mt-3 grid gap-2">
        {sheet.rows.map((row) => (
          <div
            key={`${sheet.heatId}:${row.laneNumber}`}
            className="grid grid-cols-[4rem_1fr_auto] gap-2"
          >
            <span className="text-muted-foreground">Lane {row.laneNumber}</span>
            <span>{row.judgeName}</span>
            <span className="text-muted-foreground">
              {formatCrewValue(row.confirmationStatus)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoleSheetPreview({
  sheet,
  timezone,
}: {
  sheet: CrewPilotRoleSheet
  timezone: string
}) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold">{sheet.roleLabel}</h4>
        <StatusPill>{sheet.rows.length} rows</StatusPill>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {sheet.rows.slice(0, 8).map((row, index) => (
          <div
            key={`${row.blockId}:${row.assignmentId ?? index}`}
            className="grid gap-1 rounded-md border p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{row.volunteerName}</p>
              <span className="text-muted-foreground">
                {formatCrewValue(row.confirmationStatus)}
              </span>
            </div>
            <p className="text-muted-foreground">
              {row.blockLabel} / {row.location}
            </p>
            <p className="text-muted-foreground">
              {formatRange(row.startsAt, row.endsAt, timezone)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FloorLeadSheetPreview({
  sheet,
  timezone,
}: {
  sheet: CrewPilotFloorLeadSheet
  timezone: string
}) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold">{sheet.floorName}</h4>
        <StatusPill>
          {sheet.rows.length} blocks / {sheet.judgeRows.length} lanes
        </StatusPill>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          {sheet.rows.slice(0, 8).map((row) => (
            <div key={`${row.blockType}:${row.blockId}`}>
              <p className="font-medium">{row.label}</p>
              <p className="text-muted-foreground">
                {formatRange(row.startsAt, row.endsAt, timezone)} / {row.role}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm">
          {sheet.judgeRows.slice(0, 8).map((row) => (
            <div key={`${row.heatId}:${row.laneNumber}`}>
              <p className="font-medium">
                {row.workoutName} heat {row.heatNumber}, lane {row.laneNumber}
              </p>
              <p className="text-muted-foreground">{row.judgeName}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function MetricPanel({ label, value }: { label: string; value: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </section>
  )
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function formatRange(
  startsAt: string | null,
  endsAt: string | null,
  timezone: string,
) {
  const start = formatExportDate(startsAt, timezone)
  const end = formatExportDate(endsAt, timezone)
  if (start && end) return `${start} - ${end}`
  return start || end || "Unscheduled"
}

function formatExportDate(value: string | null, timezone: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ""
    : formatDateTimeInTimezone(date, timezone)
}

function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
