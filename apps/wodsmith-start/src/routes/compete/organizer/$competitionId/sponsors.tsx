/**
 * Competition Sponsors Route
 *
 * Organizer page for managing competition sponsors.
 * Fetches sponsors and groups, passes to SponsorManager component.
 * Uses parent route loader data for competition data.
 */

import {createFileRoute, getRouteApi} from '@tanstack/react-router'
import {getCompetitionSponsorsFn} from '@/server-fns/sponsor-fns'
import {SponsorManager} from '@/components/sponsors/sponsor-manager'

// Get parent route API to access its loader data
const parentRoute = getRouteApi('/compete/organizer/$competitionId')

export const Route = createFileRoute(
  '/compete/organizer/$competitionId/sponsors',
)({
  component: SponsorsPage,
  loader: async ({params}) => {
    // Fetch sponsors with groups
    const {groups, ungroupedSponsors} = await getCompetitionSponsorsFn({
      data: {competitionId: params.competitionId},
    })

    return {
      groups,
      ungroupedSponsors,
    }
  },
})

function SponsorsPage() {
  const {groups, ungroupedSponsors} = Route.useLoaderData()
  // Get competition from parent layout loader data
  const {competition} = parentRoute.useLoaderData()

  return (
    <SponsorManager
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      groups={groups}
      ungroupedSponsors={ungroupedSponsors}
    />
  )
}
