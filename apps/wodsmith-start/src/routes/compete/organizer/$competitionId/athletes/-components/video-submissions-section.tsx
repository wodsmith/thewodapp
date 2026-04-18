import { Card, CardContent } from "@/components/ui/card"
import { EventSubmissionCard } from "./event-submission-card"
import type {
  AthleteDetailEvent,
  AthleteDetailMember,
  AthleteDetailScore,
  AthleteDetailVideoSubmission,
} from "./types"

interface VideoSubmissionsSectionProps {
  registrationId: string
  competitionId: string
  events: AthleteDetailEvent[]
  videoSubmissions: AthleteDetailVideoSubmission[]
  scores: AthleteDetailScore[]
  members: AthleteDetailMember[]
  teamSize: number
  captainUserId: string
  formatDateTime: (d: Date | string | null | undefined) => string
}

export function VideoSubmissionsSection({
  registrationId,
  competitionId,
  events,
  videoSubmissions,
  scores,
  members,
  teamSize,
  captainUserId,
  formatDateTime,
}: VideoSubmissionsSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Video Submissions
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          One card per event. Add, edit or delete submissions, and enter first
          scores inline.
        </p>
      </div>
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events configured for this competition yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventSubmissionCard
              key={event.id}
              event={event}
              registrationId={registrationId}
              competitionId={competitionId}
              submissions={videoSubmissions.filter(
                (s) => s.trackWorkoutId === event.trackWorkoutId,
              )}
              scores={scores.filter(
                (s) => s.trackWorkoutId === event.trackWorkoutId,
              )}
              members={members}
              teamSize={teamSize}
              captainUserId={captainUserId}
              formatDateTime={formatDateTime}
            />
          ))}
        </div>
      )}
    </section>
  )
}
