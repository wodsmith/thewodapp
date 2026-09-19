import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { WorkoutDefinitionFields } from "@/components/workouts/workout-definition-fields"
import type { WorkoutAuthoringContext } from "@/lib/workout-authoring"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import { describeWorkoutFn } from "@/server-fns/workout-authoring-fns"

/** The consumer owns saving; classification cannot create a workout by itself. */
export function DescriptionWorkoutForm<TResult = NormalizedWorkoutSave>({
  context,
  onSubmit,
  onCancel,
  submitLabel = "Create workout",
  initialDescription = "",
  onDirtyChange,
  onBusyChange,
  recognize,
}: {
  context: WorkoutAuthoringContext
  onSubmit: (workout: TResult) => Promise<void> | void
  onCancel: () => void
  submitLabel?: string
  initialDescription?: string
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
  recognize?: (description: string) => Promise<TResult>
}) {
  const [text, setText] = useState(initialDescription)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const pending = useRef(false)
  const mounted = useRef(true)
  const currentKey = useRef("")
  currentKey.current = JSON.stringify([context, text])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  // Retain inference after a save failure so a retry keeps the same definition.
  const draft = useRef<{ key: string; workout: TResult } | null>(null)
  return (
    <form
      className="min-w-0 space-y-5"
      onSubmit={async (event) => {
        event.preventDefault()
        if (pending.current || !text.trim()) return
        pending.current = true
        setBusy(true)
        onBusyChange?.(true)
        setError("")
        try {
          const key = JSON.stringify([context, text])
          if (draft.current?.key !== key)
            draft.current = {
              key,
              workout: recognize
                ? await recognize(text)
                : ((await describeWorkoutFn({
                    data: { context, description: text },
                  })) as TResult),
            }
          if (!mounted.current || currentKey.current !== key) return
          await onSubmit(draft.current.workout)
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not create the workout. Your description is still here.",
          )
        } finally {
          pending.current = false
          setBusy(false)
          onBusyChange?.(false)
        }
      }}
    >
      <WorkoutDefinitionFields
        value={{}}
        onChange={() => {}}
        descriptionEntry={{
          text,
          onChange: (next) => {
            setText(next)
            onDirtyChange?.(true)
            setError("")
          },
        }}
        disabled={busy}
        autoFocus
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {busy && (
        <output className="block text-sm text-muted-foreground">
          Preparing your workout…
        </output>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? "Creating…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
