import { ArrowLeft, ChevronRight, MapPin, Printer, Search } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CrewPublishedSchedule } from "@/lib/crew/published-schedule"

type Assignment =
  CrewPublishedSchedule["volunteers"][number]["assignments"][number]

// @lat: [[crew#Published Volunteer Schedule]]
export function CrewPublicScheduleView({
  schedule,
  preview = false,
}: {
  schedule: CrewPublishedSchedule
  preview?: boolean
}) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = normalizeName(query)
  const matches = useMemo(
    () =>
      normalizedQuery.length < 2
        ? []
        : schedule.volunteers.filter((volunteer) =>
            normalizeName(volunteer.name).includes(normalizedQuery),
          ),
    [schedule.volunteers, normalizedQuery],
  )
  const selected = schedule.volunteers.find(
    (volunteer) => volunteer.id === selectedId,
  )
  const days = new Map<string, Assignment[]>()
  for (const assignment of selected?.assignments ?? []) {
    const day = assignment.startTime
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: schedule.event.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(assignment.startTime))
      : "Time to be confirmed"
    days.set(day, [...(days.get(day) ?? []), assignment])
  }

  return (
    <section className="min-w-0 space-y-7">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {preview ? "Volunteer preview" : "Volunteer schedule"}
        </p>
        <h1 className="break-words text-3xl font-semibold tracking-tight">
          {schedule.event.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          All times in {schedule.event.timezone}.
          {!preview && (
            <>
              {" "}
              Updated{" "}
              {formatPublishedDate(
                schedule.publishedAt,
                schedule.event.timezone,
              )}
              .
            </>
          )}
        </p>
      </header>

      {!selected ? (
        <div className="space-y-5 print:hidden">
          <div className="space-y-2">
            <label
              htmlFor="crew-find-name"
              className="block text-lg font-semibold"
            >
              Find your name
            </label>
            <p className="text-sm text-muted-foreground">
              Enter at least two letters of your first or last name. No account
              needed.
            </p>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground"
              />
              <Input
                ref={searchRef}
                id="crew-find-name"
                type="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 pl-10 text-base md:text-base"
                placeholder="First or last name"
              />
            </div>
          </div>
          <output
            aria-live="polite"
            className="block text-sm text-muted-foreground"
          >
            {normalizedQuery.length >= 2
              ? matches.length > 0
                ? `${matches.length} ${matches.length === 1 ? "volunteer" : "volunteers"} found`
                : "No matching names. Try another spelling or ask your organizer to check the roster."
              : `${schedule.volunteers.length} volunteers on this schedule.`}
          </output>
          <ul className="divide-y rounded-lg border empty:hidden">
            {matches.map((volunteer) => {
              const first = volunteer.assignments[0]
              const duplicateName = schedule.volunteers.some(
                (other) =>
                  other.id !== volunteer.id &&
                  normalizeName(other.name) === normalizeName(volunteer.name),
              )
              return (
                <li key={volunteer.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(volunteer.id)}
                    className="flex min-h-16 w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`View ${volunteer.name}'s schedule`}
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="block break-words font-semibold">
                        {volunteer.name}
                      </span>
                      <span className="block break-words text-sm text-muted-foreground">
                        {first
                          ? `${first.roleLabel}${first.location ? ` · ${first.location}` : ""}`
                          : "No assignments yet"}
                      </span>
                      {duplicateName && (
                        <span className="block text-xs text-muted-foreground">
                          {first?.startTime &&
                            `${formatPublishedDate(first.startTime, schedule.event.timezone)} · ${formatAssignmentTime(first, schedule.event.timezone)} · `}
                          Roster reference {volunteer.id.slice(-6)} · Check your
                          role with the organizer if unsure.
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Button
              variant="ghost"
              className="min-h-11 px-0"
              onClick={() => {
                setSelectedId(null)
                requestAnimationFrame(() => searchRef.current?.focus())
              }}
            >
              <ArrowLeft /> Find another name
            </Button>
            {!preview && (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => window.print()}
              >
                <Printer /> Print my schedule
              </Button>
            )}
          </div>
          <h2 className="break-words text-2xl font-semibold">
            {selected.name}
          </h2>
          {selected.assignments.length === 0 && (
            <p className="rounded-lg border p-5 text-muted-foreground">
              Your assignments haven’t been published yet. Check back here or
              contact your organizer.
            </p>
          )}
          {[...days.entries()].map(([day, assignments]) => (
            <section key={day} className="space-y-3">
              <h3 className="border-b pb-2 font-semibold">
                {assignments[0]?.startTime
                  ? new Intl.DateTimeFormat("en-US", {
                      timeZone: schedule.event.timezone,
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).format(new Date(assignments[0].startTime))
                  : day}
              </h3>
              <ol className="divide-y">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="grid break-inside-avoid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"
                  >
                    <p className="font-medium tabular-nums">
                      {formatAssignmentTime(
                        assignment,
                        schedule.event.timezone,
                      )}
                    </p>
                    <div className="min-w-0 space-y-1">
                      <h4 className="break-words font-semibold">
                        {assignment.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {assignment.roleLabel}
                        {assignment.heatNumber !== null
                          ? ` · Heat ${assignment.heatNumber}`
                          : ""}
                        {assignment.laneNumber !== null
                          ? ` · Lane ${assignment.laneNumber}`
                          : ""}
                      </p>
                      {assignment.location && (
                        <p className="flex items-start gap-1.5 break-words text-sm">
                          <MapPin
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                          />
                          {assignment.location}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="border-t pt-4 text-sm text-muted-foreground print:hidden">
            Keep this link handy for updates. If an assignment looks wrong,
            contact your competition organizer.
          </p>
        </div>
      )}
    </section>
  )
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
}

function formatPublishedDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatAssignmentTime(assignment: Assignment, timezone: string) {
  if (!assignment.startTime) return "Time to be confirmed"
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  })
  const start = formatter.format(new Date(assignment.startTime))
  return assignment.endTime
    ? `${start} – ${formatter.format(new Date(assignment.endTime))}`
    : start
}
