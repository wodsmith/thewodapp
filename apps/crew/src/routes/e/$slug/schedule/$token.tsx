import { createFileRoute, notFound } from "@tanstack/react-router"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_LABELS,
  type VolunteerAvailability,
  type VolunteerRoleType,
} from "@/db/schemas/volunteers"
import { getCrewVolunteerScheduleTokenFn } from "@/server-fns/crew-volunteer-fns"

export const Route = createFileRoute("/e/$slug/schedule/$token")({
  loader: async ({ params }) => {
    const result = await getCrewVolunteerScheduleTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (result.status !== "valid" || !result.event || !result.volunteer) {
      throw notFound()
    }

    return result
  },
  component: CrewVolunteerScheduleTokenPage,
  head: ({ loaderData }) => {
    const event = loaderData?.event
    if (!event) {
      return { meta: [{ title: "Volunteer Schedule Not Found" }] }
    }

    return {
      meta: [
        { title: `${event.name} Volunteer Schedule | WODsmith Crew` },
        {
          name: "description",
          content: `Volunteer schedule details for ${event.name}.`,
        },
      ],
    }
  },
})

function CrewVolunteerScheduleTokenPage() {
  const { event, volunteer } = Route.useLoaderData()

  if (!event || !volunteer) {
    return null
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Volunteer schedule
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {event.startDate} to {event.endDate}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoBlock label="Volunteer" value={volunteer.name ?? "Not provided"} />
        <InfoBlock label="Email" value={volunteer.email} />
        <InfoBlock
          label="Availability"
          value={formatAvailability(volunteer.availability)}
        />
        <InfoBlock
          label="Preferred roles"
          value={formatRoleTypes(volunteer.roleTypes)}
        />
      </section>

      {(volunteer.phone ||
        volunteer.credentials ||
        volunteer.availabilityNotes) && (
        <section className="space-y-4 rounded-md border bg-card p-6 shadow-sm">
          {volunteer.phone && <InfoRow label="Phone" value={volunteer.phone} />}
          {volunteer.credentials && (
            <InfoRow label="Credentials" value={volunteer.credentials} />
          )}
          {volunteer.availabilityNotes && (
            <InfoRow
              label="Availability notes"
              value={volunteer.availabilityNotes}
            />
          )}
        </section>
      )}

      <section className="rounded-md border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Assignments</h2>
        <p className="mt-2 text-muted-foreground">
          No volunteer assignments are published for this link yet.
        </p>
      </section>
    </main>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap font-medium">{value}</p>
    </div>
  )
}

function formatRoleTypes(roleTypes: VolunteerRoleType[]) {
  if (roleTypes.length === 0) return "General"
  return roleTypes
    .map((roleType) => VOLUNTEER_ROLE_LABELS[roleType] ?? roleType)
    .join(", ")
}

function formatAvailability(availability: VolunteerAvailability | null) {
  if (availability === VOLUNTEER_AVAILABILITY.MORNING) return "Morning"
  if (availability === VOLUNTEER_AVAILABILITY.AFTERNOON) return "Afternoon"
  if (availability === VOLUNTEER_AVAILABILITY.ALL_DAY) return "All day"
  return "Not provided"
}
