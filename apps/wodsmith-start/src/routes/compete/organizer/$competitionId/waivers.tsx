/**
 * Competition Waivers Route
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/waivers/page.tsx
 *
 * Allows organizers to manage waivers for their competition - create, edit, delete, reorder.
 * Uses the existing waiver-fns.ts server functions.
 * Uses parent route loader data for competition data (avoids duplicate fetch).
 */
// @lat: [[organizer-dashboard#Waivers]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"
import { WaiversPage } from "./-pages/waivers-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/waivers",
)({
  staleTime: 10_000,
  loader: async ({ params }) => {
    // Fetch waivers for this competition
    const { waivers } = await getCompetitionWaiversFn({
      data: { competitionId: params.competitionId },
    })

    return {
      waivers,
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { waivers } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()

  return (
    <WaiversPage
      competitionId={competition.id}
      teamId={competition.organizingTeamId}
      waivers={waivers}
    />
  )
}
