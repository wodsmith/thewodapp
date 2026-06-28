// @lat: [[crew#Assignment Confirmation Responses]]

import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
import {
  CrewVolunteerPublicResponseControls,
  getCrewVolunteerResponseActionKey,
} from "@/components/crew/volunteer-public-response-controls"
import {
  getCrewAssignmentConfirmationStatusBadgeClassName,
  getCrewAssignmentConfirmationStatusLabel,
} from "@/lib/crew/assignment-confirmation-display"
import {
  type CrewAssignmentConfirmationTokenData,
  getCrewAssignmentConfirmationTokenFn,
  respondCrewAssignmentConfirmationTokenFn,
} from "@/server-fns/crew-confirmation-fns"
import {
  type CrewVolunteerScheduleTokenData,
  type CrewVolunteerVisibleAssignment,
  getCrewVolunteerScheduleTokenFn,
  respondCrewVolunteerScheduleTokenFn,
} from "@/server-fns/crew-volunteer-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/e/$slug/confirm/$token")({
  loader: async ({ params }) => {
    const assignmentResult = await getCrewAssignmentConfirmationTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (assignmentResult.status !== "missing") {
      return { mode: "assignment" as const, assignmentResult }
    }

    const volunteerResult = await getCrewVolunteerScheduleTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (
      volunteerResult.status !== "valid" ||
      !volunteerResult.event ||
      !volunteerResult.volunteer
    ) {
      throw notFound()
    }

    return { mode: "volunteer" as const, volunteerResult }
  },
  component: CrewAssignmentConfirmationPage,
  head: ({ loaderData }) => {
    const event =
      loaderData?.mode === "assignment"
        ? loaderData.assignmentResult.event
        : loaderData?.volunteerResult.event
    return {
      meta: [
        {
          title: event
            ? `${event.name} Assignment Confirmation | WODsmith Crew`
            : "Assignment Confirmation | WODsmith Crew",
        },
      ],
    }
  },
})

function CrewAssignmentConfirmationPage() {
  const loaderData = Route.useLoaderData()

  if (loaderData.mode === "assignment") {
    return (
      <CrewAssignmentTokenConfirmation data={loaderData.assignmentResult} />
    )
  }

  return <CrewVolunteerTokenConfirmation data={loaderData.volunteerResult} />
}

