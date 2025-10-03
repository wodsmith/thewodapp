"use client"

import { Building2, ChevronsUpDown, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTeamContext } from "@/state/team-context"
import { Badge } from "@/components/ui/badge"

interface Team {
	id: string
	name: string
}

interface TeamContextIndicatorProps {
	teams: Team[]
}

export function TeamContextIndicator({ teams }: TeamContextIndicatorProps) {
	const { currentTeamId, setCurrentTeam, clearCurrentTeam } = useTeamContext()

	// Don't auto-select - start with "All Teams" view
	const currentTeam = teams.find((t) => t.id === currentTeamId)

	if (teams.length <= 1) {
		return null
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Filter className="h-3 w-3" />
				<span>Filter by team:</span>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant={currentTeam ? "default" : "outline"}
						className="w-[250px] justify-between"
					>
						<div className="flex items-center gap-2">
							<Building2 className="h-4 w-4" />
							<span className="truncate">
								{currentTeam?.name || "All Teams"}
							</span>
						</div>
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-[250px]" align="end">
					<DropdownMenuLabel>Filter by Team</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={() => clearCurrentTeam()}
						className="flex items-center gap-2"
					>
						<Building2 className="h-4 w-4" />
						<span className="flex-1">All Teams</span>
						{!currentTeamId && (
							<Badge variant="secondary" className="ml-2 text-xs">
								Current
							</Badge>
						)}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{teams.map((team) => (
						<DropdownMenuItem
							key={team.id}
							onSelect={() => setCurrentTeam(team.id)}
							className="flex items-center gap-2"
						>
							<Building2 className="h-4 w-4" />
							<span className="flex-1 truncate">{team.name}</span>
							{team.id === currentTeamId && (
								<Badge variant="secondary" className="ml-2 text-xs">
									Current
								</Badge>
							)}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<p className="text-xs text-muted-foreground">
				{currentTeam
					? `Showing tracks for ${currentTeam.name} only`
					: "Showing tracks for all your teams"}
			</p>
		</div>
	)
}
