"use client"

import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { useRouter, useLocation } from "@tanstack/react-router"
import * as React from "react"
import { useTransition } from "react"
import { toast } from "sonner"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Button } from "~/components/ui/button"
import { setActiveTeamAction } from "~/actions/team-actions"
import { cn } from "~/utils/cn"

interface Team {
	id: string
	name: string
	slug: string
	type: string
	isPersonalTeam: boolean
}

interface ActiveTeamSwitcherProps {
	teams: Team[]
	activeTeamId: string | null
}

// Patterns that indicate a team-specific resource page
// These pages show resources owned by the current team, so switching teams
// should redirect to /admin/teams instead of staying on the same page
const TEAM_RESOURCE_PATTERNS = [
	/^\/admin\/teams\/programming\/[^/]+/, // /admin/teams/programming/:trackId
	/^\/admin\/teams\/competitions\/[^/]+/, // /admin/teams/competitions/:id
	/^\/admin\/teams\/schedule-templates\/[^/]+/, // /admin/teams/schedule-templates/:id
]

export function ActiveTeamSwitcher({
	teams,
	activeTeamId,
}: ActiveTeamSwitcherProps) {
	const router = useRouter()
	const location = useLocation()
	const pathname = location.pathname
	const [isPending, startTransition] = useTransition()

	const activeTeam = teams.find((team) => team.id === activeTeamId)

	// Check if current page is a team-specific resource
	const isTeamResourcePage = TEAM_RESOURCE_PATTERNS.some((pattern) =>
		pattern.test(pathname),
	)

	const handleTeamSwitch = (teamId: string) => {
		if (teamId === activeTeamId) return

		startTransition(async () => {
			try {
				const result = await setActiveTeamAction({ teamId })

				if (result instanceof Error || !result) {
					console.error("Failed to switch team:", result)
					toast.error("Failed to switch team", {
						description: "Please try again",
					})
					return
				}

				// If on a team-specific resource page, redirect to /admin/teams
				// since the resource belongs to the previous team
				if (isTeamResourcePage) {
					router.push("/admin/teams")
				} else {
					// TODO: Refresh page or refetch data in TanStack Start
					window.location.reload()
				}
			} catch (error) {
				console.error("Team switch error:", error)
				toast.error("Failed to switch team")
			}
		})
	}

	if (teams.length === 0) {
		return null
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="font-bold uppercase hover:underline"
					disabled={isPending}
				>
					<Building2 className="mr-2 h-4 w-4" />
					{activeTeam?.name || "Select Team"}
					<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[200px]">
				<DropdownMenuLabel>Switch Team</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{teams.map((team) => (
					<DropdownMenuItem
						key={team.id}
						onClick={() => handleTeamSwitch(team.id)}
						className="cursor-pointer"
						disabled={isPending}
					>
						<Check
							className={cn(
								"mr-2 h-4 w-4",
								activeTeamId === team.id ? "opacity-100" : "opacity-0",
							)}
						/>
						<span className="flex-1 truncate">{team.name}</span>
						{team.isPersonalTeam && (
							<span className="ml-2 text-xs text-muted-foreground">
								(Personal)
							</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
