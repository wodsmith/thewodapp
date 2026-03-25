/**
 * Competition Cohost Waivers Route
 *
 * Cohost page for managing competition waivers.
 * Mirrors the organizer waivers page but uses cohost server functions.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { cohostGetCompetitionWaiversFn } from "@/server-fns/cohost/cohost-waiver-fns"
import { WaiverList } from "../../organizer/$competitionId/-components/waiver-list"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/waivers",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Fetch waivers for this competition
    const waiversResult = await cohostGetCompetitionWaiversFn({
      data: { competitionId: params.competitionId, competitionTeamId },
    }).catch(() => ({ waivers: [] }))

    return {
      waivers: waiversResult.waivers,
    }
  },
  component: CohostWaiversPage,
})

function CohostWaiversPage() {
  const { waivers } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()

  return (
    <WaiverList
      competitionId={competition.id}
      teamId={competition.competitionTeamId!}
      waivers={waivers}
    />
  )
}
