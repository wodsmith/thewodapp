import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/events/$eventId/volunteers")({
  component: VolunteersPage,
})

function VolunteersPage() {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Volunteers</h2>
      <p className="mt-2 text-muted-foreground">
        Volunteer signup, invitations, confirmations, and crew roster tools are
        intentionally placeholder-only in this route trim.
      </p>
    </section>
  )
}
