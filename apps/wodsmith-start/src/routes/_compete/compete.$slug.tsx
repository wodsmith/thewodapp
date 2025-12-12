import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { notFound } from '@tanstack/react-router'
import { EventDetailsContent } from '~/components/compete/event-details-content'
import { ScheduleContent } from '~/components/compete/schedule-content'
import { ScheduleSkeleton } from '~/components/compete/schedule-skeleton'
import { WorkoutsContent } from '~/components/compete/workouts-content'
import { WorkoutsSkeleton } from '~/components/compete/workouts-skeleton'
import { getCompetitionFn } from '~/server-functions/competitions'
import { getSessionFromCookie } from '~/utils/auth.server'

export const Route = createFileRoute('/_compete/compete/$slug')({
  loader: async ({ params }) => {
    const compResult = await getCompetitionFn({
      data: { idOrSlug: params.slug },
    })

    if (!compResult.success || !compResult.data) {
      throw notFound()
    }

    const competition = compResult.data
    const session = await getSessionFromCookie()

    return {
      competition,
      userId: session?.userId,
    }
  },
  component: CompetitionDetailComponent,
})

function CompetitionDetailComponent() {
  const { competition, userId } = Route.useLoaderData()

  return (
    <EventDetailsContent
      competition={competition}
      workoutsContent={
        <Suspense fallback={<WorkoutsSkeleton />}>
          <WorkoutsContent competition={competition} />
        </Suspense>
      }
      scheduleContent={
        <Suspense fallback={<ScheduleSkeleton />}>
          <ScheduleContent
            competitionId={competition.id}
            currentUserId={userId}
          />
        </Suspense>
      }
    />
  )
}
