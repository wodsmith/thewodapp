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
import { cohostGetPermissionsFn } from "@/server-fns/cohost/cohost-competition-fns"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
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

    // Verify user is a cohost on the competition team or a site admin
    const isCohost = !!session.teams?.find(
      (t) =>
        t.id === competition.competitionTeamId && t.role.id === "cohost",
    )
    const isSiteAdmin = session.user?.role === "admin"

    if (!isSiteAdmin && !isCohost) {
      throw redirect({
        to: "/compete",
        search: {},
      })
    }

    // Get cohost permissions from DB via server function
    // (can't import server/cohost.ts directly — it imports getDb which breaks client boundary)
    const permissions = await cohostGetPermissionsFn({
      data: { competitionTeamId: competition.competitionTeamId! },
    })

    return {
      competition,
      permissions,
    }
  },
})

function CohostCompetitionLayout() {
  const { competition, permissions } = Route.useLoaderData()

  return (
    <CohostSidebar
      competitionId={competition.id}
      competitionType={competition.competitionType}
      permissions={
        permissions ?? {
          canViewRevenue: false,
          canEditCapacity: false,
          canEditScoring: false,
          canEditRotation: false,
          canManagePricing: false,
        }
      }
    >
      <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <Outlet />
      </div>
    </CohostSidebar>
  )
}
