import { createFileRoute, Link } from "@tanstack/react-router"

const shellEvents = [
  {
    id: "pilot-weekend",
    name: "Pilot Weekend",
    status: "Shell",
    location: "Boise, ID",
  },
  {
    id: "fall-throwdown",
    name: "Fall Throwdown",
    status: "Placeholder",
    location: "Salt Lake City, UT",
  },
]

export const Route = createFileRoute("/events")({
  component: EventsPage,
})

function EventsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="text-muted-foreground">
            Static Crew event placeholders for the trimmed route map.
          </p>
        </div>
        <Link
          to="/events/new"
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New event
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shellEvents.map((event) => (
          <Link
            key={event.id}
            to="/events/$eventId"
            params={{ eventId: event.id }}
            className="rounded-md border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{event.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {event.location}
                </p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                {event.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
