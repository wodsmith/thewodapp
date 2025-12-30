"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Building2, ChevronsUpDown, Plus } from "lucide-react"
import type * as React from "react"
import { useState } from "react"
import { toast } from "sonner"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar"
import { setActiveTeamFn } from "@/server-fns/team-settings-fns"

export interface TeamSwitcherTeam {
	id: string
	name: string
	logo?: React.ElementType
	plan?: string
}

export function TeamSwitcher({
	teams,
	activeTeamId,
}: {
	teams: TeamSwitcherTeam[]
	activeTeamId: string | null
}) {
	const { isMobile } = useSidebar()
	const router = useRouter()
	const [isLoading, setIsLoading] = useState(false)

	const setActiveTeam = useServerFn(setActiveTeamFn)

	const activeTeam = teams.find((team) => team.id === activeTeamId)

	const handleTeamSwitch = async (teamId: string) => {
		if (teamId === activeTeamId) return

		setIsLoading(true)
		try {
			const result = await setActiveTeam({ data: { teamId } })

			if (!result.success) {
				toast.error("Failed to switch team", {
					description: "Please try again",
				})
				return
			}

			// Invalidate router to refresh all data
			router.invalidate()
		} catch (error) {
			console.error("Failed to switch team:", error)
			toast.error("Failed to switch team", {
				description:
					error instanceof Error ? error.message : "Please try again",
			})
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
							teams.map((team, index) => {
								const TeamLogo = team.logo || Building2
								return (
									<DropdownMenuItem
										key={team.id}
										onClick={() => handleTeamSwitch(team.id)}
										className="gap-2 p-2"
										disabled={isLoading}
									>
										<div className="flex size-6 items-center justify-center rounded-sm border">
											<TeamLogo className="size-4 shrink-0" />
										</div>
										{team.name}
										<DropdownMenuShortcut>
											{String.fromCharCode(8984)}
											{index + 1}
										</DropdownMenuShortcut>
									</DropdownMenuItem>
								)
							})
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
