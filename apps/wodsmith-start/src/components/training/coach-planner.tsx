import { useBlocker } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  TrainingBlock,
  TrainingBlockKind,
  TrainingContent,
  TrainingContext,
  TrainingSession,
  TrainingTeam,
} from "@/lib/training/types"
import {
  copyTrainingSessionFn,
  getTrainingWeekFn,
  publishTrainingSessionFn,
  saveTrainingDraftFn,
} from "@/server-fns/training-fns"
import { cn } from "@/utils/cn"
import { CoachLibraryPicker } from "./coach-library-picker"
import { CoachSessionPreview, coachBlockLabels } from "./coach-session-preview"

const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
const actionClass = "min-h-11"
const primaryClass =
  "min-h-11 bg-primary text-[#1b1009] hover:bg-[#fa873c] dark:hover:bg-[#fa873c] disabled:bg-muted disabled:text-foreground disabled:opacity-100 dark:disabled:bg-muted"

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function mondayFor(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return shiftDate(date, -((day + 6) % 7))
}

function todayInZone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

function labelDate(date: string, short = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: short ? "short" : "long",
    month: "short",
    day: "numeric",
    ...(short ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00Z`))
}

function availableTimezones(current: string) {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [
          "America/Boise",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "America/New_York",
          "Europe/London",
          "Europe/Paris",
          "Australia/Sydney",
          "Asia/Tokyo",
        ]
  return [...new Set(["UTC", current, ...zones])].sort()
}

function emptyContent(): TrainingContent {
  return { title: "", coachNote: "", isRestDay: false, blocks: [] }
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again."
}

interface PlannerLocation {
  teamId: string
  trackId: string
  startDate: string
  selectedDate: string
}

function initialLocation(
  context: TrainingContext,
  initialTeamId?: string,
): PlannerLocation {
  const teams = context.teams.filter((team) => team.canProgram)
  const team =
    teams.find((item) => item.id === initialTeamId) ||
    teams.find((item) => item.id === context.activeTeamId) ||
    teams[0]
  const today = todayInZone(team?.timezone || "UTC")
  return {
    teamId: team?.id || "",
    trackId: team?.tracks[0]?.id || "",
    startDate: mondayFor(today),
    selectedDate: today,
  }
}

export function CoachPlanner({
  context,
  initialTeamId,
}: {
  context: TrainingContext
  initialTeamId?: string
}) {
  const [location, setLocation] = useState(() =>
    initialLocation(context, initialTeamId),
  )
  const [week, setWeek] = useState<{
    key: string
    sessions: TrainingSession[]
  } | null>(null)
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pendingLocation, setPendingLocation] =
    useState<PlannerLocation | null>(null)
  const [notice, setNotice] = useState("")
  const dayStrip = useRef<HTMLElement>(null)
  const teams = context.teams.filter((team) => team.canProgram)
  const team = teams.find((item) => item.id === location.teamId)
  const track = team?.tracks.find((item) => item.id === location.trackId)
  const weekKey = `${location.teamId}:${location.trackId}:${location.startDate}:${retry}`
  const loaded = week?.key === weekKey
  const sessions = loaded ? week.sessions : []
  const dates = Array.from({ length: 7 }, (_, index) =>
    shiftDate(location.startDate, index),
  )
  const blocker = useBlocker({
    shouldBlockFn: () => dirty || busy,
    enableBeforeUnload: dirty || busy,
    withResolver: true,
  })

  useEffect(() => {
    if (!loaded || !dayStrip.current) return
    const selected = dayStrip.current.querySelector<HTMLButtonElement>(
      `[data-date="${location.selectedDate}"]`,
    )
    if (selected)
      dayStrip.current.scrollLeft =
        selected.offsetLeft -
        (dayStrip.current.clientWidth - selected.clientWidth) / 2
  }, [loaded, location.selectedDate])

  useEffect(() => {
    if (!location.teamId || !location.trackId) return
    let active = true
    setLoadError("")
    getTrainingWeekFn({
      data: {
        teamId: location.teamId,
        trackId: location.trackId,
        startDate: location.startDate,
        mode: "coach",
      },
    })
      .then((result) => {
        if (active) setWeek({ key: weekKey, sessions: result.sessions })
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error))
      })
    return () => {
      active = false
    }
  }, [location.teamId, location.trackId, location.startDate, weekKey])

  function changeLocation(next: PlannerLocation) {
    if (busy) return
    if (JSON.stringify(next) === JSON.stringify(location)) return
    if (dirty) {
      setPendingLocation(next)
      return
    }
    setLocation(next)
    setLoadError("")
    setNotice("")
  }

  function rememberSession(session: TrainingSession) {
    setWeek((current) =>
      current?.key === weekKey
        ? {
            ...current,
            sessions: [
              ...current.sessions.filter((item) => item.id !== session.id),
              session,
            ],
          }
        : current,
    )
  }

  if (!teams.length) {
    return (
      <div className="py-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          Coach’s planner
        </h1>
        <p className="mt-3 text-muted-foreground">
          You need programming permission in a gym to use this planner.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-7 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Weekly programming
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Plan, review, and publish your gym’s training.
          </p>
        </div>
      </header>
      <div className="grid gap-4 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="coach-gym">Gym</Label>
          <select
            id="coach-gym"
            className={selectClass}
            value={location.teamId}
            disabled={busy}
            onChange={(event) => {
              const nextTeam = teams.find(
                (item) => item.id === event.target.value,
              )
              if (nextTeam)
                changeLocation({
                  ...location,
                  teamId: nextTeam.id,
                  trackId: nextTeam.tracks[0]?.id || "",
                })
            }}
          >
            {teams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="coach-track">Programming track</Label>
          <select
            id="coach-track"
            className={selectClass}
            value={location.trackId}
            disabled={busy || !team?.tracks.length}
            onChange={(event) =>
              changeLocation({ ...location, trackId: event.target.value })
            }
          >
            {!team?.tracks.length && (
              <option value="">No tracks available</option>
            )}
            {team?.tracks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="coach-week">Week containing</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="size-11 shrink-0"
              aria-label="Previous week"
              disabled={busy}
              onClick={() =>
                changeLocation({
                  ...location,
                  startDate: shiftDate(location.startDate, -7),
                  selectedDate: shiftDate(location.selectedDate, -7),
                })
              }
            >
              <ChevronLeft />
            </Button>
            <Input
              id="coach-week"
              className="h-11 min-w-0"
              type="date"
              min="2000-01-03"
              max="2100-12-31"
              value={location.startDate}
              disabled={busy}
              onChange={(event) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value))
                  changeLocation({
                    ...location,
                    startDate: mondayFor(event.target.value),
                    selectedDate: event.target.value,
                  })
              }}
            />
            <Button
              variant="outline"
              className="size-11 shrink-0"
              aria-label="Next week"
              disabled={busy}
              onClick={() =>
                changeLocation({
                  ...location,
                  startDate: shiftDate(location.startDate, 7),
                  selectedDate: shiftDate(location.selectedDate, 7),
                })
              }
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
      <output
        className={cn("text-sm text-muted-foreground", !notice && "sr-only")}
      >
        {notice}
      </output>
      {!track ? (
        <p className="py-8 text-muted-foreground">
          This gym has no programming tracks available. Add a track in gym
          programming settings before composing a day.
        </p>
      ) : loadError ? (
        <div className="space-y-4 py-8">
          <p role="alert" className="text-destructive">
            {loadError}
          </p>
          <Button
            variant="outline"
            className={actionClass}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry loading week
          </Button>
        </div>
      ) : !loaded ? (
        <output className="block py-12 text-muted-foreground">
          Loading your programming week…
        </output>
      ) : (
        <section
          className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
          aria-label="Programming week"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="font-semibold">
              {labelDate(location.startDate, true)} –{" "}
              {labelDate(shiftDate(location.startDate, 6), true)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {team?.name} · {track.name}
            </p>
          </div>
          <nav
            ref={dayStrip}
            aria-label="Training days"
            className="relative grid grid-cols-7 overflow-x-auto border-b border-border max-md:grid-cols-[repeat(7,minmax(136px,1fr))]"
          >
            {dates.map((date) => {
              const session = sessions.find(
                (item) => item.trainingDate === date,
              )
              const content = session?.draft || session?.published
              const published = !!session?.published
              const changed =
                !!session?.draft &&
                JSON.stringify(session.draft) !==
                  JSON.stringify(session.published)
              const status =
                date === location.selectedDate && dirty
                  ? "Unsaved changes"
                  : published
                    ? changed
                      ? "Unpublished edits"
                      : "Published"
                    : session
                      ? "Draft"
                      : "Empty"
              return (
                <button
                  key={date}
                  data-date={date}
                  type="button"
                  disabled={busy}
                  aria-pressed={location.selectedDate === date}
                  onClick={() =>
                    changeLocation({ ...location, selectedDate: date })
                  }
                  className={cn(
                    "flex min-h-32 min-w-0 flex-col gap-2 border-r border-border p-4 text-left last:border-r-0 hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50",
                    location.selectedDate === date &&
                      "bg-primary/10 shadow-[inset_0_-3px_0_0_hsl(var(--primary))]",
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {labelDate(date, true)}
                  </span>
                  <span className="line-clamp-2 break-words text-sm font-medium">
                    {content?.title || "Plan this day"}
                  </span>
                  <span className="mt-auto text-xs text-muted-foreground">
                    {status}
                    {content?.isRestDay ? " · Rest" : ""}
                  </span>
                </button>
              )
            })}
          </nav>
          {team && (
            <CoachDayEditor
              key={`${location.teamId}:${location.trackId}:${location.selectedDate}`}
              initialSession={
                sessions.find(
                  (item) => item.trainingDate === location.selectedDate,
                ) || null
              }
              team={team}
              trackId={track.id}
              trainingDate={location.selectedDate}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onSession={rememberSession}
              onNotice={setNotice}
              onCopied={(session) => {
                setDirty(false)
                setLocation({
                  teamId: session.teamId,
                  trackId: session.trackId,
                  startDate: mondayFor(session.trainingDate),
                  selectedDate: session.trainingDate,
                })
                rememberSession(session)
                setNotice(
                  "Copied as an independent draft. Review the destination day before publishing.",
                )
              }}
            />
          )}
        </section>
      )}
      <AlertDialog
        open={!!pendingLocation || blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) {
            setPendingLocation(null)
            if (blocker.status === "blocked") blocker.reset()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {busy ? "Finishing your changes" : "Discard unsaved changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {busy
                ? "Wait for the current save or publication to finish before leaving this day."
                : "Your edits on this day have not been saved. Stay to save your draft, or discard these edits and continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={actionClass}>
              Stay on this day
            </AlertDialogCancel>
            <AlertDialogAction
              className={primaryClass}
              disabled={busy}
              onClick={() => {
                setDirty(false)
                if (pendingLocation) {
                  setLocation(pendingLocation)
                  setPendingLocation(null)
                  setNotice("")
                }
                if (blocker.status === "blocked") blocker.proceed()
              }}
            >
              Discard and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface CoachDayEditorProps {
  initialSession: TrainingSession | null
  team: TrainingTeam
  trackId: string
  trainingDate: string
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
  onSession: (session: TrainingSession) => void
  onNotice: (notice: string) => void
  onCopied: (session: TrainingSession) => void
}

function CoachDayEditor({
  initialSession,
  team,
  trackId,
  trainingDate,
  onDirtyChange,
  onBusyChange,
  onSession,
  onNotice,
  onCopied,
}: CoachDayEditorProps) {
  const [session, setSession] = useState(initialSession)
  const [content, setContent] = useState(
    () => initialSession?.draft || initialSession?.published || emptyContent(),
  )
  const [timezone, setTimezone] = useState(
    initialSession?.timezone || team.timezone || "UTC",
  )
  const [timezones] = useState(() =>
    availableTimezones(initialSession?.timezone || team.timezone || "UTC"),
  )
  const [saved, setSaved] = useState(() =>
    JSON.stringify({
      content:
        initialSession?.draft || initialSession?.published || emptyContent(),
      timezone: initialSession?.timezone || team.timezone || "UTC",
    }),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [reviewOpen, setReviewOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [restConfirm, setRestConfirm] = useState(false)
  const [deleteBlock, setDeleteBlock] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [copyDate, setCopyDate] = useState(shiftDate(trainingDate, 1))
  const [copyTrack, setCopyTrack] = useState(trackId)
  const [copyError, setCopyError] = useState("")
  const mutationRunning = useRef(false)
  const dirty = JSON.stringify({ content, timezone }) !== saved
  const trackName =
    team.tracks.find((track) => track.id === trackId)?.name || "Training track"
  const publishProblem = !content.title.trim()
    ? "Add a session title before publishing."
    : !content.isRestDay && !content.blocks.length
      ? "Add a section or mark this as a rest day before publishing."
      : content.blocks.some(
            (block) => !block.title.trim() || !block.prescription.trim(),
          )
        ? "Give every section a title and prescription before publishing."
        : ""

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange(busy)
  }, [busy, onBusyChange])
  useEffect(() => {
    if (editingBlock)
      document.getElementById(`coach-title-${editingBlock}`)?.focus()
  }, [editingBlock])

  function updateBlock(id: string, values: Partial<TrainingBlock>) {
    setContent((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? { ...block, ...values } : block,
      ),
    }))
  }

  function moveBlock(id: string, offset: number) {
    setContent((current) => {
      const blocks = [...current.blocks]
      const index = blocks.findIndex((block) => block.id === id)
      const destination = index + offset
      if (index < 0 || destination < 0 || destination >= blocks.length)
        return current
      ;[blocks[index], blocks[destination]] = [
        blocks[destination],
        blocks[index],
      ]
      return { ...current, blocks }
    })
  }

  function acceptSession(next: TrainingSession) {
    const nextContent = next.draft || next.published || emptyContent()
    setSession(next)
    setContent(nextContent)
    setTimezone(next.timezone)
    setSaved(JSON.stringify({ content: nextContent, timezone: next.timezone }))
    onDirtyChange(false)
    onSession(next)
  }

  async function saveDraft() {
    if (mutationRunning.current) return
    mutationRunning.current = true
    setBusy(true)
    setError("")
    try {
      const next = await saveTrainingDraftFn({
        data: {
          teamId: team.id,
          trackId,
          trainingDate,
          timezone,
          expectedRevision: session?.revision || 0,
          content,
        },
      })
      acceptSession(next)
      onNotice("Draft saved. Athletes still see the last published version.")
    } catch (caught) {
      setError(
        `${errorMessage(caught)} Your edits are still here; no unsaved changes were discarded.`,
      )
    } finally {
      mutationRunning.current = false
      setBusy(false)
    }
  }

  async function publish() {
    if (!session?.draft || dirty || publishProblem || mutationRunning.current)
      return
    mutationRunning.current = true
    setBusy(true)
    setError("")
    try {
      const next = await publishTrainingSessionFn({
        data: { sessionId: session.id, expectedRevision: session.revision },
      })
      acceptSession(next)
      setReviewOpen(false)
      onNotice(
        `Published version ${next.publishedVersion}. Athletes can now see this training day; earlier results keep their performed version.`,
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      mutationRunning.current = false
      setBusy(false)
    }
  }

  async function copyDay() {
    if (!session || dirty || mutationRunning.current) return
    if (!copyDate || (copyDate === trainingDate && copyTrack === trackId)) {
      setCopyError("Choose a different destination day or track.")
      return
    }
    mutationRunning.current = true
    setBusy(true)
    setCopyError("")
    try {
      const next = await copyTrainingSessionFn({
        data: {
          sessionId: session.id,
          targetDate: copyDate,
          targetTrackId: copyTrack,
          expectedRevision: session.revision,
        },
      })
      setCopyOpen(false)
      onBusyChange(false)
      onCopied(next)
    } catch (caught) {
      setCopyError(errorMessage(caught))
    } finally {
      mutationRunning.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0 p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">{labelDate(trainingDate)}</h3>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {dirty
                ? "Unsaved changes"
                : session?.draft
                  ? "Saved draft"
                  : session?.published
                    ? "Published · no edits"
                    : "New day"}
            </span>
          </div>
          {session?.published && (
            <p className="mt-2 text-xs text-muted-foreground">
              Athletes see published version {session.publishedVersion}.
            </p>
          )}
          <fieldset disabled={busy} className="mt-6 min-w-0 space-y-5">
            <legend className="sr-only">Session composer</legend>
            <div className="space-y-2">
              <Label htmlFor="coach-session-title">Session title</Label>
              <Input
                id="coach-session-title"
                className="h-11"
                value={content.title}
                maxLength={160}
                placeholder="Name this training day"
                onChange={(event) =>
                  setContent({ ...content, title: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-session-note">
                Athlete-facing coach note
              </Label>
              <Textarea
                id="coach-session-note"
                value={content.coachNote}
                maxLength={4000}
                rows={3}
                placeholder="Intent, pacing, or context for the whole day"
                onChange={(event) =>
                  setContent({ ...content, coachNote: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-timezone">Training timezone</Label>
              <select
                id="coach-timezone"
                className={selectClass}
                value={timezone}
                required
                onChange={(event) => setTimezone(event.target.value)}
              >
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                The selected calendar date belongs to this timezone.
              </p>
            </div>
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"
              htmlFor="coach-rest"
            >
              <input
                id="coach-rest"
                type="checkbox"
                className="size-5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                checked={content.isRestDay}
                onChange={(event) => {
                  if (event.target.checked && content.blocks.length)
                    setRestConfirm(true)
                  else
                    setContent({ ...content, isRestDay: event.target.checked })
                }}
              />
              Planned rest day
            </label>
            {content.isRestDay ? (
              <p className="border-t border-border py-5 text-sm text-muted-foreground">
                Rest days appear in the athlete's week with no result required.
              </p>
            ) : (
              <div className="divide-y divide-border border-y border-border">
                {!content.blocks.length && (
                  <p className="py-6 text-sm text-muted-foreground">
                    Start with a warm-up, a scored section, or a coaching note.
                  </p>
                )}
                {content.blocks.map((block, index) => (
                  <section
                    key={block.id}
                    aria-label={`Section ${index + 1}: ${block.title || "Untitled section"}`}
                    className="min-w-0 py-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {index + 1} · {coachBlockLabels[block.kind]}
                        </p>
                        <h4 className="mt-1 break-words font-semibold">
                          {block.title || "Untitled section"}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-11"
                          aria-label={`Move ${block.title || `section ${index + 1}`} up`}
                          disabled={index === 0}
                          onClick={() => moveBlock(block.id, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-11"
                          aria-label={`Move ${block.title || `section ${index + 1}`} down`}
                          disabled={index === content.blocks.length - 1}
                          onClick={() => moveBlock(block.id, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={actionClass}
                          aria-expanded={editingBlock === block.id}
                          aria-controls={`coach-edit-${block.id}`}
                          onClick={() =>
                            setEditingBlock(
                              editingBlock === block.id ? null : block.id,
                            )
                          }
                        >
                          {editingBlock === block.id ? "Done" : "Edit"}
                        </Button>
                      </div>
                    </div>
                    {editingBlock === block.id ? (
                      <div
                        id={`coach-edit-${block.id}`}
                        className="mt-5 space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`coach-kind-${block.id}`}>
                            Section type
                          </Label>
                          <select
                            id={`coach-kind-${block.id}`}
                            className={selectClass}
                            value={block.kind}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                kind: event.target.value as TrainingBlockKind,
                              })
                            }
                          >
                            {Object.entries(coachBlockLabels).map(
                              ([kind, label]) => (
                                <option key={kind} value={kind}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`coach-title-${block.id}`}>
                            Section title
                          </Label>
                          <Input
                            id={`coach-title-${block.id}`}
                            className="h-11"
                            value={block.title}
                            maxLength={160}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                title: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`coach-prescription-${block.id}`}>
                            Prescription
                          </Label>
                          <Textarea
                            id={`coach-prescription-${block.id}`}
                            value={block.prescription}
                            rows={4}
                            maxLength={6000}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                prescription: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`coach-scaling-${block.id}`}>
                            Scaling options
                          </Label>
                          <Textarea
                            id={`coach-scaling-${block.id}`}
                            value={block.scalingGuidance}
                            rows={3}
                            maxLength={3000}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                scalingGuidance: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`coach-guidance-${block.id}`}>
                            Coach’s guidance
                          </Label>
                          <Textarea
                            id={`coach-guidance-${block.id}`}
                            value={block.coachGuidance}
                            rows={3}
                            maxLength={3000}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                coachGuidance: event.target.value,
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(actionClass, "text-destructive")}
                          onClick={() => setDeleteBlock(block.id)}
                        >
                          Remove section
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {block.prescription || "Add a prescription."}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className={actionClass}
              disabled={content.blocks.length >= 20}
              onClick={() => {
                const block: TrainingBlock = {
                  id: crypto.randomUUID(),
                  kind: "check",
                  title: "",
                  prescription: "",
                  scalingGuidance: "",
                  coachGuidance: "",
                }
                setContent({
                  ...content,
                  isRestDay: false,
                  blocks: [...content.blocks, block],
                })
                setEditingBlock(block.id)
              }}
            >
              <Plus />
              Add a section
            </Button>
            <CoachLibraryPicker
              key={team.id}
              teamId={team.id}
              disabled={busy || content.blocks.length >= 20}
              onAdd={(block) => {
                setContent((current) => ({
                  ...current,
                  isRestDay: false,
                  blocks: [...current.blocks, block],
                }))
                setEditingBlock(block.id)
              }}
            />
          </fieldset>
        </div>
        <CoachSessionPreview
          content={content}
          gymName={team.name}
          trackName={trackName}
          dateLabel={labelDate(trainingDate)}
          timezone={timezone}
        />
      </div>
      <footer className="space-y-4 border-t border-border p-5 lg:p-6">
        {error && !reviewOpen && (
          <p role="alert" className="break-words text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-prose space-y-1">
            <p className="text-sm font-medium">
              {dirty
                ? "Your changes are not saved yet."
                : session?.draft
                  ? "Draft saved to this gym and track."
                  : session?.published
                    ? "This day is published. Edit the session to start a new draft."
                    : "Save this day to create a draft."}
            </p>
            <p className="text-xs text-muted-foreground">
              Save a draft first, then review exactly what athletes will see.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className={actionClass}
              disabled={busy || dirty || !session}
              onClick={() => {
                setCopyError("")
                setCopyOpen(true)
              }}
            >
              Copy day to…
            </Button>
            <Button
              variant="outline"
              className={actionClass}
              disabled={busy || (!dirty && !!session)}
              onClick={saveDraft}
            >
              {busy && !reviewOpen && !copyOpen ? "Saving…" : "Save draft"}
            </Button>
            <Button
              className={primaryClass}
              disabled={busy || dirty || !session?.draft}
              onClick={() => {
                setError("")
                setReviewOpen(true)
              }}
            >
              Review & publish
            </Button>
          </div>
        </div>
      </footer>
      <Dialog
        open={reviewOpen}
        onOpenChange={(open) => {
          if (!busy) setReviewOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto [&>button:last-child]:size-11 [&>button:last-child]:grid [&>button:last-child]:place-items-center">
          <DialogHeader>
            <DialogTitle>Review this training day</DialogTitle>
            <DialogDescription>
              Publishing releases the saved draft immediately to eligible
              athletes.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Gym</dt>
            <dd className="break-words font-medium">{team.name}</dd>
            <dt className="text-muted-foreground">Track</dt>
            <dd className="break-words">{trackName}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd>{labelDate(trainingDate)}</dd>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="break-words">{timezone}</dd>
            <dt className="text-muted-foreground">Audience</dt>
            <dd>Gym members with access to this programming track</dd>
            <dt className="text-muted-foreground">Session</dt>
            <dd className="break-words">
              {content.title || "Untitled session"}
            </dd>
            <dt className="text-muted-foreground">Content</dt>
            <dd>
              {content.isRestDay
                ? "Planned rest day"
                : `${content.blocks.length} sections`}
            </dd>
          </dl>
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            {session?.published
              ? `This publishes version ${session.publishedVersion + 1}. Earlier results remain attached to the version athletes performed; publishing does not rewrite their history.`
              : "This day becomes visible to athletes after publication."}
          </p>
          {(publishProblem || error) && (
            <p role="alert" className="text-sm text-destructive">
              {error || publishProblem}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className={actionClass}
              disabled={busy}
              onClick={() => setReviewOpen(false)}
            >
              Back to editing
            </Button>
            <Button
              className={primaryClass}
              disabled={busy || dirty || !!publishProblem}
              onClick={publish}
            >
              {busy ? "Publishing…" : "Publish day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={copyOpen}
        onOpenChange={(open) => {
          if (!busy) setCopyOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto [&>button:last-child]:size-11 [&>button:last-child]:grid [&>button:last-child]:place-items-center">
          <DialogHeader>
            <DialogTitle>Copy day to an empty destination</DialogTitle>
            <DialogDescription>
              The saved content becomes an independent draft. Existing
              programming is never replaced.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            From {team.name} · {trackName} · {labelDate(trainingDate)}
          </p>
          <div className="space-y-2">
            <Label htmlFor="coach-copy-track">Destination track</Label>
            <select
              id="coach-copy-track"
              className={selectClass}
              value={copyTrack}
              disabled={busy}
              onChange={(event) => {
                setCopyTrack(event.target.value)
                setCopyError("")
              }}
            >
              {team.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="coach-copy-date">Destination date</Label>
            <Input
              id="coach-copy-date"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              className="h-11"
              value={copyDate}
              disabled={busy}
              required
              onChange={(event) => {
                setCopyDate(event.target.value)
                setCopyError("")
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Timezone: {timezone}. The destination stays unpublished until
            reviewed.
          </p>
          {copyError && (
            <p role="alert" className="text-sm text-destructive">
              {copyError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className={actionClass}
              disabled={busy}
              onClick={() => setCopyOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className={primaryClass}
              disabled={busy || !copyDate || !copyTrack}
              onClick={copyDay}
            >
              {busy ? "Copying…" : "Copy as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={restConfirm} onOpenChange={setRestConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this a rest day?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {content.blocks.length} sections from your draft.
              The published day and earlier results stay unchanged until you
              publish a new version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={actionClass}>
              Keep training sections
            </AlertDialogCancel>
            <AlertDialogAction
              className={primaryClass}
              onClick={() => {
                setContent({ ...content, isRestDay: true, blocks: [] })
                setEditingBlock(null)
              }}
            >
              Make rest day
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleteBlock}
        onOpenChange={(open) => {
          if (!open) setDeleteBlock(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this section?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “
              {content.blocks.find((block) => block.id === deleteBlock)
                ?.title || "Untitled section"}
              ” from the draft. It does not change the currently published
              version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={actionClass}>
              Keep section
            </AlertDialogCancel>
            <AlertDialogAction
              className={primaryClass}
              onClick={() => {
                setContent({
                  ...content,
                  blocks: content.blocks.filter(
                    (block) => block.id !== deleteBlock,
                  ),
                })
                setEditingBlock(null)
                setDeleteBlock(null)
              }}
            >
              Remove section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
