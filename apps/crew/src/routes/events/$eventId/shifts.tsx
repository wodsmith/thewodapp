import type { FormEvent } from "react"
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  isVolunteerCompatibleWithShift,
  type CrewRosterVolunteer,
} from "@/lib/crew/roster-shifts"
import {
  assignCrewVolunteerToShiftFn,
  createCrewShiftFn,
  deleteCrewShiftFn,
  getCrewShiftBoardFn,
  removeCrewVolunteerShiftAssignmentFn,
  updateCrewShiftFn,
  type CrewShiftBoardItem,
} from "@/server-fns/crew-roster-shift-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"
import {
  VOLUNTEER_ROLE_OPTIONS,
  type VolunteerRoleType,
} from "@/db/schemas/volunteers"

export const Route = createFileRoute("/events/$eventId/shifts")({
  loader: async ({ params }) =>
    await getCrewShiftBoardFn({ data: { eventId: params.eventId } }),
  component: EventShiftsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventShiftsPage() {
  const { eventId } = parentRoute.useParams()
  const { event, roster, rosterSummary, shifts, shiftSummary } =
    Route.useLoaderData()
  const timezone = event.timezone ?? "America/Denver"
  const assignableVolunteers = roster.filter(
    (volunteer) => volunteer.membershipId && volunteer.status === "active",
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Shifts</h2>
          <p className="text-sm text-muted-foreground">
            {shiftSummary.totalShifts} shifts, {shiftSummary.openSlots} open
            slots
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatusPanel label="Active volunteers" value={rosterSummary.active} />
        <StatusPanel label="Assignable" value={rosterSummary.assignable} />
        <StatusPanel
          label="Assigned slots"
          value={shiftSummary.assignedSlots}
        />
        <StatusPanel
          label="Confirmed"
          value={shiftSummary.confirmationSummary.confirmed}
        />
        <StatusPanel
          label="Needs response"
          value={
            shiftSummary.confirmationSummary.pending +
            shiftSummary.confirmationSummary.changeRequested +
            shiftSummary.confirmationSummary.declined
          }
        />
      </div>

      <CreateShiftForm
        eventId={eventId}
        eventStartDate={event.startDate}
        timezone={timezone}
      />

      <div className="space-y-4">
        {shifts.length > 0 ? (
          shifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              eventId={eventId}
              shift={shift}
              volunteers={assignableVolunteers}
              timezone={timezone}
            />
          ))
        ) : (
          <section className="rounded-md border bg-card p-8 text-center shadow-sm">
            <h3 className="font-semibold">No shifts yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create the first event shift to start assigning volunteers.
            </p>
          </section>
        )}
      </div>
    </section>
  )
}

function CreateShiftForm({
  eventId,
  eventStartDate,
  timezone,
}: {
  eventId: string
  eventStartDate: string
  timezone: string
}) {
  const router = useRouter()
  const createShift = useServerFn(createCrewShiftFn)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSubmitting(true)

    try {
      await createShift({
        data: {
          eventId,
          name: getFormString(formData, "name"),
          roleType: getFormString(formData, "roleType") as VolunteerRoleType,
          date: getFormString(formData, "date"),
          startTime: getFormString(formData, "startTime"),
          endTime: getFormString(formData, "endTime"),
          location: getFormString(formData, "location"),
          capacity: Number(getFormString(formData, "capacity")),
          notes: getFormString(formData, "notes"),
        },
      })
      toast.success("Shift created")
      form.reset()
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create shift",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted">
          <Plus className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">New shift</h3>
          <p className="text-sm text-muted-foreground">{timezone}</p>
        </div>
      </div>

      <ShiftFields
        defaultDate={eventStartDate}
        defaultStartTime="09:00"
        defaultEndTime="12:00"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Create shift
      </button>
    </form>
  )
}

