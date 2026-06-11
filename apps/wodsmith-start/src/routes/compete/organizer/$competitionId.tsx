/**
 * Competition Organizer Layout Route
 *
 * Layout route for organizer competition detail pages with sidebar navigation.
 * Fetches competition data, verifies user permissions, and provides context to child routes.
 */
// @lat: [[organizer-dashboard#Layout and Access Control]]

import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router"
import { CompetitionDashboardShell } from "@/components/competition-dashboard-shell"
import { PendingOrganizerBanner } from "@/components/pending-organizer-banner"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"

export const Route = createFileRoute("/compete/organizer/$competitionId")({
  component: CompetitionLayout,
  staleTime: 10_000, // Cache for 10 seconds (SWR behavior)
  loader: async ({ params, context }) => {
    const session = context.session

    // Require authentication
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/organizer/${params.competitionId}` },
      })
    }

    // Get competition by ID
    const { competition } = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })

    if (!competition) {
      throw notFound()
    }

    // Verify user can manage this competition using session data
    const canManage =
      session.user?.role === "admin" ||
      !!session.teams?.find(
        (t) =>
          t.id === competition.organizingTeamId &&
          (t.role.id === "admin" || t.role.id === "owner"),
      )

    if (!canManage) {
      throw redirect({
        to: "/",
        search: {},
      })
    }

    return {
      competition,
    }
  },
})

function CompetitionLayout() {
  const { competition } = Route.useLoaderData()
  const { entitlements } = Route.useRouteContext()

  return (
    <CompetitionDashboardShell
      competition={competition}
      banner={
        entitlements.isPendingApproval ? (
          <PendingOrganizerBanner variant="sidebar-inset" />
        ) : undefined
      }
    >
      <Outlet />
    </CompetitionDashboardShell>
  )
}
