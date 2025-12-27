'use client'

import {Link} from '@tanstack/react-router'
import {Trash2} from 'lucide-react'
import type {TrackWorkoutWithDetails} from '@/server-fns/programming-fns'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {removeWorkoutFromTrackFn} from '@/server-fns/programming-fns'

interface TrackWorkoutRowProps {
  trackWorkout: TrackWorkoutWithDetails
  onRemoved?: () => void
}

export function TrackWorkoutRow({
  trackWorkout,
  onRemoved,
}: TrackWorkoutRowProps) {
  const handleRemove = async () => {
    if (
      !window.confirm(
        'Are you sure you want to remove this workout from the track?',
      )
    ) {
      return
    }

    try {
      await removeWorkoutFromTrackFn({
        data: {trackWorkoutId: trackWorkout.id},
      })
      onRemoved?.()
    } catch (error) {
      console.error('Failed to remove workout:', error)
      alert('Failed to remove workout. Please try again.')
    }
  }

  return (
    <Card className="border-2 hover:border-primary transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-sm">
              {trackWorkout.trackOrder}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-mono tracking-tight mb-1">
                <Link
                  to="/workouts/$workoutId"
                  params={{workoutId: trackWorkout.workout.id}}
                  className="hover:text-primary transition-colors"
                >
                  {trackWorkout.workout.name}
                </Link>
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Badge variant="secondary" className="font-mono text-xs">
                  {trackWorkout.workout.scheme}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={handleRemove}
            variant="outline"
            size="icon"
            className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {trackWorkout.notes && (
        <CardContent className="pt-0">
          <div className="bg-muted/50 rounded-md p-3 border">
            <p className="text-sm font-mono text-muted-foreground">
              {trackWorkout.notes}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
