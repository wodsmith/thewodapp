import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  formatVolunteerAvailability,
  formatVolunteerRole,
  type CrewRosterStatus,
  type CrewRosterVolunteer,
} from "@/lib/crew/roster-shifts"
import { getCrewRosterPageFn } from "@/server-fns/crew-roster-shift-fns"

export const Route = createFileRoute("/events/$eventId/volunteers")({
  loader: async ({ params }) =>
    await getCrewRosterPageFn({ data: { eventId: params.eventId } }),
  component: VolunteersPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function VolunteersPage() {
  const { eventId } = parentRoute.useParams()
  const { roster, summary, shiftSummary } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Roster</h2>
          <p className="text-sm text-muted-foreground">
            {summary.total} volunteers, {summary.assignable} assignable
          </p>
        </div>
        <Link
          to="/events/$eventId/shifts"
          params={{ eventId }}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Manage shifts
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatusPanel label="Pending" value={summary.pending} />
        <StatusPanel label="Accepted" value={summary.accepted} />
        <StatusPanel label="Active" value={summary.active} />
        <StatusPanel
          label="Shift coverage"
          value={`${shiftSummary.assignedSlots}/${shiftSummary.capacity}`}
        />
      </div>

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        {roster.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Volunteer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Availability</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((volunteer) => (
                  <VolunteerRow key={volunteer.id} volunteer={volunteer} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h3 className="font-semibold">No volunteers yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Import volunteers or share the public signup link to build the
              roster.
            </p>
          </div>
        )}
      </section>
    </section>
  )
}

function VolunteerRow({ volunteer }: { volunteer: CrewRosterVolunteer }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 align-top">
        <div className="font-medium">{volunteer.name}</div>
        <div className="text-muted-foreground">{volunteer.email}</div>
        {volunteer.phone ? (
          <div className="text-muted-foreground">{volunteer.phone}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={volunteer.status} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {volunteer.roleTypes.map((roleType) => (
            <span
              key={roleType}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              {formatVolunteerRole(roleType)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div>{formatVolunteerAvailability(volunteer.availability)}</div>
        {volunteer.availabilityNotes ? (
          <div className="mt-1 max-w-xs text-muted-foreground">
            {volunteer.availabilityNotes}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        <div>
          {volunteer.imported ? "Imported" : formatCrewValue(volunteer.source)}
        </div>
        {volunteer.signupSource ? (
          <div className="mt-1">{formatCrewValue(volunteer.signupSource)}</div>
        ) : null}
      </td>
    </tr>
  )
}

function StatusPanel({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function StatusBadge({ status }: { status: CrewRosterStatus }) {
  const className =
    status === "active"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : status === "accepted"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
        : status === "pending"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : "border-muted bg-muted text-muted-foreground"

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {formatCrewValue(status)}
    </span>
  )
}
