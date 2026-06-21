// @lat: [[crew#Assignment Confirmation Responses]]
// @lat: [[crew#Volunteer Self Service]]
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  CalendarPlus,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  Printer,
} from "lucide-react"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_LABELS,
  type VolunteerAvailability,
  type VolunteerRoleType,
} from "@/db/schemas/volunteers"
import {
  getCrewAssignmentConfirmationStatusBadgeClassName,
  getCrewAssignmentConfirmationStatusLabel,
} from "@/lib/crew/assignment-confirmation-display"
import {
  getCrewAssignmentConfirmationTokenFn,
  type CrewAssignmentConfirmationTokenData,
  updateCrewAssignmentConfirmationContactTokenFn,
} from "@/server-fns/crew-confirmation-fns"
import {
  buildCrewVolunteerSelfServiceGoogleCalendarUrl,
  buildCrewVolunteerSelfServiceIcs,
  buildCrewVolunteerSelfServiceIcsFilename,
} from "@/lib/crew/volunteer-self-service"
import { getCrewVolunteerScheduleTokenFn } from "@/server-fns/crew-volunteer-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

const optionalContactString = (maxLength: number) =>
  z.string().trim().max(maxLength).optional()

const contactFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(255),
  name: optionalContactString(200),
  phone: optionalContactString(50),
  availability: z.union([z.enum(VOLUNTEER_AVAILABILITY), z.literal("")]),
  availabilityNotes: optionalContactString(5000),
  credentials: optionalContactString(1000),
})

type ContactFormValues = z.infer<typeof contactFormSchema>

