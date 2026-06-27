import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Flame,
  Loader2,
  MapPin,
  PlayCircle,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react"
import type { ChangeEvent, FormEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  buildCascadedLocalTimes,
  type CascadedHeatRow,
  DEFAULT_HEAT_DURATION_MINUTES,
  DEFAULT_TRANSITION_MINUTES,
  MAX_BULK_HEATS,
} from "@/lib/crew/heat-scheduling"
import {
  getImportFields,
  inferColumnMapping,
} from "@/lib/crew/imports/column-mapping"
import {
  CREW_IMPORT_ACCEPTED_FILE_TYPES,
  parseCrewImportFile,
} from "@/lib/crew/imports/file"
import type { CrewImportMappingSuggestion } from "@/lib/crew/imports/mapping-memory"
import type {
  ColumnMapping,
  HeatScheduleImportRow,
  ImportIssue,
  PreviewImportRow,
} from "@/lib/crew/imports/types"
import {
  deleteHeatFn,
  getNextHeatNumberFn,
} from "@/server-fns/competition-heats-fns"
import {
  type CrewHeatRow,
  type CrewHeatsTrackWorkout,
  type CrewVenueOption,
  generateHeatsFn,
  getCrewHeatsPageFn,
} from "@/server-fns/crew-heats-fns"
import {
  applyCrewImportFn,
  type CrewImportApplyResult,
  getCrewImportMappingSuggestionFn,
  type PersistedCrewImportPreview,
  saveCrewImportMappingPresetFn,
} from "@/server-fns/crew-import-fns"
import { DEFAULT_TIMEZONE, parseTimeInTimezone } from "@/utils/timezone-utils"

