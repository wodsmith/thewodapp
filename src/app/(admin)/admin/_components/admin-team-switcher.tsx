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
	currentTeamSlug: string
}

export function AdminTeamSwitcher({ currentTeamSlug }: AdminTeamSwitcherProps) {
	const { session } = useSessionStore()
	const router = useRouter()

	// Find the current team from the session
	const currentTeam = session?.teams?.find(
		(team) => team.slug === currentTeamSlug,
	)

	// Get all teams that the user has access to
	const availableTeams = session?.teams || []

	const handleTeamSwitch = (teamSlug: string) => {
		// Navigate to the same route but with the new team slug
		const currentPath = window.location.pathname
		const pathSegments = currentPath.split("/")

		// Find the admin/teams/[teamSlug] part and replace the team slug
		const adminIndex = pathSegments.indexOf("admin")
		const teamsIndex = pathSegments.indexOf("teams")

		if (
			adminIndex !== -1 &&
			teamsIndex !== -1 &&
			pathSegments[teamsIndex + 1]
		) {
			pathSegments[teamsIndex + 1] = teamSlug
			const newPath = pathSegments.join("/") as Route
			router.push(newPath)
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
							onClick={() => handleTeamSwitch(team.slug)}
							className={`flex items-center gap-3 p-3 font-mono cursor-pointer ${
								team.slug === currentTeamSlug
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
							{team.slug === currentTeamSlug && (
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
