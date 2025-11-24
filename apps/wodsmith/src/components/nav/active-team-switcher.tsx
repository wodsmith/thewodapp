"use client"

import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useServerAction } from "@repo/zsa-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { setActiveTeamAction } from "@/actions/team-actions"
import { cn } from "@/utils/cn"

interface Team {
	id: string
	name: string
	slug: string
	isPersonalTeam: boolean
}

interface ActiveTeamSwitcherProps {
	teams: Team[]
	activeTeamId: string | null
}

export function ActiveTeamSwitcher({
	teams,
	activeTeamId,
}: ActiveTeamSwitcherProps) {
	const router = useRouter()
	const [isLoading, setIsLoading] = React.useState(false)

	const { execute: setActiveTeam } = useServerAction(setActiveTeamAction)

	const activeTeam = teams.find((team) => team.id === activeTeamId)

	const handleTeamSwitch = async (teamId: string) => {
		if (teamId === activeTeamId) return

		setIsLoading(true)
		try {
			const [result, error] = await setActiveTeam({ teamId })

			if (error) {
				console.error("Failed to switch team:", error)
				return
			}

			// Refresh the page to update all server components
			router.refresh()
		} finally {
			setIsLoading(false)
		}
	}

	if (teams.length === 0) {
		return null
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="font-bold uppercase hover:underline"
					disabled={isLoading}
				>
					<Building2 className="mr-2 h-4 w-4" />
					{activeTeam?.name || "Select Team"}
					<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[200px]">
				<DropdownMenuLabel>Switch Team</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{teams.map((team) => (
					<DropdownMenuItem
						key={team.id}
						onClick={() => handleTeamSwitch(team.id)}
						className="cursor-pointer"
						disabled={isLoading}
					>
						<Check
							className={cn(
								"mr-2 h-4 w-4",
								activeTeamId === team.id ? "opacity-100" : "opacity-0",
							)}
						/>
						<span className="flex-1 truncate">{team.name}</span>
						{team.isPersonalTeam && (
							<span className="ml-2 text-xs text-muted-foreground">
								(Personal)
							</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