export const Route = createFileRoute("/events/$eventId/heats")({
  loader: async ({ params }) =>
    await getCrewHeatsPageFn({ data: { eventId: params.eventId } }),
  component: EventHeatsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventHeatsPage() {
  const router = useRouter()
  const { eventId } = parentRoute.useParams()
  const { event } = parentRoute.useLoaderData()
  const timezone = event.competition.timezone ?? DEFAULT_TIMEZONE
  const { trackWorkouts, heatsByTrackWorkoutId, venues } = Route.useLoaderData()

  const [importOpen, setImportOpen] = useState(false)

  async function handleImportComplete() {
    setImportOpen(false)
    await router.invalidate()
  }

  async function handleHeatChange() {
    await router.invalidate()
  }

  const totalHeats = trackWorkouts.reduce(
    (sum, tw) => sum + (heatsByTrackWorkoutId[tw.id]?.length ?? 0),
    0,
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Heats</h2>
          <p className="text-sm text-muted-foreground">
            {totalHeats === 0
              ? "No heats scheduled yet."
              : `${totalHeats} ${totalHeats === 1 ? "heat" : "heats"} scheduled across ${trackWorkouts.length} ${trackWorkouts.length === 1 ? "workout" : "workouts"}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
        >
          <FileSpreadsheet className="size-4" />
          Import from CSV or Excel
        </button>
      </div>

      {trackWorkouts.length === 0 ? (
        <EmptyWorkoutsNotice eventId={eventId} />
      ) : (
        <div className="space-y-4">
          {trackWorkouts.map((tw) => (
            <WorkoutHeatSection
              key={tw.id}
              eventId={eventId}
              timezone={timezone}
              trackWorkout={tw}
              heats={heatsByTrackWorkoutId[tw.id] ?? []}
              venues={venues}
              onHeatChange={handleHeatChange}
            />
          ))}
        </div>
      )}

      <HeatImportDialog
        open={importOpen}
        eventId={eventId}
        onClose={() => setImportOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </section>
  )
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyWorkoutsNotice({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
      <Flame className="mx-auto mb-3 size-8 text-muted-foreground/50" />
      <p className="font-medium">No workouts configured</p>
      <p className="mt-1">
        Add workouts on the{" "}
        <Link
          to="/events/$eventId/setup"
          params={{ eventId }}
          className="font-medium text-foreground underline underline-offset-2"
        >
          Setup page
        </Link>{" "}
        before scheduling heats.
      </p>
    </div>
  )
}

// ============================================================================
// Workout section with heat list
// ============================================================================

interface WorkoutHeatSectionProps {
  eventId: string
  timezone: string
  trackWorkout: CrewHeatsTrackWorkout
  heats: CrewHeatRow[]
  venues: CrewVenueOption[]
  onHeatChange: () => Promise<void>
}

function WorkoutHeatSection({
  eventId,
  timezone,
  trackWorkout,
  heats,
  venues,
  onHeatChange,
}: WorkoutHeatSectionProps) {
  const [addOpen, setAddOpen] = useState(false)

  async function handleAdded() {
    setAddOpen(false)
    await onHeatChange()
  }

  return (
    <section className="rounded-md border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 className="font-semibold">{trackWorkout.label}</h3>
          <p className="text-sm text-muted-foreground">
            {heats.length === 0
              ? "No heats"
              : `${heats.length} ${heats.length === 1 ? "heat" : "heats"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          <Plus className="size-4" />
          Add heats
        </button>
      </div>

      {heats.length > 0 ? (
        <div className="divide-y">
          {heats.map((heat) => (
            <HeatRow key={heat.id} heat={heat} onHeatChange={onHeatChange} />
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          No heats yet — add some manually or import from CSV or Excel.
        </p>
      )}

      <AddHeatsDialog
        open={addOpen}
        eventId={eventId}
        timezone={timezone}
        trackWorkoutId={trackWorkout.id}
        venues={venues}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />
    </section>
  )
}

// ============================================================================
// Individual heat row
// ============================================================================

interface HeatRowProps {
  heat: CrewHeatRow
  onHeatChange: () => Promise<void>
}

function HeatRow({ heat, onHeatChange }: HeatRowProps) {
  const deleteHeat = useServerFn(deleteHeatFn)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteHeat({ data: { heatId: heat.id } })
      toast.success("Heat removed")
      await onHeatChange()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove heat",
      )
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        <span className="shrink-0 font-medium">Heat {heat.heatNumber}</span>
        {heat.scheduledTime ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatHeatTime(heat.scheduledTime)}
          </span>
        ) : null}
        {heat.venueName ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {heat.venueName}
            {heat.venueLaneCount !== null
              ? ` · ${heat.venueLaneCount} ${heat.venueLaneCount === 1 ? "lane" : "lanes"}`
              : null}
          </span>
        ) : null}
        {heat.divisionLabel ? (
          <span className="rounded-md border bg-background px-2 py-0.5 text-xs">
            {heat.divisionLabel}
          </span>
        ) : null}
        {heat.schedulePublishedAt ? (
          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            Published
          </span>
        ) : (
          <span className="rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Draft
          </span>
        )}
      </div>
      <div className="shrink-0">
        {confirmDelete ? (
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
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Add heats dialog (bulk builder with per-heat editable times)
// ============================================================================

const DEFAULT_HEAT_COUNT = 4

/**
 * Convert a `datetime-local` wall-clock value ("YYYY-MM-DDThh:mm"), interpreted
 * in the event timezone, into a stored UTC Date. Returns null when the value is
 * empty or malformed.
 */
function localValueToUtc(localValue: string, timezone: string): Date | null {
  const match = localValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/)
  if (!match) return null
  const [, dateStr, timeStr] = match
  return parseTimeInTimezone(timeStr, dateStr, timezone)
}

interface AddHeatsDialogProps {
  open: boolean
  eventId: string
  timezone: string
  trackWorkoutId: string
  venues: CrewVenueOption[]
  onClose: () => void
  onAdded: () => Promise<void>
}

function AddHeatsDialog({
  open,
  eventId,
  timezone,
  trackWorkoutId,
  venues,
  onClose,
  onAdded,
}: AddHeatsDialogProps) {
  const generateHeats = useServerFn(generateHeatsFn)
  const getNextHeatNumber = useServerFn(getNextHeatNumberFn)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nextHeatNumber, setNextHeatNumber] = useState<number>(1)
  const [count, setCount] = useState(String(DEFAULT_HEAT_COUNT))
  const [startTime, setStartTime] = useState("")
  const [venueId, setVenueId] = useState("")
  const [lengthMinutes, setLengthMinutes] = useState(
    String(DEFAULT_HEAT_DURATION_MINUTES),
  )
  const [gapMinutes, setGapMinutes] = useState(
    String(DEFAULT_TRANSITION_MINUTES),
  )
  // The editable per-heat list. Recomputed from the global controls below;
  // individual rows can be overridden until the next global change.
  const [heatRows, setHeatRows] = useState<CascadedHeatRow[]>([])

  useEffect(() => {
    if (!open) return
    let ignore = false
    void getNextHeatNumber({ data: { trackWorkoutId } }).then((result) => {
      if (!ignore) setNextHeatNumber(result.nextHeatNumber)
    })
    return () => {
      ignore = true
    }
  }, [open, trackWorkoutId, getNextHeatNumber])

  const heatCount = Number(count)
  const length = Number(lengthMinutes)
  const gap = Number(gapMinutes)
  const selectedVenue = venueId
    ? (venues.find((venue) => venue.id === venueId) ?? null)
    : null

  // Re-sync the whole list whenever a GLOBAL control changes (start time, heat
  // length, heat gap, count, or the starting heat number). This intentionally
  // overwrites any manual per-heat edits — the cascade is the source of truth
  // until the organizer overrides an individual row again.
  useEffect(() => {
    if (!open) return
    setHeatRows(
      buildCascadedLocalTimes({
        count: Number.isInteger(heatCount) ? heatCount : 0,
        startLocalValue: startTime,
        lengthMinutes: length,
        gapMinutes: gap,
        startHeatNumber: nextHeatNumber,
      }),
    )
  }, [open, heatCount, startTime, length, gap, nextHeatNumber])

  function handleClose() {
    setCount(String(DEFAULT_HEAT_COUNT))
    setStartTime("")
    setVenueId("")
    setLengthMinutes(String(DEFAULT_HEAT_DURATION_MINUTES))
    setGapMinutes(String(DEFAULT_TRANSITION_MINUTES))
    setHeatRows([])
    onClose()
  }

  function updateHeatTime(index: number, localValue: string) {
    setHeatRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, localValue } : row)),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!Number.isInteger(heatCount) || heatCount < 1) {
      toast.error("Enter how many heats to add (at least 1)")
      return
    }
    if (heatCount > MAX_BULK_HEATS) {
      toast.error(`Add at most ${MAX_BULK_HEATS} heats at a time`)
      return
    }

    // Send per-heat times AS-IS (including manual overrides), converting each
    // wall-clock value to UTC in the event timezone.
    const heats = heatRows.map((row) => ({
      heatNumber: row.heatNumber,
      scheduledTime: row.localValue
        ? localValueToUtc(row.localValue, timezone)
        : null,
    }))

    setIsSubmitting(true)
    try {
      await generateHeats({
        data: {
          eventId,
          trackWorkoutId,
          venueId: venueId || null,
          durationMinutes: length > 0 ? length : null,
          heats,
        },
      })
      toast.success(`${heatCount} ${heatCount === 1 ? "heat" : "heats"} added`)
      await onAdded()
      handleClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add heats",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add heats</DialogTitle>
          <DialogDescription>
            Set a start time, heat length, and heat gap — the times below fill
            in automatically. Editing any heat's time overrides just that heat
            until you change a control above.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <AddHeatField label="How many heats" htmlFor="heat-count">
              <input
                id="heat-count"
                type="number"
                min={1}
                max={MAX_BULK_HEATS}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </AddHeatField>
            <AddHeatField label="Start time" htmlFor="heat-start-time">
              <input
                id="heat-start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </AddHeatField>
            <AddHeatField label="Heat length (minutes)" htmlFor="heat-length">
              <input
                id="heat-length"
                type="number"
                min={1}
                max={180}
                value={lengthMinutes}
                onChange={(e) => setLengthMinutes(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </AddHeatField>
            <AddHeatField label="Heat gap (minutes)" htmlFor="heat-gap">
              <input
                id="heat-gap"
                type="number"
                min={0}
                max={120}
                value={gapMinutes}
                onChange={(e) => setGapMinutes(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </AddHeatField>
          </div>

          {venues.length > 0 ? (
            <AddHeatField label="Location" htmlFor="heat-venue">
              <select
                id="heat-venue"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No location</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} · {venue.laneCount}{" "}
                    {venue.laneCount === 1 ? "lane" : "lanes"}
                  </option>
                ))}
              </select>
              {selectedVenue ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Heats here have {selectedVenue.laneCount}{" "}
                  {selectedVenue.laneCount === 1 ? "lane" : "lanes"}.
                </span>
              ) : null}
            </AddHeatField>
          ) : null}

          {heatRows.length > 0 ? (
            <div className="rounded-md border">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground">
                <Clock className="size-3.5" />
                Heat times ({timezone})
              </div>
              <ul className="divide-y">
                {heatRows.map((row, index) => (
                  <li
                    key={row.heatNumber}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="w-16 shrink-0 text-sm font-medium">
                      Heat {row.heatNumber}
                    </span>
                    <input
                      type="datetime-local"
                      aria-label={`Heat ${row.heatNumber} time`}
                      value={row.localValue}
                      onChange={(e) => updateHeatTime(index, e.target.value)}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Add{" "}
              {Number.isInteger(heatCount) && heatCount > 0 ? heatCount : ""}{" "}
              {heatCount === 1 ? "heat" : "heats"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddHeatField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm" htmlFor={htmlFor}>
      <span className="font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

// ============================================================================
// Heat schedule import dialog
// ============================================================================

interface HeatImportDialogProps {
  open: boolean
  eventId: string
  onClose: () => void
  onImportComplete: () => Promise<void>
}

function HeatImportDialog({
  open,
  eventId,
  onClose,
  onImportComplete,
}: HeatImportDialogProps) {
  const [latestPreview, setLatestPreview] =
    useState<PersistedCrewImportPreview | null>(null)

  function handlePreviewComplete(preview: PersistedCrewImportPreview) {
    setLatestPreview(preview)
  }

  async function handleApplyComplete(result: CrewImportApplyResult) {
    setLatestPreview((current) =>
      current && current.importId === result.importId
        ? { ...current, status: result.status }
        : current,
    )
    await onImportComplete()
  }

  function handleClose() {
    setLatestPreview(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import heat schedule from CSV or Excel</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with heat schedule details. Review the
            preview, then apply the rows you are ready to use.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <HeatImportUploadPanel
            eventId={eventId}
            onPreviewComplete={handlePreviewComplete}
          />
          {latestPreview ? (
            <HeatImportPreviewPanel
              eventId={eventId}
              preview={latestPreview}
              onApplyComplete={handleApplyComplete}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HeatImportUploadPanel({
  eventId,
  onPreviewComplete,
}: {
  eventId: string
  onPreviewComplete: (preview: PersistedCrewImportPreview) => void
}) {
  const getMappingSuggestion = useServerFn(getCrewImportMappingSuggestionFn)
  const saveMappingPreset = useServerFn(saveCrewImportMappingPresetFn)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [mappingSuggestion, setMappingSuggestion] =
    useState<CrewImportMappingSuggestion | null>(null)
  const [sourcePlatform, setSourcePlatform] = useState("")
  const [clientIssues, setClientIssues] = useState<ImportIssue[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingMappingSuggestion, setIsLoadingMappingSuggestion] =
    useState(false)
  const [isSavingMapping, setIsSavingMapping] = useState(false)
  const fields = useMemo(() => getImportFields("heat_schedule"), [])
  const mappedFieldCount = Object.keys(mapping).length

  useEffect(() => {
    let ignore = false

    if (headers.length === 0) {
      setMappingSuggestion(null)
      setIsLoadingMappingSuggestion(false)
      return
    }

    setMappingSuggestion(null)
    setIsLoadingMappingSuggestion(true)
    void getMappingSuggestion({
      data: {
        eventId,
        kind: "heat_schedule",
        sourcePlatform,
        headers,
      },
    })
      .then((result) => {
        if (!ignore) setMappingSuggestion(result.suggestion)
      })
      .catch(() => {
        if (!ignore) setMappingSuggestion(null)
      })
      .finally(() => {
        if (!ignore) setIsLoadingMappingSuggestion(false)
      })

    return () => {
      ignore = true
    }
  }, [eventId, getMappingSuggestion, headers, sourcePlatform])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setFile(selectedFile)

    if (!selectedFile) {
      setHeaders([])
      setMapping({})
      setMappingSuggestion(null)
      setClientIssues([])
      return
    }

    const parsed = parseCrewImportFile(
      {
        filename: selectedFile.name,
        mimeType: selectedFile.type,
        data: await selectedFile.arrayBuffer(),
      },
      { maxRows: 20 },
    )
    setHeaders(parsed.headers)
    setMapping(inferColumnMapping(parsed.headers, "heat_schedule"))
    setClientIssues(parsed.fileIssues)
  }

  function updateMapping(field: string, header: string) {
    setMapping((current) => {
      const next = { ...current }
      if (header) next[field] = header
      else delete next[field]
      return next
    })
  }

  function handleUseSuggestedMapping(suggestion: CrewImportMappingSuggestion) {
    setMapping(suggestion.columnMapping)
    toast.success("Saved column choices loaded")
  }

  async function handleSaveMapping() {
    if (headers.length === 0 || mappedFieldCount === 0) {
      toast.error("Match at least one column first")
      return
    }

    setIsSavingMapping(true)
    try {
      const result = await saveMappingPreset({
        data: {
          eventId,
          kind: "heat_schedule",
          sourcePlatform,
          headers,
          columnMapping: mapping,
        },
      })
      setMappingSuggestion(result.suggestion)
      toast.success("Column choices saved")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save column choices",
      )
    } finally {
      setIsSavingMapping(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      toast.error("Choose a CSV or Excel file first")
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append("eventId", eventId)
    formData.append("kind", "heat_schedule")
    formData.append("file", file)
    formData.append("sourcePlatform", sourcePlatform)
    formData.append("columnMapping", JSON.stringify(mapping))

    try {
      const response = await fetch("/api/crew/import", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as
        | { importPreview: PersistedCrewImportPreview }
        | { error: string }

      if (!response.ok || !("importPreview" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to preview import",
        )
      }

      onPreviewComplete(payload.importPreview)
      toast.success("Heat schedule preview ready")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to preview import",
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
          <FileSpreadsheet className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Heat schedule file</h3>
          <p className="text-sm text-muted-foreground">
            {headers.length > 0
              ? `${headers.length} columns detected`
              : "Choose a heat schedule CSV or Excel file to preview."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <ImportField label="CSV or Excel file" htmlFor="heat-import-file">
          <input
            id="heat-import-file"
            type="file"
            accept={CREW_IMPORT_ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </ImportField>
        <ImportField
          label="Source label (optional)"
          htmlFor="heat-import-source"
        >
          <input
            id="heat-import-source"
            value={sourcePlatform}
            onChange={(event) => setSourcePlatform(event.target.value)}
            placeholder="Competition Corner export"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </ImportField>
      </div>

      {clientIssues.length > 0 ? (
        <IssueList className="mt-4" issues={clientIssues} />
      ) : null}

      {headers.length > 0 ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-semibold">Match columns</h4>
            <button
              type="button"
              onClick={handleSaveMapping}
              disabled={isSavingMapping || mappedFieldCount === 0}
              className="inline-flex h-9 w-fit items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingMapping ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save column choices
            </button>
          </div>
          {mappingSuggestion ? (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Saved column choices available</p>
                  <p className="text-muted-foreground">
                    {mappingSuggestion.matchedFieldCount} fields from{" "}
                    {mappingSuggestion.sourcePlatform}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUseSuggestedMapping(mappingSuggestion)}
                  className="inline-flex h-9 w-fit items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <CheckCircle2 className="size-4" />
                  Use saved choices
                </button>
              </div>
            </div>
          ) : isLoadingMappingSuggestion ? (
            <p className="text-sm text-muted-foreground">
              Checking saved column choices...
            </p>
          ) : null}
          <div className="space-y-3">
            {fields.map((field) => (
              <label
                key={field.key}
                className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr] sm:items-center"
              >
                <span className="text-muted-foreground">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    updateMapping(field.key, event.target.value)
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Not mapped</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Preview heat schedule
        </button>
      </div>
    </form>
  )
}

function HeatImportPreviewPanel({
  eventId,
  preview,
  onApplyComplete,
}: {
  eventId: string
  preview: PersistedCrewImportPreview
  onApplyComplete: (result: CrewImportApplyResult) => Promise<void>
}) {
  const applyImport = useServerFn(applyCrewImportFn)
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<CrewImportApplyResult | null>(
    null,
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const canApply = preview.status === "previewed"
  const impact = getPreviewImpact(preview)
  const appliedCount = applyResult
    ? applyResult.createdCount + applyResult.updatedCount
    : 0

  async function handleApply() {
    setIsApplying(true)
    try {
      const result = await applyImport({
        data: {
          eventId,
          importId: preview.importId,
          confirmed: true,
        },
      })
      setApplyResult(result)
      await onApplyComplete(result)
      setIsConfirmOpen(false)
      toast.success("Heat schedule applied")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to apply heat schedule",
      )
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <section className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">
            Preview ready: {impact.readyCount} heat rows
          </h3>
          <p className="text-sm text-muted-foreground">
            {preview.originalFilename}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportStatusBadge status={applyResult?.status ?? preview.status} />
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!canApply || isApplying}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Apply heat schedule
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Ready heat rows" value={impact.readyCount} />
        <SummaryMetric label="Warnings" value={preview.warningCount} />
        <SummaryMetric label="Need review" value={impact.blockedCount} />
      </div>

      {applyResult ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Applied" value={appliedCount} />
          <SummaryMetric label="Added" value={applyResult.createdCount} />
          <SummaryMetric label="Skipped" value={applyResult.skippedCount} />
        </div>
      ) : null}

      {preview.fileIssues.length > 0 ? (
        <IssueList issues={preview.fileIssues} />
      ) : null}

      <HeatPreviewTable rows={preview.rows} />

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply heat schedule?</DialogTitle>
            <DialogDescription>
              Review these changes before Crew updates your event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Crew will use ready rows to add heat schedule details or match
              existing heat entries for this event.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetric label="Ready" value={impact.readyCount} />
              <SummaryMetric label="Skipped" value={impact.skippedCount} />
              <SummaryMetric label="Need review" value={impact.blockedCount} />
            </div>
            {preview.warningCount > 0 ? (
              <p className="text-amber-700">
                {preview.warningCount} warnings will stay attached to the
                preview so you can review them after applying.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply || isApplying}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying ? <Loader2 className="size-4 animate-spin" /> : null}
              Apply heat schedule
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function HeatPreviewTable({ rows }: { rows: PreviewImportRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
        No rows were parsed.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="max-h-[24rem] overflow-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Workout</th>
              <th className="px-3 py-2 font-medium">Heat</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Division</th>
              <th className="px-3 py-2 font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const heat = row.normalizedRow as HeatScheduleImportRow
              const issues = [...row.errors, ...row.warnings]
              return (
                <tr key={row.rowNumber} className="border-t align-top">
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-2">{heat.workout || "Not mapped"}</td>
                  <td className="px-3 py-2">
                    {heat.heatLabel || "Not mapped"}
                  </td>
                  <td className="px-3 py-2">
                    {heat.scheduledTime || "Not mapped"}
                  </td>
                  <td className="px-3 py-2">{heat.division || "Not mapped"}</td>
                  <td className="px-3 py-2">
                    {issues.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="size-4" />
                        Ready
                      </span>
                    ) : (
                      <div className="space-y-1">
                        {issues.map((issue, index) => (
                          <p
                            key={`${issue.code}-${index}`}
                            className={
                              issue.severity === "error"
                                ? "text-destructive"
                                : "text-amber-700"
                            }
                          >
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// Shared primitives
// ============================================================================

function ImportField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm" htmlFor={htmlFor}>
      <span className="font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function IssueList({
  issues,
  className,
}: {
  issues: ImportIssue[]
  className?: string
}) {
  return (
    <div className={className}>
      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {issues.map((issue, index) => (
          <div key={`${issue.code}-${index}`} className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{issue.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function ImportStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex w-fit rounded-md border bg-background px-2 py-1 text-xs font-medium">
      {formatImportStatus(status)}
    </span>
  )
}

function getPreviewImpact(preview: PersistedCrewImportPreview) {
  return preview.rows.reduce(
    (summary, row) => {
      if (row.action === "skip") summary.skippedCount += 1
      else if (row.action === "error" || row.errors.length > 0) {
        summary.blockedCount += 1
      } else summary.readyCount += 1
      return summary
    },
    { readyCount: 0, skippedCount: 0, blockedCount: 0 },
  )
}

function formatImportStatus(status: string) {
  if (status === "previewed") return "Preview ready"
  if (status === "applied") return "Applied"
  if (status === "failed") return "Needs review"

  return status
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatHeatTime(date: Date | string) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return String(date)

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d)
}
