import type { FormEvent } from "react"
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  getCrewAssignmentConfirmationTokenFn,
  respondCrewAssignmentConfirmationTokenFn,
} from "@/server-fns/crew-confirmation-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/e/$slug/confirm/$token")({
  loader: async ({ params }) => {
    const result = await getCrewAssignmentConfirmationTokenFn({
      data: { slug: params.slug, token: params.token },
    })

    if (result.status === "missing") {
      throw notFound()
    }

    return result
  },
  component: CrewAssignmentConfirmationPage,
  head: ({ loaderData }) => {
    const event = loaderData?.event
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
  const data = Route.useLoaderData()
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
  const confirmationStatus = data.confirmation?.status ?? "pending"
  const canRespond = confirmationStatus === "pending"

  async function submitResponse(
    action: "confirm" | "decline" | "request_change",
    responseNote?: string,
  ) {
    setPendingAction(action)
    try {
      const result = await respond({
        data: { slug, token, action, responseNote },
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

  async function handleChangeRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const responseNote = getFormString(formData, "responseNote")
    await submitResponse("request_change", responseNote)
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
            <h2 className="text-xl font-semibold">{data.assignment.name}</h2>
            <p className="mt-2 text-muted-foreground">
              {data.assignment.roleLabel}
            </p>
          </div>
          <StatusBadge status={confirmationStatus} />
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <Fact
            label="Start"
            value={formatDateTimeInTimezone(
              data.assignment.startTime,
              timezone,
              "EEE, MMM d h:mm a",
            )}
          />
          <Fact
            label="End"
            value={formatDateTimeInTimezone(
              data.assignment.endTime,
              timezone,
              "EEE, MMM d h:mm a",
            )}
          />
          <Fact
            label="Location"
            value={data.assignment.location ?? "Not set"}
          />
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

        {data.assignment.notes ? (
          <p className="mt-5 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm text-muted-foreground">
            {data.assignment.notes}
          </p>
        ) : null}
      </section>

      {canRespond ? (
        <section className="space-y-4 rounded-md border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => submitResponse("confirm")}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "confirm" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirm
            </button>
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => submitResponse("decline")}
              className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "decline" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Decline
            </button>
          </div>

          <form onSubmit={handleChangeRequest} className="space-y-3">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Request a change</span>
              <textarea
                name="responseNote"
                rows={4}
                className="rounded-md border bg-background px-3 py-2"
                placeholder="Share what needs to change"
              />
            </label>
            <button
              type="submit"
              disabled={pendingAction !== null}
              className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "request_change" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Send request
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Response recorded</h2>
          <p className="mt-2 text-muted-foreground">
            Your current response is {formatCrewValue(confirmationStatus)}.
          </p>
          {data.confirmation?.responseNote ? (
            <p className="mt-4 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
              {data.confirmation.responseNote}
            </p>
          ) : null}
        </section>
      )}
    </main>
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
  const className =
    status === "confirmed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : status === "declined"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : status === "change_requested"
          ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700"

  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {formatCrewValue(status)}
    </span>
  )
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}
