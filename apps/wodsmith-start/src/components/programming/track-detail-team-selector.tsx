"use client"

import { Building2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { useTeamContext } from "~/state/team-context"

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
	const [hydrated, setHydrated] = useState(false)

	// Set hydrated flag after mount
	useEffect(() => {
		setHydrated(true)
	}, [])

	// Auto-select first team if none selected (only after hydration)
	useEffect(() => {
		if (!hydrated) return
		if (!currentTeamId && teams.length > 0) {
			const firstTeam = teams[0]
			if (firstTeam) {
				setCurrentTeam(firstTeam.id)
			}
		}
	}, [hydrated, currentTeamId, teams, setCurrentTeam])

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
