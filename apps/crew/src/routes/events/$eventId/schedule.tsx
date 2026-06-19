import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/schedule")({
  component: SchedulePage,
})

function SchedulePage() {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Schedule</h2>
      <p className="mt-2 text-muted-foreground">
        Shift, heat, and assignment schedule planning will land in later Crew
        slices. This page exists to prove the route map shape.
      </p>
    </section>
  )
}
