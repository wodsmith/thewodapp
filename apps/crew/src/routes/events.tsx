import { createFileRoute, Link } from "@tanstack/react-router"
import {
  calculateSetupProgress,
  parseCrewSettings,
} from "@/lib/crew-event-setup"
import { listCrewEventsFn } from "@/server-fns/crew-event-settings-fns"

export const Route = createFileRoute("/events")({
  loader: async () => await listCrewEventsFn(),
  component: EventsPage,
})

function EventsPage() {
  const { events } = Route.useLoaderData()

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="text-muted-foreground">
            Crew-only event setup records backed by normal competitions.
          </p>
        </div>
        <Link
          to="/events/new"
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No Crew events yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the first Crew event to add a normal competition and its Crew
            settings row.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => {
            const setupProgress = calculateSetupProgress(
              parseCrewSettings(event.settings.settings).setup,
            )

            return (
              <Link
                key={event.settings.id}
                to="/events/$eventId"
                params={{ eventId: event.competition.id }}
                className="rounded-md border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {event.competition.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {event.competition.startDate} to{" "}
                      {event.competition.endDate}
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {formatValue(event.settings.lifecycle)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium">
                      {formatValue(event.settings.crewPlan)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Concierge</dt>
                    <dd className="font-medium">
                      {formatValue(event.settings.conciergeStatus)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="font-medium">
                      {event.settings.sourcePlatform ?? "Not set"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Setup progress
                    </span>
                    <span className="font-medium">
                      {setupProgress.percent}%
                    </span>
                  </div>
                  <ProgressBar value={setupProgress.percent} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <section className="rounded-md border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Crew events use the competition ID as their route ID. The Crew settings
        table adds setup/import metadata without creating a separate event
        model.
      </section>
    </main>
  )
}

function formatValue(value: string) {
  return value.replaceAll("_", " ")
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
