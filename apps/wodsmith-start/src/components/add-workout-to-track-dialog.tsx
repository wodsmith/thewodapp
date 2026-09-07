"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WorkoutImportAccessButton } from "@/components/workout-import/workout-import-entry"
import { WorkoutImportPanel } from "@/components/workout-import/workout-import-panel"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import { addWorkoutToTrackFn } from "@/server-fns/programming-fns"
import { getWorkoutsFn } from "@/server-fns/workout-fns"

interface AddWorkoutToTrackDialogProps {
  trackId: string
  teamId: string
  onSuccess?: () => void
}

export function AddWorkoutToTrackDialog({
  trackId,
  teamId,
  onSuccess,
}: AddWorkoutToTrackDialogProps) {
  const submitLock = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )
  const autoOrder = trackId === CROSSFIT_TRACK_ID
  const [open, setOpen] = useState(false)
  const [createWithAI, setCreateWithAI] = useState(false)
  const importingWithAI = createWithAI && !autoOrder
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>("")
  const [trackOrder, setTrackOrder] = useState<string>("1")
  const [notes, setNotes] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [workouts, setWorkouts] = useState<Array<{ id: string; name: string }>>(
    [],
  )
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false)

  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retrying the same page must rerun the request.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchWorkouts = async () => {
      setIsLoadingWorkouts(true)
      setLoadError(false)
      try {
        const result = await getWorkoutsFn({
          data: { teamId, page, pageSize: 50 },
        })
        if (cancelled) return
        setWorkouts((previous) =>
          page === 1
            ? result.workouts
            : [
                ...previous,
                ...result.workouts.filter(
                  (item) =>
                    !previous.some((existing) => existing.id === item.id),
                ),
              ],
        )
        setTotalCount(result.totalCount)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setIsLoadingWorkouts(false)
      }
    }
    void fetchWorkouts()
    return () => {
      cancelled = true
    }
  }, [open, teamId, page, loadAttempt])

  const handleSubmit = async () => {
    if (submitLock.current) return
    if (!selectedWorkoutId) {
      setError("Please select a workout")
      return
    }

    const orderNumber = Number.parseInt(trackOrder, 10)
    if (!autoOrder && (Number.isNaN(orderNumber) || orderNumber < 1)) {
      setError("Track order must be a positive number")
      return
    }

    submitLock.current = true
    setIsSubmitting(true)
    setError(null)
    try {
      await addWorkoutToTrackFn({
        data: autoOrder
          ? {
              trackId: CROSSFIT_TRACK_ID,
              workoutId: selectedWorkoutId,
              notes: notes.trim() || undefined,
            }
          : {
              trackId,
              workoutId: selectedWorkoutId,
              trackOrder: orderNumber,
              notes: notes.trim() || undefined,
            },
      })

      setSuccessMessage("Workout added to track")
      // Wait a moment to show success message
      closeTimer.current = setTimeout(() => {
        setOpen(false)
        submitLock.current = false
        setIsSubmitting(false)
        closeTimer.current = null
        // Reset form
        setSelectedWorkoutId("")
        setTrackOrder("1")
        setNotes("")
        setSuccessMessage(null)
        // Trigger parent refresh
        onSuccess?.()
      }, 1000)
    } catch (err) {
      console.error("Failed to add workout to track:", err)
      setError(
        err instanceof Error ? err.message : "Failed to add workout to track",
      )
      submitLock.current = false
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (submitLock.current) return
    setOpen(newOpen)
    if (newOpen) {
      setPage(1)
      setWorkouts([])
      setTotalCount(0)
    }
    if (!newOpen) {
      setCreateWithAI(false)
      // Reset form when closing
      setSelectedWorkoutId("")
      setTrackOrder("1")
      setNotes("")
      setError(null)
      setSuccessMessage(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add workout</Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(event) => {
          if (importingWithAI) event.preventDefault()
        }}
        className={
          importingWithAI
            ? "max-h-[95dvh] overflow-y-auto sm:max-w-3xl"
            : "max-h-[95dvh] overflow-y-auto sm:max-w-[500px]"
        }
      >
        <DialogHeader>
          <DialogTitle>Add workout to track</DialogTitle>
          <DialogDescription>
            {autoOrder
              ? "Select a workout to append to the track."
              : "Select a workout and specify its position in the programming track."}
          </DialogDescription>
        </DialogHeader>

        {!autoOrder && !importingWithAI && (
          <WorkoutImportAccessButton
            destination={{ kind: "track", trackId }}
            onClick={() => setCreateWithAI(true)}
          />
        )}
        {importingWithAI && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateWithAI(false)}
          >
            Choose an existing workout
          </Button>
        )}
        {error && (
          <div className="p-4 bg-red-500/10 border-2 border-red-500 text-red-500 font-mono text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-500/10 border-2 border-green-500 text-green-500 font-mono text-sm">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 py-4">
          {!importingWithAI && (
            <div className="grid gap-2">
              <Label htmlFor="workout">Workout</Label>
              <Select
                value={selectedWorkoutId}
                onValueChange={setSelectedWorkoutId}
                disabled={isLoadingWorkouts || isSubmitting}
              >
                <SelectTrigger id="workout">
                  <SelectValue placeholder="Select a workout" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingWorkouts ? (
                    <SelectItem value="loading" disabled>
                      Loading workouts...
                    </SelectItem>
                  ) : workouts.length > 0 ? (
                    workouts.map((workout) => (
                      <SelectItem key={workout.id} value={workout.id}>
                        {workout.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-workouts" disabled>
                      No workouts available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {loadError ? (
                <div role="alert">
                  <p>Failed to load workouts.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLoadAttempt((value) => value + 1)}
                  >
                    Retry loading workouts
                  </Button>
                </div>
              ) : (
                workouts.length < totalCount && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoadingWorkouts || isSubmitting}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    {isLoadingWorkouts
                      ? "Loading workouts..."
                      : "Load more workouts"}
                  </Button>
                )
              )}
            </div>
          )}
          {!autoOrder && (
            <div className="grid gap-2">
              <Label htmlFor="trackOrder">Track Order</Label>
              <Input
                id="trackOrder"
                type="number"
                min="1"
                value={trackOrder}
                onChange={(e) => setTrackOrder(e.target.value)}
                disabled={isSubmitting}
                placeholder="1"
              />
              <p className="text-sm text-muted-foreground">
                Position of this workout in the track (e.g., Day 1, Day 2)
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="Add any notes about this workout..."
            />
          </div>
        </div>
        {importingWithAI && open && (
          <WorkoutImportPanel
            key={trackId}
            destination={{ kind: "track", trackId }}
            saveLabel="Create and add to track"
            track={{
              trackOrder: Number(trackOrder),
              notes: notes.trim() || undefined,
            }}
            onClose={() => setCreateWithAI(false)}
            onSaved={() => {
              handleOpenChange(false)
              onSuccess?.()
            }}
          />
        )}
        {!importingWithAI && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedWorkoutId}
            >
              {isSubmitting ? "Adding..." : "Add workout"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
