/**
 * Submission Windows Page
 *
 * Shared page body for the organizer and cohost submission-windows routes
 * (online competitions only). The organizer route renders it with defaults;
 * the cohost route injects a cohost-permissioned upsert override.
 */

import type { ComponentProps } from "react"
import { SubmissionWindowsManager } from "@/components/compete/submission-windows-manager"
import type { CohostCompetitionWorkout } from "@/server-fns/cohost/cohost-workout-fns"
import type { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

type SubmissionWindowsManagerProps = ComponentProps<
  typeof SubmissionWindowsManager
>

type OrganizerWorkouts = Awaited<
  ReturnType<typeof getCompetitionWorkoutsFn>
>["workouts"]

interface SubmissionWindowsPageProps {
  competitionId: string
  /** Organizing team for organizers, competition team for cohosts. */
  teamId: string
  workouts: OrganizerWorkouts | CohostCompetitionWorkout[]
  initialEvents: SubmissionWindowsManagerProps["initialEvents"]
  timezone?: string | null
  /** Cohost routes inject a cohost-permissioned upsert mutation. */
  overrides?: SubmissionWindowsManagerProps["overrides"]
}

export function SubmissionWindowsPage({
  competitionId,
  teamId,
  workouts,
  initialEvents,
  timezone,
  overrides,
}: SubmissionWindowsPageProps) {
  // Map workouts to format expected by SubmissionWindowsManager
  const workoutsWithType = workouts.map((event: any) => ({
    id: event.id,
    workoutId: event.workoutId,
    name: event.workout?.name || `Event #${event.trackOrder}`,
    workoutType: event.workout?.scheme || "for-time",
    trackOrder: event.trackOrder,
    parentEventId: event.parentEventId ?? null,
  }))

  return (
    <SubmissionWindowsManager
      competitionId={competitionId}
      teamId={teamId}
      workouts={workoutsWithType}
      initialEvents={initialEvents}
      timezone={timezone || "America/Denver"}
      overrides={overrides}
    />
  )
}
