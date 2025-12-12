"use client"

import { useRouter } from "@tanstack/react-router"
import { useCallback } from "react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select"
import type { OrganizingTeam } from "~/utils/get-user-organizing-teams"

interface TeamFilterProps {
	teams: OrganizingTeam[]
	selectedTeamId: string
}

/**
 * Team filter dropdown for competition organizers.
 * Allows switching between teams with organizing permissions.
 * Resets group filter when team changes.
 *
 * @example
 * <TeamFilter
 *   teams={organizingTeams}
 *   selectedTeamId={currentTeamId}
 * />
 */
export function TeamFilter({ teams, selectedTeamId }: TeamFilterProps) {
	const router = useRouter()

	const handleTeamChange = useCallback(
		(teamId: string) => {
			// Update URL with new team ID, reset group filter
			router.navigate({
				to: "/compete/organizer",
				search: { teamId, groupId: undefined },
			})
		},
		[router],
	)

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
