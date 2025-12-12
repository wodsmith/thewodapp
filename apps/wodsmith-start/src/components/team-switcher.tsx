"use client"

import { Building2, ChevronsUpDown, Plus } from "lucide-react"
import { Link, useRouter } from "@tanstack/react-router"
import * as React from "react"
import { toast } from "sonner"
import { useServerFnWithState } from "~/hooks/use-server-fn"
import { setActiveTeamFn } from "~/server-functions/team"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/components/ui/sidebar"

export function TeamSwitcher({
	teams,
	activeTeamId,
}: {
	teams: {
		id: string
		name: string
		logo: React.ElementType
		plan: string
	}[]
	activeTeamId: string | null
}) {
	const { isMobile } = useSidebar()
	const router = useRouter()
	const [isLoading, setIsLoading] = React.useState(false)

	const { execute: setActiveTeam } = useServerFnWithState(setActiveTeamFn)

	const activeTeam = teams.find((team) => team.id === activeTeamId)

	const handleTeamSwitch = async (teamId: string) => {
		if (teamId === activeTeamId) return

		setIsLoading(true)
		try {
			const [_result, error] = await setActiveTeam({ teamId })

			if (error) {
				console.error("Failed to switch team:", error)
				toast.error("Failed to switch team", {
					description: error.message || "Please try again",
				})
				return
			}

			// Invalidate router to refresh data
			router.invalidate()
		} finally {
			setIsLoading(false)
		}
	}

	const LogoComponent = activeTeam?.logo || Building2

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<LogoComponent className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">
									{activeTeam?.name || "No Team"}
								</span>
								<span className="truncate text-xs">
									{activeTeam?.plan || "Select a team"}
								</span>
							</div>
							<ChevronsUpDown className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
						align="start"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuLabel className="text-xs text-muted-foreground">
							Teams
						</DropdownMenuLabel>
						{teams.length > 0 ? (
							teams.map((team, index) => (
								<DropdownMenuItem
									key={team.id}
									onClick={() => handleTeamSwitch(team.id)}
									className="gap-2 p-2"
									disabled={isLoading}
								>
									<div className="flex size-6 items-center justify-center rounded-sm border">
										<team.logo className="size-4 shrink-0" />
									</div>
									{team.name}
									<DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
								</DropdownMenuItem>
							))
						) : (
							<DropdownMenuItem disabled className="gap-2 p-2">
								<div className="flex size-6 items-center justify-center rounded-sm border">
									<Building2 className="size-4 shrink-0" />
								</div>
								No teams available
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem className="gap-2 p-2 cursor-pointer" asChild>
							<Link to="/settings/teams/create">
								<div className="flex size-6 items-center justify-center border bg-background">
									<Plus className="size-4" />
								</div>
								<div className="font-medium text-muted-foreground">
									Add team
								</div>
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
