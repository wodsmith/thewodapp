import {createFileRoute} from '@tanstack/react-router'
import {
  getCompetitionByIdFn,
  getCompetitionRegistrationsFn,
} from '@/server-fns/competition-detail-fns'
import {DeleteCompetitionForm} from './-components/delete-competition-form'

export const Route = createFileRoute(
  '/compete/organizer/$competitionId/danger-zone',
)({
  loader: async ({params}) => {
    const [competitionResult, registrationsResult] = await Promise.all([
      getCompetitionByIdFn({data: {competitionId: params.competitionId}}),
      getCompetitionRegistrationsFn({
        data: {competitionId: params.competitionId},
      }),
    ])

    if (!competitionResult.competition) {
      throw new Error('Competition not found')
    }

    return {
      competition: competitionResult.competition,
      registrationCount: registrationsResult.registrations.length,
    }
  },
  component: DangerZonePage,
  head: ({loaderData}) => {
    const competition = loaderData?.competition
    if (!competition) {
      return {
        meta: [{title: 'Competition Not Found'}],
      }
    }
    return {
      meta: [
        {title: `Danger Zone - ${competition.name}`},
        {
          name: 'description',
          content: `Dangerous actions for ${competition.name}`,
        },
      ],
    }
  },
})

function DangerZonePage() {
  const {competition, registrationCount} = Route.useLoaderData()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
        <p className="text-muted-foreground mt-1">
          Irreversible actions that affect this competition
        </p>
      </div>

      <DeleteCompetitionForm
        competitionId={competition.id}
        competitionName={competition.name}
        organizingTeamId={competition.organizingTeamId}
        registrationCount={registrationCount}
      />
    </div>
  )
}
