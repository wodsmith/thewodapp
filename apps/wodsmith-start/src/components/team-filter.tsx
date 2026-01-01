"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { setActiveTeamFn } from "@/server-fns/team-settings-fns"

interface OrganizingTeam {
	id: string
	name: string
}

interface TeamFilterProps {
	teams: OrganizingTeam[]
	selectedTeamId: string
}

export function TeamFilter({ teams, selectedTeamId }: TeamFilterProps) {
	const router = useRouter()
	const setActiveTeam = useServerFn(setActiveTeamFn)

	const handleTeamChange = async (teamId: string) => {
		try {
			// Update the active team cookie on the server
			await setActiveTeam({ data: { teamId } })

			// Invalidate the route to trigger a reload with the new team
			router.invalidate()
		} catch (error) {
			console.error("Failed to change team:", error)
			// Could add toast notification here
		}
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-muted-foreground">Organizing as:</span>
			<Select value={selectedTeamId} onValueChange={handleTeamChange}>
				<SelectTrigger className="w-[200px]">
					<SelectValue placeholder="Select team" />
				</SelectTrigger>
				<SelectContent>
					{teams.map((team) => (
						<SelectItem key={team.id} value={team.id}>
							{team.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
