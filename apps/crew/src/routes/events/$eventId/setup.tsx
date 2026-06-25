import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Dumbbell,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateCrewEventSettingsFn } from "@/server-fns/crew-event-settings-fns"
import {
  createCrewLocationFn,
  type CrewLocation,
  deleteCrewLocationFn,
  getCrewLocationsFn,
  updateCrewLocationFn,
} from "@/server-fns/crew-locations-fns"
import {
  createCrewWorkoutShellFn,
  type CrewWorkoutShell,
  deleteCrewWorkoutShellFn,
  getCrewWorkoutShellsFn,
  updateCrewWorkoutShellFn,
} from "@/server-fns/crew-workout-shells-fns"
import { COMMON_US_TIMEZONES, DEFAULT_TIMEZONE } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/setup")({
  loader: async ({ params }) => {
    const [workoutShells, locations] = await Promise.all([
      getCrewWorkoutShellsFn({ data: { eventId: params.eventId } }),
      getCrewLocationsFn({ data: { eventId: params.eventId } }),
    ])
    return {
      workouts: workoutShells.workouts,
      locations: locations.locations,
    }
  },
  component: EventSetupPage,
})

const parentRoute = getRouteApi("/events/$eventId")

// @lat: [[crew#Event Setup Dashboard]]
// @lat: [[crew#Workout Shells]]
function EventSetupPage() {
  const router = useRouter()
  const { eventId } = parentRoute.useParams()
  const { event } = parentRoute.useLoaderData()
  const { workouts, locations } = Route.useLoaderData()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState(event.competition.name)
  const [startDate, setStartDate] = useState(event.competition.startDate)
  const [endDate, setEndDate] = useState(event.competition.endDate)
  const [timezone, setTimezone] = useState(
    event.competition.timezone ?? DEFAULT_TIMEZONE,
  )

  useEffect(() => {
    setName(event.competition.name)
    setStartDate(event.competition.startDate)
    setEndDate(event.competition.endDate)
    setTimezone(event.competition.timezone ?? DEFAULT_TIMEZONE)
  }, [event])

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Event name is required")
      return
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after the start date")
      return
    }

    setIsSubmitting(true)

    try {
      await updateCrewEventSettingsFn({
        data: {
          competitionId: event.competition.id,
          name: trimmedName,
          startDate,
          endDate,
          timezone,
        },
      })

      toast.success("Event details saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save setup",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={handleSubmit}>
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Event details</h2>
            <p className="text-sm text-muted-foreground">
              Confirm the details volunteers and staff will use for planning.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Event name" htmlFor="crew-setup-name" wide>
              <input
                id="crew-setup-name"
                value={name}
                onChange={(changeEvent) => setName(changeEvent.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Start date" htmlFor="crew-setup-start-date">
              <input
                id="crew-setup-start-date"
                type="date"
                value={startDate}
                onChange={(changeEvent) =>
                  setStartDate(changeEvent.target.value)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="End date" htmlFor="crew-setup-end-date">
              <input
                id="crew-setup-end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(changeEvent) => setEndDate(changeEvent.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Timezone" htmlFor="crew-setup-timezone" wide>
              <select
                id="crew-setup-timezone"
                value={timezone}
                onChange={(changeEvent) => setTimezone(changeEvent.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {COMMON_US_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="size-4" aria-hidden="true" />
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </section>
      </form>

      <WorkoutsSection eventId={eventId} workouts={workouts} />

      <LocationsSection eventId={eventId} locations={locations} />
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}

function Field({ label, htmlFor, wide = false, children }: FieldProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}
    >
      <span className="text-sm font-medium" id={`${htmlFor}-label`}>
        {label}
      </span>
      {children}
    </label>
  )
}

// ============================================================================
// Workouts section
// ============================================================================

interface WorkoutsSectionProps {
  eventId: string
  workouts: CrewWorkoutShell[]
}

// @lat: [[crew#Workout Shells]]
function WorkoutsSection({ eventId, workouts }: WorkoutsSectionProps) {
  const router = useRouter()
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; workout: CrewWorkoutShell } | null
  >(null)

  async function handleSaved() {
    setDialogState(null)
    await router.invalidate()
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Workouts</h2>
          <p className="text-sm text-muted-foreground">
            Create the workouts athletes will compete in. Add heat times for
            each on the Heats page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogState({ mode: "create" })}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add workout
        </button>
      </div>

      {workouts.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
          <Dumbbell className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="font-medium">No workouts yet</p>
          <p className="mt-1">
            Add a workout to start building your heat schedule.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {workouts.map((workout) => (
            <WorkoutCard
              key={workout.trackWorkoutId}
              eventId={eventId}
              workout={workout}
              onEdit={() => setDialogState({ mode: "edit", workout })}
              onDeleted={handleSaved}
            />
          ))}
        </div>
      )}

      <WorkoutShellDialog
        key={dialogState?.mode === "edit" ? dialogState.workout.workoutId : "create"}
        eventId={eventId}
        state={dialogState}
        onClose={() => setDialogState(null)}
        onSaved={handleSaved}
      />
    </section>
  )
}

interface WorkoutCardProps {
  eventId: string
  workout: CrewWorkoutShell
  onEdit: () => void
  onDeleted: () => Promise<void>
}

function WorkoutCard({ eventId, workout, onEdit, onDeleted }: WorkoutCardProps) {
  const deleteShell = useServerFn(deleteCrewWorkoutShellFn)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteShell({
        data: { eventId, trackWorkoutId: workout.trackWorkoutId },
      })
      toast.success("Workout removed")
      await onDeleted()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove workout",
      )
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <article className="flex flex-col rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{workout.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${workout.name}`}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${workout.name}`}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {workout.description ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {workout.description}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-muted-foreground/70">
          No description
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {workout.heatCount === 0
          ? "No heats"
          : `${workout.heatCount} ${workout.heatCount === 1 ? "heat" : "heats"}`}
      </p>

      {confirmDelete ? (
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <span className="text-sm text-muted-foreground">Remove?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {isDeleting ? <Loader2 className="size-3 animate-spin" /> : null}
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted"
          >
            <X className="size-3" />
            Cancel
          </button>
        </div>
      ) : null}
    </article>
  )
}

