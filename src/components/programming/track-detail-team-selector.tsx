"use client"

import { Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTeamContext } from "@/state/team-context"
import { useEffect } from "react"

interface Team {
	id: string
	name: string
}

interface TrackDetailTeamSelectorProps {
	teams: Team[]
}

export function TrackDetailTeamSelector({
	teams,
}: TrackDetailTeamSelectorProps) {
	const { currentTeamId, setCurrentTeam } = useTeamContext()

	// Auto-select first team if none selected
	useEffect(() => {
		if (!currentTeamId && teams.length > 0) {
			setCurrentTeam(teams[0].id)
		}
	}, [currentTeamId, teams, setCurrentTeam])

	const currentTeam = teams.find((t) => t.id === currentTeamId)

	if (teams.length <= 1) {
		return null
	}

	return (
		<div className="flex items-center gap-2 text-sm">
			<Building2 className="h-3 w-3 text-muted-foreground" />
			<span className="text-muted-foreground">Viewing as:</span>
			<Badge variant="secondary" className="text-xs">
				{currentTeam?.name || "No team selected"}
			</Badge>
		</div>
	)
}
