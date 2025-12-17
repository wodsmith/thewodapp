"use client"

import { useServerAction } from "@repo/zsa-react"
import { useRouter, useSearchParams } from "next/navigation"
import { setActiveTeamAction } from "@/actions/team-actions"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { OrganizingTeam } from "@/utils/get-user-organizing-teams"

interface TeamFilterProps {
	teams: OrganizingTeam[]
	selectedTeamId: string
}

export function TeamFilter({ teams, selectedTeamId }: TeamFilterProps) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const { execute: setActiveTeam } = useServerAction(setActiveTeamAction)

	const handleTeamChange = async (teamId: string) => {
		// Set the active team in session cookie so downstream components
		// (like competition pages) use the correct team context for payouts, limits, etc.
		await setActiveTeam({ teamId })

		const params = new URLSearchParams(searchParams.toString())
		params.set("teamId", teamId)
		// Reset group filter when changing teams
		params.delete("groupId")
		router.push(`/compete/organizer?${params.toString()}`)
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
