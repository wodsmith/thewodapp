/**
 * Competition Cohost Layout Route
 *
 * Layout route for cohost competition detail pages with sidebar navigation.
 * Fetches competition data, verifies cohost permissions, and provides context to child routes.
 */

import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router"
import { CohostSidebar } from "@/components/cohost-sidebar"
import { FEATURES } from "@/config/features"
import { cohostGetPermissionsFn } from "@/server-fns/cohost/cohost-competition-fns"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { checkTeamHasFeatureFn } from "@/server-fns/entitlements"
import { validateSession } from "@/server-fns/middleware/auth"

export const Route = createFileRoute("/compete/cohost/$competitionId")({
  component: CohostCompetitionLayout,
  staleTime: 10_000, // Cache for 10 seconds (SWR behavior)
  beforeLoad: async ({ params }) => {
    // Validate session — cohost routes require authentication
    const session = await validateSession()

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: `/compete/cohost/${params.competitionId}`,
        },
      })
    }

    return { session }
  },
  loader: async ({ params, context }) => {
    const session = context.session

    // Require authentication
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/cohost/${params.competitionId}` },
      })
    }

    // Get competition by ID
    const { competition } = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })

    if (!competition) {
      throw notFound()
    }

    // Fetch cohost permissions (DB-based, source of truth). Returns all-true
    // for site admins, the cohost's metadata for cohosts, or null otherwise.
    // We don't gate on session.teams here because KV can lag right after the
    // user accepts a cohost invite, which would bounce them to /compete.
    const [permissions, hasCouponsEntitlement] = await Promise.all([
      cohostGetPermissionsFn({
        data: { competitionTeamId: competition.competitionTeamId! },
      }),
      checkTeamHasFeatureFn({
        data: {
          teamId: competition.organizingTeamId,
          featureKey: FEATURES.PRODUCT_COUPONS,
        },
      }).catch(() => false),
    ])

    if (!permissions) {
      throw redirect({
        to: "/compete",
        search: {},
      })
    }

    // Mask coupons permission if team doesn't have the entitlement
    const maskedPermissions = {
      ...permissions,
      coupons: permissions.coupons && hasCouponsEntitlement,
    }

    return {
      competition,
      permissions: maskedPermissions,
    }
  },
})

function CohostCompetitionLayout() {
  const { competition, permissions } = Route.useLoaderData()

  return (
    <CohostSidebar
      competitionId={competition.id}
      competitionName={competition.name}
      competitionType={competition.competitionType}
      permissions={permissions}
    >
      <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <Outlet />
      </div>
    </CohostSidebar>
  )
}
