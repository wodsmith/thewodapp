import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/")({
  component: EventOverviewPage,
})

function EventOverviewPage() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {[
        ["Volunteer pool", "Placeholder for signup and invite coverage."],
        ["Schedule", "Placeholder for heat, shift, and assignment views."],
        ["Readiness", "Placeholder for event-day operating checks."],
      ].map(([title, description]) => (
        <div key={title} className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
      ))}
    </section>
  )
}
