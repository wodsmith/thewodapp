"use client"

import { Bell, User } from "lucide-react"
import Link from "next/link"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AthleteProfileMissingFields } from "@/server/user"

interface PendingInvitation {
	id: string
	token: string
	team: {
		id: string | undefined
		name: string | undefined
		slug: string | undefined
	}
}

interface NotificationBellProps {
	invitations: PendingInvitation[]
	missingProfileFields?: AthleteProfileMissingFields | null
}

function formatMissingFields(
	missing: AthleteProfileMissingFields | null | undefined,
): string {
	if (!missing) return ""
	const fields: string[] = []
	if (missing.gender) fields.push("gender")
	if (missing.dateOfBirth) fields.push("date of birth")
	if (missing.affiliateName) fields.push("affiliate")
	if (fields.length === 0) return ""
	if (fields.length === 1) return `Add ${fields[0]}`
	if (fields.length === 2) return `Add ${fields[0]} & ${fields[1]}`
	return `Add ${fields.slice(0, -1).join(", ")} & ${fields[fields.length - 1]}`
}

export function NotificationBell({
	invitations,
	missingProfileFields = null,
}: NotificationBellProps) {
	const isProfileIncomplete =
		missingProfileFields &&
		(missingProfileFields.gender ||
			missingProfileFields.dateOfBirth ||
			missingProfileFields.affiliateName)
	const hasNotifications = invitations.length > 0 || isProfileIncomplete

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="relative font-bold text-foreground dark:text-dark-foreground"
				>
					<Bell className="h-5 w-5" />
					{hasNotifications && (
						<span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>Notifications</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{!hasNotifications ? (
					<DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
				) : (
					<>
						{isProfileIncomplete && (
							<DropdownMenuItem asChild>
								<Link href="/settings/profile" className="cursor-pointer">
									<div className="flex items-start gap-2">
										<User className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400" />
										<div className="flex flex-col gap-0.5">
											<span className="font-medium">Complete Your Profile</span>
											<span className="text-muted-foreground text-sm">
												{formatMissingFields(missingProfileFields)} for
												competitions
											</span>
										</div>
									</div>
								</Link>
							</DropdownMenuItem>
						)}
						{invitations.map((invitation) => (
							<DropdownMenuItem key={invitation.id} asChild>
								<Link
									href={`/compete/invite/${invitation.token}`}
									className="cursor-pointer"
								>
									<div className="flex flex-col gap-0.5">
										<span className="font-medium">Team Invite</span>
										<span className="text-muted-foreground text-sm">
											{invitation.team.name}
										</span>
									</div>
								</Link>
							</DropdownMenuItem>
						))}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
