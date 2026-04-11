"use client"

import { Link } from "@tanstack/react-router"
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Lock,
  Loader2,
  Trophy,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import { SubmissionStatusBadge } from "./submission-status-badge"
import { getAthleteDivisionSubmissionsFn } from "@/server-fns/video-submission-fns"

interface Division {
  id: string
  label: string
}

interface Registration {
  id: string
  divisionId: string | null
}

interface UserDivision {
  registration: Registration
  division: Division | null
}

interface WorkoutInfo {
  id: string
  workoutId: string
  trackOrder: number
  parentEventId: string | null
  workout: {
    name: string
    scheme: string
  }
}

interface WorkoutSubmission {
  trackWorkoutId: string
  hasVideo: boolean
  videoReviewStatus: ReviewStatus | null
  hasScore: boolean
  displayScore: string | null
  scoreStatus: string | null
  verificationStatus: string | null
  canSubmit: boolean
  windowStatus: "open" | "not_yet_open" | "closed" | "no_window"
}

interface AthleteScoreSubmissionPanelProps {
  competitionId: string
  slug: string
  userDivisions: UserDivision[]
  workouts: WorkoutInfo[]
}

function formatTrackOrder(trackOrder: number | string): string {
  const n = Number(trackOrder)
  if (n % 1 === 0) return String(n).padStart(2, "0")
  const whole = Math.floor(n)
  const decimal = Math.round((n - whole) * 100)
  return `${whole}.${String(decimal).padStart(2, "0")}`
}

export function AthleteScoreSubmissionPanel({
  competitionId,
  slug,
  userDivisions,
  workouts,
}: AthleteScoreSubmissionPanelProps) {
  const [selectedDivisionIdx, setSelectedDivisionIdx] = useState(0)
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const selectedUserDiv = userDivisions[selectedDivisionIdx]
  const registration = selectedUserDiv?.registration
  const division = selectedUserDiv?.division

  // Only show parent-level (non-child) workouts
  const parentWorkouts = useMemo(
    () => workouts.filter((w) => !w.parentEventId),
    [workouts],
  )

  // Stable list of trackWorkout IDs for fetching
  const trackWorkoutIds = useMemo(
    () => parentWorkouts.map((w) => w.id),
    [parentWorkouts],
  )

  useEffect(() => {
    if (!registration?.id || !division?.id || trackWorkoutIds.length === 0) {
      setSubmissions([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    getAthleteDivisionSubmissionsFn({
      data: {
        competitionId,
        trackWorkoutIds,
        registrationId: registration.id,
        divisionId: division.id,
      },
    })
      .then((result) => {
        if (!cancelled) {
          setSubmissions(result.submissions)
        }
      })
      .catch(() => {
        if (!cancelled) setSubmissions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [competitionId, registration?.id, division?.id, trackWorkoutIds])

  const submissionMap = new Map(
    submissions.map((s) => [s.trackWorkoutId, s]),
  )

  const submittedCount = submissions.filter(
    (s) => s.hasScore || s.hasVideo,
  ).length

  return (
    <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Submit Your Scores</CardTitle>
        </div>

        {userDivisions.length > 1 && (
          <div className="mt-2">
            <Select
              value={String(selectedDivisionIdx)}
              onValueChange={(v) => setSelectedDivisionIdx(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {userDivisions.map((ud, idx) => (
                  <SelectItem key={ud.division?.id ?? idx} value={String(idx)}>
                    {ud.division?.label ?? "Unknown Division"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {userDivisions.length === 1 && division && (
          <p className="text-sm text-muted-foreground">
            Division: <span className="font-medium">{division.label}</span>
          </p>
        )}

        {!loading && parentWorkouts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {submittedCount} of {parentWorkouts.length} workout
            {parentWorkouts.length !== 1 ? "s" : ""} submitted
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          parentWorkouts.map((event) => {
            const sub = submissionMap.get(event.id)
            return (
              <WorkoutRow
                key={event.id}
                event={event}
                submission={sub ?? null}
                slug={slug}
                divisionId={division?.id}
              />
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function WorkoutRow({
  event,
  submission,
  slug,
  divisionId,
}: {
  event: WorkoutInfo
  submission: WorkoutSubmission | null
  slug: string
  divisionId?: string
}) {
  const hasSubmitted = submission?.hasScore || submission?.hasVideo
  const canSubmit = submission?.canSubmit ?? false
  const windowStatus = submission?.windowStatus ?? "no_window"

  // Row is interactive if there's something to submit/edit, or something to view
  const isInteractive = canSubmit || hasSubmitted

  const rowContent = (
    <>
      {/* Event number */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums">
        {formatTrackOrder(event.trackOrder)}
      </div>

      {/* Workout info */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${!isInteractive ? "text-muted-foreground" : ""}`}>
          {event.workout.name}
        </p>

        {hasSubmitted && submission ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {/* Score display */}
            {submission.displayScore && (
              <span className="text-xs font-medium text-foreground">
                {submission.displayScore}
                {submission.scoreStatus === "cap" && " (Cap)"}
              </span>
            )}

            {/* Video review status badge */}
            {submission.hasVideo && submission.videoReviewStatus && (
              <SubmissionStatusBadge
                status={submission.videoReviewStatus}
                size="sm"
                showTooltip={false}
              />
            )}

            {/* Score-only verification status (when no video) */}
            {!submission.hasVideo &&
              submission.hasScore &&
              submission.verificationStatus && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Score Submitted
                </Badge>
              )}

            {/* Submitted but no verification status yet */}
            {submission.hasScore &&
              !submission.hasVideo &&
              !submission.verificationStatus && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Submitted
                </Badge>
              )}
          </div>
        ) : (
          <div className="mt-1">
            {canSubmit ? (
              <span className="text-xs text-primary font-medium">
                Ready to submit
              </span>
            ) : windowStatus === "not_yet_open" ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Not yet open
              </span>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Submission closed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action indicator */}
      <div className="shrink-0">
        {hasSubmitted && canSubmit ? (
          <Badge variant="outline" className="text-xs">
            Edit
          </Badge>
        ) : hasSubmitted && !canSubmit ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : canSubmit ? (
          <Button size="sm" variant="default" className="h-7 text-xs pointer-events-none">
            Submit
          </Button>
        ) : windowStatus === "not_yet_open" ? (
          <Clock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isInteractive && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </>
  )

  if (!isInteractive) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-background p-3 opacity-60">
        {rowContent}
      </div>
    )
  }

  return (
    <Link
      to="/compete/$slug/workouts/$eventId"
      params={{ slug, eventId: event.id }}
      search={divisionId ? { division: divisionId } : {}}
      className="group flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
    >
      {rowContent}
    </Link>
  )
}
