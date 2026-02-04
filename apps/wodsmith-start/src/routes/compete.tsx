/**
 * This file uses top-level imports for server-only modules.
 */
import {
	createFileRoute,
	Outlet,
	useLocation,
	useMatches,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { CompeteBreadcrumb } from "@/components/compete-breadcrumb"
import CompeteNav from "@/components/compete-nav"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"

// Server function to get session and permissions
const getCompeteNavDataFn = createServerFn({ method: "GET" }).handler(
	async () => {
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
	staleTime: 30_000, // Cache for 30 seconds - nav data changes infrequently
	loader: async () => {
		const { session, canOrganize } = await getCompeteNavDataFn()
		return { session, canOrganize }
	},
})

function CompeteLayout() {
	const { session, canOrganize } = Route.useLoaderData()
	const location = useLocation()
	const matches = useMatches()

	// Check if we're on an organizer route that uses its own layout
	// - _dashboard routes: have their own layout with CompeteNav
	// - $competitionId routes: have sidebar layout
	// - onboard routes: have their own layout
	const isOrganizerRoute =
		location.pathname === "/compete/organizer" ||
		location.pathname.startsWith("/compete/organizer/")

	// Organizer routes have their own layouts (dashboard or competition sidebar)
	if (isOrganizerRoute) {
		return <Outlet />
	}

	// Build dynamic labels from matched route loader data
	const dynamicLabels: Record<string, string> = {}

	// Look for event details data in matched routes
	for (const match of matches) {
		const loaderData = match.loaderData as Record<string, unknown> | undefined
		if (loaderData?.event && typeof loaderData.event === "object") {
			const event = loaderData.event as {
				id?: string
				workout?: { name?: string }
			}
			if (event.id && event.workout?.name) {
				dynamicLabels[event.id] = event.workout.name
			}
		}
		// Add competition name for slug
		if (loaderData?.competition && typeof loaderData.competition === "object") {
			const competition = loaderData.competition as {
				slug?: string
				name?: string
			}
			if (competition.slug && competition.name) {
				dynamicLabels[competition.slug] = competition.name
			}
		}
	}

	return (
		<div className="flex min-h-screen flex-col print:min-h-0 print:block">
			<div className="print:hidden">
				<CompeteNav session={session} canOrganize={canOrganize} />
			</div>

			<main className="container mx-auto flex-1 p-4 print:p-0 print:max-w-none print:mx-0">
				<div className="print:hidden">
					<CompeteBreadcrumb dynamicLabels={dynamicLabels} />
				</div>
				<Outlet />
			</main>

			<footer className="border-black border-t-2 p-4 print:hidden">
				<div className="container mx-auto">
					<p className="text-center">
						&copy; {new Date().getFullYear()} WODsmith. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	)
}
