/**
 * Admin Team Scheduling Route
 *
 * Displays the scheduling calendar for a team.
 * Shows all scheduled workouts in a FullCalendar view.
 */

import {createFileRoute} from '@tanstack/react-router'
import {TeamSchedulingCalendar} from '@/components/admin/team-scheduling-calendar'

export const Route = createFileRoute('/admin/teams/$teamId/scheduling')({
  component: TeamSchedulingPage,
})

function TeamSchedulingPage() {
  const {teamId} = Route.useParams()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scheduling</h2>
        <p className="text-muted-foreground">
          View and manage scheduled workouts for this team.
        </p>
      </div>

      <TeamSchedulingCalendar teamId={teamId} />
    </div>
  )
}
