import { Card, CardContent } from "@/components/ui/card"
import { EventScoreCard } from "./event-score-card"
import type {
  AthleteDetailEvent,
  AthleteDetailMember,
  AthleteDetailScore,
} from "./types"

interface ScoresSectionProps {
  registrationId: string
  competitionId: string
  organizingTeamId: string
  divisionId: string | null
  events: AthleteDetailEvent[]
  scores: AthleteDetailScore[]
  members: AthleteDetailMember[]
}

export function ScoresSection({
  registrationId,
  competitionId,
  organizingTeamId,
  divisionId,
  events,
  scores,
  members,
}: ScoresSectionProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No events configured yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventScoreCard
          key={event.id}
          event={event}
          registrationId={registrationId}
          competitionId={competitionId}
          organizingTeamId={organizingTeamId}
          divisionId={divisionId}
          scores={scores.filter(
            (s) => s.trackWorkoutId === event.trackWorkoutId,
          )}
          members={members}
        />
      ))}
    </div>
  )
}
