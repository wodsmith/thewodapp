"use client"

import { Clock } from "lucide-react"
import { useMemo } from "react"
import type {
  CrewJudgeHeat,
  CrewJudgeWorkout,
} from "@/server-fns/crew-judge-rotations-fns"
import type { JudgeGridCell } from "./judge-grid-utils"

interface JudgeOverviewProps {
  workouts: CrewJudgeWorkout[]
  heats: CrewJudgeHeat[]
  /** Planned judge-grid cells across all workouts (one per heat + lane). */
  gridCells: JudgeGridCell[]
}

interface EventSummary {
  workout: CrewJudgeWorkout
  heatCount: number
  assignedJudges: number
  totalRequiredJudges: number // Based on lane count
  startTime: Date | null
  endTime: Date | null
}

interface DayGroup {
  dateKey: string
  label: string
  summaries: EventSummary[]
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return new Date(value.getTime())
  return new Date(value)
}

/**
 * Shows judge assignment progress per workout.
 * Displays how many judges are assigned vs how many are needed based on lane count.
 */
export function JudgeOverview({
  workouts,
  heats,
  gridCells,
}: JudgeOverviewProps) {
  // Count planned judge cells per workout (a cell occupies one heat + lane).
  // The grid only edits one workout at a time, so a cell's heat number maps to
  // that workout's heats. Heat numbers can repeat across workouts, so attribute
  // each cell to every workout that has a heat with that number — in practice
  // the active workout's heat numbers are the ones present.
  const cellCountByWorkout = useMemo(() => {
    const heatNumbersByWorkout = new Map<string, Set<number>>()
    for (const heat of heats) {
      const set = heatNumbersByWorkout.get(heat.trackWorkoutId) ?? new Set()
      set.add(heat.heatNumber)
      heatNumbersByWorkout.set(heat.trackWorkoutId, set)
    }
    const counts = new Map<string, number>()
    for (const workout of workouts) {
      const heatNumbers = heatNumbersByWorkout.get(workout.id) ?? new Set()
      const count = gridCells.filter((cell) =>
        heatNumbers.has(cell.heatNumber),
      ).length
      counts.set(workout.id, count)
    }
    return counts
  }, [workouts, heats, gridCells])

  const dayGroups = useMemo<DayGroup[]>(() => {
    const summaries: EventSummary[] = workouts
      .map((workout) => {
        const workoutHeats = heats.filter(
          (h) => h.trackWorkoutId === workout.id && h.scheduledTime,
        )

        const assignedJudges = cellCountByWorkout.get(workout.id) ?? 0

        // Calculate total required judges (one per lane per heat). Lane count
        // comes from each heat's location/venue, never from athletes.
        const totalRequiredJudges = heats
          .filter((h) => h.trackWorkoutId === workout.id)
          .reduce((sum, heat) => sum + heat.laneCount, 0)

        if (workoutHeats.length === 0) {
          return {
            workout,
            heatCount: heats.filter((h) => h.trackWorkoutId === workout.id)
              .length,
            assignedJudges,
            totalRequiredJudges,
            startTime: null,
            endTime: null,
          }
        }

        // Sort by scheduled time
        const sortedHeats = workoutHeats.sort((a, b) => {
          const aTime = a.scheduledTime ? toDate(a.scheduledTime).getTime() : 0
          const bTime = b.scheduledTime ? toDate(b.scheduledTime).getTime() : 0
          return aTime - bTime
        })

        const firstHeat = sortedHeats[0]
        const lastHeat = sortedHeats[sortedHeats.length - 1]

        if (!firstHeat?.scheduledTime || !lastHeat?.scheduledTime) {
          return {
            workout,
            heatCount: workoutHeats.length,
            assignedJudges,
            totalRequiredJudges,
            startTime: null,
            endTime: null,
          }
        }

        const startTime = toDate(firstHeat.scheduledTime)

        // End time = last heat start + duration (default 15 min if not set)
        const lastHeatDuration = lastHeat.durationMinutes ?? 15
        const endTime = toDate(lastHeat.scheduledTime)
        endTime.setMinutes(endTime.getMinutes() + lastHeatDuration)

        return {
          workout,
          heatCount: heats.filter((h) => h.trackWorkoutId === workout.id)
            .length,
          assignedJudges,
          totalRequiredJudges,
          startTime,
          endTime,
        }
      })
      .sort((a, b) => {
        // Sort by start time first, then by track order
        if (a.startTime && b.startTime) {
          const timeDiff = a.startTime.getTime() - b.startTime.getTime()
          if (timeDiff !== 0) return timeDiff
        }
        // Unscheduled events go last
        if (a.startTime && !b.startTime) return -1
        if (!a.startTime && b.startTime) return 1
        return a.workout.trackOrder - b.workout.trackOrder
      })

    // Group by day
    const groups = new Map<string, DayGroup>()

    for (const summary of summaries) {
      const dateKey = summary.startTime
        ? getDateKey(summary.startTime)
        : "unscheduled"
      const label = summary.startTime
        ? formatDayLabel(summary.startTime)
        : "Unscheduled"

      const existing = groups.get(dateKey)
      if (existing) {
        existing.summaries.push(summary)
      } else {
        groups.set(dateKey, { dateKey, label, summaries: [summary] })
      }
    }

    return Array.from(groups.values())
  }, [workouts, heats, cellCountByWorkout])

  if (workouts.length === 0) return null

  const hasScheduledHeats = dayGroups.some(
    (g) => g.dateKey !== "unscheduled" && g.summaries.length > 0,
  )
  if (!hasScheduledHeats) return null

  return (
    <div className="mb-6 rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Judge Assignment Overview</h3>
      </div>
      <div className="space-y-4">
        {dayGroups.map((group) => (
          <div key={group.dateKey}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h4>
            <div className="space-y-1.5">
              {group.summaries.map((summary) => {
                const isFullyStaffed =
                  summary.assignedJudges >= summary.totalRequiredJudges
                const progressPercent =
                  summary.totalRequiredJudges > 0
                    ? Math.round(
                        (summary.assignedJudges / summary.totalRequiredJudges) *
                          100,
                      )
                    : 0

                return (
                  <div
                    key={summary.workout.id}
                    className="flex items-center gap-3 text-sm tabular-nums"
                  >
                    <span className="w-6 text-right text-muted-foreground">
                      {summary.workout.trackOrder}
                    </span>
                    <span className="flex-1 truncate font-sans">
                      {summary.workout.workout.name}
                    </span>
                    {summary.startTime && summary.endTime ? (
                      <>
                        <span className="text-muted-foreground">
                          {formatTime(summary.startTime)}-
                          {formatTime(summary.endTime)}
                        </span>
                        <span
                          className={`w-24 text-right ${
                            isFullyStaffed
                              ? "font-medium text-green-600"
                              : "text-orange-600"
                          }`}
                        >
                          {summary.assignedJudges}/{summary.totalRequiredJudges}{" "}
                          judges
                        </span>
                        <span className="w-12 text-right text-xs text-muted-foreground">
                          {progressPercent}%
                        </span>
                      </>
                    ) : (
                      <span className="italic text-muted-foreground">
                        {summary.heatCount > 0
                          ? `${summary.heatCount} heat${summary.heatCount !== 1 ? "s" : ""} - ${summary.assignedJudges}/${summary.totalRequiredJudges} judges`
                          : "No heats"}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
