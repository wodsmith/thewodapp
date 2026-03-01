/**
 * Admin Team Detail Layout Route
 *
 * Layout route for admin team detail pages with tab navigation.
 * Fetches team data and provides context to child routes.
 */

import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	useMatches,
} from "@tanstack/react-router"
import {
	Building2,
	Calendar,
	CalendarDays,
	Settings,
	User,
	Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTeamByIdForAdminFn } from "@/server-fns/admin-team-fns"

export const Route = createFileRoute("/admin/teams/$teamId")({
	component: AdminTeamLayout,
	loader: async ({ params }) => {
		const { team } = await getTeamByIdForAdminFn({
			data: { teamId: params.teamId },
		})

		if (!team) {
			throw notFound()
		}

		return { team }
	},
})

// Tab configuration
const teamTabs = [
	{
		id: "overview",
		label: "Overview",
		href: (teamId: string) => `/admin/teams/${teamId}`,
		icon: Building2,
	},
	{
		id: "scheduling",
		label: "Scheduling",
		href: (teamId: string) => `/admin/teams/${teamId}/scheduling`,
		icon: CalendarDays,
	},
	{
		id: "gym-setup",
		label: "Gym Setup",
		href: (teamId: string) => `/admin/teams/${teamId}/gym-setup`,
		icon: Settings,
	},
	{
		id: "coaches",
		label: "Coaches",
		href: (teamId: string) => `/admin/teams/${teamId}/coaches`,
		icon: Users,
	},
]

function getTeamTypeBadge(team: {
	type: string | null
	isPersonalTeam: boolean
}) {
	if (team.isPersonalTeam) {
		return (
			<Badge variant="secondary" className="text-xs">
				<User className="mr-1 h-3 w-3" />
				Personal
			</Badge>
		)
	}

	switch (team.type) {
		case "gym":
			return (
				<Badge variant="default" className="text-xs">
					<Building2 className="mr-1 h-3 w-3" />
					Gym
				</Badge>
			)
		case "competition_event":
			return (
				<Badge variant="outline" className="text-xs">
					<Calendar className="mr-1 h-3 w-3" />
					Competition Event
				</Badge>
			)
		case "competition_team":
			return (
				<Badge variant="outline" className="text-xs">
					<Users className="mr-1 h-3 w-3" />
					Athlete Team
				</Badge>
			)
		default:
			return (
				<Badge variant="secondary" className="text-xs">
					{team.type}
				</Badge>
			)
	}
}

function AdminTeamLayout() {
	const { team } = Route.useLoaderData()
	const matches = useMatches()

	// Determine active tab from current path
	const currentPath = matches[matches.length - 1]?.pathname ?? ""
	const segments = currentPath.split("/").filter(Boolean)
	const lastSegment = segments[segments.length - 1]

	// If last segment is the teamId, we're on overview
	const activeTab = lastSegment === team.id ? "overview" : lastSegment

	return (
		<div className="max-w-6xl">
			{/* Breadcrumb */}
			<nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
				<Link to="/admin" className="hover:text-foreground">
					Admin
				</Link>
				<span>/</span>
				<Link to="/admin/teams" className="hover:text-foreground">
					Teams
				</Link>
				<span>/</span>
				<span className="text-foreground">{team.name}</span>
			</nav>

			<div className="space-y-6">
				{/* Team Header */}
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<div className="flex items-center gap-3">
							<h1 className="text-3xl font-bold">{team.name}</h1>
							{getTeamTypeBadge(team)}
						</div>
						<p className="text-muted-foreground">
							{team.description || `Team slug: ${team.slug}`}
						</p>
					</div>
				</div>

				{/* Tab Navigation */}
				<Tabs value={activeTab} className="w-full">
					<TabsList>
						{teamTabs.map((tab) => (
							<TabsTrigger key={tab.id} value={tab.id} asChild>
								<Link to={tab.href(team.id)}>
									<tab.icon className="mr-2 h-4 w-4" />
									{tab.label}
								</Link>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>

				{/* Child route content */}
				<Outlet />
			</div>
		</div>
	)
}
