// @lat: [[crew#Series Crew Pools]]
import type { ReactNode } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  CalendarCheck,
  History,
  ShieldCheck,
  Users,
  UserRoundCheck,
} from "lucide-react"
import type { SeriesCrewPoolEntry } from "@/lib/crew/series-crew-pools"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  formatVolunteerAvailability,
  formatVolunteerRole,
} from "@/lib/crew/roster-shifts"
import { getCrewSeriesCrewPoolPageFn } from "@/server-fns/crew-series-fns"

export const Route = createFileRoute("/series/$groupId/crew")({
  loader: async ({ params, location }) =>
    await getCrewSeriesCrewPoolPageFn({
      data: {
        groupId: params.groupId,
        selectedCompetitionIds: getSelectedCompetitionIdsFromSearch(
          location.search as Record<string, unknown>,
        ),
      },
    }),
  component: SeriesCrewPoolPage,
})

function SeriesCrewPoolPage() {
  const { groupId } = Route.useParams()
  const { group, pool } = Route.useLoaderData()
  const navigate = useNavigate()

  function setSelectedCompetition(competitionId: string, selected: boolean) {
    const current = new Set(pool.selectedCompetitionIds)
    if (selected) {
      current.add(competitionId)
    } else if (current.size > 1) {
      current.delete(competitionId)
    }

    void navigate({
      to: "/series/$groupId/crew",
      params: { groupId },
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        events: [...current].join(","),
      }),
      replace: true,
    })
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{group.id}</p>
          <h1 className="text-3xl font-semibold">{group.name}</h1>
          <p className="text-muted-foreground">Series crew pool</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/events"
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Events
          </Link>
        </nav>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric
          icon={<Users className="size-4" />}
          label="Pool"
          value={pool.summary.totalVolunteers}
        />
        <Metric
          icon={<CalendarCheck className="size-4" />}
          label="Placements"
          value={pool.summary.rosterPlacements}
        />
        <Metric
          icon={<UserRoundCheck className="size-4" />}
          label="Selected"
          value={pool.summary.volunteersInSelectedCompetitions}
        />
        <Metric
          icon={<History className="size-4" />}
          label="History"
          value={pool.summary.volunteersWithHistory}
        />
        <Metric
          icon={<ShieldCheck className="size-4" />}
          label="Credentials"
          value={pool.summary.safeCredentialCount}
        />
      </section>

      <section className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Selected competitions</h2>
        </div>
        <div className="grid gap-0 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
          {pool.competitions.map((competition) => (
            <label
              key={competition.id}
              className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={competition.selected}
                disabled={
                  competition.selected &&
                  pool.selectedCompetitionIds.length <= 1
                }
                onChange={(event) =>
                  setSelectedCompetition(competition.id, event.target.checked)
                }
                className="mt-1 size-4"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{competition.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {competition.startDate} to {competition.endDate} -{" "}
                  {competition.rosterCount} rostered
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        {pool.entries.length > 0 ? (
          <div className="divide-y">
            {pool.entries.map((entry) => (
              <SeriesCrewPoolRow key={entry.poolKey} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <h2 className="font-semibold">No rostered volunteers</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add volunteers on an event roster to build the series pool.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

function SeriesCrewPoolRow({ entry }: { entry: SeriesCrewPoolEntry }) {
  const facts = buildSeriesCrewPoolFacts(entry)

  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">{entry.volunteerName}</h3>
          <p className="text-sm text-muted-foreground">
            {entry.rosterEvents.length} roster placement
            {entry.rosterEvents.length === 1 ? "" : "s"} -{" "}
            {entry.priorEventCount} prior series event
            {entry.priorEventCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="space-y-2">
          {entry.rosterEvents.map((event) => (
            <div
              key={`${entry.poolKey}:${event.competitionId}`}
              className="rounded-md border bg-background p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{event.competitionName}</span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs">
                  {event.selected
                    ? "Selected"
                    : formatCrewValue(event.rosterStatus)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {event.roleTypes.map((roleType) => (
                  <span
                    key={roleType}
                    className="rounded-md border px-2 py-1 text-xs"
                  >
                    {formatVolunteerRole(roleType)}
                  </span>
                ))}
                <span className="rounded-md border px-2 py-1 text-xs">
                  {formatVolunteerAvailability(event.availability)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/events/$eventId/volunteers"
                  params={{ eventId: event.competitionId }}
                  className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Roster
                </Link>
                <Link
                  to="/events/$eventId/shifts"
                  params={{ eventId: event.competitionId }}
                  className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Shifts
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <FactList facts={facts} />
        {entry.lastEvent ? (
          <p className="text-sm text-muted-foreground">
            Last series event: {entry.lastEvent.label},{" "}
            {formatSeriesPoolDate(entry.lastEvent.occurredAt)}
          </p>
        ) : null}
        {entry.priorRoleTypes.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Prior roles:{" "}
            {entry.priorRoleTypes.map(formatVolunteerRole).join(", ")}
          </p>
        ) : null}
        {entry.credentials.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Credentials:{" "}
            {entry.credentials
              .map(
                (credential) =>
                  `${credential.credentialLabel} (${formatCrewValue(
                    credential.status,
                  )})`,
              )
              .join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function FactList({ facts }: { facts: string[] }) {
  if (facts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {facts.map((fact) => (
        <span key={fact} className="rounded-md bg-muted px-2 py-1">
          {fact}
        </span>
      ))}
    </div>
  )
}

function buildSeriesCrewPoolFacts(entry: SeriesCrewPoolEntry) {
  const facts = [
    entry.reliability.signedUp
      ? `${entry.reliability.signedUp} signup${plural(entry.reliability.signedUp)}`
      : null,
    entry.reliability.imported
      ? `${entry.reliability.imported} import${plural(entry.reliability.imported)}`
      : null,
    entry.reliability.assigned
      ? `${entry.reliability.assigned} assignment${plural(entry.reliability.assigned)}`
      : null,
    entry.reliability.confirmed
      ? `${entry.reliability.confirmed} confirmed`
      : null,
    entry.reliability.declined
      ? `${entry.reliability.declined} declined`
      : null,
    entry.reliability.changeRequested
      ? `${entry.reliability.changeRequested} change request${plural(
          entry.reliability.changeRequested,
        )}`
      : null,
    entry.reliability.noShow
      ? `${entry.reliability.noShow} no-show${plural(entry.reliability.noShow)}`
      : null,
    entry.reliability.completed
      ? `${entry.reliability.completed} completed`
      : null,
  ]

  return facts.filter((fact): fact is string => Boolean(fact))
}

function getSelectedCompetitionIdsFromSearch(search: Record<string, unknown>) {
  const value = search.events
  if (typeof value !== "string") return undefined
  const selected = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return selected.length > 0 ? selected : undefined
}

function formatSeriesPoolDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
