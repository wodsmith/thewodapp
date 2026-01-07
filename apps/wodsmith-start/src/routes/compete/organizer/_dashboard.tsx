/**
 * Dashboard Layout Route (Pathless)
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

const getCompeteNavDataFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { TEAM_PERMISSIONS } = await import("@/db/schemas/teams")
		const { getSessionFromCookie } = await import("@/utils/auth")
		const session = await getSessionFromCookie()

		const canOrganize = session?.teams
			? session.teams.some((team) =>
					team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
				)
			: false

		return { session, canOrganize }
	},
)

export const Route = createFileRoute("/compete/organizer/_dashboard")({
	component: DashboardLayout,
	loader: async () => {
		const { session, canOrganize } = await getCompeteNavDataFn()
		return { session, canOrganize }
	},
})

function DashboardLayout() {
	const { entitlements } = Route.useRouteContext()
	const { session, canOrganize } = Route.useLoaderData()

	return (
		<div className="flex min-h-screen flex-col">
			<CompeteNav session={session} canOrganize={canOrganize} />

			<main className="container mx-auto flex-1 pt-4 sm:p-4">
				<CompeteBreadcrumb />
				{entitlements.isPendingApproval && (
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
