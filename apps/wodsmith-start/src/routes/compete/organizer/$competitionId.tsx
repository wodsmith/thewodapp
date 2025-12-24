/**
 * Competition Organizer Layout Route
 *
 * Layout route for organizer competition detail pages with sidebar navigation.
 * Fetches competition data, verifies user permissions, and provides context to child routes.
 */

import {
  createFileRoute,
  Outlet,
  notFound,
  redirect,
} from '@tanstack/react-router'
import {getCompetitionByIdFn} from '@/server-fns/competition-detail-fns'
import {checkCanManageCompetitionFn} from '@/server-fns/competition-detail-fns'
import {CompetitionSidebar} from '@/components/competition-sidebar'

export const Route = createFileRoute('/compete/organizer/$competitionId')({
  component: CompetitionLayout,
  loader: async ({params, context}) => {
    const session = context.session

    // Require authentication
    if (!session?.user?.id) {
      throw redirect({
        to: '/sign-in',
        search: {redirect: `/compete/organizer/${params.competitionId}`},
      })
    }

    // Get competition by ID
    const {competition} = await getCompetitionByIdFn({
      data: {competitionId: params.competitionId},
    })

    if (!competition) {
      throw notFound()
    }

    // Verify user can manage this competition
    const {canManage} = await checkCanManageCompetitionFn({
      data: {
        organizingTeamId: competition.organizingTeamId,
        userId: session.user.id,
      },
    })

    if (!canManage) {
      throw redirect({
        to: '/compete',
        search: {},
      })
    }

    return {
      competition,
    }
  },
})

function CompetitionLayout() {
  const {competition} = Route.useLoaderData()

  return (
    <CompetitionSidebar competitionId={competition.id}>
      <Outlet />
    </CompetitionSidebar>
  )
}
