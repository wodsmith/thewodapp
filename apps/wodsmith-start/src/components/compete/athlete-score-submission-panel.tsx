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
  secondaryValue: number | null
  verificationStatus: string | null
  canSubmit: boolean
  windowStatus: "open" | "not_yet_open" | "closed" | "no_window"
}

interface EventDivisionMappings {
  mappings: Array<{ trackWorkoutId: string; divisionId: string }>
  hasMappings: boolean
}

interface AthleteScoreSubmissionPanelProps {
  competitionId: string
  slug: string
  userDivisions: UserDivision[]
  workouts: WorkoutInfo[]
  eventDivisionMappings: EventDivisionMappings
}

export function AthleteScoreSubmissionPanel({
  competitionId,
  slug,
  userDivisions,
  workouts,
  eventDivisionMappings,
}: AthleteScoreSubmissionPanelProps) {
  const [selectedDivisionIdx, setSelectedDivisionIdx] = useState(0)
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const selectedUserDiv = userDivisions[selectedDivisionIdx]
  const registration = selectedUserDiv?.registration
  const division = selectedUserDiv?.division

  // Build parent -> children map (unfiltered)
  const rawChildEventsMap = useMemo(() => {
    const map = new Map<string, WorkoutInfo[]>()
    for (const w of workouts) {
      if (w.parentEventId) {
        const children = map.get(w.parentEventId) ?? []
        children.push(w)
        map.set(w.parentEventId, children)
      }
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.trackOrder - b.trackOrder)
    }
    return map
  }, [workouts])

  // Division mapping sets for filtering both parents and children
  const { eventsWithMappings, mappedToSelectedDiv } = useMemo(() => {
    if (!eventDivisionMappings.hasMappings || !division?.id) {
      return { eventsWithMappings: new Set<string>(), mappedToSelectedDiv: new Set<string>() }
    }
    return {
      eventsWithMappings: new Set(
        eventDivisionMappings.mappings.map((m) => m.trackWorkoutId),
      ),
      mappedToSelectedDiv: new Set(
        eventDivisionMappings.mappings
          .filter((m) => m.divisionId === division.id)
          .map((m) => m.trackWorkoutId),
      ),
    }
  }, [eventDivisionMappings, division?.id])

  // Filter parents and children by division mappings.
  // Children with explicit mappings can survive even if the parent is mapped out.
  const { filteredParents, filteredChildEventsMap } = useMemo(() => {
    const isVisible = (id: string) =>
      eventsWithMappings.size === 0 || !eventsWithMappings.has(id) || mappedToSelectedDiv.has(id)

    const parents = workouts.filter((w) => !w.parentEventId)
    const childMap = new Map<string, WorkoutInfo[]>()
    const visibleParents: WorkoutInfo[] = []

    for (const parent of parents) {
      const children = rawChildEventsMap.get(parent.id)

      if (!children || children.length === 0) {
        // Leaf parent — filter by its own mapping
        if (isVisible(parent.id)) visibleParents.push(parent)
        continue
      }

      // Filter children first — children with explicit mappings survive
      // even if parent is mapped out
      const visibleChildren = children.filter((c) => isVisible(c.id))
      if (visibleChildren.length > 0) {
        visibleParents.push(parent)
        childMap.set(parent.id, visibleChildren)
      }
    }

    return { filteredParents: visibleParents, filteredChildEventsMap: childMap }
  }, [workouts, rawChildEventsMap, eventsWithMappings, mappedToSelectedDiv])

  // Collect all IDs we need submissions for: parents without children + visible children
  const trackWorkoutIds = useMemo(() => {
    const ids: string[] = []
    for (const parent of filteredParents) {
      const children = filteredChildEventsMap.get(parent.id)
      if (children && children.length > 0) {
        ids.push(...children.map((c) => c.id))
      } else {
        ids.push(parent.id)
      }
    }
    return ids
  }, [filteredParents, filteredChildEventsMap])

  useEffect(() => {
    if (!registration?.id || !division?.id || trackWorkoutIds.length === 0) {
      setSubmissions([])
      setFetchError(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setFetchError(false)

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
        if (!cancelled) setFetchError(true)
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

  const totalSubmittable = trackWorkoutIds.length
  const submittedCount = submissions.filter(
    (s) => s.hasScore || s.hasVideo,
  ).length

  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/5">
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

        {!loading && !fetchError && totalSubmittable > 0 && (
          <p className="text-xs text-muted-foreground">
            {submittedCount} of {totalSubmittable} workout score
            {totalSubmittable !== 1 ? "s" : ""} submitted
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <p className="text-sm text-destructive py-4 text-center">
            Failed to load submissions. Please try refreshing.
          </p>
        ) : (
          filteredParents.map((event, idx) => {
            const position = idx + 1
            const children = filteredChildEventsMap.get(event.id)

            if (children && children.length > 0) {
              return (
                <div key={event.id} className="space-y-1">
                  {/* Parent group label */}
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <NumberBadge value={String(position).padStart(2, "0")} />
                    <span className="text-sm font-semibold truncate">
                      {event.workout.name}
                    </span>
                  </div>
                  {/* Sub-event rows with left accent */}
                  <div className="ml-[22px] border-l-2 border-border/40 pl-0 space-y-1">
                    {children.map((child, childIdx) => {
                      const sub = submissionMap.get(child.id)
                      const letter = String.fromCharCode(65 + childIdx)
                      return (
                        <WorkoutRow
                          key={child.id}
                          event={child}
                          submission={sub ?? null}
                          slug={slug}
                          divisionId={division?.id}
                          parentEventId={event.id}
                          badge={letter}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            }

            const sub = submissionMap.get(event.id)
            return (
              <WorkoutRow
                key={event.id}
                event={event}
                submission={sub ?? null}
                slug={slug}
                divisionId={division?.id}
                badge={String(position).padStart(2, "0")}
              />
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function NumberBadge({ value }: { value: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums">
      {value}
    </div>
  )
}

function StatusLine({ submission, canSubmit, windowStatus }: {
  submission: WorkoutSubmission | null
  canSubmit: boolean
  windowStatus: WorkoutSubmission["windowStatus"]
}) {
  const hasSubmitted = submission?.hasScore || submission?.hasVideo

  if (hasSubmitted && submission) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {submission.displayScore && (
          <span className="text-xs font-medium text-foreground">
            {submission.displayScore}
            {submission.scoreStatus === "cap" && " (Cap)"}
            {submission.scoreStatus === "cap" &&
              submission.secondaryValue !== null &&
              ` — ${submission.secondaryValue} reps`}
          </span>
        )}

        {submission.hasVideo && submission.videoReviewStatus && (
          <SubmissionStatusBadge
            status={submission.videoReviewStatus}
            size="sm"
            showTooltip={false}
          />
        )}

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
    )
  }

  if (canSubmit) {
    return (
      <span className="text-xs text-primary font-medium">Ready to submit</span>
    )
  }

  if (windowStatus === "not_yet_open") {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Not yet open
      </span>
    )
  }

  return (
    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
      <Lock className="h-3 w-3" />
      Submission closed
    </span>
  )
}

function ActionIndicator({ submission, canSubmit, windowStatus }: {
  submission: WorkoutSubmission | null
  canSubmit: boolean
  windowStatus: WorkoutSubmission["windowStatus"]
}) {
  const hasSubmitted = submission?.hasScore || submission?.hasVideo

  if (hasSubmitted && canSubmit) {
    return (
      <Badge variant="outline" className="text-xs">
        Edit
      </Badge>
    )
  }
  if (hasSubmitted && !canSubmit) {
    return <Eye className="h-4 w-4 text-muted-foreground" />
  }
  if (canSubmit) {
    return (
      <span className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
        Submit
      </span>
    )
  }
  if (windowStatus === "not_yet_open") {
    return <Clock className="h-4 w-4 text-muted-foreground" />
  }
  return <Lock className="h-4 w-4 text-muted-foreground" />
}

function WorkoutRow({
  event,
  submission,
  slug,
  divisionId,
  parentEventId,
  badge,
}: {
  event: WorkoutInfo
  submission: WorkoutSubmission | null
  slug: string
  divisionId?: string
  parentEventId?: string
  badge: string
}) {
  const linkEventId = parentEventId ?? event.id
  const hasSubmitted = submission?.hasScore || submission?.hasVideo
  const canSubmit = submission?.canSubmit ?? false
  const windowStatus = submission?.windowStatus ?? "no_window"
  const isInteractive = canSubmit || hasSubmitted

  const rowContent = (
    <>
      <NumberBadge value={badge} />

      {/* Two-line content: name + status — always same structure */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`truncate text-sm font-medium leading-tight ${!isInteractive ? "text-muted-foreground" : ""}`}>
          {event.workout.name}
        </p>
        <StatusLine
          submission={submission}
          canSubmit={canSubmit}
          windowStatus={windowStatus}
        />
      </div>

      <div className="shrink-0">
        <ActionIndicator
          submission={submission}
          canSubmit={canSubmit}
          windowStatus={windowStatus}
        />
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
      params={{ slug, eventId: linkEventId }}
      search={divisionId ? { division: divisionId } : {}}
      className="group flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
    >
      {rowContent}
    </Link>
  )
}
