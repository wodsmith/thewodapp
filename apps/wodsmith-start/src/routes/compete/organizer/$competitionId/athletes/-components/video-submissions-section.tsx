import { Card, CardContent } from "@/components/ui/card"
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

  return (
    <div className="space-y-4">
      {events.map((event) => (
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
          scores={scores.filter(
            (s) => s.trackWorkoutId === event.trackWorkoutId,
          )}
          teamSize={teamSize}
          captainUserId={captainUserId}
          formatDateTime={formatDateTime}
        />
      ))}
    </div>
  )
}
