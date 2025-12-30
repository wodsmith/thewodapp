import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import CompeteNav from "@/components/compete-nav"

// Server function to get session and permissions
const getCompeteNavDataFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { TEAM_PERMISSIONS } = await import("@/db/schemas/teams")
		const { getSessionFromCookie } = await import("@/utils/auth")
		const session = await getSessionFromCookie()

		// Check if user has MANAGE_COMPETITIONS permission in any team
		const canOrganize = session?.teams
			? session.teams.some((team) =>
					team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
				)
			: false

		return { session, canOrganize }
	},
)

export const Route = createFileRoute("/compete")({
	component: CompeteLayout,
	loader: async () => {
		const { session, canOrganize } = await getCompeteNavDataFn()
		return { session, canOrganize }
	},
})

function CompeteLayout() {
	const { session, canOrganize } = Route.useLoaderData()
	const location = useLocation()

	// Check if we're on an organizer competition detail page (has sidebar layout)
	// These pages have their own layout and don't need the CompeteNav header
	const isOrganizerDetailPage =
		/^\/compete\/organizer\/[^/]+/.test(location.pathname) &&
		location.pathname !== "/compete/organizer"

	// Organizer detail pages have their own full-page layout with sidebar
	if (isOrganizerDetailPage) {
		return <Outlet />
	}

	return (
		<div className="flex min-h-screen flex-col">
			<CompeteNav session={session} canOrganize={canOrganize} />

			<main className="container mx-auto flex-1 pt-4 sm:p-4">
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
