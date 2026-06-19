import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router"
import { getCrewEventFn } from "@/server-fns/crew-event-settings-fns"

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ params }) => {
    const result = await getCrewEventFn({ data: { eventId: params.eventId } })
    if (!result.event) {
      throw notFound()
    }
    return { event: result.event }
  },
  component: EventShell,
})

function EventShell() {
  const { eventId } = Route.useParams()
  const { event } = Route.useLoaderData()

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{eventId}</p>
          <h1 className="text-3xl font-semibold">{event.competition.name}</h1>
          <p className="text-muted-foreground">
            {event.competition.startDate} to {event.competition.endDate}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Overview
          </Link>
          <Link
            to="/events/$eventId/readiness"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Readiness
          </Link>
          <Link
            to="/events/$eventId/setup"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Setup
          </Link>
          <Link
            to="/events/$eventId/imports"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Imports
          </Link>
          <Link
            to="/events/$eventId/volunteers"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Volunteers
          </Link>
          <Link
            to="/events/$eventId/shifts"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Shifts
          </Link>
          <Link
            to="/events/$eventId/schedule"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Schedule
          </Link>
        </nav>
      </div>

      <Outlet />
    </main>
  )
}
