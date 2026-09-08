import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { CrossFitTrackDays } from "@/components/crossfit-track-days"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WorkoutImportEntry } from "@/components/workout-import/workout-import-entry"
import { libraryOccurrence } from "@/lib/training/library-occurrence"
import { providerDateLabel, workoutScoring } from "@/lib/crossfit/display"
import type {
  PersonalTrainingDay,
  PersonalTrainingItem,
  PersonalTrainingItemInput,
} from "@/lib/training/personal-types"
import type {
  OwnTrainingResult,
  TrainingBlock,
  TrainingSession,
  TrainingTeam,
  TrainingProviderDay,
} from "@/lib/training/types"
import { normalizedWorkoutSaveSchema } from "@/lib/workout-import/schemas"
import { getTrainingWeekFn } from "@/server-fns/training-fns"
import {
  getPersonalTrainingDayFn,
  getTrainingLibraryWorkoutFn,
  savePersonalTrainingResultFn,
  savePersonalTrainingSessionFn,
} from "@/server-fns/training-personal-fns"
import { AthleteSessionBlock } from "./athlete-session-block"
import { SessionWorkoutActions } from "./session-workout-actions"
import { PersonalWorkoutDefinition } from "./personal-workout-definition"

function itemInput(item: PersonalTrainingItem): PersonalTrainingItemInput {
  if (item.kind === "source")
    return {
      id: item.id,
      kind: item.kind,
      sourceSessionId: item.sourceSessionId,
      sourceBlockId: item.sourceBlockId,
      sourcePublishedVersion: item.sourcePublishedVersion,
    }
  if (item.kind === "library")
    return {
      id: item.id,
      kind: item.kind,
      workoutId: item.workoutId,
      sourceTrackId: libraryOccurrence(item).trackId,
      sourceDate: libraryOccurrence(item).sourceDate,
    }
  return item
}

