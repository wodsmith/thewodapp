"use client"

import { useServerAction } from "@repo/zsa-react"
import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { setActiveTeamAction } from "@/actions/team-actions"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/utils/cn"

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
	const pathname = usePathname()
	const [isLoading, setIsLoading] = React.useState(false)

	const { execute: setActiveTeam } = useServerAction(setActiveTeamAction)

	const activeTeam = teams.find((team) => team.id === activeTeamId)

	// Check if current page is a team-specific resource
	const isTeamResourcePage = TEAM_RESOURCE_PATTERNS.some((pattern) =>
		pattern.test(pathname),
	)

	const handleTeamSwitch = async (teamId: string) => {
		if (teamId === activeTeamId) return

		setIsLoading(true)
		try {
			const [, error] = await setActiveTeam({ teamId })

			if (error) {
				console.error("Failed to switch team:", error)
				toast.error("Failed to switch team", {
					description: error.message || "Please try again",
				})
				return
			}

			// If on a team-specific resource page, redirect to /admin/teams
			// since the resource belongs to the previous team
			if (isTeamResourcePage) {
				router.push("/admin/teams")
			} else {
				// Refresh the page to update all server components
				router.refresh()
			}
		} finally {
			setIsLoading(false)
		}
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
					disabled={isLoading}
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
						disabled={isLoading}
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
