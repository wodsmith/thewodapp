import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EventSubmissionCard } from "./event-submission-card"
import type {
  AthleteDetailEvent,
  AthleteDetailScore,
  AthleteDetailVideoSubmission,
} from "./types"

interface VideoSubmissionsSectionProps {
  registrationId: string
  competitionId: string
  organizingTeamId: string
  divisionId: string | null
  events: AthleteDetailEvent[]
  videoSubmissions: AthleteDetailVideoSubmission[]
  scores: AthleteDetailScore[]
  teamSize: number
  captainUserId: string
  formatDateTime: (d: Date | string | null | undefined) => string
}

export function VideoSubmissionsSection({
  registrationId,
  competitionId,
  organizingTeamId,
  divisionId,
  events,
  videoSubmissions,
  scores,
  teamSize,
  captainUserId,
  formatDateTime,
}: VideoSubmissionsSectionProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No events configured for this competition yet.
        </CardContent>
      </Card>
    )
  }

  const topLevel = events.filter((e) => e.parentTrackWorkoutId === null)
  const childrenByParent = new Map<string, AthleteDetailEvent[]>()
  for (const e of events) {
    if (e.parentTrackWorkoutId === null) continue
    const list = childrenByParent.get(e.parentTrackWorkoutId) ?? []
    list.push(e)
    childrenByParent.set(e.parentTrackWorkoutId, list)
  }

  const renderLeaf = (event: AthleteDetailEvent) => (
    <EventSubmissionCard
      key={event.id}
      event={event}
      registrationId={registrationId}
      competitionId={competitionId}
      organizingTeamId={organizingTeamId}
      divisionId={divisionId}
      submissions={videoSubmissions.filter(
        (s) => s.trackWorkoutId === event.trackWorkoutId,
      )}
      scores={scores.filter((s) => s.trackWorkoutId === event.trackWorkoutId)}
      teamSize={teamSize}
      captainUserId={captainUserId}
      formatDateTime={formatDateTime}
    />
  )

  return (
    <div className="space-y-4">
      {topLevel.map((event) => {
        const children = childrenByParent.get(event.trackWorkoutId) ?? []
        if (children.length === 0) return renderLeaf(event)

        // Parent with sub-events: parent has no submissions of its own.
        // Render a wrapper card with header, and each child as a nested card.
        return (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle className="truncate">{event.workoutName}</CardTitle>
              <CardDescription className="text-xs">
                Scored per sub-event below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {children.map((child) => renderLeaf(child))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
