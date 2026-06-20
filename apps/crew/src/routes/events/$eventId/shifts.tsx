// @lat: [[crew#Shift Board Pilot Ops]]
// @lat: [[crew#Assignment Confirmations]]
import type { FormEvent } from "react"
import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  getCrewAssignmentConfirmationStatusBadgeClassName,
  getCrewAssignmentConfirmationStatusLabel,
} from "@/lib/crew/assignment-confirmation-display"
import {
  CREW_ASSIGNMENT_CONFIRMATION_ORGANIZER_STATES,
  getCrewAssignmentConfirmationOperationalState,
  type CrewAssignmentConfirmationOrganizerState,
} from "@/lib/crew/assignment-confirmations"
import { formatCrewValue } from "@/lib/crew-event-display"
import {
  filterCrewShiftBoardPilotShifts,
  getRoleFilterOptions,
  type CrewShiftBoardPilotFilters,
  type CrewShiftPilotShiftState,
} from "@/lib/crew/shift-board-pilot-ops"
import {
  formatVolunteerAvailability,
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
import { updateCrewShiftAssignmentConfirmationStateFn } from "@/server-fns/crew-confirmation-fns"
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

const DEFAULT_SHIFT_BOARD_FILTERS: CrewShiftBoardPilotFilters = {
  roleType: "all",
  status: "all",
  source: "all",
  credentialQuery: "",
}

const SHIFT_BOARD_STATUS_FILTERS = new Set<
  CrewShiftBoardPilotFilters["status"]
>(["all", "ready", "open_slots", "responses_needed", "blocked"])

const SHIFT_BOARD_SOURCE_FILTERS = new Set<
  CrewShiftBoardPilotFilters["source"]
>(["all", "imported_assignments", "direct_assignments"])

function EventShiftsPage() {
  const { eventId } = parentRoute.useParams()
  const { event, roster, rosterSummary, shifts, shiftSummary, pilotOps } =
    Route.useLoaderData()
  const timezone = event.timezone ?? "America/Denver"
  const navigate = useNavigate()
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>
  const filters = useMemo(
    () => getShiftBoardFiltersFromSearch(searchParams),
    [searchParams],
  )
  function setFilters(nextFilters: CrewShiftBoardPilotFilters) {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        ...toShiftBoardFilterSearch(nextFilters),
      }),
      replace: true,
    })
  }
  const roleFilterOptions = useMemo(
    () => getRoleFilterOptions(shifts),
    [shifts],
  )
  const visibleShifts = useMemo(
    () =>
      filterCrewShiftBoardPilotShifts({
        shifts,
        roster,
        pilotOps,
        filters,
      }),
    [filters, pilotOps, roster, shifts],
  )
  const assignableVolunteers = roster.filter(
    (volunteer) => volunteer.membershipId && volunteer.status === "active",
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Shift board</h2>
          <p className="text-sm text-muted-foreground">
            {pilotOps.summary.readyShifts} ready,{" "}
            {pilotOps.summary.openShiftCount} with open slots,{" "}
            {pilotOps.summary.blockedShiftCount} blocked
          </p>
        </div>
        <Link
          to="/events/$eventId/staffing"
          params={{ eventId }}
          className="inline-flex h-10 w-fit items-center rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Staffing report
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatusPanel
          label="Ready shifts"
          value={pilotOps.summary.readyShifts}
        />
        <StatusPanel label="Open slots" value={pilotOps.summary.openSlots} />
        <StatusPanel
          label="Blocked"
          value={pilotOps.summary.blockedShiftCount}
        />
        <StatusPanel
          label="Needs response"
          value={pilotOps.summary.responsesNeededShiftCount}
        />
        <StatusPanel
          label="Imported assignments"
          value={pilotOps.summary.importedAssignmentCount}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-6">
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
          label="Sent"
          value={shiftSummary.confirmationOperationalSummary.sent}
        />
        <StatusPanel
          label="Action needed"
          value={
            shiftSummary.confirmationOperationalSummary.organizerActionNeeded
          }
        />
      </div>

      <PilotOpsFilters
        filters={filters}
        roleOptions={roleFilterOptions}
        visibleCount={visibleShifts.length}
        totalCount={shifts.length}
        onChange={setFilters}
      />

      <CreateShiftForm
        eventId={eventId}
        eventStartDate={event.startDate}
        timezone={timezone}
      />

      <div className="space-y-4">
        {visibleShifts.length > 0 ? (
          visibleShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              eventId={eventId}
              shift={shift}
              pilotState={pilotOps.shiftsById[shift.id]}
              volunteers={assignableVolunteers}
              timezone={timezone}
              credentialQuery={filters.credentialQuery}
            />
          ))
        ) : shifts.length > 0 ? (
          <section className="rounded-md border bg-card p-8 text-center shadow-sm">
            <h3 className="font-semibold">
              No shifts match the current filters
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Adjust the role, status, source, or credential filter.
            </p>
          </section>
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

function getShiftBoardFiltersFromSearch(
  searchParams: Record<string, unknown>,
): CrewShiftBoardPilotFilters {
  const roleType = getSearchString(searchParams.roleType)
  const status = getSearchString(searchParams.status)
  const source = getSearchString(searchParams.source)
  const credentialQuery = getSearchString(searchParams.credentialQuery).trim()

  return {
    roleType: VOLUNTEER_ROLE_OPTIONS.some((option) => option.value === roleType)
      ? (roleType as VolunteerRoleType)
      : DEFAULT_SHIFT_BOARD_FILTERS.roleType,
    status: SHIFT_BOARD_STATUS_FILTERS.has(
      status as CrewShiftBoardPilotFilters["status"],
    )
      ? (status as CrewShiftBoardPilotFilters["status"])
      : DEFAULT_SHIFT_BOARD_FILTERS.status,
    source: SHIFT_BOARD_SOURCE_FILTERS.has(
      source as CrewShiftBoardPilotFilters["source"],
    )
      ? (source as CrewShiftBoardPilotFilters["source"])
      : DEFAULT_SHIFT_BOARD_FILTERS.source,
    credentialQuery,
  }
}

function toShiftBoardFilterSearch(filters: CrewShiftBoardPilotFilters) {
  return {
    roleType:
      filters.roleType === DEFAULT_SHIFT_BOARD_FILTERS.roleType
        ? undefined
        : filters.roleType,
    status:
      filters.status === DEFAULT_SHIFT_BOARD_FILTERS.status
        ? undefined
        : filters.status,
    source:
      filters.source === DEFAULT_SHIFT_BOARD_FILTERS.source
        ? undefined
        : filters.source,
    credentialQuery: filters.credentialQuery.trim() || undefined,
  }
}

function getSearchString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function PilotOpsFilters({
  filters,
  roleOptions,
  visibleCount,
  totalCount,
  onChange,
}: {
  filters: CrewShiftBoardPilotFilters
  roleOptions: Array<{ value: VolunteerRoleType; label: string }>
  visibleCount: number
  totalCount: number
  onChange: (filters: CrewShiftBoardPilotFilters) => void
}) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Role</span>
            <select
              value={filters.roleType}
              onChange={(event) =>
                onChange({
                  ...filters,
                  roleType: event.target.value as VolunteerRoleType | "all",
                })
              }
              className="h-10 min-w-0 rounded-md border bg-background px-3"
            >
              <option value="all">All roles</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                onChange({
                  ...filters,
                  status: event.target
                    .value as CrewShiftBoardPilotFilters["status"],
                })
              }
              className="h-10 min-w-0 rounded-md border bg-background px-3"
            >
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="open_slots">Open slots</option>
              <option value="responses_needed">Responses needed</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Source</span>
            <select
              value={filters.source}
              onChange={(event) =>
                onChange({
                  ...filters,
                  source: event.target
                    .value as CrewShiftBoardPilotFilters["source"],
                })
              }
              className="h-10 min-w-0 rounded-md border bg-background px-3"
            >
              <option value="all">All assignments</option>
              <option value="imported_assignments">Imported assignments</option>
              <option value="direct_assignments">Direct assignments</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Credential</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filters.credentialQuery}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    credentialQuery: event.target.value,
                  })
                }
                className="h-10 w-full min-w-0 rounded-md border bg-background pl-9 pr-3 text-sm"
                placeholder="EMT, L1, rigging"
              />
            </span>
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {visibleCount}/{totalCount} shifts
        </p>
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
  pilotState,
  volunteers,
  timezone,
  credentialQuery,
}: {
  eventId: string
  shift: CrewShiftBoardItem
  pilotState: CrewShiftPilotShiftState | undefined
  volunteers: CrewRosterVolunteer[]
  timezone: string
  credentialQuery: string
}) {
  const router = useRouter()
  const assignVolunteer = useServerFn(assignCrewVolunteerToShiftFn)
  const removeAssignment = useServerFn(removeCrewVolunteerShiftAssignmentFn)
  const deleteShift = useServerFn(deleteCrewShiftFn)
  const updateShift = useServerFn(updateCrewShiftFn)
  const updateConfirmationState = useServerFn(
    updateCrewShiftAssignmentConfirmationStateFn,
  )
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [updatingConfirmationId, setUpdatingConfirmationId] = useState<
    string | null
  >(null)
  const assignedMembershipIds = new Set(
    shift.assignments.map((assignment) => assignment.membershipId),
  )
  const availableVolunteers = volunteers.filter(
    (volunteer) =>
      volunteer.membershipId &&
      !assignedMembershipIds.has(volunteer.membershipId) &&
      isVolunteerCompatibleWithShift(shift.roleType, volunteer.roleTypes) &&
      volunteerMatchesCredentialQuery(volunteer, credentialQuery),
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

  async function handleConfirmationStateUpdate(
    event: FormEvent<HTMLFormElement>,
    assignment: CrewShiftBoardItem["assignments"][number],
  ) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const state = getFormString(formData, "state")
    if (!isOrganizerConfirmationState(state)) {
      toast.error("Choose a confirmation state")
      return
    }

    setUpdatingConfirmationId(assignment.id)
    try {
      await updateConfirmationState({
        data: {
          eventId,
          assignmentId: assignment.id,
          state,
          responseNote: getFormString(formData, "responseNote"),
        },
      })
      toast.success("Confirmation updated")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update confirmation",
      )
    } finally {
      setUpdatingConfirmationId(null)
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
            {pilotState ? <PilotStatusBadge state={pilotState} /> : null}
            <span className="rounded-md border bg-background px-2 py-1 text-xs">
              {shift.roleLabel}
            </span>
            <span className="rounded-md border bg-background px-2 py-1 text-xs">
              {shift.assignedCount}/{shift.capacity}
            </span>
            {pilotState?.importedAssignmentCount ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700">
                <UploadCloud className="size-3.5" />
                {pilotState.importedAssignmentCount} imported
              </span>
            ) : null}
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

      {pilotState?.warnings.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {pilotState.warnings.map((warning) => (
            <PilotWarningBadge
              key={`${warning.kind}:${warning.assignmentId ?? warning.detail}`}
              warning={warning}
            />
          ))}
        </div>
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
                        status={getCrewAssignmentConfirmationOperationalState(
                          assignment.confirmation,
                        )}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {assignment.volunteer.email}
                    </div>
                    <VolunteerDetailTags volunteer={assignment.volunteer} />
                    <AssignmentResponseDetail
                      confirmation={assignment.confirmation}
                      timezone={timezone}
                    />
                    {assignment.confirmation?.responseNote ? (
                      <div className="mt-1 max-w-md text-sm text-muted-foreground">
                        {assignment.confirmation.responseNote}
                      </div>
                    ) : null}
                    <AssignmentConfirmationControls
                      assignment={assignment}
                      isUpdating={updatingConfirmationId === assignment.id}
                      onSubmit={(event) =>
                        handleConfirmationStateUpdate(event, assignment)
                      }
                    />
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
                  {volunteer.name} · {volunteer.email} ·{" "}
                  {formatVolunteerAvailability(volunteer.availability)}
                  {volunteer.credentials ? ` · ${volunteer.credentials}` : ""}
                </option>
              ))}
            </select>
          </label>
          {credentialQuery.trim() && availableVolunteers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No compatible volunteers match that credential filter.
            </p>
          ) : null}
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