function ShiftCard({
  eventId,
  shift,
  volunteers,
  timezone,
}: {
  eventId: string
  shift: CrewShiftBoardItem
  volunteers: CrewRosterVolunteer[]
  timezone: string
}) {
  const router = useRouter()
  const assignVolunteer = useServerFn(assignCrewVolunteerToShiftFn)
  const removeAssignment = useServerFn(removeCrewVolunteerShiftAssignmentFn)
  const deleteShift = useServerFn(deleteCrewShiftFn)
  const updateShift = useServerFn(updateCrewShiftFn)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const assignedMembershipIds = new Set(
    shift.assignments.map((assignment) => assignment.membershipId),
  )
  const availableVolunteers = volunteers.filter(
    (volunteer) =>
      volunteer.membershipId &&
      !assignedMembershipIds.has(volunteer.membershipId) &&
      isVolunteerCompatibleWithShift(shift.roleType, volunteer.roleTypes),
  )

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const membershipId = getFormString(formData, "membershipId")
    if (!membershipId) {
      toast.error("Choose a volunteer")
      return
    }

    setIsAssigning(true)
    try {
      const result = await assignVolunteer({
        data: { eventId, shiftId: shift.id, membershipId },
      })
      toast.success(
        result.action === "skipped_duplicate"
          ? "Volunteer already assigned"
          : "Volunteer assigned",
      )
      form.reset()
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign volunteer",
      )
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleRemove(membershipId: string) {
    try {
      await removeAssignment({
        data: { eventId, shiftId: shift.id, membershipId },
      })
      toast.success("Volunteer removed")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove volunteer",
      )
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${shift.name}?`)) return

    setIsDeleting(true)
    try {
      await deleteShift({ data: { eventId, shiftId: shift.id } })
      toast.success("Shift deleted")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete shift",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsUpdating(true)

    try {
      await updateShift({
        data: {
          eventId,
          shiftId: shift.id,
          name: getFormString(formData, "name"),
          roleType: getFormString(formData, "roleType") as VolunteerRoleType,
          date: getFormString(formData, "date"),
          startTime: getFormString(formData, "startTime"),
          endTime: getFormString(formData, "endTime"),
          location: getFormString(formData, "location"),
          capacity: Number(getFormString(formData, "capacity")),
          notes: getFormString(formData, "notes"),
        },
      })
      toast.success("Shift updated")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update shift",
      )
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{shift.name}</h3>
            <span className="rounded-md border bg-background px-2 py-1 text-xs">
              {shift.roleLabel}
            </span>
            <span className="rounded-md border bg-background px-2 py-1 text-xs">
              {shift.assignedCount}/{shift.capacity}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDateTimeInTimezone(
              shift.startTime,
              timezone,
              "EEE, MMM d h:mm a",
            )}{" "}
            to {formatDateTimeInTimezone(shift.endTime, timezone, "h:mm a")}
          </p>
          {shift.location ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {shift.location}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md border px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>

      {shift.notes ? (
        <p className="mt-4 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm text-muted-foreground">
          {shift.notes}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Assignments</h4>
          {shift.assignments.length > 0 ? (
            <div className="space-y-2">
              {shift.assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {assignment.volunteer.name}
                      </span>
                      <ConfirmationBadge
                        status={assignment.confirmation?.status ?? "pending"}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {assignment.volunteer.email}
                    </div>
                    {assignment.confirmation?.responseNote ? (
                      <div className="mt-1 max-w-md text-sm text-muted-foreground">
                        {assignment.confirmation.responseNote}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(assignment.membershipId)}
                    className="h-9 w-fit rounded-md border px-3 text-sm hover:bg-muted"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              No assignments yet
            </p>
          )}
        </div>

        <form onSubmit={handleAssign} className="space-y-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Add volunteer</span>
            <select
              name="membershipId"
              className="h-10 rounded-md border bg-background px-3"
              disabled={
                availableVolunteers.length === 0 || shift.openSlots === 0
              }
            >
              <option value="">Choose volunteer</option>
              {availableVolunteers.map((volunteer) => (
                <option key={volunteer.id} value={volunteer.membershipId ?? ""}>
                  {volunteer.name} · {volunteer.email}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={
              isAssigning ||
              availableVolunteers.length === 0 ||
              shift.openSlots === 0
            }
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAssigning ? <Loader2 className="size-4 animate-spin" /> : null}
            Assign
          </button>
        </form>
      </div>

      <details className="mt-5 rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Edit shift
        </summary>
        <form onSubmit={handleUpdate} className="mt-4">
          <ShiftFields
            shift={shift}
            timezone={timezone}
            defaultDate={formatDateTimeInTimezone(
              shift.startTime,
              timezone,
              "yyyy-MM-dd",
            )}
            defaultStartTime={formatDateTimeInTimezone(
              shift.startTime,
              timezone,
              "HH:mm",
            )}
            defaultEndTime={formatDateTimeInTimezone(
              shift.endTime,
              timezone,
              "HH:mm",
            )}
          />
          <button
            type="submit"
            disabled={isUpdating}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdating ? <Loader2 className="size-4 animate-spin" /> : null}
            Save shift
          </button>
        </form>
      </details>
    </section>
  )
}

function ConfirmationBadge({ status }: { status: string }) {
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
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {formatCrewValue(status)}
    </span>
  )
}

function ShiftFields({
  shift,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: {
  shift?: CrewShiftBoardItem
  timezone?: string
  defaultDate: string
  defaultStartTime: string
  defaultEndTime: string
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Name">
        <input
          name="name"
          defaultValue={shift?.name ?? ""}
          required
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="Role">
        <select
          name="roleType"
          defaultValue={shift?.roleType ?? "general"}
          required
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {VOLUNTEER_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <input
          type="date"
          name="date"
          defaultValue={defaultDate}
          required
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="Capacity">
        <input
          type="number"
          name="capacity"
          min={1}
          defaultValue={shift?.capacity ?? 1}
          required
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="Start">
        <input
          type="time"
          name="startTime"
          defaultValue={defaultStartTime}
          required
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="End">
        <input
          type="time"
          name="endTime"
          defaultValue={defaultEndTime}
          required
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="Location">
        <input
          name="location"
          defaultValue={shift?.location ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="Notes">
        <input
          name="notes"
          defaultValue={shift?.notes ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </div>
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

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}