export const Route = createFileRoute("/e/$slug/schedule/$token")({
  loader: async ({ params }) => {
    const assignmentResult = await getCrewAssignmentConfirmationTokenFn({
      data: { slug: params.slug, token: params.token },
    })
    if (assignmentResult.status !== "missing") {
      return { mode: "assignment" as const, assignmentResult }
    }

    const result = await getCrewVolunteerScheduleTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (result.status !== "valid" || !result.event || !result.volunteer) {
      throw notFound()
    }

    return { mode: "volunteer" as const, volunteerResult: result }
  },
  component: CrewVolunteerScheduleTokenPage,
  head: ({ loaderData }) => {
    const event =
      loaderData?.mode === "assignment"
        ? loaderData.assignmentResult.event
        : loaderData?.volunteerResult.event
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
  const loaderData = Route.useLoaderData()

  if (loaderData.mode === "assignment") {
    return <CrewAssignmentSchedule data={loaderData.assignmentResult} />
  }

  const { event, volunteer } = loaderData.volunteerResult

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

function CrewAssignmentSchedule({
  data,
}: {
  data: CrewAssignmentConfirmationTokenData
}) {
  const { slug, token } = Route.useParams()
  const router = useRouter()
  const updateContact = useServerFn(
    updateCrewAssignmentConfirmationContactTokenFn,
  )
  const contactForm = useForm<ContactFormValues>({
    resolver: standardSchemaResolver(contactFormSchema),
    defaultValues: getContactDefaultValues(data.volunteer),
  })
  const schedule = useMemo(() => {
    if (data.status !== "valid" || !data.assignment) return []
    if (data.schedule.length > 0) return data.schedule
    return [
      {
        ...data.assignment,
        confirmation: data.confirmation,
        isTokenAssignment: true,
      },
    ]
  }, [data])
  const tokenAssignment =
    schedule.find((assignment) => assignment.isTokenAssignment) ?? null
  const eventName = data.event?.name ?? "Crew"
  const icsText = useMemo(
    () =>
      buildCrewVolunteerSelfServiceIcs({
        eventName,
        assignments: schedule,
      }),
    [eventName, schedule],
  )
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    icsText,
  )}`
  const googleCalendarUrl = tokenAssignment
    ? buildCrewVolunteerSelfServiceGoogleCalendarUrl({
        eventName,
        assignment: tokenAssignment,
      })
    : null
  const confirmHref = `/e/${encodeURIComponent(slug)}/confirm/${encodeURIComponent(
    token,
  )}`

  async function handleContactSubmit(values: ContactFormValues) {
    try {
      const result = await updateContact({
        data: {
          slug,
          token,
          email: values.email,
          name: emptyToUndefined(values.name),
          phone: emptyToUndefined(values.phone),
          availability: values.availability || undefined,
          availabilityNotes: emptyToUndefined(values.availabilityNotes),
          credentials: emptyToUndefined(values.credentials),
        },
      })
      if (result.success) {
        toast.success(result.message)
        contactForm.reset(getContactDefaultValues(result.volunteer))
      } else {
        toast.error(result.message)
      }
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Contact update failed",
      )
    }
  }

  if (data.status !== "valid" || !data.event || !data.assignment) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0">
        <section className="rounded-md border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
          <p className="text-sm font-medium text-muted-foreground">
            Volunteer schedule
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {data.status === "expired"
              ? "This schedule link has expired"
              : "This schedule link is no longer valid"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Please contact the event organizer for a fresh link.
          </p>
        </section>
      </main>
    )
  }

  const timezone = data.event.timezone ?? "America/Denver"
  const eventDates = `${data.event.startDate} to ${data.event.endDate}`

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 print:max-w-none print:px-0">
      <section className="rounded-md border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Volunteer schedule
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{data.event.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {data.volunteer?.name ?? "Volunteer"} ·{" "}
              {data.volunteer?.email ?? "No email"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <a
              href={icsHref}
              download={buildCrewVolunteerSelfServiceIcsFilename(
                data.event.name,
              )}
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
            >
              <CalendarPlus className="size-4" />
              iCal
            </a>
            {googleCalendarUrl ? (
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
              >
                <ExternalLink className="size-4" />
                Google
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
            >
              <Printer className="size-4" />
              Print
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card p-6 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Response</h2>
            <p className="text-sm text-muted-foreground">
              {tokenAssignment?.name ?? data.assignment.name} ·{" "}
              {getCrewAssignmentConfirmationStatusLabel(
                data.confirmation?.status ?? "pending",
              )}
            </p>
          </div>
          <a
            href={confirmHref}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ExternalLink className="size-4" />
            Respond
          </a>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Assignments</h2>
        {schedule.map((assignment) => (
          <article
            key={assignment.id}
            className={`rounded-md border bg-card p-5 shadow-sm print:break-inside-avoid print:shadow-none ${
              assignment.isTokenAssignment ? "border-primary/50" : ""
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">{assignment.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assignment.roleLabel}
                </p>
              </div>
              <StatusBadge status={assignment.confirmation?.status} />
            </div>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <InfoRow
                label="Start"
                value={formatDateTimeInTimezone(
                  assignment.startTime,
                  timezone,
                  "EEE, MMM d h:mm a",
                )}
              />
              <InfoRow
                label="End"
                value={formatDateTimeInTimezone(
                  assignment.endTime,
                  timezone,
                  "EEE, MMM d h:mm a",
                )}
              />
              <InfoRow
                label="Location"
                value={assignment.location ?? "Not set"}
              />
              <InfoRow label="Event dates" value={eventDates} />
            </dl>

            {assignment.notes ? (
              <p className="mt-5 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm text-muted-foreground">
                {assignment.notes}
              </p>
            ) : null}

            {assignment.isTokenAssignment ? (
              <a
                href={confirmHref}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted print:hidden"
              >
                <ExternalLink className="size-4" />
                Update response
              </a>
            ) : null}
          </article>
        ))}
      </section>

      <section className="rounded-md border bg-card p-6 shadow-sm print:hidden">
        <h2 className="text-xl font-semibold">Contact</h2>
        <form
          onSubmit={contactForm.handleSubmit(handleContactSubmit)}
          className="mt-5 grid gap-4"
        >
          <label className="grid gap-2 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <Mail className="size-4" />
              Email
            </span>
            <input
              type="email"
              required
              {...contactForm.register("email")}
              className="h-10 rounded-md border bg-background px-3"
            />
            {contactForm.formState.errors.email?.message ? (
              <span className="text-xs text-destructive">
                {contactForm.formState.errors.email.message}
              </span>
            ) : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Name</span>
              <input
                {...contactForm.register("name")}
                className="h-10 rounded-md border bg-background px-3"
              />
              {contactForm.formState.errors.name?.message ? (
                <span className="text-xs text-destructive">
                  {contactForm.formState.errors.name.message}
                </span>
              ) : null}
            </label>
            <label className="grid gap-2 text-sm">
              <span className="inline-flex items-center gap-2 font-medium">
                <Phone className="size-4" />
                Phone
              </span>
              <input
                {...contactForm.register("phone")}
                className="h-10 rounded-md border bg-background px-3"
              />
              {contactForm.formState.errors.phone?.message ? (
                <span className="text-xs text-destructive">
                  {contactForm.formState.errors.phone.message}
                </span>
              ) : null}
            </label>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Availability</span>
            <select
              {...contactForm.register("availability")}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">Not provided</option>
              <option value={VOLUNTEER_AVAILABILITY.MORNING}>Morning</option>
              <option value={VOLUNTEER_AVAILABILITY.AFTERNOON}>
                Afternoon
              </option>
              <option value={VOLUNTEER_AVAILABILITY.ALL_DAY}>All day</option>
            </select>
            {contactForm.formState.errors.availability?.message ? (
              <span className="text-xs text-destructive">
                {contactForm.formState.errors.availability.message}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Availability notes</span>
            <textarea
              rows={3}
              {...contactForm.register("availabilityNotes")}
              className="rounded-md border bg-background px-3 py-2"
            />
            {contactForm.formState.errors.availabilityNotes?.message ? (
              <span className="text-xs text-destructive">
                {contactForm.formState.errors.availabilityNotes.message}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Credentials</span>
            <textarea
              rows={3}
              {...contactForm.register("credentials")}
              className="rounded-md border bg-background px-3 py-2"
            />
            {contactForm.formState.errors.credentials?.message ? (
              <span className="text-xs text-destructive">
                {contactForm.formState.errors.credentials.message}
              </span>
            ) : null}
          </label>

          <button
            type="submit"
            disabled={contactForm.formState.isSubmitting}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {contactForm.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save contact
          </button>
        </form>
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

function StatusBadge({ status }: { status: string | null | undefined }) {
  const confirmationStatus = status ?? "pending"
  const className =
    getCrewAssignmentConfirmationStatusBadgeClassName(confirmationStatus)

  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {getCrewAssignmentConfirmationStatusLabel(confirmationStatus)}
    </span>
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

function getContactDefaultValues(
  volunteer: CrewAssignmentConfirmationTokenData["volunteer"],
): ContactFormValues {
  return {
    email: volunteer?.email ?? "",
    name: volunteer?.name ?? "",
    phone: volunteer?.phone ?? "",
    availability: volunteer?.availability ?? "",
    availabilityNotes: volunteer?.availabilityNotes ?? "",
    credentials: volunteer?.credentials ?? "",
  }
}

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed || undefined
}