function PilotStatusBadge({ state }: { state: CrewShiftPilotShiftState }) {
  const className =
    state.severity === "covered"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : state.severity === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
        : "border-destructive/30 bg-destructive/10 text-destructive"
  const Icon =
    state.severity === "covered"
      ? CheckCircle2
      : state.severity === "warning"
        ? Clock3
        : AlertTriangle

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      <Icon className="size-3.5" />
      {state.statusLabel}
    </span>
  )
}

function PilotWarningBadge({
  warning,
}: {
  warning: CrewShiftPilotShiftState["warnings"][number]
}) {
  const className =
    warning.severity === "critical"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-amber-500/30 bg-amber-500/10 text-amber-700"

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${className}`}
      title={warning.detail}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="truncate">{warning.label}</span>
    </span>
  )
}

function VolunteerDetailTags({
  volunteer,
}: {
  volunteer: CrewShiftBoardItem["assignments"][number]["volunteer"]
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
      <span className="rounded-md border bg-muted/40 px-2 py-1">
        {formatRoleList(volunteer.roleTypes)}
      </span>
      <span className="rounded-md border bg-muted/40 px-2 py-1">
        {formatVolunteerAvailability(volunteer.availability)}
      </span>
      {volunteer.credentials ? (
        <span className="rounded-md border bg-muted/40 px-2 py-1">
          {volunteer.credentials}
        </span>
      ) : null}
      {volunteer.imported ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-medium text-sky-700">
          <UploadCloud className="size-3.5" />
          Imported
        </span>
      ) : null}
      {volunteer.signupSource ? (
        <span className="rounded-md border bg-muted/40 px-2 py-1">
          {formatCrewValue(volunteer.signupSource)}
        </span>
      ) : null}
    </div>
  )
}

function AssignmentResponseDetail({
  confirmation,
  timezone,
}: {
  confirmation: CrewShiftBoardItem["assignments"][number]["confirmation"]
  timezone: string
}) {
  if (!confirmation) {
    return <p className="mt-2 text-xs text-amber-700">Confirmation missing</p>
  }

  const state = getCrewAssignmentConfirmationOperationalState(confirmation)
  if (state === "pending") {
    return <p className="mt-2 text-xs text-muted-foreground">Not sent</p>
  }
  if (state === "sent" && confirmation.sentAt) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Sent{" "}
        {formatDateTimeInTimezone(
          confirmation.sentAt,
          timezone,
          "MMM d h:mm a",
        )}
      </p>
    )
  }
  if (state === "replaced") {
    return <p className="mt-2 text-xs text-muted-foreground">Replaced</p>
  }

  if (!confirmation.respondedAt) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {getCrewAssignmentConfirmationStatusLabel(state)}
      </p>
    )
  }

  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {getCrewAssignmentConfirmationStatusLabel(state)}{" "}
      {formatDateTimeInTimezone(
        confirmation.respondedAt,
        timezone,
        "MMM d h:mm a",
      )}
    </p>
  )
}

function ConfirmationBadge({ status }: { status: string }) {
  const className = getCrewAssignmentConfirmationStatusBadgeClassName(status)

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}
    >
      {getCrewAssignmentConfirmationStatusLabel(status)}
    </span>
  )
}

function AssignmentConfirmationControls({
  assignment,
  isUpdating,
  onSubmit,
}: {
  assignment: CrewShiftBoardItem["assignments"][number]
  isUpdating: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const state = getCrewAssignmentConfirmationOperationalState(
    assignment.confirmation,
  )
  const stateInputId = `confirmation-state-${assignment.id}`
  const noteInputId = `confirmation-note-${assignment.id}`

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <label className="sr-only" htmlFor={stateInputId}>
        Confirmation state for {assignment.volunteer.name}
      </label>
      <select
        id={stateInputId}
        name="state"
        defaultValue={state === "missing" ? "pending" : state}
        className="h-9 min-w-0 rounded-md border bg-card px-2 text-sm"
      >
        {CREW_ASSIGNMENT_CONFIRMATION_ORGANIZER_STATES.map((option) => (
          <option key={option} value={option}>
            {getCrewAssignmentConfirmationStatusLabel(option)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={noteInputId}>
        Confirmation note for {assignment.volunteer.name}
      </label>
      <input
        id={noteInputId}
        name="responseNote"
        className="h-9 min-w-0 rounded-md border bg-card px-2 text-sm"
        placeholder="Note"
        defaultValue={assignment.confirmation?.responseNote ?? ""}
      />
      <button
        type="submit"
        disabled={isUpdating}
        className="inline-flex h-9 w-fit items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUpdating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Save
      </button>
    </form>
  )
}

function isOrganizerConfirmationState(
  state: string,
): state is CrewAssignmentConfirmationOrganizerState {
  return CREW_ASSIGNMENT_CONFIRMATION_ORGANIZER_STATES.includes(
    state as CrewAssignmentConfirmationOrganizerState,
  )
}

function volunteerMatchesCredentialQuery(
  volunteer: CrewRosterVolunteer,
  credentialQuery: string,
) {
  const query = credentialQuery.trim().toLowerCase()
  if (!query) return true
  return volunteer.credentials?.toLowerCase().includes(query) ?? false
}

function formatRoleList(roleTypes: VolunteerRoleType[]) {
  return roleTypes
    .map(
      (roleType) =>
        VOLUNTEER_ROLE_OPTIONS.find((option) => option.value === roleType)
          ?.label ?? formatCrewValue(roleType),
    )
    .join(", ")
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
