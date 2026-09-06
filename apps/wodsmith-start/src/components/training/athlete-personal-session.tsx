import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
} from "@/lib/training/types"
import { getTrainingWeekFn } from "@/server-fns/training-fns"
import {
  getPersonalTrainingDayFn,
  getTrainingLibraryWorkoutFn,
  savePersonalTrainingResultFn,
  savePersonalTrainingSessionFn,
} from "@/server-fns/training-personal-fns"
import { AthleteSessionBlock } from "./athlete-session-block"

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
    return { id: item.id, kind: item.kind, workoutId: item.workoutId }
  return item
}

export function AthletePersonalSession({
  team,
  trackId,
  date,
  sourceResults,
  onSaved,
  libraryWorkoutId,
  onInteractionBusy,
}: {
  team: TrainingTeam
  trackId: string
  date: string
  sourceResults: OwnTrainingResult[]
  onSaved: (result: OwnTrainingResult) => void
  libraryWorkoutId?: string
  onInteractionBusy?: (busy: boolean) => void
}) {
  const [day, setDay] = useState<PersonalTrainingDay | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [retry, setRetry] = useState(0)
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
    onInteractionBusy?.(saving || editingWorkout)
    return () => onInteractionBusy?.(false)
  }, [saving, editingWorkout, onInteractionBusy])
  const [libraryPending, setLibraryPending] = useState(libraryWorkoutId)
  const [libraryPreview, setLibraryPreview] = useState<{
    name: string
    description: string
    scheme: string
  } | null>(null)
  const [libraryError, setLibraryError] = useState("")
  useEffect(() => {
    let cancelled = false
    setLibraryPreview(null)
    setLibraryError("")
    if (!libraryPending) return
    getTrainingLibraryWorkoutFn({
      data: { teamId: team.id, workoutId: libraryPending },
    })
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
    setError("")
    setEditor(null)
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

  async function save(items: PersonalTrainingItemInput[]) {
    if (!day || saving) return false
    setSaving(true)
    setError("")
    try {
      await savePersonalTrainingSessionFn({
        data: {
          teamId: team.id,
          trainingDate: date,
          expectedRevision: day.personalSession?.revision ?? 0,
          items,
        },
      })
      const next = await getPersonalTrainingDayFn({
        data: {
          teamId: team.id,
          trainingDate: date,
          trackId: trackId || undefined,
        },
      })
      setDay(next)
      return true
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
  const title = personal
    ? "My session"
    : (source?.published?.title ?? "My session")
  const items = day.items
  const inputs = items.map(itemInput)
  const selectedTrackName = team.tracks.find(
    (track) => track.id === trackId,
  )?.name

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
            kind: "check",
            coachGuidance: "",
            scalingGuidance: "",
          },
    })
    setAdding(false)
  }

  return (
    <section aria-labelledby="training-session-title" aria-busy={saving}>
      <div className="pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2
            id="training-session-title"
            className="min-w-0 break-words text-3xl font-semibold sm:text-4xl"
          >
            {title}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={saving || editor !== null}
              onClick={() => {
                document.getElementById("session-add-workout")?.focus()
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add workout
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={saving || editor !== null}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Done customizing" : "Customize session"}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {date} ·{" "}
          {personal
            ? "Your session · Personal changes are private"
            : (selectedTrackName ?? "Personal training")}
        </p>
        {!personal && source?.published?.coachNote ? (
          <p className="mt-5 max-w-prose whitespace-pre-wrap break-words leading-relaxed">
            {source.published.coachNote}
          </p>
        ) : null}
        {!personal && !items.length ? (
          <p className="mt-5 text-muted-foreground">
            {source?.published?.isRestDay
              ? "Rest day. Add your own work if you choose to train."
              : "No session is published for this day. You can still build your own."}
          </p>
        ) : null}
        {editing ? (
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Add, remove, or reorder workouts for your day. Published workouts
            stay linked to their track. Remix a workout to change its
            prescription.
          </p>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="mb-6 space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setRetry((value) => value + 1)}
          >
            Reload session
          </Button>
        </div>
      ) : null}
      {libraryPending ? (
        <div className="space-y-3 border-y border-border py-6">
          <h3 className="text-lg font-semibold">
            {libraryPreview
              ? `Add ${libraryPreview.name}?`
              : "Selected library workout"}
          </h3>
          <p className="text-sm text-muted-foreground">
            It will be added to your session on {date}. Its original scoring
            format stays available.
          </p>
          {libraryError ? (
            <p role="alert" className="text-sm text-destructive">
              {libraryError}
            </p>
          ) : libraryPreview ? (
            <p className="max-w-prose whitespace-pre-wrap break-words text-sm">
              {libraryPreview.description}
            </p>
          ) : (
            <output>Loading workout…</output>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
              disabled={saving || !libraryPreview}
              onClick={async () => {
                if (
                  await save([
                    ...inputs,
                    {
                      id: crypto.randomUUID(),
                      kind: "library",
                      workoutId: libraryPending,
                    },
                  ])
                ) {
                  setLibraryPending(undefined)
                  const url = new URL(window.location.href)
                  url.searchParams.delete("workoutId")
                  window.history.replaceState(null, "", url)
                }
              }}
            >
              Add to my session
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setLibraryPending(undefined)}
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
        const result =
          item.kind === "source" && !personalResult
            ? ([...sourceResults, ...day.results].find(
                (result) =>
                  result.sessionId === item.sourceSessionId &&
                  result.blockId === item.sourceBlockId &&
                  result.publishedVersion === item.sourcePublishedVersion,
              ) ?? day.results.find((result) => result.blockId === item.id))
            : day.results.find((result) => result.blockId === item.id)
        const sourceLabel =
          item.kind === "source"
            ? item.trackName
            : item.kind === "library"
              ? "Workout library"
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
          <div key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              {personal || editing ? (
                <p className="py-3 text-sm text-muted-foreground">
                  {sourceLabel}
                  {item.kind === "source" && item.sourceIsCurrent === false
                    ? " · Earlier prescription · Private results"
                    : ""}
                  {item.kind === "source" && item.sourceTrainingDate !== date
                    ? ` · ${item.sourceTrainingDate}`
                    : ""}
                </p>
              ) : null}
              {editing ? (
                <div className="flex flex-wrap items-center gap-1">
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
                      void save(next)
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
                      void save(next)
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
                      void save(inputs.filter((entry) => entry.id !== item.id))
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
                      ? `/log/${encodeURIComponent(day.libraryResults.find((result) => result.itemId === item.id)?.scoreId ?? "")}/edit?redirectUrl=${encodeURIComponent(`/training?teamId=${team.id}&date=${date}`)}`
                      : `/log/new?workoutId=${encodeURIComponent(item.workoutId)}&date=${date}&teamId=${encodeURIComponent(team.id)}&personalSessionId=${encodeURIComponent(personal?.id ?? "")}&personalItemId=${encodeURIComponent(item.id)}&personalRevision=${personal?.revision ?? 0}`
                  }
                >
                  {day.libraryResults.some(
                    (result) => result.itemId === item.id,
                  )
                    ? "View saved workout"
                    : "Log workout"}
                </a>
              </div>
            ) : (
              <ol>
                <AthleteSessionBlock
                  session={renderedSession}
                  block={item.block}
                  index={index}
                  gymName={team.name}
                  trackName={sourceLabel}
                  result={result}
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
      {editor ? (
        <form
          className="space-y-4 border-t border-border py-6"
          onSubmit={async (event) => {
            event.preventDefault()
            const original = items.find((item) => item.id === editor.itemId)
            const next: PersonalTrainingItemInput = {
              id:
                original?.kind === "personal"
                  ? original.id
                  : crypto.randomUUID(),
              kind: "personal",
              block: {
                ...editor.block,
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
              await save(
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
            {editor.itemId ? "Edit your workout" : "Create a workout"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Your prescription and results stay private.
          </p>
          <fieldset disabled={saving} className="space-y-4">
            <legend className="sr-only">Workout details</legend>
            <div className="space-y-2">
              <Label htmlFor="personal-title">Workout name</Label>
              <Input
                ref={editorInput}
                id="personal-title"
                required
                maxLength={200}
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
                <option value="load">Load</option>
                <option value="time">Time</option>
                <option value="reps">Reps</option>
                <option value="note">Instructions only</option>
              </select>
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 bg-primary text-black hover:bg-primary hover:brightness-110 dark:text-black dark:hover:bg-primary"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : "Save to my session"}
            </Button>
            <Button
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
            if (await save([...inputs, ...entries])) setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {!editor && !adding ? (
        <div className="flex flex-wrap gap-2 border-t border-border py-6">
          <Button
            id="session-add-workout"
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => setAdding(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            From programming
          </Button>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={saving}
            onClick={() => startEditor()}
          >
            Create workout
          </Button>
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
  onAdd: (items: PersonalTrainingItemInput[]) => Promise<void>
  onClose: () => void
}) {
  const [trackId, setTrackId] = useState(team.tracks[0]?.id ?? "")
  const [sourceDate, setSourceDate] = useState(date)
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    setSession(null)
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
        if (!cancelled)
          setSession(
            week.sessions.find((item) => item.trainingDate === sourceDate) ??
              null,
          )
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
  const blocks = session?.published?.blocks ?? []
  const available = blocks.filter(
    (block) =>
      !currentItems.some(
        (item) =>
          item.kind === "source" &&
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
        Add from programming
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
              id="source-date"
              type="date"
              value={sourceDate}
              onChange={(event) => setSourceDate(event.target.value)}
            />
          </div>
        </div>
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
              variant="ghost"
              type="button"
              onClick={() => setSelected(available.map((block) => block.id))}
            >
              Select all workouts
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
          disabled={disabled || loading || !selected.length}
          onClick={() => {
            if (session)
              void onAdd(
                selected.map((blockId) => ({
                  id: crypto.randomUUID(),
                  kind: "source",
                  sourceSessionId: session.id,
                  sourceBlockId: blockId,
                  sourcePublishedVersion: session.publishedVersion,
                })),
              )
          }}
        >
          Add {selected.length || "selected"} workout
          {selected.length === 1 ? "" : "s"}
        </Button>
        <Button variant="outline" disabled={disabled} onClick={onClose}>
          Close
        </Button>
      </div>
    </section>
  )
}
