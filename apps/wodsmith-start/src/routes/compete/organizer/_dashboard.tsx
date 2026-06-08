/**
 * Dashboard Layout Route (Pathless)
 *
 * This file uses top-level imports for server-only modules.
 *
 * Layout for organizer pages that don't have the competition sidebar.
 * Includes the CompeteNav header, main content area, and footer.
 * Shows the pending organizer banner with page-container variant.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { CompeteBreadcrumb } from "@/components/compete-breadcrumb"
import CompeteNav from "@/components/compete-nav"
import { PendingOrganizerBanner } from "@/components/pending-organizer-banner"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"
import { computeOrganizerEntitlements } from "@/utils/organizer-entitlements"

const getCompeteNavDataFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSessionFromCookie()

    const canOrganize = session?.teams
      ? session.teams.some((team) =>
          team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
        )
      : false
    const hasOrganizerApplication = computeOrganizerEntitlements(
      session,
      null,
    ).hasHostCompetitions

    return { session, canOrganize, hasOrganizerApplication }
  },
)

export const Route = createFileRoute("/compete/organizer/_dashboard")({
  component: DashboardLayout,
  staleTime: 30_000, // Cache for 30 seconds - nav data changes infrequently
  loader: async () => {
    const { session, canOrganize, hasOrganizerApplication } =
      await getCompeteNavDataFn()
    return { session, canOrganize, hasOrganizerApplication }
  },
})

function DashboardLayout() {
  const { entitlements } = Route.useRouteContext() as {
    entitlements?: { isPendingApproval?: boolean }
  }
  const { session, canOrganize, hasOrganizerApplication } =
    Route.useLoaderData()

  return (
    <div className="flex min-h-screen flex-col">
      <CompeteNav
        session={session}
        canOrganize={canOrganize}
        hasOrganizerApplication={hasOrganizerApplication}
      />

      <main className="container mx-auto flex-1 pt-4 sm:p-4">
        <CompeteBreadcrumb />
        {entitlements?.isPendingApproval && (
          <PendingOrganizerBanner variant="page-container" />
        )}
        <Outlet />
      </main>

      <footer className="border-black border-t-2 p-4">
        <div className="container mx-auto">
          <p className="text-center">
            &copy; {new Date().getFullYear()} WODsmith. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
