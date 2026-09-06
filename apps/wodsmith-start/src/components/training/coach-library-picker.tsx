import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { libraryWorkoutToBlock } from "@/lib/training/library-block"
import type { TrainingBlock } from "@/lib/training/types"
import {
  getTrainingLibraryWorkoutFn,
  listTrainingLibraryWorkoutsFn,
} from "@/server-fns/training-personal-fns"

export function CoachLibraryPicker({
  teamId,
  disabled,
  onAdd,
  onOpenChange,
}: {
  teamId: string
  disabled: boolean
  onAdd: (block: TrainingBlock) => void
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<
    Array<{ id: string; name: string; scheme: string }>
  >([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const requestSequence = useRef(0)
  useEffect(() => {
    onOpenChange?.(open)
    return () => onOpenChange?.(false)
  }, [open, onOpenChange])
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing gym invalidates in-flight library requests.
  useEffect(() => {
    requestSequence.current += 1
    setItems([])
    setSearched(false)
    setError("")
    setBusy(false)
    return () => {
      requestSequence.current += 1
    }
  }, [teamId])
  async function findWorkouts() {
    if (disabled) return
    const request = ++requestSequence.current
    setBusy(true)
    setItems([])
    setError("")
    try {
      const result = await listTrainingLibraryWorkoutsFn({
        data: { teamId, search },
      })
      if (request !== requestSequence.current) return
      setItems(result)
      setSearched(true)
    } catch {
      if (request === requestSequence.current)
        setError("Could not load the workout library. Try searching again.")
    } finally {
      if (request === requestSequence.current) setBusy(false)
    }
  }
  async function addWorkout(workoutId: string) {
    if (disabled || busy) return
    const request = ++requestSequence.current
    setBusy(true)
    setError("")
    try {
      const workout = await getTrainingLibraryWorkoutFn({
        data: { teamId, workoutId },
      })
      if (request !== requestSequence.current) return
      onAdd(libraryWorkoutToBlock(workout, crypto.randomUUID()))
      setOpen(false)
    } catch (error) {
      if (request !== requestSequence.current) return
      setError(
        error instanceof Error
          ? error.message
          : "Could not add this workout. Try again.",
      )
    } finally {
      if (request === requestSequence.current) setBusy(false)
    }
  }
  return (
    <div className="mt-4 space-y-4">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Add from workout library
      </Button>
      {open && (
        <section
          className="space-y-4 border-t border-border pt-4"
          aria-label="Workout library picker"
        >
          <p className="max-w-prose text-sm text-muted-foreground">
            Add an independent section to this draft. The original library
            workout stays available for reuse.
          </p>
          <div className="space-y-2">
            <Label htmlFor="coach-library-search">Find a library workout</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="coach-library-search"
                disabled={disabled}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void findWorkouts()
                  }
                }}
              />
              <Button
                type="button"
                disabled={busy || disabled}
                onClick={() => void findWorkouts()}
              >
                {busy ? "Loading…" : "Search library"}
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {searched && !busy && !items.length && (
            <p className="text-sm text-muted-foreground">
              No workouts match. Try another name.
            </p>
          )}
          <ul className="max-h-72 space-y-2 overflow-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.scheme}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || disabled}
                  onClick={() => void addWorkout(item.id)}
                  aria-label={`Add ${item.name} to draft`}
                >
                  Add to draft
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
