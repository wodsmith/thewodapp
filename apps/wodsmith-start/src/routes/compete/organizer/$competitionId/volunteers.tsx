import {createFileRoute} from '@tanstack/react-router'
import {getCompetitionByIdFn} from '@/server-fns/competition-detail-fns'
import {getCompetitionWorkoutsFn} from '@/server-fns/competition-workouts-fns'
import {
  canInputScoresFn,
  getCompetitionVolunteersFn,
  getDirectVolunteerInvitesFn,
  getPendingVolunteerInvitationsFn,
} from '@/server-fns/volunteer-fns'
import {InvitedVolunteersList} from './-components/invited-volunteers-list'
import {JudgeSchedulingContainer} from './-components/judge-scheduling-container'
import {VolunteersList} from './-components/volunteers-list'

export const Route = createFileRoute(
  '/compete/organizer/$competitionId/volunteers',
)({
  loader: async ({params}) => {
    const result = await getCompetitionByIdFn({
      data: {competitionId: params.competitionId},
    })

    if (!result.competition) {
      throw new Error('Competition not found')
    }

    const competition = result.competition

    if (!competition.competitionTeamId) {
      throw new Error('Competition team not found')
    }

    // Parallel fetch: invitations, volunteers, events, direct invites
    const [invitations, volunteers, eventsResult, directInvites] =
      await Promise.all([
        getPendingVolunteerInvitationsFn({
          data: {competitionTeamId: competition.competitionTeamId},
        }),
        getCompetitionVolunteersFn({
          data: {competitionTeamId: competition.competitionTeamId},
        }),
        getCompetitionWorkoutsFn({
          data: {
            competitionId: competition.id,
            teamId: competition.organizingTeamId,
          },
        }),
        getDirectVolunteerInvitesFn({
          data: {competitionTeamId: competition.competitionTeamId},
        }),
      ])

    const events = eventsResult.workouts

    // For each volunteer, check if they have score access
    const volunteersWithAccess = await Promise.all(
      volunteers.map(async (volunteer) => {
        const hasScoreAccess = volunteer.user
          ? await canInputScoresFn({
              data: {
                userId: volunteer.user.id,
                competitionTeamId: competition.competitionTeamId!,
              },
            })
          : false

        return {
          ...volunteer,
          hasScoreAccess,
        }
      }),
    )

    // Filter pending direct invites for conditional rendering
    const pendingDirectInvites = directInvites.filter(
      (i) => i.status === 'pending',
    )

    return {
      competition,
      invitations,
      volunteersWithAccess,
      events,
      directInvites,
      pendingDirectInvites,
    }
  },
  component: VolunteersPage,
})

function VolunteersPage() {
  const {
    competition,
    invitations,
    volunteersWithAccess,
    events,
    directInvites,
    pendingDirectInvites,
  } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-8">
      {/* Invited Volunteers Section - Only show if there are pending direct invites */}
      {pendingDirectInvites.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Invited Volunteers</h2>
            <p className="text-sm text-muted-foreground">
              {pendingDirectInvites.length} pending{' '}
              {pendingDirectInvites.length === 1 ? 'invite' : 'invites'}
            </p>
          </div>
          <InvitedVolunteersList invites={directInvites} />
        </section>
      )}

      {/* Volunteers Section */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Volunteers</h2>
          <p className="text-sm text-muted-foreground">
            {invitations.length + volunteersWithAccess.length} total (
            {invitations.length} application
            {invitations.length === 1 ? '' : 's'}, {volunteersWithAccess.length}{' '}
            approved)
          </p>
        </div>

        <VolunteersList
          competitionId={competition.id}
          competitionSlug={competition.slug}
          competitionTeamId={competition.competitionTeamId!}
          organizingTeamId={competition.organizingTeamId}
          invitations={invitations}
          volunteers={volunteersWithAccess}
        />
      </section>

      {/* Judging Schedule Section - Placeholder for now */}
      <JudgeSchedulingContainer
        competitionId={competition.id}
        organizingTeamId={competition.organizingTeamId}
        events={events}
        heats={[]}
        judges={[]}
        judgeAssignments={[]}
        rotations={[]}
        eventDefaultsMap={new Map()}
        versionHistoryMap={new Map()}
        activeVersionMap={new Map()}
        competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
        competitionDefaultPattern={
          (competition.defaultLaneShiftPattern as 'stay' | 'shift_right') ??
          'shift_right'
        }
      />
    </div>
  )
}
