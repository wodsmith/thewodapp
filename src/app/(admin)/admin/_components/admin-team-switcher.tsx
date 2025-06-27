"use client"

import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSessionStore } from "@/state/session"
import { Building2, ChevronDown } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"

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
		const teamPathRegex = /^(\/admin\/teams\/)([^\/]+)(.*)$/
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
			<div className="flex items-center gap-3 px-4 py-2 border-2 border-primary bg-card shadow-[4px_4px_0px_0px] shadow-primary">
				<Building2 className="h-6 w-6" />
				<span className="text-lg font-mono font-bold">Team Not Found</span>
			</div>
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="flex items-center gap-3 px-4 py-2 border-2 border-primary bg-card shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] hover:shadow-primary transition-all font-mono font-bold text-sm h-auto"
				>
					<Building2 className="h-6 w-6" />
					<span className="truncate">{currentTeam.name}</span>
					<ChevronDown className="h-4 w-4 ml-auto" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-80 border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary"
			>
				{availableTeams.length > 0 ? (
					availableTeams.map((team) => (
						<DropdownMenuItem
							key={team.id}
							onClick={() => handleTeamSwitch(team.id)}
							className={`flex items-center gap-3 p-3 font-mono cursor-pointer ${
								team.id === currentTeamId
									? "bg-orange text-white"
									: "hover:bg-orange/10"
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
					<DropdownMenuItem disabled className="p-3 font-mono">
						No teams available
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
