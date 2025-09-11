"use client"

import { Calendar, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SessionValidationResult } from "@/types"

interface ScheduleDropdownProps {
	session: SessionValidationResult
}

export default function ScheduleDropdown({ session }: ScheduleDropdownProps) {
	const router = useRouter()

	// Filter teams where the user is an owner
	const ownedTeams =
		session?.teams?.filter((team) => team.role.name === "owner") || []

	// Don't show the dropdown if user doesn't own any teams
	if (ownedTeams.length === 0) {
		return null
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex items-center gap-1 font-bold text-foreground uppercase hover:underline dark:text-dark-foreground">
				Schedule
				<ChevronDown className="h-4 w-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="flex items-center gap-2">
					<Calendar className="h-4 w-4" />
					Schedule Workouts
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{ownedTeams.map((team) => (
					<DropdownMenuItem
						key={team.id}
						onClick={() => router.push(`/admin/teams/${team.id}`)}
						className="cursor-pointer"
					>
						{team.name}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
