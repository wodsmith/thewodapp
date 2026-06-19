import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Event-day operations
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            Run the crew without carrying the whole competition platform.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            This shell is scoped to Crew events, volunteer coordination, and
            schedule planning. Registration, scoring, leaderboards, payouts,
            programming, and athlete logs stay out of this app surface.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/events"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View events
          </Link>
          <Link
            to="/events/new"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Draft event
          </Link>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Crew shell routes</h2>
          <div className="grid gap-3 text-sm">
            {[
              ["/events", "Crew event list"],
              ["/events/new", "Event setup placeholder"],
              ["/events/$eventId", "Event operations overview"],
              ["/events/$eventId/setup", "Event setup dashboard"],
              ["/events/$eventId/volunteers", "Volunteer placeholder"],
              ["/events/$eventId/schedule", "Schedule placeholder"],
            ].map(([path, label]) => (
              <div
                key={path}
                className="flex items-center justify-between gap-4 rounded-md border bg-background px-3 py-2"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {path}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
