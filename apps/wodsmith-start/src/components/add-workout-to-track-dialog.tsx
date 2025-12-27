'use client'

import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {addWorkoutToTrackFn} from '@/server-fns/programming-fns'
import {getWorkoutsFn} from '@/server-fns/workout-fns'

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
  const [open, setOpen] = useState(false)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('')
  const [trackOrder, setTrackOrder] = useState<string>('1')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [workouts, setWorkouts] = useState<Array<{id: string; name: string}>>(
    [],
  )
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false)

  // Fetch workouts when dialog opens
  useEffect(() => {
    if (open && workouts.length === 0) {
      const fetchWorkouts = async () => {
        setIsLoadingWorkouts(true)
        try {
          const result = await getWorkoutsFn({
            data: {teamId, page: 1, pageSize: 100},
          })
          setWorkouts(result.workouts)
        } catch (err) {
          console.error('Failed to fetch workouts:', err)
          setError('Failed to load workouts')
        } finally {
          setIsLoadingWorkouts(false)
        }
      }
      fetchWorkouts()
    }
  }, [open, teamId, workouts.length])

  const handleSubmit = async () => {
    if (!selectedWorkoutId) {
      setError('Please select a workout')
      return
    }

    const orderNumber = Number.parseInt(trackOrder, 10)
    if (Number.isNaN(orderNumber) || orderNumber < 1) {
      setError('Track order must be a positive number')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await addWorkoutToTrackFn({
        data: {
          trackId,
          workoutId: selectedWorkoutId,
          trackOrder: orderNumber,
          notes: notes.trim() || undefined,
        },
      })

      setSuccessMessage('Workout added to track')
      // Wait a moment to show success message
      setTimeout(() => {
        setOpen(false)
        // Reset form
        setSelectedWorkoutId('')
        setTrackOrder('1')
        setNotes('')
        setSuccessMessage(null)
        // Trigger parent refresh
        onSuccess?.()
      }, 1000)
    } catch (err) {
      console.error('Failed to add workout to track:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to add workout to track',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset form when closing
      setSelectedWorkoutId('')
      setTrackOrder('1')
      setNotes('')
      setError(null)
      setSuccessMessage(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Workout</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Workout to Track</DialogTitle>
          <DialogDescription>
            Select a workout and specify its position in the programming track.
          </DialogDescription>
        </DialogHeader>

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
          </div>
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
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedWorkoutId}
          >
            {isSubmitting ? 'Adding...' : 'Add Workout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
