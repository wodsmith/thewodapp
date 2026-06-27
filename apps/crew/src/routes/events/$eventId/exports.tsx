// @lat: [[crew#Pilot Exports]]
// @lat: [[crew#Event Day Export Packet]]
import {
  createFileRoute,
  getRouteApi,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import { Download, Printer } from "lucide-react"
import type { ReactNode } from "react"
import type {
  CrewPilotExports,
  CrewPilotJudgeEventSection,
  CrewPilotMasterScheduleDaySection,
  CrewPilotShiftSheet,
} from "@/lib/crew/exports/pilot-exports"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  type CrewPilotExportsPageData,
  getCrewPilotExportsPageFn,
} from "@/server-fns/crew-pilot-export-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/exports")({
  loader: async ({ params }) =>
    await getCrewPilotExportsPageFn({
      data: { eventId: params.eventId },
    }),
  component: EventPilotExportsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

const PACKET_TABS = [
  { id: "schedule", label: "Master Schedule" },
  { id: "judges", label: "Judges" },
  { id: "shifts", label: "Shifts" },
] as const

type PacketTabId = (typeof PACKET_TABS)[number]["id"]

function isPacketTabId(value: unknown): value is PacketTabId {
  return PACKET_TABS.some((tab) => tab.id === value)
}

function EventPilotExportsPage() {
  const { eventId } = parentRoute.useParams()
  const { event, exports, sources } = Route.useLoaderData()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { tab?: string }
  const activeTab = isPacketTabId(search.tab) ? search.tab : "schedule"

  function handleTabChange(tabId: PacketTabId) {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        tab: tabId,
      }),
      replace: true,
    })
  }

  return (
    <EventPilotExportsView
      eventId={eventId}
      event={event}
      exports={exports}
      sources={sources}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  )
}

export function EventPilotExportsView({
  event,
  exports,
  sources,
  activeTab,
  onTabChange,
}: EventPilotExportsViewProps) {
  const timezone = event.timezone ?? "America/Denver"

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Print packet</h2>
          <p className="text-sm text-muted-foreground">
            {formatExportDate(exports.generatedAt, timezone)} / {timezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "schedule" ? (
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
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Print
          </button>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b print:hidden"
        role="tablist"
        aria-label="Print packet sections"
      >
        {PACKET_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label} ({getTabCount(tab.id, exports, sources)})
          </button>
        ))}
      </div>

      <PrintHeader
        eventName={event.name}
        subtitle={PACKET_TABS.find((tab) => tab.id === activeTab)?.label ?? ""}
        generatedAt={formatExportDate(exports.generatedAt, timezone)}
      />

      {activeTab === "schedule" ? (
        <ScheduleTab
          daySections={exports.masterScheduleDaySections}
          timezone={timezone}
        />
      ) : null}
      {activeTab === "judges" ? (
        <JudgesTab
          eventSections={exports.judgeEventSections}
          timezone={timezone}
        />
      ) : null}
      {activeTab === "shifts" ? (
        <ShiftsTab shiftSheets={exports.shiftSheets} timezone={timezone} />
      ) : null}
    </section>
  )
}

interface EventPilotExportsViewProps {
  eventId: string
  event: CrewPilotExportsPageData["event"]
  exports: CrewPilotExports
  sources: CrewPilotExportsPageData["sources"]
  activeTab: PacketTabId
  onTabChange: (tabId: PacketTabId) => void
}

function getTabCount(
  tabId: PacketTabId,
  exports: CrewPilotExports,
  sources: CrewPilotExportsPageData["sources"],
) {
  if (tabId === "schedule") return exports.summary.masterScheduleRows
  if (tabId === "judges") return exports.summary.judgeHeatSheets
  return sources.shifts
}

