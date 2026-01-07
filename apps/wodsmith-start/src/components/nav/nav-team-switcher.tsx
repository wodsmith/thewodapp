"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react"
import type * as React from "react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setActiveTeamFn } from "@/server-fns/team-settings-fns"

/**
 * Team data for the nav team switcher.
 * Compatible with the team data from KVSession.teams
 */
export interface NavTeamSwitcherTeam {
	id: string
	name: string
	logo?: React.ElementType
	plan?: {
		id: string
		name: string
		features: string[]
		limits: Record<string, number>
	}
}

/**
 * Team switcher component for use in the main navigation bar.
 * Unlike the sidebar TeamSwitcher, this version uses a Button trigger
 * and doesn't require the SidebarProvider context.
 */
export function NavTeamSwitcher({
	teams,
	activeTeamId,
}: {
	teams: NavTeamSwitcherTeam[]
	activeTeamId: string | null
}) {
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
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="gap-2 border-2 border-black font-semibold dark:border-dark-border"
					disabled={isLoading}
				>
					<LogoComponent className="size-4" />
					<span className="max-w-[150px] truncate">
						{activeTeam?.name || "Select Team"}
					</span>
					<ChevronsUpDown className="size-4 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="start" sideOffset={8}>
				<DropdownMenuLabel className="text-xs text-muted-foreground">
					Teams
				</DropdownMenuLabel>
				{teams.length > 0 ? (
					teams.map((team) => {
						const TeamLogo = team.logo || Building2
						const isActive = team.id === activeTeamId
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
								<span className="flex-1 truncate">{team.name}</span>
								{isActive && <Check className="size-4 text-primary" />}
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
						<div className="font-medium text-muted-foreground">Add team</div>
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
