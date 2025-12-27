import {createFileRoute, getRouteApi} from '@tanstack/react-router'
import {getHeatsForCompetitionFn} from '@/server-fns/competition-heats-fns'
import {getPublishedCompetitionWorkoutsFn} from '@/server-fns/competition-workouts-fns'
import {getCompetitionBySlugFn} from '@/server-fns/competition-fns'
import {SchedulePageContent} from '@/components/schedule-page-content'

const parentRoute = getRouteApi('/compete/$slug')

export const Route = createFileRoute('/compete/$slug/schedule')({
  component: CompetitionSchedulePage,
  loader: async ({params}) => {
    // Fetch competition by slug to get the ID
    const {competition} = await getCompetitionBySlugFn({
      data: {slug: params.slug},
    })

    if (!competition) {
      return {heats: [], events: []}
    }

    // Fetch heats and events for this competition
    const [heatsResult, eventsResult] = await Promise.all([
      getHeatsForCompetitionFn({data: {competitionId: competition.id}}),
      getPublishedCompetitionWorkoutsFn({
        data: {competitionId: competition.id},
      }),
    ])

    return {
      heats: heatsResult.heats,
      events: eventsResult.workouts,
    }
  },
})

function CompetitionSchedulePage() {
  const {heats, events} = Route.useLoaderData()
  const {session} = parentRoute.useLoaderData()

  return (
    <SchedulePageContent
      events={events}
      heats={heats}
      currentUserId={session?.userId}
    />
  )
}
