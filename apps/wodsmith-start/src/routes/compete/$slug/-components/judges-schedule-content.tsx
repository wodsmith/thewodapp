"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import type {
  JudgesScheduleEvent,
  JudgesScheduleHeat,
} from "@/server-fns/judge-scheduling-fns"
import { cn } from "@/utils/cn"
import { formatTrackOrder } from "@/utils/format-track-order"

interface JudgesScheduleContentProps {
  competitionName: string
  events: JudgesScheduleEvent[]
  timezone: string
}

interface DayGroup {
  dateKey: string
  label: string
  events: JudgesScheduleEvent[]
}

type ScheduleMode = "master" | "judges"
type ScheduleJudge = JudgesScheduleHeat["judges"][number]
type LaneAssignment = JudgesScheduleHeat["laneAssignments"][number]

interface LaneData {
  judge: ScheduleJudge | null
  registration: LaneAssignment["registration"]
  division: string | null
}

interface JudgePacketAssignment {
  event: JudgesScheduleEvent
  heat: JudgesScheduleHeat
  judge: ScheduleJudge
  lane: LaneData | null
}

interface JudgePacket {
  membershipId: string
  name: string
  assignments: JudgePacketAssignment[]
}

const PRINT_LANES_PER_ROW = 6

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return new Date(value.getTime())
  return new Date(value)
}

function getDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function formatDayLabel(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatCompactDayLabel(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function getFullName(
  firstName: string | null,
  lastName: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Unassigned"
}

function formatTimeCap(seconds: number | null): string | null {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds
    ? `${minutes}:${remainingSeconds.toString().padStart(2, "0")} cap`
    : `${minutes} min cap`
}

function formatScheme(scheme: string): string {
  return scheme
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }
  return chunks
}

function getMaxLanes(event: JudgesScheduleEvent): number {
  return Math.max(
    ...event.heats.map((heat) =>
      Math.max(
        heat.venue?.laneCount ?? 0,
        ...heat.laneAssignments.map((lane) => lane.laneNumber),
        ...heat.judges.map((judge) => judge.laneNumber ?? 0),
      ),
    ),
    1,
  )
}

function getLaneData(
  heat: JudgesScheduleHeat,
  maxLanes: number,
): Map<number, LaneData> {
  const laneData = new Map<number, LaneData>()
  for (let laneNumber = 1; laneNumber <= maxLanes; laneNumber += 1) {
    laneData.set(laneNumber, {
      judge: null,
      registration: null,
      division: null,
    })
  }
  for (const assignment of heat.laneAssignments) {
    laneData.set(assignment.laneNumber, {
      judge: laneData.get(assignment.laneNumber)?.judge ?? null,
      registration: assignment.registration,
      division: assignment.division?.label ?? null,
    })
  }
  for (const judge of heat.judges) {
    if (!judge.laneNumber) continue
    const existing = laneData.get(judge.laneNumber)
    laneData.set(judge.laneNumber, {
      judge,
      registration: existing?.registration ?? null,
      division: existing?.division ?? null,
    })
  }
  return laneData
}

function getCompetitorLabel(lane: LaneData): string {
  return (
    lane.registration?.teamName ??
    lane.registration?.athleteNames[0] ??
    "Unassigned athlete"
  )
}

function getDayGroups(
  events: JudgesScheduleEvent[],
  timezone: string,
): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const event of events) {
    const heatsByDay = new Map<
      string,
      { label: string; heats: JudgesScheduleHeat[] }
    >()
    for (const heat of event.heats) {
      const dateKey = heat.scheduledTime
        ? getDateKey(toDate(heat.scheduledTime), timezone)
        : "unscheduled"
      const label = heat.scheduledTime
        ? formatDayLabel(toDate(heat.scheduledTime), timezone)
        : "Unscheduled"
      const existing = heatsByDay.get(dateKey)
      if (existing) existing.heats.push(heat)
      else heatsByDay.set(dateKey, { label, heats: [heat] })
    }
    for (const [dateKey, { label, heats }] of heatsByDay) {
      const eventSlice = { ...event, heats }
      const existing = groups.get(dateKey)
      if (existing) existing.events.push(eventSlice)
      else groups.set(dateKey, { dateKey, label, events: [eventSlice] })
    }
  }
  return Array.from(groups.values()).sort((first, second) => {
    if (first.dateKey === "unscheduled") return 1
    if (second.dateKey === "unscheduled") return -1
    return first.dateKey.localeCompare(second.dateKey)
  })
}

