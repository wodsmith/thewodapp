"use client"

import { Calendar } from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { SessionValidationResult } from "~/types"

interface ScheduleDropdownProps {
	session: SessionValidationResult
}

export default function ScheduleDropdown({ session }: ScheduleDropdownProps) {
	// Filter teams where the user is an owner
	const ownedTeams =
		session?.teams?.filter((team) => team.role.name === "owner") || []

	// Don't show the link if user doesn't own any teams
	if (ownedTeams.length === 0) {
		return null
	}

	return (
		<Link
			href="/admin/teams"
			className="flex items-center gap-1 font-bold text-foreground uppercase hover:underline dark:text-dark-foreground"
		>
			<Calendar className="h-4 w-4" />
			Schedule
		</Link>
	)
}
