"use client"

import { Building2, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSessionStore } from "@/state/session"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"

interface TeamOption {
	id: string
	name: string
}

interface TeamProgrammingSelectorProps {
	selectedTeamId?: string
	onTeamSelect: (teamId: string) => void
	disabled?: boolean
}

export function TeamProgrammingSelector({
	selectedTeamId,
	onTeamSelect,
	disabled = false,
}: TeamProgrammingSelectorProps) {
	const session = useSessionStore((state) => state.session)
	const hasTeamPermission = useSessionStore((state) => state.hasTeamPermission)

	// Filter teams where user has MANAGE_PROGRAMMING permission
	const eligibleTeams: TeamOption[] =
		session?.teams
			?.filter((team) =>
				hasTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
			)
			.map((team) => ({
				id: team.id,
				name: team.name,
			})) || []

	const selectedTeam = eligibleTeams.find((team) => team.id === selectedTeamId)

	// If only one team, don't show selector
	if (eligibleTeams.length <= 1) {
		return null
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="w-[200px] justify-between text-sm"
					disabled={disabled}
				>
					<div className="flex items-center gap-2">
						<Building2 className="h-4 w-4" />
						<span className="truncate">
							{selectedTeam ? selectedTeam.name : "Select team..."}
						</span>
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[200px]" align="start">
				{eligibleTeams.map((team) => (
					<DropdownMenuItem
						key={team.id}
						onSelect={() => onTeamSelect(team.id)}
						className="flex items-center gap-2"
					>
						<Building2 className="h-4 w-4" />
						<span className="truncate">{team.name}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
