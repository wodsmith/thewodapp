"use client"

import type { Route } from "next"
import { type ComponentType, useEffect, useState } from "react"

import {
	Building2,
	Calculator,
	CreditCard,
	Frame,
	Map as MapIcon,
	PieChart,
	Settings,
	Settings2,
	ShoppingCart,
	SquareTerminal,
	Users,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { useSessionStore } from "@/state/session"

export type NavItem = {
	title: string
	url: Route
	icon?: ComponentType
}

export type NavMainItem = NavItem & {
	isActive?: boolean
	items?: NavItem[]
}

type Data = {
	user: {
		name: string
		email: string
	}
	teams: {
		name: string
		logo: ComponentType
		plan: string
	}[]
	navMain: NavMainItem[]
	projects: NavItem[]
}

// TODO Add a theme switcher
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { session } = useSessionStore()
	const [formattedTeams, setFormattedTeams] = useState<Data["teams"]>([])
	const [hasAdminPermissions, setHasAdminPermissions] = useState(false)

	// Map session teams to the format expected by TeamSwitcher
	useEffect(() => {
		if (session?.teams && session.teams.length > 0) {
			// Map teams from session to the format expected by TeamSwitcher
			console.log("session.teams", session.teams, { session })
			const teamData = session.teams.map((team) => {
				return {
					name: team.name,
					// TODO Get the actual logo when we implement team avatars
					logo: Building2,
					// Default plan - you might want to add plan data to your team structure
					plan: team.role.name || "Member",
				}
			})

			setFormattedTeams(teamData)

			// Check if user has admin permissions on any team
			const hasAdmin = session.teams.some((team) =>
				team.permissions.includes(TEAM_PERMISSIONS.SCHEDULE_WORKOUTS),
			)
			setHasAdminPermissions(hasAdmin)
		}
	}, [session])

	const data: Data = {
		user: {
			name: session?.user?.firstName || "User",
			email: session?.user?.email || "user@example.com",
		},
		teams: formattedTeams,
		navMain: [
			{
				title: "Dashboard",
				url: "/dashboard",
				icon: SquareTerminal,
				isActive: true,
			},
			{
				title: "Teams",
				url: "/dashboard/teams" as Route,
				icon: Users,
			},
			...(hasAdminPermissions
				? [
						{
							title: "Admin Dashboard",
							url: "/dashboard/admin" as Route,
							icon: Settings,
						},
					]
				: []),
			{
				title: "Marketplace",
				url: "/dashboard/marketplace",
				icon: ShoppingCart,
			},
			{
				title: "Billing",
				url: "/dashboard/billing",
				icon: CreditCard,
			},
			{
				title: "Settings",
				url: "/settings",
				icon: Settings2,
				items: [
					{
						title: "Profile",
						url: "/settings",
					},
					{
						title: "Security",
						url: "/settings/security",
					},
					{
						title: "Sessions",
						url: "/settings/sessions",
					},
					{
						title: "Change Password",
						url: "/forgot-password",
					},
				],
			},
		],
		projects: [
			{
				title: "Design Engineering",
				url: "#",
				icon: Frame,
			},
			{
				title: "Sales & Marketing",
				url: "#",
				icon: PieChart,
			},
			{
				title: "Travel",
				url: "#",
				icon: MapIcon,
			},
		],
	}

	return (
		<Sidebar collapsible="icon" {...props}>
			{data?.teams?.length > 0 && (
				<SidebarHeader>
					<TeamSwitcher teams={data.teams} />
				</SidebarHeader>
			)}

			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavProjects projects={data.projects} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}
