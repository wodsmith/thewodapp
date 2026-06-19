import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId")({
  component: EventShell,
})

function EventShell() {
  const { eventId } = Route.useParams()

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{eventId}</p>
          <h1 className="text-3xl font-semibold">Crew event overview</h1>
          <p className="text-muted-foreground">
            Placeholder operations shell for staffing, volunteers, and
            schedules.
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
            to="/events/$eventId/volunteers"
            params={{ eventId }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Volunteers
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