export function AthletePersonalSession({
  team,
  trackId,
  date,
  sourceResults,
  onSaved,
  libraryWorkoutIds,
  libraryWorkoutId,
  onLibraryWorkoutHandled,
  onInteractionBusy,
  surface = "track",
  onSurfaceChange,
}: {
  surface?: "track" | "session"
  onSurfaceChange?: (surface: "track" | "session") => void
  team: TrainingTeam
  trackId: string
  date: string
  sourceResults: OwnTrainingResult[]
  onSaved: (result: OwnTrainingResult) => void
  libraryWorkoutIds?: string[]
  libraryWorkoutId?: string
  onLibraryWorkoutHandled?: () => void
  onInteractionBusy?: (busy: boolean) => void
}) {
  const [day, setDay] = useState<PersonalTrainingDay | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const importContextKey = JSON.stringify([team.id, date, trackId])
  const importContext = useMemo(
    () => ({ key: importContextKey, active: true }),
    [importContextKey],
  )
  const currentImportContext = useRef(importContext)
  currentImportContext.current = importContext
  useEffect(() => {
    importContext.active = true
    return () => {
      importContext.active = false
    }
  }, [importContext])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<PersonalTrainingItem[]>([])
  const [receipt, setReceipt] = useState<{
    items: PersonalTrainingItemInput[]
    message: string
  } | null>(null)
  const additionIds = useRef(new Map<string, string>())
  const builderTrigger = useRef<HTMLButtonElement>(null)
  const surfaceScroll = useRef({ track: 0, session: 0 })
  function selectSurface(next: "track" | "session") {
    surfaceScroll.current[surface] = window.scrollY
    onSurfaceChange?.(next)
    requestAnimationFrame(() =>
      window.scrollTo({ top: surfaceScroll.current[next] }),
    )
  }
  function additionId(key: string) {
    let value = additionIds.current.get(key)
    if (!value) {
      value = crypto.randomUUID()
      additionIds.current.set(key, value)
    }
    return value
  }
  const [adding, setAdding] = useState(false)
  const [retry, setRetry] = useState(0)
  const loadedContext = useRef("")
  const [editor, setEditor] = useState<{
    itemId?: string
    block: TrainingBlock
  } | null>(null)
  const editingWorkout = editor !== null
  const editorInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editingWorkout) editorInput.current?.focus()
  }, [editingWorkout])
  useEffect(() => {
    onInteractionBusy?.(saving || editing || editingWorkout || importOpen)
    return () => onInteractionBusy?.(false)
  }, [saving, editing, editingWorkout, importOpen, onInteractionBusy])
  const [libraryPending, setLibraryPending] = useState<string[]>(
    libraryWorkoutIds ?? (libraryWorkoutId ? [libraryWorkoutId] : []),
  )
  useEffect(() => {
    setLibraryPending(
      libraryWorkoutIds ?? (libraryWorkoutId ? [libraryWorkoutId] : []),
    )
  }, [libraryWorkoutIds, libraryWorkoutId])
  const libraryConfirmation = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (libraryPending.length && !loading) libraryConfirmation.current?.focus()
  }, [libraryPending, loading])
  const [libraryPreview, setLibraryPreview] = useState<
    Awaited<ReturnType<typeof getTrainingLibraryWorkoutFn>>[] | null
  >(null)
  const [libraryError, setLibraryError] = useState("")
  useEffect(() => {
    let cancelled = false
    setLibraryPreview(null)
    setLibraryError("")
    if (!libraryPending.length) return
    Promise.all(
      libraryPending.map((workoutId) =>
        getTrainingLibraryWorkoutFn({ data: { teamId: team.id, workoutId } }),
      ),
    )
      .then((workout) => {
        if (!cancelled) setLibraryPreview(workout)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setLibraryError(
            cause instanceof Error
              ? cause.message
              : "Could not load this workout. Return to the library and try again.",
          )
      })
    return () => {
      cancelled = true
    }
  }, [team.id, libraryPending])
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads the same selected day.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const key = `${team.id}:${date}:${trackId}`
    if (loadedContext.current !== key) setDay(null)
    loadedContext.current = key
    setError("")
    setEditor(null)
    setEditing(false)
    setReceipt(null)
    setAdding(false)
    getPersonalTrainingDayFn({
      data: {
        teamId: team.id,
        trainingDate: date,
        trackId: trackId || undefined,
      },
    })
      .then((result) => {
        if (!cancelled) setDay(result)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your session. Try again.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [team.id, date, trackId, retry])

  function clearLibraryRequest() {
    setLibraryPending([])
    if (onLibraryWorkoutHandled) onLibraryWorkoutHandled()
    else {
      const url = new URL(window.location.href)
      url.searchParams.delete("workoutId")
      url.searchParams.delete("workoutIds")
      window.history.replaceState(window.history.state, "", url)
    }
  }

  async function save(
    items: PersonalTrainingItemInput[],
    mode: "replace" | "append" | "undo" = "replace",
  ) {
    if (!day || saving) return false
    const savingContext = importContext
    setSaving(true)
    setError("")
    try {
      const saved = await savePersonalTrainingSessionFn({
        data: {
          teamId: team.id,
          trainingDate: date,
          expectedRevision: day.personalSession?.revision ?? 0,
          items,
          mode,
        },
      })
      if (currentImportContext.current !== savingContext) return false
      setDay((current) =>
        current
          ? { ...current, personalSession: saved, items: saved.items }
          : current,
      )
      return saved
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your session could not be saved. Try again.",
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <output className="block border-t border-border py-10">
        Loading your session…
      </output>
    )
  if (!day)
    return (
      <div role="alert" className="space-y-4 py-8">
        <p>{error}</p>
        <Button
          className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </Button>
      </div>
    )
  const source = day.sourceSession
  const personal = day.personalSession
  const customized = !!personal && personal.compositionState !== "result_only"
  const selectedTrackName =
    team.tracks.find((track) => track.id === trackId)?.name ??
    "Track programming"
  const sourceItems: PersonalTrainingItem[] =
    source?.published?.blocks.map((block) => ({
      id: `source-${block.id}`,
      kind: "source",
      sourceSessionId: source.id,
      sourceBlockId: block.id,
      sourcePublishedVersion: source.publishedVersion,
      block,
      trackId: source.trackId,
      trackName: selectedTrackName,
      sourceTrainingDate: source.trainingDate,
    })) ?? []
  const items = editing
    ? draft
    : surface === "session"
      ? customized
        ? personal.items
        : []
      : sourceItems
  const title = editing
    ? "Build My session"
    : surface === "session"
      ? "My session"
      : (source?.published?.title ?? selectedTrackName)
  const inputs = items.map(itemInput)
  async function updateDraft(next: PersonalTrainingItemInput[]) {
    const known = [...draft, ...sourceItems, ...(personal?.items ?? [])]
    setDraft(
      next.map((input) => {
        if (input.kind === "personal") return input
        const item = known.find((item) => item.id === input.id)
        if (!item) throw new Error("Reload this section before adding it")
        return item
      }),
    )
    return true
  }
  async function append(entries: PersonalTrainingItemInput[]) {
    const existingIds = new Set(personal?.items.map((item) => item.id))
    const saved = await save(entries, "append")
    if (saved) {
      const inserted = entries.filter(
        (entry) =>
          !existingIds.has(entry.id) &&
          saved.items.some((item) => item.id === entry.id),
      )
      setReceipt(
        inserted.length
          ? {
              items: inserted,
              message: `Added to My session · ${providerDateLabel(date)}`,
            }
          : null,
      )
      return true
    }
    return false
  }
  async function beginBuilder(empty = false) {
    const builderContext = importContext
    if (!empty && customized && personal) {
      setDraft([...personal.items])
      setEditing(true)
      return
    }
    if (!empty && surface === "track" && day?.source?.kind === "provider-day") {
      try {
        const entries = await Promise.all(
          day.source.day.workouts.map(async (entry) => {
            const workout = await getTrainingLibraryWorkoutFn({
              data: {
                teamId: team.id,
                workoutId: entry.workoutId,
                sourceTrackId: trackId,
                sourceDate: date,
              },
            })
            return {
              id: additionId(`library-${entry.workoutId}`),
              kind: "library" as const,
              workoutId: entry.workoutId,
              occurrence: { trackId, sourceDate: date },
              workout,
              provenance: workout.provenance,
            }
          }),
        )
        if (currentImportContext.current !== builderContext) return
        setDraft(entries)
        setEditing(true)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load this session",
        )
      }
      return
    }
    setDraft(
      empty
        ? []
        : surface === "session" && customized
          ? [...personal.items]
          : [...sourceItems],
    )
    setEditing(true)
  }

  function startEditor(item?: PersonalTrainingItem) {
    if (item?.kind === "library") return
    setEditor({
      itemId: item?.id,
      block: item
        ? { ...item.block }
        : {
            id: crypto.randomUUID(),
            title: "",
            prescription: "",
            kind: "workout",
            workout: {
              name: "",
              description: "",
              scheme: "time",
              scoreType: "min",
              roundsToScore: 1,
              timeCapSeconds: null,
              repsPerRound: null,
              tiebreakScheme: null,
              movementIds: [],
              scalingGroupId: null,
              scope: "private",
            },
            coachGuidance: "",
            scalingGuidance: "",
          },
    })
    setAdding(false)
  }

  return (
    <section aria-labelledby="training-session-title" aria-busy={saving}>
      <div className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2
            id="training-session-title"
            className="min-w-0 break-words text-3xl font-semibold sm:text-4xl"
          >
            {title}
          </h2>
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button
                  className="min-h-11"
                  disabled={saving || !!editor}
                  onClick={async () => {
                    if (await save(inputs)) {
                      setEditing(false)
                      selectSurface("session")
                      requestAnimationFrame(() =>
                        builderTrigger.current?.focus(),
                      )
                    }
                  }}
                >
                  Save session
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false)
                    setEditor(null)
                    setAdding(false)
                    requestAnimationFrame(() => builderTrigger.current?.focus())
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  ref={builderTrigger}
                  variant="outline"
                  className="min-h-11"
                  onClick={() => beginBuilder()}
                >
                  {surface === "session" && customized
                    ? "Edit session"
                    : "Customize session"}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11"
                  onClick={() =>
                    selectSurface(surface === "session" ? "track" : "session")
                  }
                >
                  {surface === "session"
                    ? `Back to ${selectedTrackName}`
                    : `My session${customized ? ` · ${personal.items.length}` : ""}`}
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {date} ·{" "}
          {surface === "session" || editing
            ? "Your session · Personal changes are private"
            : (selectedTrackName ?? "Personal training")}
        </p>
        {surface === "track" && !editing && source?.published?.coachNote ? (
          <p className="mt-5 max-w-prose whitespace-pre-wrap break-words leading-relaxed">
            {source.published.coachNote}
          </p>
        ) : null}
        {!items.length &&
        (surface === "session" || day.source?.kind !== "provider-day") ? (
          <p className="mt-5 text-muted-foreground">
            {surface === "session"
              ? "Your session is empty. Customize a track or start empty to build your day."
              : source?.published?.isRestDay
                ? "Rest day. Add your own work if you choose to train."
                : "No session is published for this day. You can still build your own."}
          </p>
        ) : null}
        {editing ? (
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            {`${customized ? "Your private composition" : `Based on ${selectedTrackName}`} · ${date}. Changes stay in this draft until you save.`}
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setDraft([])}
            >
              Start empty
            </Button>
          </p>
        ) : null}
      </div>
      {receipt ? (
        <output className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-4">
          <p className="mr-auto text-sm">{receipt.message}</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              selectSurface("session")
              requestAnimationFrame(() =>
                document
                  .getElementById(`session-item-${receipt.items[0]?.id}`)
                  ?.focus(),
              )
            }}
          >
            Open session
          </Button>
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={saving}
            onClick={async () => {
              if (await save(receipt.items, "undo")) setReceipt(null)
            }}
          >
            Undo
          </Button>
        </output>
      ) : null}
      {error ? (
        <div role="alert" className="mb-6 space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => setRetry((value) => value + 1)}
          >
            Reload session
          </Button>
        </div>
      ) : null}
      {libraryPending.length > 0 ? (
        <div className="space-y-3 border-y border-border py-6">
          <h3
            ref={libraryConfirmation}
            tabIndex={-1}
            className="text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ring"
          >
            {libraryPreview
              ? `Add ${libraryPreview.length === 1 ? libraryPreview[0]?.name : `${libraryPreview.length} workouts`}?`
              : "Selected library workout"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Add to {team.name} on {providerDateLabel(date)}. The original
            scoring format stays available.
          </p>
          {libraryError ? (
            <p role="alert" className="text-sm text-destructive">
              {libraryError}
            </p>
          ) : libraryPreview ? (
            <p className="max-w-prose whitespace-pre-wrap break-words text-sm">
              {libraryPreview
                .map(
                  (
                    workout,
                  ) => `${workout.name} · ${workoutScoring(workout)}${workout.provenance ? ` · ${workout.provenance.trackName} · Programmed ${providerDateLabel(workout.provenance.sourceDate)}` : ""}
${workout.provenance ? "" : workout.description}`,
                )
                .join("\n\n")}
            </p>
          ) : (
            <output>Loading workout…</output>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
              disabled={saving || !libraryPreview}
              onClick={async () => {
                if (editing && libraryPreview) {
                  setDraft([
                    ...draft,
                    ...libraryPending.map((workoutId, index) => ({
                      id: additionId(`library-${workoutId}`),
                      kind: "library" as const,
                      workoutId,
                      workout: libraryPreview[index]!,
                      provenance: libraryPreview[index]?.provenance,
                    })),
                  ])
                  clearLibraryRequest()
                  return
                }
                if (
                  await append(
                    libraryPending.map((workoutId) => ({
                      id: additionId(`library-${workoutId}`),
                      kind: "library" as const,
                      workoutId,
                    })),
                  )
                ) {
                  clearLibraryRequest()
                }
              }}
            >
              Add to my session
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={saving}
              onClick={clearLibraryRequest}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {items.map((item, index) => {
        const personalResult =
          item.kind === "personal" ||
          (item.kind === "source" &&
            (item.sourceIsCurrent === false ||
              item.sourceTrainingDate !== date))
        const sourceOccurrenceResult =
          item.kind === "source" && item.sourceTrainingDate === date
            ? [...sourceResults, ...day.results].find(
                (result) =>
                  result.sessionId === item.sourceSessionId &&
                  result.blockId === item.sourceBlockId &&
                  result.publishedVersion === item.sourcePublishedVersion,
              )
            : undefined
        const ownedResult = day.results.find(
          (result) =>
            result.sessionId === personal?.id && result.blockId === item.id,
        )
        const result = ownedResult ?? sourceOccurrenceResult
        const readOnlySourceResult =
          item.kind === "source" &&
          item.sourceIsCurrent === false &&
          !ownedResult &&
          !!sourceOccurrenceResult
        const sourceLabel =
          item.kind === "source"
            ? item.trackName
            : item.kind === "library"
              ? item.provenance
                ? `${item.provenance.trackName} · Programmed ${providerDateLabel(item.provenance.sourceDate)}`
                : "Workout library"
              : item.remixedFrom
                ? "Your remix"
                : "Your workout"
        const renderedSession: TrainingSession = {
          id:
            item.kind === "source"
              ? item.sourceSessionId
              : (personal?.id ?? "personal"),
          teamId: team.id,
          trackId: item.kind === "source" ? item.trackId : trackId,
          trainingDate: date,
          timezone: team.timezone,
          revision: personal?.revision ?? 0,
          publishedVersion:
            item.kind === "source" ? item.sourcePublishedVersion : 1,
          draft: null,
          published: null,
        }
        return (
          <div
            key={item.id}
            id={`session-item-${item.id}`}
            tabIndex={-1}
            className="focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              {personal || editing ? (
                <p className="py-3 text-sm text-muted-foreground">
                  {sourceLabel}
                  {item.kind === "source" && item.sourceIsCurrent === false
                    ? readOnlySourceResult
                      ? " · Earlier prescription"
                      : " · Earlier prescription · Private results"
                    : ""}
                  {item.kind === "source" && item.sourceTrainingDate !== date
                    ? ` · ${item.sourceTrainingDate}`
                    : ""}
                </p>
              ) : null}
              {editing ? (
                <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    aria-label={`Move ${item.kind === "library" ? item.workout.name : item.block.title} up`}
                    disabled={saving || editor !== null || index === 0}
                    onClick={() => {
                      const next = [...inputs]
                      const moved = next.splice(index, 1)[0]
                      if (!moved) return
                      next.splice(index - 1, 0, moved)
                      void updateDraft(next)
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    aria-label={`Move ${item.kind === "library" ? item.workout.name : item.block.title} down`}
                    disabled={
                      saving || editor !== null || index === items.length - 1
                    }
                    onClick={() => {
                      const next = [...inputs]
                      const moved = next.splice(index, 1)[0]
                      if (!moved) return
                      next.splice(index + 1, 0, moved)
                      void updateDraft(next)
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {item.kind !== "library" ? (
                    <Button
                      variant="ghost"
                      className="min-h-11"
                      disabled={
                        saving ||
                        editor !== null ||
                        (item.kind === "personal" && !!result?.completed)
                      }
                      onClick={() => startEditor(item)}
                    >
                      {item.kind === "source"
                        ? "Remix to edit"
                        : "Edit workout"}
                    </Button>
                  ) : (
                    <a
                      className="inline-flex min-h-11 items-center px-3 text-sm underline underline-offset-4"
                      href={`/workouts/${encodeURIComponent(item.workoutId)}?teamId=${encodeURIComponent(team.id)}&date=${date}`}
                    >
                      View or remix in library
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={saving || editor !== null}
                    onClick={() =>
                      setDraft((current) => [
                        ...(current ?? []),
                        item.kind === "source"
                          ? {
                              id: crypto.randomUUID(),
                              kind: "personal",
                              block: item.block,
                              remixedFrom: {
                                sourceSessionId: item.sourceSessionId,
                                sourceBlockId: item.sourceBlockId,
                                sourcePublishedVersion:
                                  item.sourcePublishedVersion,
                              },
                            }
                          : { ...item, id: crypto.randomUUID() },
                      ])
                    }
                  >
                    Add another attempt
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={saving || editor !== null}
                    onClick={() =>
                      void updateDraft(
                        inputs.filter((entry) => entry.id !== item.id),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
            {item.kind === "library" ? (
              <div className="space-y-3 py-6">
                <h3 className="break-words text-xl font-semibold">
                  {item.workout.name}
                </h3>
                <p className="max-w-prose whitespace-pre-wrap break-words">
                  {item.workout.description}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.workout.scheme}
                </p>
                <a
                  className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
                  href={
                    day.libraryResults.find(
                      (result) => result.itemId === item.id,
                    )
                      ? `/log/${encodeURIComponent(day.libraryResults.find((result) => result.itemId === item.id)?.scoreId ?? "")}/edit?redirectUrl=${encodeURIComponent(`/training?teamId=${team.id}&date=${date}&surface=session`)}`
                      : `/log/new?workoutId=${encodeURIComponent(item.workoutId)}&date=${date}&teamId=${encodeURIComponent(team.id)}&personalSessionId=${encodeURIComponent(personal?.id ?? "")}&personalItemId=${encodeURIComponent(item.id)}&personalRevision=${personal?.revision ?? 0}`
                  }
                >
                  {day.libraryResults.some(
                    (result) => result.itemId === item.id,
                  )
                    ? `Edit score · ${day.libraryResults.find((result) => result.itemId === item.id)?.displayScore ?? "Saved"}`
                    : "Log score"}
                </a>
              </div>
            ) : (
              <ol>
                <AthleteSessionBlock
                  secondaryActions={
                    surface === "track" && !editing ? (
                      <div className="contents">
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={
                            saving ||
                            !!personal?.items.some(
                              (existing) =>
                                existing.kind === "source" &&
                                item.kind === "source" &&
                                existing.sourceSessionId ===
                                  item.sourceSessionId &&
                                existing.sourceBlockId === item.sourceBlockId &&
                                existing.sourcePublishedVersion ===
                                  item.sourcePublishedVersion,
                            )
                          }
                          onClick={() =>
                            void append([
                              { ...itemInput(item), id: additionId(item.id) },
                            ])
                          }
                        >
                          {personal?.items.some(
                            (existing) =>
                              existing.kind === "source" &&
                              item.kind === "source" &&
                              existing.sourceSessionId ===
                                item.sourceSessionId &&
                              existing.sourceBlockId === item.sourceBlockId,
                          )
                            ? "In My session"
                            : "Add to My session"}
                        </Button>
                      </div>
                    ) : null
                  }
                  session={renderedSession}
                  block={item.block}
                  index={index}
                  gymName={team.name}
                  trackName={sourceLabel}
                  result={result}
                  readOnlyMessage={
                    editing
                      ? "Save your session to record this section."
                      : readOnlySourceResult
                        ? "Saved against an earlier published version. This result is preserved in My progress and cannot be edited here."
                        : undefined
                  }
                  privateOnly={personalResult}
                  saveResult={
                    personalResult && personal
                      ? async (input) =>
                          savePersonalTrainingResultFn({
                            data: {
                              personalSessionId: personal.id,
                              itemId: item.id,
                              expectedRevision: personal.revision,
                              score: input.score,
                              ...(item.block.kind === "workout"
                                ? {
                                    status: input.status,
                                    secondaryScore: input.secondaryScore,
                                    roundScores: input.roundScores,
                                    tiebreakScore: input.tiebreakScore,
                                    distanceUnit: input.distanceUnit,
                                  }
                                : {}),
                              notes: input.notes,
                              unit: input.unit,
                              completed: input.completed,
                            },
                          })
                      : undefined
                  }
                  onSaved={(saved) => {
                    if (item.kind === "source" && !personalResult)
                      onSaved(saved)
                    setDay((current) =>
                      current
                        ? {
                            ...current,
                            results: [
                              ...current.results.filter(
                                (existing) => existing.id !== saved.id,
                              ),
                              saved,
                            ],
                          }
                        : current,
                    )
                  }}
                />
              </ol>
            )}
          </div>
        )
      })}
      {day.source?.kind === "provider-day" &&
        surface === "track" &&
        !editing && (
          <div className={personal ? "mt-8 border-t pt-6" : ""}>
            <h3 className="mb-4 text-lg font-semibold">
              {selectedTrackName} · Source programming
            </h3>
            <CrossFitTrackDays
              days={[day.source.day]}
              selectedDate={date}
              onAdd={(ids) =>
                void append(
                  ids.map((workoutId) => ({
                    id: additionId(`library-${workoutId}`),
                    kind: "library",
                    workoutId,
                    sourceTrackId: trackId,
                    sourceDate: date,
                  })),
                )
              }
              renderActions={(workout) => (
                <SessionWorkoutActions
                  teamId={team.id}
                  date={date}
                  workoutId={workout.workoutId}
                  trackId={trackId}
                  day={day}
                  onChanged={setDay}
                  onOpenSession={() => selectSurface("session")}
                />
              )}
            />
          </div>
        )}
      {editor ? (
        <form
          className="space-y-4 border-t border-border py-6"
          onSubmit={async (event) => {
            event.preventDefault()
            let savedBlock = editor.block
            if (editor.block.kind === "workout") {
              const parsed = normalizedWorkoutSaveSchema.safeParse(
                editor.block.workout,
              )
              if (!parsed.success) {
                setError(
                  parsed.error.issues[0]?.message ??
                    "Check the workout details before saving.",
                )
                return
              }
              savedBlock = {
                ...editor.block,
                workout: parsed.data,
                title: parsed.data.name,
                prescription: parsed.data.description,
              }
            }
            const original = items.find((item) => item.id === editor.itemId)
            const next: PersonalTrainingItemInput = {
              id:
                original?.kind === "personal"
                  ? original.id
                  : crypto.randomUUID(),
              kind: "personal",
              block: {
                ...savedBlock,
                id:
                  original?.kind === "personal"
                    ? original.block.id
                    : crypto.randomUUID(),
              },
              ...(original?.kind === "source"
                ? {
                    remixedFrom: {
                      sourceSessionId: original.sourceSessionId,
                      sourceBlockId: original.sourceBlockId,
                      sourcePublishedVersion: original.sourcePublishedVersion,
                    },
                  }
                : original?.kind === "personal" && original.remixedFrom
                  ? { remixedFrom: original.remixedFrom }
                  : {}),
            }
            if (
              await updateDraft(
                original
                  ? inputs.map((item) =>
                      item.id === original.id ? next : item,
                    )
                  : [...inputs, next],
              )
            )
              setEditor(null)
          }}
        >
          <h3 className="text-xl font-semibold">
            {editor.itemId
              ? "Edit your workout"
              : editor.block.kind === "workout"
                ? "Create a workout"
                : "Add a session section"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Your prescription and results stay private.
          </p>
          {editor.block.kind === "workout" && editor.block.workout ? (
            <PersonalWorkoutDefinition
              teamId={team.id}
              value={editor.block.workout}
              disabled={saving}
              onChange={(patch) =>
                setEditor((current) =>
                  current?.block.workout
                    ? {
                        ...current,
                        block: {
                          ...current.block,
                          workout: { ...current.block.workout, ...patch },
                          title: patch.name ?? current.block.title,
                          prescription:
                            patch.description ?? current.block.prescription,
                        },
                      }
                    : current,
                )
              }
            />
          ) : (
            <fieldset disabled={saving} className="space-y-4">
              <legend className="sr-only">Workout details</legend>
              <div className="space-y-2">
                <Label htmlFor="personal-title">
                  {["check", "note"].includes(editor.block.kind)
                    ? "Section name"
                    : "Workout name"}
                </Label>
                <Input
                  className="min-h-11"
                  ref={editorInput}
                  id="personal-title"
                  required
                  maxLength={160}
                  value={editor.block.title}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      block: { ...editor.block, title: event.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal-prescription">Workout</Label>
                <Textarea
                  id="personal-prescription"
                  required
                  rows={5}
                  value={editor.block.prescription}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      block: {
                        ...editor.block,
                        prescription: event.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal-kind">Record</Label>
                <select
                  id="personal-kind"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  value={editor.block.kind}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      block: {
                        ...editor.block,
                        kind: event.target.value as TrainingBlock["kind"],
                      },
                    })
                  }
                >
                  <option value="check">Completion</option>
                  {items.some(
                    (item) =>
                      item.kind !== "library" &&
                      item.id === editor.itemId &&
                      ["load", "time", "reps"].includes(item.block.kind),
                  ) ? (
                    <>
                      <option value="load">Load</option>
                      <option value="time">Time</option>
                      <option value="reps">Reps</option>
                    </>
                  ) : null}
                  <option value="note">Instructions only</option>
                </select>
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
              disabled={saving}
              type="submit"
            >
              Apply to draft
            </Button>
            <Button
              className="min-h-11"
              disabled={saving}
              variant="outline"
              type="button"
              onClick={() => setEditor(null)}
            >
              Discard changes
            </Button>
          </div>
        </form>
      ) : null}
      {adding ? (
        <ProgrammingPicker
          team={team}
          date={date}
          currentItems={items}
          disabled={saving}
          onAdd={async (entries) => {
            setDraft([...draft, ...entries])
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editing && !editor && !adding ? (
        <div className="grid grid-cols-1 gap-2 border-t border-border py-6 sm:flex sm:flex-wrap">
          <Button
            id="session-add-workout"
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => setAdding(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add from another session
          </Button>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => startEditor()}
          >
            Create workout
          </Button>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setEditor({
                block: {
                  id: crypto.randomUUID(),
                  kind: "check",
                  title: "",
                  prescription: "",
                  scalingGuidance: "",
                  coachGuidance: "",
                },
              })
              setAdding(false)
            }}
          >
            Add instructions or completion
          </Button>
          <WorkoutImportEntry
            key={importContextKey}
            destination={{ kind: "personal" }}
            saveLabel="Create and review for session"
            disabled={saving || libraryPending.length > 0}
            onOpenChange={setImportOpen}
            onSaved={(result, signal) => {
              if (
                signal.aborted ||
                !importContext.active ||
                currentImportContext.current !== importContext
              ) {
                throw new Error(
                  "The selected session changed. Your workout is saved in the library; add it from there to the intended day.",
                )
              }
              setLibraryPending([result.workoutId])
            }}
          />
          <a
            className="inline-flex min-h-11 items-center px-3 text-sm font-medium underline underline-offset-4"
            href={`/workouts?teamId=${encodeURIComponent(team.id)}&date=${date}`}
          >
            Workout library
          </a>
        </div>
      ) : null}
    </section>
  )
}

function ProgrammingPicker({
  team,
  date,
  currentItems,
  disabled,
  onAdd,
  onClose,
}: {
  team: TrainingTeam
  date: string
  currentItems: PersonalTrainingItem[]
  disabled: boolean
  onAdd: (items: PersonalTrainingItem[]) => Promise<void>
  onClose: () => void
}) {
  const [trackId, setTrackId] = useState(team.tracks[0]?.id ?? "")
  const [sourceDate, setSourceDate] = useState(date)
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [provider, setProvider] = useState<TrainingProviderDay | null>(null)
  const [excerpt, setExcerpt] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    setSession(null)
    setProvider(null)
    setExcerpt("")
    setSelected([])
    setError("")
    if (!trackId || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) return
    setLoading(true)
    getTrainingWeekFn({
      data: {
        teamId: team.id,
        trackId,
        startDate: sourceDate,
        mode: "athlete",
      },
    })
      .then((week) => {
        if (!cancelled) {
          const coached =
            week.sessions.find((item) => item.trainingDate === sourceDate) ??
            null
          setSession(coached)
          setProvider(
            coached
              ? null
              : (week.providerDays?.find((day) => day.date === sourceDate) ??
                  null),
          )
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load programming. Choose another track or date to retry.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [team.id, trackId, sourceDate])
  const sourceBlocks = session?.published?.blocks ?? []
  const blocks = provider
    ? provider.workouts.map((workout) => ({
        id: workout.workoutId,
        title: workout.name,
        prescription: workout.description ?? "",
      }))
    : sourceBlocks
  const available = blocks.filter(
    (block) =>
      !currentItems.some((item) =>
        item.kind === "library"
          ? item.workoutId === block.id &&
            item.occurrence?.trackId === trackId &&
            item.occurrence?.sourceDate === sourceDate
          : item.kind === "source" &&
            item.sourceSessionId === session?.id &&
            item.sourceBlockId === block.id &&
            item.sourcePublishedVersion === session.publishedVersion,
      ),
  )
  return (
    <section
      className="space-y-4 border-t border-border py-6"
      aria-labelledby="programming-picker-title"
    >
      <h3 id="programming-picker-title" className="text-xl font-semibold">
        Add from another session
      </h3>
      <fieldset disabled={disabled} className="space-y-4">
        <legend className="sr-only">Choose workouts</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="source-track">Track</Label>
            <select
              id="source-track"
              value={trackId}
              onChange={(event) => setTrackId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            >
              {team.tracks.map((track) => (
                <option value={track.id} key={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-date">Programmed date</Label>
            <Input
              className="min-h-11"
              id="source-date"
              type="date"
              value={sourceDate}
              onChange={(event) => setSourceDate(event.target.value)}
            />
          </div>
        </div>
        {provider?.markdown && (
          <div className="space-y-3">
            <details>
              <summary className="min-h-11 cursor-pointer py-3">
                Read the original session
              </summary>
              <p className="whitespace-pre-wrap text-sm">{provider.markdown}</p>
            </details>
            <Label htmlFor="borrowed-instructions">
              Instructions to borrow (optional)
            </Label>
            <Textarea
              id="borrowed-instructions"
              placeholder="Paste the warm-up, cooldown or instructions you want to keep."
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Saved as a private note with the source track, date and link.
            </p>
          </div>
        )}
        {loading ? (
          <output>Loading programming…</output>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !available.length ? (
          <p className="text-sm text-muted-foreground">
            {blocks.length
              ? "These workouts are already in your session."
              : "No workouts are published for this track and date."}
          </p>
        ) : (
          <>
            <Button
              className="min-h-11"
              variant="ghost"
              type="button"
              onClick={() => setSelected(available.map((block) => block.id))}
            >
              Select all sections
            </Button>
            <div className="divide-y divide-border">
              {available.map((block) => (
                <label
                  key={block.id}
                  className="flex min-h-11 items-start gap-3 py-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-primary"
                    checked={selected.includes(block.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, block.id]
                          : selected.filter((id) => id !== block.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block break-words font-medium">
                      {block.title}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {block.prescription}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
          disabled={
            disabled || loading || (!selected.length && !excerpt.trim())
          }
          onClick={async () => {
            if (provider) {
              setLoading(true)
              setError("")
              try {
                const borrowed: PersonalTrainingItem[] = await Promise.all(
                  selected.map(async (workoutId) => {
                    const workout = await getTrainingLibraryWorkoutFn({
                      data: {
                        teamId: team.id,
                        workoutId,
                        sourceTrackId: trackId,
                        sourceDate,
                      },
                    })
                    return {
                      id: crypto.randomUUID(),
                      kind: "library" as const,
                      workoutId,
                      workout,
                      provenance: workout.provenance,
                      occurrence: { trackId, sourceDate },
                    }
                  }),
                )
                if (excerpt.trim())
                  borrowed.push({
                    id: crypto.randomUUID(),
                    kind: "personal",
                    block: {
                      id: crypto.randomUUID(),
                      kind: "note",
                      title: "Borrowed instructions",
                      prescription: `${excerpt.trim()}\n\nSource: ${team.tracks.find((track) => track.id === trackId)?.name ?? "Programming"} · ${sourceDate}\n${provider.url}`,
                      coachGuidance: "",
                      scalingGuidance: "",
                    },
                  })
                await onAdd(borrowed)
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not load the selected workouts",
                )
              } finally {
                setLoading(false)
              }
              return
            }
            if (session)
              void onAdd(
                selected.map((blockId) => ({
                  id: crypto.randomUUID(),
                  kind: "source",
                  sourceSessionId: session.id,
                  sourceBlockId: blockId,
                  sourcePublishedVersion: session.publishedVersion,
                  block: sourceBlocks.find((block) => block.id === blockId)!,
                  trackId: session.trackId,
                  trackName:
                    team.tracks.find((track) => track.id === session.trackId)
                      ?.name ?? "Programming",
                  sourceTrainingDate: session.trainingDate,
                })),
              )
          }}
        >
          Add {selected.length + (excerpt.trim() ? 1 : 0) || "selected"} workout
          {selected.length + (excerpt.trim() ? 1 : 0) === 1 ? "" : "s"}
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={disabled}
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </section>
  )
}
