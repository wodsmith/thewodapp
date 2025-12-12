import { createFileRoute } from '@tanstack/react-router'
import { notFound } from '@tanstack/react-router'
import { SchedulePageContent } from '~/components/compete/schedule/schedule-page-content'
import { getCompetitionFn, getCompetitionWorkoutsFn } from '~/server-functions/competitions'
import { getHeatsForCompetitionFn } from '~/server-functions/heats'
import { getSessionFromCookie } from '~/utils/auth.server'

export const Route = createFileRoute('/_compete/compete/$slug/tabs/schedule')({
  loader: async ({ params }) => {
    const compResult = await getCompetitionFn({
      data: { idOrSlug: params.slug },
    })

    if (!compResult.success || !compResult.data) {
      throw notFound()
    }

    const competition = compResult.data
    const session = await getSessionFromCookie()
    
    const [eventResult, heatsResult] = await Promise.all([
      getCompetitionWorkoutsFn({
        data: { competitionId: competition.id },
      }),
      getHeatsForCompetitionFn({
        data: { competitionId: competition.id },
      }),
    ])

    return {
      competition,
      events: eventResult.success ? eventResult.data : [],
      heats: heatsResult.success ? heatsResult.data : [],
      userId: session?.userId,
    }
  },
  component: SchedulePageComponent,
})

function SchedulePageComponent() {
  const { events, heats, userId } = Route.useLoaderData()

  return (
    <SchedulePageContent
      events={events}
      heats={heats}
      currentUserId={userId}
    />
  )
}