function getJudgePackets(events: JudgesScheduleEvent[]): JudgePacket[] {
  const packets = new Map<string, JudgePacket>()
  for (const event of events) {
    for (const heat of event.heats) {
      const maxLanes = getMaxLanes(event)
      const lanes = getLaneData(heat, maxLanes)
      for (const judge of heat.judges) {
        const packet = packets.get(judge.membershipId) ?? {
          membershipId: judge.membershipId,
          name: getFullName(judge.firstName, judge.lastName),
          assignments: [],
        }
        packet.assignments.push({
          event,
          heat,
          judge,
          lane: judge.laneNumber ? (lanes.get(judge.laneNumber) ?? null) : null,
        })
        packets.set(judge.membershipId, packet)
      }
    }
  }

  for (const packet of packets.values()) {
    packet.assignments.sort((first, second) => {
      const firstTime = first.heat.scheduledTime
        ? toDate(first.heat.scheduledTime).getTime()
        : Number.MAX_SAFE_INTEGER
      const secondTime = second.heat.scheduledTime
        ? toDate(second.heat.scheduledTime).getTime()
        : Number.MAX_SAFE_INTEGER
      return (
        firstTime - secondTime ||
        first.event.trackOrder - second.event.trackOrder ||
        first.heat.heatNumber - second.heat.heatNumber
      )
    })
  }

  return Array.from(packets.values()).sort((first, second) =>
    first.name.localeCompare(second.name),
  )
}

export function JudgesScheduleContent({
  competitionName,
  events,
  timezone,
}: JudgesScheduleContentProps) {
  const [mode, setMode] = useState<ScheduleMode>("master")
  const [selectedJudgeId, setSelectedJudgeId] = useState("all")
  const dayGroups = useMemo(
    () => getDayGroups(events, timezone),
    [events, timezone],
  )
  const judgePackets = useMemo(() => getJudgePackets(events), [events])
  const visibleJudgePackets =
    selectedJudgeId === "all"
      ? judgePackets
      : judgePackets.filter((packet) => packet.membershipId === selectedJudgeId)

  if (events.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Judge schedules
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {competitionName}
          </p>
        </div>
        <div className="rounded-lg border border-dashed px-5 py-10 text-center print:hidden">
          <p className="font-medium">No schedule to print</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add heats and publish judge assignments, then return here.
          </p>
        </div>
      </div>
    )
  }

  const heatCount = events.reduce(
    (total, event) => total + event.heats.length,
    0,
  )

  return (
    <div className="space-y-8 print:space-y-0">
      <header className="print:hidden">
        <div className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Judge schedules
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {competitionName} · {events.length} events · {heatCount} heats ·{" "}
              {judgePackets.length} judges
            </p>
          </div>
          <fieldset className="inline-flex w-fit rounded-xl bg-muted p-1">
            <legend className="sr-only">Schedule format</legend>
            <Button
              type="button"
              size="sm"
              variant={mode === "master" ? "default" : "ghost"}
              aria-pressed={mode === "master"}
              onClick={() => setMode("master")}
            >
              Master grid
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "judges" ? "default" : "ghost"}
              aria-pressed={mode === "judges"}
              onClick={() => setMode("judges")}
            >
              Judge packets
            </Button>
          </fieldset>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {mode === "master"
            ? "A floor-wide view of every heat, lane, judge, and competitor."
            : "Personal run sheets with each judge’s assignments and workout briefs."}
        </p>
      </header>

      {mode === "master" ? (
        <MasterSchedule
          competitionName={competitionName}
          dayGroups={dayGroups}
          timezone={timezone}
        />
      ) : (
        <JudgePackets
          competitionName={competitionName}
          packets={visibleJudgePackets}
          allPackets={judgePackets}
          selectedJudgeId={selectedJudgeId}
          onJudgeChange={setSelectedJudgeId}
          timezone={timezone}
        />
      )}
    </div>
  )
}