function ScheduleTab({
  daySections,
  timezone,
}: {
  daySections: CrewPilotMasterScheduleDaySection[]
  timezone: string
}) {
  if (daySections.length === 0) {
    return <EmptyState message="No shift or heat rows are ready to export." />
  }

  return (
    <div className="space-y-8">
      {daySections.map((section) => (
        <PacketSection
          key={section.dayKey}
          title={formatPacketDay(section.dayKey)}
        >
          <PacketTable
            headers={[
              "Time",
              "Block",
              "Location",
              "Role",
              "Coverage",
              "People",
            ]}
            rows={section.rows.map((row) => ({
              key: `${row.blockType}:${row.blockId}`,
              cells: [
                formatRange(row.startsAt, row.endsAt, timezone),
                row.label,
                row.location,
                row.role,
                `${row.assigned}/${row.needed}${row.open > 0 ? ` (${row.open} open)` : ""}`,
                row.people || "Unassigned",
              ],
            }))}
          />
        </PacketSection>
      ))}
    </div>
  )
}

function JudgesTab({
  eventSections,
  timezone,
}: {
  eventSections: CrewPilotJudgeEventSection[]
  timezone: string
}) {
  if (eventSections.length === 0) {
    return <EmptyState message="No heats are ready for judge assignment." />
  }

  return (
    <div className="space-y-8">
      {eventSections.map((section) => (
        <PacketSection key={section.workoutId} title={section.workoutName}>
          <div className="space-y-4">
            {section.heats.map((heat) => (
              <div key={heat.heatId} className="break-inside-avoid space-y-1">
                <p className="text-sm font-medium">
                  Heat {heat.heatNumber} / {heat.venueName} /{" "}
                  {formatExportDate(heat.startsAt, timezone) || "Unscheduled"}
                </p>
                <PacketTable
                  headers={["Lane", "Judge", "Position", "Status"]}
                  rows={heat.rows.map((row) => ({
                    key: `${heat.heatId}:lane:${row.laneNumber}`,
                    cells: [
                      row.laneNumber,
                      row.judgeName,
                      row.position,
                      formatCrewValue(row.confirmationStatus),
                    ],
                  }))}
                  empty="No lanes for this heat."
                />
              </div>
            ))}
          </div>
        </PacketSection>
      ))}
    </div>
  )
}

function ShiftsTab({
  shiftSheets,
  timezone,
}: {
  shiftSheets: CrewPilotShiftSheet[]
  timezone: string
}) {
  if (shiftSheets.length === 0) {
    return <EmptyState message="No shifts are ready to export." />
  }

  return (
    <div className="space-y-8">
      {shiftSheets.map((sheet) => (
        <PacketSection
          key={sheet.shiftId}
          title={sheet.name}
          subtitle={`${formatRange(sheet.startsAt, sheet.endsAt, timezone)} / ${sheet.location} / ${sheet.roleLabel} / ${sheet.assigned}/${sheet.needed} filled${sheet.open > 0 ? ` (${sheet.open} open)` : ""}`}
        >
          <PacketTable
            headers={["Volunteer", "Status"]}
            rows={sheet.rows.map((row) => ({
              key: row.rowKey,
              cells: [
                row.volunteerName,
                formatCrewValue(row.confirmationStatus),
              ],
            }))}
            empty="No volunteers on this shift."
          />
        </PacketSection>
      ))}
    </div>
  )
}

function PrintHeader({
  eventName,
  subtitle,
  generatedAt,
}: {
  eventName: string
  subtitle: string
  generatedAt: string
}) {
  return (
    <header className="hidden border-b pb-4 print:block">
      <h1 className="text-2xl font-semibold">{eventName}</h1>
      <p className="text-sm">
        {subtitle} / {generatedAt}
      </p>
    </header>
  )
}

function PacketSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3 break-inside-avoid print:break-before-page first:print:break-before-auto">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle ? (
          <p className="text-sm text-muted-foreground print:text-black">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function PacketTable({
  headers,
  rows,
  empty = "No rows.",
}: {
  headers: string[]
  rows: Array<{ key: string; cells: Array<ReactNode> }>
  empty?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border px-2 py-1 text-xs font-semibold uppercase text-muted-foreground print:text-black"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {headers.map((header, cellIndex) => (
                <td key={header} className="border px-2 py-1 align-top">
                  {row.cells[cellIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function formatPacketDay(dayKey: string) {
  if (dayKey === "Unscheduled") return dayKey
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!match) return dayKey
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return dayKey
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  } catch {
    return dayKey
  }
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
