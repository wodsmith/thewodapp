/**
 * Competition Organizer Layout Route
 *
 * Layout route for organizer competition detail pages with sidebar navigation.
 * Fetches competition data, verifies user permissions, and provides context to child routes.
 */

import {
	createFileRoute,
	notFound,
	Outlet,
	redirect,
	useMatches,
} from "@tanstack/react-router"
import { CompetitionHeader } from "@/components/competition-header"
import { CompetitionSidebar } from "@/components/competition-sidebar"
import { OrganizerBreadcrumb } from "@/components/organizer-breadcrumb"
import { PendingOrganizerBanner } from "@/components/pending-organizer-banner"
import {
	checkCanManageCompetitionFn,
	getCompetitionByIdFn,
} from "@/server-fns/competition-detail-fns"

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

		// Verify user can manage this competition
		const { canManage } = await checkCanManageCompetitionFn({
			data: {
				organizingTeamId: competition.organizingTeamId,
				userId: session.user.id,
			},
		})

		if (!canManage) {
			throw redirect({
				to: "/compete",
				search: {},
			})
		}

		return {
			competition,
		}
	},
})

// Map route paths to breadcrumb labels
const routeLabels: Record<string, string> = {
	divisions: "Divisions",
	athletes: "Registrations",
	events: "Events",
	gameday: "Game Day",
	schedule: "Schedule",
	volunteers: "Volunteers",
	results: "Results",
	pricing: "Pricing",
	revenue: "Revenue",
	sponsors: "Sponsors",
	settings: "Settings",
	edit: "Edit",
	"danger-zone": "Danger Zone",
}

function CompetitionLayout() {
	const { competition } = Route.useLoaderData()
	const { entitlements } = Route.useRouteContext()
	const matches = useMatches()

	// Get the current child route segment for breadcrumb
	const currentPath = matches[matches.length - 1]?.pathname ?? ""
	const segments = currentPath.split("/").filter(Boolean)
	const lastSegment = segments[segments.length - 1]

	// Build breadcrumb segments
	const breadcrumbSegments: Array<{ label: string; href?: string }> = [
		{ label: competition.name },
	]

	// Add current page to breadcrumb if not on overview
	if (lastSegment && lastSegment !== competition.id) {
		const label = routeLabels[lastSegment] || lastSegment
		breadcrumbSegments.push({ label })
	}

	return (
		<CompetitionSidebar competitionId={competition.id}>
			{entitlements.isPendingApproval && (
				<PendingOrganizerBanner variant="sidebar-inset" />
			)}
			<div className="flex flex-1 flex-col gap-6 p-6">
				{/* Breadcrumb */}
				<OrganizerBreadcrumb segments={breadcrumbSegments} />

				{/* Competition Header */}
				<CompetitionHeader
					competition={{
						id: competition.id,
						name: competition.name,
						slug: competition.slug,
						description: competition.description,
						startDate: competition.startDate,
						endDate: competition.endDate,
						registrationOpensAt: competition.registrationOpensAt,
						registrationClosesAt: competition.registrationClosesAt,
						visibility: competition.visibility,
						status: competition.status,
					}}
				/>

				{/* Child route content */}
				<Outlet />
			</div>
		</CompetitionSidebar>
	)
}
