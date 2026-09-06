import { useState } from "react"
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
}: {
  teamId: string
  disabled: boolean
  onAdd: (block: TrainingBlock) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<
    Array<{ id: string; name: string; scheme: string }>
  >([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function findWorkouts() {
    setBusy(true)
    setError("")
    try {
      setItems(
        await listTrainingLibraryWorkoutsFn({ data: { teamId, search } }),
      )
      setSearched(true)
    } catch {
      setError("Could not load the workout library. Try searching again.")
    } finally {
      setBusy(false)
    }
  }
  async function addWorkout(workoutId: string) {
    setBusy(true)
    setError("")
    try {
      const workout = await getTrainingLibraryWorkoutFn({
        data: { teamId, workoutId },
      })
      onAdd(libraryWorkoutToBlock(workout, crypto.randomUUID()))
      setOpen(false)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not add this workout. Try again.",
      )
    } finally {
      setBusy(false)
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
