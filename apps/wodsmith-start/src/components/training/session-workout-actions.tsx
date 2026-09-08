import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { PersonalTrainingDay } from "@/lib/training/personal-types"
import {
  getPersonalTrainingDayFn,
  savePersonalTrainingSessionFn,
} from "@/server-fns/training-personal-fns"

/** Personal actions never imply permission to edit the source workout. */
export function SessionWorkoutActions({
  teamId,
  date,
  workoutId,
  trackId,
  sourceDate = trackId ? date : undefined,
  day: suppliedDay,
  onChanged,
  onOpenSession,
}: {
  teamId?: string
  date: string
  workoutId: string
  trackId?: string
  sourceDate?: string
  day?: PersonalTrainingDay
  onChanged?: (day: PersonalTrainingDay) => void
  onOpenSession?: () => void
}) {
  const [day, setDay] = useState(suppliedDay)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [added, setAdded] = useState(false)
  const intent = useRef<string | null>(null)
  const [insertedId, setInsertedId] = useState<string | null>(null)
  const context = `${teamId}:${date}:${workoutId}:${trackId ?? ""}:${sourceDate ?? ""}`
  const active = useRef(context)
  active.current = context
  useEffect(() => {
    if (onChanged || suppliedDay) setDay(suppliedDay)
  }, [suppliedDay, onChanged])
  // biome-ignore lint/correctness/useExhaustiveDependencies: A source-context change invalidates the pending user intent.
  useEffect(() => {
    let cancelled = false
    intent.current = null
    setInsertedId(null)
    setAdded(false)
    setBusy(false)
    setError("")
    if (onChanged || !teamId) return
    getPersonalTrainingDayFn({ data: { teamId, trainingDate: date } })
      .then((next) => {
        if (!cancelled) setDay(next)
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not load My session. Reload to add this workout.")
      })
    return () => {
      cancelled = true
    }
  }, [teamId, date, workoutId, trackId, sourceDate, onChanged])
  const personal = day?.personalSession
  const included = personal?.items.find(
    (item) =>
      item.kind === "library" &&
      item.workoutId === workoutId &&
      item.occurrence?.trackId === trackId &&
      item.occurrence?.sourceDate === sourceDate,
  )
  const result = day?.libraryResults.find(
    (result) =>
      result.workoutId === workoutId &&
      !!result.occurrence &&
      result.occurrence.trackId === trackId &&
      result.occurrence.sourceDate === sourceDate,
  )
  const returnTo = `/training?teamId=${encodeURIComponent(teamId ?? "")}&date=${date}&surface=track${trackId ? `&trackId=${encodeURIComponent(trackId)}` : ""}`
  const sessionHref = returnTo.replace("surface=track", "surface=session")
  const logHref = result
    ? `/log/${encodeURIComponent(result.scoreId)}/edit?redirectUrl=${encodeURIComponent(returnTo)}`
    : `/log/new?workoutId=${encodeURIComponent(workoutId)}&teamId=${encodeURIComponent(teamId ?? "")}&date=${date}${trackId ? `&trackId=${encodeURIComponent(trackId)}${sourceDate ? `&sourceDate=${sourceDate}` : ""}` : ""}`
  async function mutate(mode: "append" | "undo") {
    if (!teamId || !day || busy) return
    const operationContext = context
    intent.current ??= crypto.randomUUID()
    setBusy(true)
    setError("")
    try {
      const saved = await savePersonalTrainingSessionFn({
        data: {
          teamId,
          trainingDate: date,
          expectedRevision: personal?.revision ?? 0,
          mode,
          items: [
            {
              id:
                mode === "undo"
                  ? (insertedId ?? intent.current)
                  : intent.current,
              kind: "library",
              workoutId,
              sourceTrackId: trackId,
              sourceDate,
            },
          ],
        },
      })
      if (active.current !== operationContext) return
      const next = { ...day, personalSession: saved, items: saved.items }
      setDay(next)
      onChanged?.(next)
      const inserted =
        mode === "append" &&
        saved.items.some((item) => item.id === intent.current)
      setAdded(inserted)
      setInsertedId(inserted ? intent.current : null)
    } catch (cause) {
      if (active.current === operationContext)
        setError(
          cause instanceof Error ? cause.message : "Could not save. Try again.",
        )
    } finally {
      if (active.current === operationContext) setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button className="min-h-11" asChild>
          <a href={logHref}>
            {result
              ? `Edit score · ${result.displayScore ?? "Saved"}`
              : "Log score"}
          </a>
        </Button>
        {included ? (
          <Button variant="outline" className="min-h-11" asChild>
            <a
              href={sessionHref}
              onClick={(event) => {
                if (onOpenSession) {
                  event.preventDefault()
                  onOpenSession()
                }
              }}
            >
              In My session
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!day || busy || !teamId}
            onClick={() => void mutate("append")}
          >
            {busy ? "Adding…" : "Add to My session"}
          </Button>
        )}
        {!onOpenSession && (
          <Button variant="ghost" className="min-h-11" asChild>
            <a href={sessionHref}>
              My session
              {personal?.compositionState !== "result_only" && personal
                ? ` · ${personal.items.length}`
                : ""}
            </a>
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Perform on {date} · Your result is private
      </p>
      {added && (
        <output className="flex flex-wrap items-center gap-2 text-sm">
          <span>Added to My session · {date}</span>
          <Button variant="link" className="min-h-11" asChild>
            <a
              href={sessionHref}
              onClick={(event) => {
                if (onOpenSession) {
                  event.preventDefault()
                  onOpenSession()
                }
              }}
            >
              Open session
            </a>
          </Button>
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={busy}
            onClick={() => void mutate("undo")}
          >
            Undo
          </Button>
        </output>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
