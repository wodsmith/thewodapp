/**
 * Cohost Competition Revenue Route
 *
 * Revenue statistics display for cohosts.
 * Gated by revenue permission.
 * Renders the shared organizer RevenuePage with the payout setup link hidden
 * so the page stays in sync with the organizer route.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import {
  getCompetitionRevenueStatsFn,
  getOrganizerStripeStatusFn,
} from "@/server-fns/commerce-fns"
import { RevenuePage } from "../../organizer/$competitionId/-pages/revenue-page"

export const Route = createFileRoute("/compete/cohost/$competitionId/revenue")({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition, permissions } = parentMatch.loaderData!

    // Permission gate: revenue
    if (!permissions?.revenue) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    // Parallel fetch: revenue stats and stripe status
    const [revenueResult, stripeResult] = await Promise.all([
      getCompetitionRevenueStatsFn({
        data: { competitionId: competition.id },
      }).catch(() => ({
        stats: {
          totalGrossCents: 0,
          totalPlatformFeeCents: 0,
          totalStripeFeeCents: 0,
          totalOrganizerNetCents: 0,
          totalRefundedCents: 0,
          purchaseCount: 0,
          byDivision: [],
        },
      })),
      getOrganizerStripeStatusFn({
        data: { organizingTeamId: competition.organizingTeamId },
      }).catch(() => ({ stripeStatus: null })),
    ])

    return {
      competition,
      stats: revenueResult.stats,
      stripeStatus: stripeResult.stripeStatus,
    }
  },
  component: RouteComponent,
  head: ({ loaderData }) => {
    const competition = loaderData?.competition
    if (!competition) {
      return { meta: [{ title: "Competition Not Found" }] }
    }
    return {
      meta: [
        { title: `Revenue - ${competition.name}` },
        {
          name: "description",
          content: `Revenue statistics for ${competition.name}`,
        },
      ],
    }
  },
})

function RouteComponent() {
  const { stats, stripeStatus } = Route.useLoaderData()

  return (
    <RevenuePage
      stats={stats}
      stripeStatus={stripeStatus ?? undefined}
      hidePayoutSetupLink
    />
  )
}
