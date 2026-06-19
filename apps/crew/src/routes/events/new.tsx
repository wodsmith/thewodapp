import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/events/new")({
  component: NewEventPage,
})

function NewEventPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold">New Crew event</h1>
        <p className="text-muted-foreground">
          Event creation is a placeholder in this slice. The later Crew event
          settings PR will add the real data model and save flow.
        </p>
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceholderField label="Event name" value="Pilot Weekend" />
          <PlaceholderField label="Primary venue" value="Main gym floor" />
          <PlaceholderField label="Start date" value="Not wired yet" />
          <PlaceholderField label="Crew lead" value="Not wired yet" />
        </div>
      </section>

      <Link
        to="/events"
        className="inline-flex rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Back to events
      </Link>
    </main>
  )
}

function PlaceholderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}