interface WorkoutShellDialogProps {
  eventId: string
  state: { mode: "create" } | { mode: "edit"; workout: CrewWorkoutShell } | null
  onClose: () => void
  onSaved: () => Promise<void>
}

function WorkoutShellDialog({
  eventId,
  state,
  onClose,
  onSaved,
}: WorkoutShellDialogProps) {
  const createShell = useServerFn(createCrewWorkoutShellFn)
  const updateShell = useServerFn(updateCrewWorkoutShellFn)
  const isEdit = state?.mode === "edit"
  const [name, setName] = useState(isEdit ? state.workout.name : "")
  const [description, setDescription] = useState(
    isEdit ? state.workout.description : "",
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Workout title is required")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit) {
        await updateShell({
          data: {
            eventId,
            workoutId: state.workout.workoutId,
            name: trimmedName,
            description,
          },
        })
        toast.success("Workout updated")
      } else {
        await createShell({
          data: { eventId, name: trimmedName, description },
        })
        toast.success("Workout added")
      }
      await onSaved()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save workout",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={(val) => !val && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit workout" : "Add workout"}</DialogTitle>
          <DialogDescription>
            Give the workout a title and an optional description. Heats are
            scheduled separately on the Heats page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm" htmlFor="workout-shell-name">
            <span className="font-medium">Title</span>
            <input
              id="workout-shell-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Event 1 — The Chipper"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <label className="block text-sm" htmlFor="workout-shell-description">
            <span className="font-medium">Description</span>
            <textarea
              id="workout-shell-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Optional — movements, reps, scoring notes."
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Save workout" : "Add workout"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Locations section
// ============================================================================

const DEFAULT_LANE_COUNT = 3
const LANE_COUNT_MIN = 1
const LANE_COUNT_MAX = 100

interface LocationsSectionProps {
  eventId: string
  locations: CrewLocation[]
}

