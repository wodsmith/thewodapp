import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router"
import { getCrewAuthRedirect } from "@/lib/crew/auth-redirect"
import { getCrewAuthStateFn } from "@/server-fns/crew-auth-fns"
import { listCrewEventsFn } from "@/server-fns/crew-event-settings-fns"

export const Route = createFileRoute("/events")({
  beforeLoad: async ({ location }) => {
    const { session } = await getCrewAuthStateFn()

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: getCrewAuthRedirect(location) },
      })
    }
  },
  loader: async () => await listCrewEventsFn(),
  component: EventsPage,
})

function EventsPage() {
  const { events } = Route.useLoaderData()
  const isEventsIndex = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, "") === "/events",
  })

  if (!isEventsIndex) {
    return <Outlet />
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="text-muted-foreground">
            Open an event to manage volunteers and build its schedule.
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
            Create your first event to start building a volunteer schedule.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* @lat: [[crew#Event Setup Dashboard]] */}
          {events.map((event) => (
            <Link
              key={event.settings.id}
              to="/events/$eventId"
              params={{ eventId: event.competition.id }}
              className="rounded-md border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50"
            >
              <h2 className="text-lg font-semibold">
                {event.competition.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.competition.startDate} to {event.competition.endDate}
              </p>
              <p className="mt-4 text-sm font-medium">Open schedule →</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
