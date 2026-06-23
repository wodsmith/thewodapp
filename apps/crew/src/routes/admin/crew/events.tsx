// @lat: [[crew#Crew Admin Shell]]
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  type CrewAdminEventListItem,
  getCrewAdminEventListFn,
} from "@/server-fns/crew-admin-event-fns"

export const Route = createFileRoute("/admin/crew/events")({
  loader: async () => await getCrewAdminEventListFn(),
  component: CrewAdminEventsPage,
})

function CrewAdminEventsPage() {
  const { events } = Route.useLoaderData() as {
    events: CrewAdminEventListItem[]
  }
  const isEventsIndex = useRouterState({
    select: (state) =>
      state.location.pathname.replace(/\/$/, "") === "/admin/crew/events",
  })

  if (!isEventsIndex) {
    return <Outlet />
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold">Admin events</h2>
          <p className="text-sm text-muted-foreground">
            Operator-only event list with setup, billing, source, and concierge
            state.
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
          <h3 className="text-lg font-semibold">No Crew events yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the first Crew event to add a competition and Crew settings
            record.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <Link
              key={event.id}
              to="/admin/crew/events/$eventId"
              params={{ eventId: event.id }}
              className="rounded-md border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{event.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {event.startDate} to {event.endDate}
                  </p>
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {formatCrewValue(event.lifecycle)}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Fact
                  label="Concierge"
                  value={formatCrewValue(event.conciergeStatus)}
                />
                <Fact
                  label="Billing"
                  value={formatCrewValue(event.billingState)}
                />
                <Fact
                  label="Source"
                  value={event.sourcePlatform ?? "Not set"}
                />
              </dl>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Setup progress</span>
                  <span className="font-medium">
                    {event.setupProgress.completed}/{event.setupProgress.total}
                  </span>
                </div>
                <ProgressBar value={event.setupProgress.percent} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
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
