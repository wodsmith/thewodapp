"use client"

import { Building2, ChevronDown } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSessionStore } from "@/state/session"

interface AdminTeamSwitcherProps {
	currentTeamId: string
}

export function AdminTeamSwitcher({ currentTeamId }: AdminTeamSwitcherProps) {
	const { session } = useSessionStore()
	const router = useRouter()

	// Find the current team from the session
	const currentTeam = session?.teams?.find((team) => team.id === currentTeamId)

	// Get all teams that the user has access to
	const availableTeams = session?.teams || []

	const handleTeamSwitch = (teamId: string) => {
		// Navigate to the same route but with the new team id
		const currentUrl = new URL(window.location.href)
		const pathname = currentUrl.pathname

		// Use regex to find and replace the team ID in the path
		// This pattern matches /admin/teams/{teamId} and captures everything before and after
		const teamPathRegex = /^(\/admin\/teams\/)([^/]+)(.*)$/
		const match = pathname.match(teamPathRegex)

		if (match) {
			// Reconstruct the path with the new team ID
			const [, prefix, , suffix] = match
			const newPath = `${prefix}${teamId}${suffix}` as Route
			router.push(newPath)
		} else {
			// Fallback: if the current path doesn't match the expected pattern,
			// navigate to the basic team admin page
			router.push(`/admin/teams/${teamId}` as Route)
		}
	}

	if (!currentTeam) {
		return (
			<div className="flex items-center gap-3 px-4 py-2 border rounded-md w-full min-w-0">
				<Building2 className="h-6 w-6 flex-shrink-0" />
				<span className="truncate flex-1 min-w-0">Team Not Found</span>
			</div>
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="flex items-center gap-3 w-full min-w-0"
				>
					<Building2 className="h-6 w-6 flex-shrink-0" />
					<span className="truncate flex-1 min-w-0">{currentTeam.name}</span>
					<ChevronDown className="h-4 w-4 flex-shrink-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-80">
				{availableTeams.length > 0 ? (
					availableTeams.map((team) => (
						<DropdownMenuItem
							key={team.id}
							onClick={() => handleTeamSwitch(team.id)}
							className={`flex items-center gap-3 cursor-pointer ${
								team.id === currentTeamId ? "bg-accent" : ""
							}`}
						>
							<Building2 className="h-4 w-4" />
							<div className="flex-1">
								<div className="font-semibold">{team.name}</div>
								<div className="text-sm text-muted-foreground">
									{team.role.name} Role
								</div>
							</div>
							{team.id === currentTeamId && (
								<div className="text-xs font-bold">CURRENT</div>
							)}
						</DropdownMenuItem>
					))
				) : (
					<DropdownMenuItem disabled>No teams available</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