// @lat: [[crew#Event Locations]]
function LocationsSection({ eventId, locations }: LocationsSectionProps) {
  const router = useRouter()
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; location: CrewLocation } | null
  >(null)

  async function handleSaved() {
    setDialogState(null)
    await router.invalidate()
  }

  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Locations</h2>
          <p className="text-sm text-muted-foreground">
            Add the floors or areas where heats run. Each location's lane count
            sets how many lanes a heat there has — pick a location when
            scheduling heats.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogState({ mode: "create" })}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add location
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="font-medium">No locations yet</p>
          <p className="mt-1">
            Add a location so heats can be scheduled to a floor with a set
            number of lanes.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              eventId={eventId}
              location={location}
              onEdit={() => setDialogState({ mode: "edit", location })}
              onDeleted={handleSaved}
            />
          ))}
        </div>
      )}

      <LocationDialog
        key={dialogState?.mode === "edit" ? dialogState.location.id : "create"}
        eventId={eventId}
        state={dialogState}
        onClose={() => setDialogState(null)}
        onSaved={handleSaved}
      />
    </section>
  )
}

interface LocationCardProps {
  eventId: string
  location: CrewLocation
  onEdit: () => void
  onDeleted: () => Promise<void>
}

function LocationCard({
  eventId,
  location,
  onEdit,
  onDeleted,
}: LocationCardProps) {
  const deleteLocation = useServerFn(deleteCrewLocationFn)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteLocation({
        data: { eventId, locationId: location.id },
      })
      toast.success("Location removed")
      await onDeleted()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove location",
      )
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <article className="flex flex-col rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{location.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${location.name}`}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${location.name}`}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {location.laneCount} {location.laneCount === 1 ? "lane" : "lanes"}
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        {location.heatCount === 0
          ? "No heats"
          : `${location.heatCount} ${location.heatCount === 1 ? "heat" : "heats"}`}
      </p>

      {confirmDelete ? (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          {location.heatCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {location.heatCount}{" "}
              {location.heatCount === 1 ? "heat" : "heats"} will keep their
              times but lose this location.
            </span>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Remove?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            >
              {isDeleting ? <Loader2 className="size-3 animate-spin" /> : null}
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted"
            >
              <X className="size-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

interface LocationDialogProps {
  eventId: string
  state: { mode: "create" } | { mode: "edit"; location: CrewLocation } | null
  onClose: () => void
  onSaved: () => Promise<void>
}

function LocationDialog({
  eventId,
  state,
  onClose,
  onSaved,
}: LocationDialogProps) {
  const createLocation = useServerFn(createCrewLocationFn)
  const updateLocation = useServerFn(updateCrewLocationFn)
  const isEdit = state?.mode === "edit"
  const [name, setName] = useState(isEdit ? state.location.name : "")
  const [laneCount, setLaneCount] = useState(
    String(isEdit ? state.location.laneCount : DEFAULT_LANE_COUNT),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Location name is required")
      return
    }
    const lanes = Number(laneCount)
    if (
      !Number.isInteger(lanes) ||
      lanes < LANE_COUNT_MIN ||
      lanes > LANE_COUNT_MAX
    ) {
      toast.error(`Lane count must be between ${LANE_COUNT_MIN} and ${LANE_COUNT_MAX}`)
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit) {
        await updateLocation({
          data: {
            eventId,
            locationId: state.location.id,
            name: trimmedName,
            laneCount: lanes,
          },
        })
        toast.success("Location updated")
      } else {
        await createLocation({
          data: { eventId, name: trimmedName, laneCount: lanes },
        })
        toast.success("Location added")
      }
      await onSaved()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save location",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={(val) => !val && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit location" : "Add location"}</DialogTitle>
          <DialogDescription>
            Name the floor or area and set how many lanes heats there have.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm" htmlFor="location-name">
            <span className="font-medium">Name</span>
            <input
              id="location-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Floor"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <label className="block text-sm" htmlFor="location-lane-count">
            <span className="font-medium">Lane count</span>
            <input
              id="location-lane-count"
              type="number"
              min={LANE_COUNT_MIN}
              max={LANE_COUNT_MAX}
              value={laneCount}
              onChange={(e) => setLaneCount(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              How many lanes a heat at this location has.
            </span>
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Save location" : "Add location"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
