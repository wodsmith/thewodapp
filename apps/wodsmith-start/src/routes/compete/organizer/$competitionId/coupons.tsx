/**
 * Competition Coupons Route
 *
 * Allows organizers to create and manage discount coupons for their competition.
 * Requires PRODUCT_COUPONS entitlement.
 */
// @lat: [[organizer-dashboard#Coupons]]

import { createFileRoute } from "@tanstack/react-router"
import { getAppUrlFn } from "@/lib/env"
import { listCouponsFn } from "@/server-fns/coupon-fns"
import { CouponsPage } from "./-pages/coupons-page"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/coupons",
)({
  component: RouteComponent,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const [appUrl, coupons] = await Promise.all([
      getAppUrlFn(),
      listCouponsFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
    ])

    return { competition, coupons, appUrl }
  },
})

function RouteComponent() {
  const { competition, coupons, appUrl } = Route.useLoaderData()

  return (
    <CouponsPage
      teamId={competition.organizingTeamId}
      competition={competition}
      coupons={coupons}
      appUrl={appUrl}
    />
  )
}