function MasterSchedule({
  competitionName,
  dayGroups,
  timezone,
}: {
  competitionName: string
  dayGroups: DayGroup[]
  timezone: string
}) {
  return (
    <section>
      <div className="space-y-6 print:hidden">
        {dayGroups.map((dayGroup) => (
          <section key={dayGroup.dateKey} className="space-y-4">
            <h2 className="text-base font-semibold">{dayGroup.label}</h2>
            {dayGroup.events.map((event) => (
              <MasterEventTable
                key={event.trackWorkoutId}
                event={event}
                timezone={timezone}
              />
            ))}
          </section>
        ))}
      </div>

      <div className="hidden text-black print:block">
        {dayGroups.flatMap((dayGroup) =>
          dayGroup.events.map((event, eventIndex) => (
            <PrintMasterEvent
              key={`${dayGroup.dateKey}:${event.trackWorkoutId}`}
              event={event}
              competitionName={competitionName}
              dayLabel={dayGroup.label}
              timezone={timezone}
              pageBreak={dayGroup !== dayGroups[0] || eventIndex > 0}
            />
          )),
        )}
      </div>
    </section>
  )
}

function MasterEventTable({
  event,
  timezone,
}: {
  event: JudgesScheduleEvent
  timezone: string
}) {
  const maxLanes = getMaxLanes(event)
  const laneNumbers = Array.from({ length: maxLanes }, (_, index) => index + 1)
  return (
    <article className="overflow-hidden rounded-lg border">
      <header className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-semibold text-orange-700 dark:text-orange-400">
            Event {formatTrackOrder(event.trackOrder)}
          </span>
          <h3 className="truncate font-semibold">{event.eventName}</h3>
        </div>
        <WorkoutMeta event={event} />
      </header>
      {maxLanes > 1 && (
        <p className="border-b px-4 py-2 text-[11px] text-muted-foreground sm:hidden">
          Swipe to view every lane
        </p>
      )}
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed border-collapse text-left"
          style={{ minWidth: `${152 + maxLanes * 176}px` }}
        >
          <caption className="sr-only">
            {event.eventName} judge and competitor lane assignments
          </caption>
          <colgroup>
            <col className="w-[152px]" />
            {laneNumbers.map((laneNumber) => (
              <col key={laneNumber} className="w-44" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/15 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">
                Heat
              </th>
              {laneNumbers.map((laneNumber) => (
                <th
                  key={laneNumber}
                  scope="col"
                  className="border-l px-3 py-2.5"
                >
                  Lane {laneNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {event.heats.map((heat) => {
              const lanes = getLaneData(heat, maxLanes)
              const floatingJudges = heat.judges.filter(
                (judge) => !judge.laneNumber,
              )
              return (
                <tr key={heat.id} className="align-top">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <p className="text-sm font-semibold">
                      Heat {heat.heatNumber}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {heat.scheduledTime
                        ? formatTime(toDate(heat.scheduledTime), timezone)
                        : "Time TBD"}
                      {heat.venue && (
                        <>
                          <br />
                          {heat.venue.name}
                        </>
                      )}
                    </p>
                    {floatingJudges.length > 0 && (
                      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                        Floor:{" "}
                        {floatingJudges
                          .map((judge) =>
                            getFullName(judge.firstName, judge.lastName),
                          )
                          .join(", ")}
                      </p>
                    )}
                  </th>
                  {laneNumbers.map((laneNumber) => (
                    <MasterLaneCell
                      key={laneNumber}
                      lane={lanes.get(laneNumber)}
                    />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function MasterLaneCell({ lane }: { lane: LaneData | undefined }) {
  const hasAssignment = !!lane?.judge || !!lane?.registration
  return (
    <td
      className={cn(
        "border-l px-3 py-3 align-top",
        !hasAssignment && "bg-muted/10",
      )}
    >
      {hasAssignment ? (
        <>
          <p className="truncate text-sm font-semibold">
            {lane?.judge
              ? getFullName(lane.judge.firstName, lane.judge.lastName)
              : "No judge"}
          </p>
          <p className="mt-2 truncate text-xs font-medium">
            {lane ? getCompetitorLabel(lane) : "No competitor"}
          </p>
          {lane?.registration?.teamName &&
            lane.registration.athleteNames.length > 0 && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {lane.registration.athleteNames.join(", ")}
              </p>
            )}
          {lane?.division && (
            <p className="mt-2 text-[10px] font-medium text-muted-foreground">
              {lane.division}
            </p>
          )}
        </>
      ) : (
        <span className="text-sm text-muted-foreground/60">—</span>
      )}
    </td>
  )
}

function WorkoutMeta({ event }: { event: JudgesScheduleEvent }) {
  const timeCap = formatTimeCap(event.timeCapSeconds)
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {[formatScheme(event.workoutScheme), timeCap].filter(Boolean).join(" / ")}
    </p>
  )
}

function PrintDocumentHeader({
  title,
  competitionName,
  subtitle,
}: {
  title: string
  competitionName: string
  subtitle?: string
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-6 border-b-2 border-black pb-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em]">
          {competitionName}
        </p>
        {subtitle && <p className="mt-1 text-xs text-gray-600">{subtitle}</p>}
      </div>
      <div
        className="flex shrink-0 items-center gap-2"
        role="img"
        aria-label="WODsmith Compete"
      >
        <img
          src="/wodsmith-logo-no-text.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7"
        />
        <div className="leading-none">
          <p className="text-[11px] tracking-tight">
            <span className="font-black uppercase">WOD</span>
            <span className="font-semibold">smith</span>
          </p>
          <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.2em] text-gray-600">
            Compete
          </p>
        </div>
      </div>
    </header>
  )
}

function PrintMasterEvent({
  event,
  competitionName,
  dayLabel,
  timezone,
  pageBreak,
}: {
  event: JudgesScheduleEvent
  competitionName: string
  dayLabel: string
  timezone: string
  pageBreak: boolean
}) {
  const maxLanes = getMaxLanes(event)
  const laneChunks = chunkArray(
    Array.from({ length: maxLanes }, (_, index) => index + 1),
    PRINT_LANES_PER_ROW,
  )
  return (
    <article className={cn(pageBreak && "break-before-page pt-1")}>
      <PrintDocumentHeader
        title="Master judge schedule"
        competitionName={competitionName}
      />
      <div className="mb-3 border-b border-gray-500 pb-2">
        <h2 className="text-base font-bold">
          Event {formatTrackOrder(event.trackOrder)}: {event.eventName}
        </h2>
        <p className="text-xs text-gray-600">
          {dayLabel} /{" "}
          {[
            formatScheme(event.workoutScheme),
            formatTimeCap(event.timeCapSeconds),
          ]
            .filter(Boolean)
            .join(" / ")}
        </p>
      </div>
      {event.heats.map((heat) => {
        const lanes = getLaneData(heat, maxLanes)
        const floatingJudges = heat.judges.filter((judge) => !judge.laneNumber)
        return (
          <section key={heat.id} className="mb-4 break-inside-avoid">
            <p className="mb-1 text-xs font-bold">
              Heat {heat.heatNumber}
              {heat.scheduledTime &&
                ` / ${formatTime(toDate(heat.scheduledTime), timezone)}`}
              {heat.venue && ` / ${heat.venue.name}`}
            </p>
            {floatingJudges.length > 0 && (
              <p className="mb-1 text-[9px] text-gray-600">
                Floor judges:{" "}
                {floatingJudges
                  .map((judge) => getFullName(judge.firstName, judge.lastName))
                  .join(", ")}
              </p>
            )}
            {laneChunks.map((laneNumbers) => (
              <table
                key={laneNumbers[0]}
                className="mb-2 w-full table-fixed border-collapse text-[9px] leading-tight"
              >
                <thead>
                  <tr>
                    {laneNumbers.map((laneNumber) => (
                      <th
                        key={laneNumber}
                        className="border border-gray-500 bg-gray-100 px-1.5 py-1 text-left"
                      >
                        Lane {laneNumber}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {laneNumbers.map((laneNumber) => {
                      const lane = lanes.get(laneNumber)
                      return (
                        <td
                          key={laneNumber}
                          className="h-20 border border-gray-500 px-1.5 py-1.5 align-top"
                        >
                          <p className="font-bold">
                            {lane?.judge
                              ? getFullName(
                                  lane.judge.firstName,
                                  lane.judge.lastName,
                                )
                              : "Judge: —"}
                          </p>
                          <p className="mt-1 font-semibold">
                            {lane ? getCompetitorLabel(lane) : "Athlete: —"}
                          </p>
                          {lane?.registration?.teamName && (
                            <p className="mt-0.5 text-gray-700">
                              {lane.registration.athleteNames.join(" / ") ||
                                "—"}
                            </p>
                          )}
                          {lane?.division && (
                            <p className="mt-1 text-gray-600">
                              {lane.division}
                            </p>
                          )}
                        </td>
                      )
                    })}
                    {laneNumbers.length < PRINT_LANES_PER_ROW &&
                      Array.from({
                        length: PRINT_LANES_PER_ROW - laneNumbers.length,
                      }).map((_, index) => (
                        <td
                          // biome-ignore lint/suspicious/noArrayIndexKey: Print-only filler cells have no identity.
                          key={index}
                          className="border-0"
                        />
                      ))}
                  </tr>
                </tbody>
              </table>
            ))}
          </section>
        )
      })}
    </article>
  )
}

function JudgePackets({
  competitionName,
  packets,
  allPackets,
  selectedJudgeId,
  onJudgeChange,
  timezone,
}: {
  competitionName: string
  packets: JudgePacket[]
  allPackets: JudgePacket[]
  selectedJudgeId: string
  onJudgeChange: (membershipId: string) => void
  timezone: string
}) {
  return (
    <section>
      <div className="mb-5 flex flex-col gap-2 border-b pb-5 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm">
          <label htmlFor="judge-packet-select" className="text-sm font-medium">
            Print sheets for
          </label>
          <select
            id="judge-packet-select"
            value={selectedJudgeId}
            onChange={(event) => onJudgeChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="all">All judges ({allPackets.length} sheets)</option>
            {allPackets.map((packet) => (
              <option key={packet.membershipId} value={packet.membershipId}>
                {packet.name} ({packet.assignments.length} heats)
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          One judge per printed page
        </p>
      </div>

      {packets.length > 0 ? (
        <>
          <div className="space-y-5 print:hidden">
            {packets.map((packet) => (
              <JudgePacketCard
                key={packet.membershipId}
                packet={packet}
                timezone={timezone}
              />
            ))}
          </div>
          <div className="hidden text-black print:block">
            {packets.map((packet, index) => (
              <PrintJudgePacket
                key={packet.membershipId}
                packet={packet}
                competitionName={competitionName}
                timezone={timezone}
                pageBreak={index > 0}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed px-5 py-10 text-center print:hidden">
          <p className="font-medium">No judge sheets available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish judge assignments to create personal sheets.
          </p>
        </div>
      )}
    </section>
  )
}

function JudgePacketCard({
  packet,
  timezone,
}: {
  packet: JudgePacket
  timezone: string
}) {
  return (
    <article className="overflow-hidden rounded-lg border">
      <header className="flex items-baseline justify-between gap-4 border-b bg-muted/30 px-5 py-4">
        <h2 className="text-lg font-semibold">{packet.name}</h2>
        <p className="shrink-0 text-xs text-muted-foreground">
          {packet.assignments.length} assigned heat
          {packet.assignments.length === 1 ? "" : "s"}
        </p>
      </header>
      <div className="divide-y">
        {packet.assignments.map((assignment) => (
          <JudgeAssignmentBlock
            key={assignment.judge.assignmentId}
            assignment={assignment}
            timezone={timezone}
          />
        ))}
      </div>
    </article>
  )
}

function JudgeAssignmentBlock({
  assignment,
  timezone,
}: {
  assignment: JudgePacketAssignment
  timezone: string
}) {
  const { event, heat, judge, lane } = assignment
  const competitor = lane ? getCompetitorLabel(lane) : "Floating assignment"
  return (
    <section className="break-inside-avoid p-5">
      <div className="grid gap-5 sm:grid-cols-[9rem_1fr] print:grid-cols-[8rem_1fr]">
        <div>
          <p className="text-xs font-medium text-muted-foreground print:text-gray-600">
            {heat.scheduledTime
              ? formatCompactDayLabel(toDate(heat.scheduledTime), timezone)
              : "Unscheduled"}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {heat.scheduledTime
              ? formatTime(toDate(heat.scheduledTime), timezone)
              : "Time TBD"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
            Heat {heat.heatNumber}
            {judge.laneNumber ? ` / Lane ${judge.laneNumber}` : " / Floor"}
          </p>
          {heat.venue && (
            <p className="mt-1 text-xs text-muted-foreground print:text-gray-600">
              {heat.venue.name}
            </p>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-semibold">
              Event {formatTrackOrder(event.trackOrder)}: {event.eventName}
            </h3>
            {lane?.division && (
              <span className="text-xs font-semibold">{lane.division}</span>
            )}
          </div>
          <dl className="mt-3 grid gap-x-5 gap-y-2 border-y py-3 text-xs sm:grid-cols-2 print:grid-cols-2">
            <div>
              <dt className="text-muted-foreground print:text-gray-600">
                Athlete / team
              </dt>
              <dd className="mt-0.5 font-semibold">{competitor}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground print:text-gray-600">
                Roster
              </dt>
              <dd className="mt-0.5 font-medium">
                {lane?.registration?.athleteNames.join(", ") || "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-3">
            <p className="text-xs font-medium">Workout</p>
            <p className="mt-0.5 text-xs text-muted-foreground print:text-gray-700">
              {[
                formatScheme(event.workoutScheme),
                formatTimeCap(event.timeCapSeconds),
              ]
                .filter(Boolean)
                .join(" / ")}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground print:text-xs print:leading-5 print:text-gray-800">
              {event.workoutDescription || "No workout description provided."}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function PrintJudgePacket({
  packet,
  competitionName,
  timezone,
  pageBreak,
}: {
  packet: JudgePacket
  competitionName: string
  timezone: string
  pageBreak: boolean
}) {
  const packetEvents = Array.from(
    new Map(
      packet.assignments.map((assignment) => [
        assignment.event.trackWorkoutId,
        assignment.event,
      ]),
    ).values(),
  )

  return (
    <article className={cn(pageBreak && "break-before-page pt-1")}>
      <PrintDocumentHeader
        title={packet.name}
        competitionName={competitionName}
        subtitle={`Judge run sheet / ${packet.assignments.length} assigned heat${packet.assignments.length === 1 ? "" : "s"}`}
      />
      <table className="w-full table-fixed border-collapse text-[9px] leading-tight">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="w-[16%] border border-gray-500 px-2 py-1.5">Time</th>
            <th className="w-[24%] border border-gray-500 px-2 py-1.5">
              Assignment
            </th>
            <th className="w-[25%] border border-gray-500 px-2 py-1.5">
              Athlete / team
            </th>
            <th className="w-[35%] border border-gray-500 px-2 py-1.5">
              Roster
            </th>
          </tr>
        </thead>
        <tbody>
          {packet.assignments.map(({ event, heat, judge, lane }) => (
            <tr key={judge.assignmentId} className="break-inside-avoid">
              <td className="border border-gray-500 px-2 py-2 align-top">
                <p className="font-bold">
                  {heat.scheduledTime
                    ? formatTime(toDate(heat.scheduledTime), timezone)
                    : "TBD"}
                </p>
                <p className="mt-0.5 text-gray-600">
                  {heat.scheduledTime
                    ? formatCompactDayLabel(
                        toDate(heat.scheduledTime),
                        timezone,
                      )
                    : "Unscheduled"}
                </p>
              </td>
              <td className="border border-gray-500 px-2 py-2 align-top">
                <p className="font-bold">
                  Event {formatTrackOrder(event.trackOrder)}: {event.eventName}
                </p>
                <p className="mt-0.5">
                  Heat {heat.heatNumber}
                  {judge.laneNumber
                    ? ` / Lane ${judge.laneNumber}`
                    : " / Floor"}
                </p>
                {heat.venue && (
                  <p className="mt-0.5 text-gray-600">{heat.venue.name}</p>
                )}
              </td>
              <td className="border border-gray-500 px-2 py-2 align-top">
                <p className="font-bold">
                  {lane ? getCompetitorLabel(lane) : "Floating assignment"}
                </p>
                {lane?.division && (
                  <p className="mt-0.5 text-gray-600">{lane.division}</p>
                )}
              </td>
              <td className="border border-gray-500 px-2 py-2 align-top">
                {lane?.registration?.athleteNames.join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 break-inside-avoid">
        <h2 className="border-b border-gray-500 pb-1 text-xs font-bold">
          Workout briefs
        </h2>
        <div className="divide-y divide-gray-300">
          {packetEvents.map((event) => (
            <div key={event.trackWorkoutId} className="py-2 text-[9px]">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-bold">
                  Event {formatTrackOrder(event.trackOrder)}: {event.eventName}
                </h3>
                <p className="shrink-0 text-gray-600">
                  {[
                    formatScheme(event.workoutScheme),
                    formatTimeCap(event.timeCapSeconds),
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              </div>
              <p className="mt-1 whitespace-pre-line leading-4 text-gray-800">
                {event.workoutDescription || "No workout description provided."}
              </p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mt-5 border-t border-gray-400 pt-2 text-[9px] text-gray-600">
        Arrive before each listed heat and check in with the floor lead for any
        last-minute lane changes.
      </footer>
    </article>
  )
}
