"use client"

import type { TrackWorkoutWithDetails } from "@/server-fns/programming-fns"
import { TrackWorkoutRow } from "./track-workout-row"

interface TrackWorkoutListProps {
  canManage?: boolean
  trackWorkouts: TrackWorkoutWithDetails[]
  onWorkoutRemoved?: () => void
}

export function TrackWorkoutList({
  trackWorkouts,
  onWorkoutRemoved,
  canManage = false,
}: TrackWorkoutListProps) {
  // Sort workouts by track order
  const sortedWorkouts = [...trackWorkouts].sort(
    (a, b) => a.trackOrder - b.trackOrder,
  )
  const visibleIds = new Set(sortedWorkouts.map((workout) => workout.id))
  const childrenByParent = new Map<string, TrackWorkoutWithDetails[]>()
  for (const workout of sortedWorkouts) {
    if (!workout.parentEventId || !visibleIds.has(workout.parentEventId))
      continue
    const children = childrenByParent.get(workout.parentEventId) ?? []
    children.push(workout)
    childrenByParent.set(workout.parentEventId, children)
  }
  const topLevelWorkouts = sortedWorkouts.filter(
    (workout) =>
      !workout.parentEventId || !visibleIds.has(workout.parentEventId),
  )

  if (sortedWorkouts.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
        <p className="text-muted-foreground font-mono">
          No workouts in this track yet.
        </p>
        <p className="text-sm text-muted-foreground font-mono mt-2">
          Add workouts to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {topLevelWorkouts.map((trackWorkout) => {
        const children = childrenByParent.get(trackWorkout.id) ?? []
        return (
          <section
            key={trackWorkout.id}
            aria-label={
              children.length
                ? `${trackWorkout.workout.name} sub-events`
                : undefined
            }
            className="space-y-2"
          >
            <TrackWorkoutRow
              trackWorkout={trackWorkout}
              onRemoved={onWorkoutRemoved}
              canManage={canManage}
              childCount={children.length}
            />
            {children.length > 0 && (
              <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
                {children.map((child) => (
                  <TrackWorkoutRow
                    key={child.id}
                    trackWorkout={child}
                    onRemoved={onWorkoutRemoved}
                    canManage={canManage}
                    isSubEvent
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
