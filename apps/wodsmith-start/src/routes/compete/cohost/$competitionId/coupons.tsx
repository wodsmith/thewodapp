/**
 * Cohost Competition Coupons Route
 *
 * Renders the shared organizer CouponsPage with cohost-permissioned coupon
 * overrides so the page stays in sync with the organizer route.
 * Gated by coupons permission. Uses cohost coupon server fns for auth.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { getAppUrlFn } from "@/lib/env"
import {
  cohostCreateCouponFn,
  cohostDeactivateCouponFn,
  cohostListCouponsFn,
} from "@/server-fns/cohost/cohost-coupon-fns"
import type { CouponsPageOverrides } from "../../organizer/$competitionId/-pages/coupons-page"
import { CouponsPage } from "../../organizer/$competitionId/-pages/coupons-page"

export const Route = createFileRoute("/compete/cohost/$competitionId/coupons")({
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition, permissions } = parentMatch.loaderData!

    // Permission gate: coupons
    if (!permissions?.coupons) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    const competitionTeamId = competition.competitionTeamId!

    const [appUrl, coupons] = await Promise.all([
      getAppUrlFn(),
      cohostListCouponsFn({
        data: {
          competitionId: competition.id,
          competitionTeamId,
        },
      }),
    ])

    return { competition, coupons, appUrl, competitionTeamId }
  },
})

function RouteComponent() {
  const { competition, coupons, appUrl, competitionTeamId } =
    Route.useLoaderData()

  const createCoupon = useServerFn(cohostCreateCouponFn)
  const deactivate = useServerFn(cohostDeactivateCouponFn)

  const overrides: CouponsPageOverrides = {
    listCoupons: async ({ competitionId }) =>
      cohostListCouponsFn({
        data: { competitionId, competitionTeamId },
      }),
    createCoupon: async (params) =>
      createCoupon({
        data: { ...params, competitionTeamId },
      }),
    deactivateCoupon: async ({ couponId, competitionId }) =>
      deactivate({
        data: { couponId, competitionId, competitionTeamId },
      }),
  }

  return (
    <CouponsPage
      teamId={competitionTeamId}
      competition={competition}
      coupons={coupons}
      appUrl={appUrl}
      overrides={overrides}
    />
  )
}