function CrewAssignmentTokenConfirmation({
  data,
}: {
  data: CrewAssignmentConfirmationTokenData
}) {
  const { slug, token } = Route.useParams()
  const router = useRouter()
  const respond = useServerFn(respondCrewAssignmentConfirmationTokenFn)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  if (data.status !== "valid" || !data.event || !data.assignment) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Assignment confirmation
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {data.status === "expired"
              ? "This link has expired"
              : "This link is no longer valid"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Please contact the event organizer for a fresh assignment link.
          </p>
        </section>
      </main>
    )
  }

  const timezone = data.event.timezone ?? "America/Denver"
  const assignment = data.assignment
  const confirmationStatus = data.confirmation?.status ?? "pending"

  async function submitResponse(
    action: "confirm" | "decline" | "request_change",
    responseNote?: string,
  ) {
    setPendingAction(getCrewVolunteerResponseActionKey(assignment.id, action))
    try {
      const result = await respond({
        data: {
          slug,
          token,
          action,
          responseNote: responseNote?.trim() || undefined,
        },
      })
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Assignment response failed",
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Assignment confirmation
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{data.event.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {data.volunteer?.name ?? "Volunteer"} ·{" "}
          {data.volunteer?.email ?? "No email"}
        </p>
      </section>

      <section className="rounded-md border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{assignment.name}</h2>
            <p className="mt-2 text-muted-foreground">{assignment.roleLabel}</p>
          </div>
          <StatusBadge status={confirmationStatus} />
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <Fact
            label="Start"
            value={formatDateTimeInTimezone(
              assignment.startTime,
              timezone,
              "EEE, MMM d h:mm a",
            )}
          />
          <Fact
            label="End"
            value={formatDateTimeInTimezone(
              assignment.endTime,
              timezone,
              "EEE, MMM d h:mm a",
            )}
          />
          <Fact label="Location" value={assignment.location ?? "Not set"} />
          <Fact
            label="Respond by"
            value={
              data.confirmation?.expiresAt
                ? formatDateTimeInTimezone(
                    data.confirmation.expiresAt,
                    timezone,
                    "MMM d h:mm a",
                  )
                : "Not set"
            }
          />
        </dl>

        {assignment.notes ? (
          <p className="mt-5 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm text-muted-foreground">
            {assignment.notes}
          </p>
        ) : null}
      </section>

      <section className="rounded-md border bg-card p-6 shadow-sm">
        <CrewVolunteerPublicResponseControls
          assignment={{
            id: assignment.id,
            confirmation: data.confirmation,
          }}
          pendingAction={pendingAction}
          onConfirm={() => void submitResponse("confirm")}
          onNoteSubmit={(action, note) => submitResponse(action, note)}
        />
      </section>
    </main>
  )
}

function CrewVolunteerTokenConfirmation({
  data,
}: {
  data: CrewVolunteerScheduleTokenData
}) {
  const { slug, token } = Route.useParams()
  const router = useRouter()
  const respond = useServerFn(respondCrewVolunteerScheduleTokenFn)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  if (data.status !== "valid" || !data.event || !data.volunteer) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Assignment confirmation
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            This link is no longer valid
          </h1>
          <p className="mt-3 text-muted-foreground">
            Please contact the event organizer for a fresh assignment link.
          </p>
        </section>
      </main>
    )
  }

  const timezone = data.event.timezone ?? "America/Denver"

  async function submitResponse(
    assignment: CrewVolunteerVisibleAssignment,
    action: "confirm" | "decline" | "request_change",
    responseNote?: string,
  ) {
    setPendingAction(getCrewVolunteerResponseActionKey(assignment.id, action))
    try {
      const result = await respond({
        data: {
          slug,
          token,
          assignmentId: assignment.id,
          action,
          responseNote: responseNote?.trim() || undefined,
        },
      })
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Assignment response failed",
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Assignment confirmation
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{data.event.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {data.volunteer.name ?? "Volunteer"} · {data.volunteer.email}
        </p>
      </section>

      {data.assignments.length === 0 ? (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No assignments yet</h2>
          <p className="mt-2 text-muted-foreground">
            No volunteer assignments are published for this link yet.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {data.assignments.map((assignment) => (
            <VolunteerAssignmentResponseCard
              key={assignment.id}
              assignment={assignment}
              timezone={timezone}
              pendingAction={pendingAction}
              onConfirm={() => void submitResponse(assignment, "confirm")}
              onNoteSubmit={(action, note) =>
                submitResponse(assignment, action, note)
              }
            />
          ))}
        </section>
      )}
    </main>
  )
}

function VolunteerAssignmentResponseCard({
  assignment,
  timezone,
  pendingAction,
  onConfirm,
  onNoteSubmit,
}: {
  assignment: CrewVolunteerVisibleAssignment
  timezone: string
  pendingAction: string | null
  onConfirm: () => void
  onNoteSubmit: (
    action: "decline" | "request_change",
    note: string,
  ) => Promise<void> | void
}) {
  const status = assignment.confirmation?.status ?? "pending"

  return (
    <article className="rounded-md border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{assignment.name}</h2>
          <p className="mt-2 text-muted-foreground">{assignment.roleLabel}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <Fact
          label="Start"
          value={formatDateTimeInTimezone(
            assignment.startTime,
            timezone,
            "EEE, MMM d h:mm a",
          )}
        />
        <Fact
          label="End"
          value={formatDateTimeInTimezone(
            assignment.endTime,
            timezone,
            "EEE, MMM d h:mm a",
          )}
        />
        <Fact label="Location" value={assignment.location ?? "Not set"} />
      </dl>

      {assignment.notes ? (
        <p className="mt-5 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm text-muted-foreground">
          {assignment.notes}
        </p>
      ) : null}

      <CrewVolunteerPublicResponseControls
        assignment={assignment}
        pendingAction={pendingAction}
        onConfirm={onConfirm}
        onNoteSubmit={onNoteSubmit}
      />
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const className = getCrewAssignmentConfirmationStatusBadgeClassName(status)

  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {getCrewAssignmentConfirmationStatusLabel(status)}
    </span>
  )
}
