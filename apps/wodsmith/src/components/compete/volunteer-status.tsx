"use client"

import { Calendar, CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { VolunteerRoleType } from "@/db/schemas/volunteers"

interface PendingVolunteerInvitation {
	id: string
	competitionName: string
	competitionSlug: string
	signupDate: Date
}

interface VolunteerMembership {
	id: string
	competitionName: string
	competitionSlug: string
	roleTypes: VolunteerRoleType[]
}

interface VolunteerStatusProps {
	pendingInvitations: PendingVolunteerInvitation[]
	activeMemberships: VolunteerMembership[]
}

// Format volunteer role type for display
function formatRoleType(roleType: VolunteerRoleType): string {
	const roleMap: Record<VolunteerRoleType, string> = {
		judge: "Judge",
		head_judge: "Head Judge",
		scorekeeper: "Scorekeeper",
		emcee: "Emcee",
		floor_manager: "Floor Manager",
		media: "Media",
		general: "General",
		equipment: "Equipment",
		medical: "Medical",
		check_in: "Check-In",
		staff: "Staff",
	}
	return roleMap[roleType] || roleType
}

export function VolunteerStatus({
	pendingInvitations,
	activeMemberships,
}: VolunteerStatusProps) {
	return (
		<div className="space-y-6">
			{/* Pending Volunteer Signups */}
			{pendingInvitations.length > 0 && (
				<div className="space-y-3">
					<h3 className="flex items-center gap-2 font-medium text-sm">
						<Clock className="h-4 w-4 text-amber-600" />
						Pending Volunteer Signups
					</h3>
					<div className="space-y-2">
						{pendingInvitations.map((invitation) => (
							<div
								key={invitation.id}
								className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
							>
								<Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="font-medium text-sm truncate">
										{invitation.competitionName}
									</p>
									<p className="text-muted-foreground text-xs">
										Signed up {invitation.signupDate.toLocaleDateString()}
									</p>
								</div>
								<Badge
									variant="secondary"
									className="shrink-0 bg-amber-500/10 text-amber-700"
								>
									Pending Approval
								</Badge>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Active Volunteer Roles */}
			{activeMemberships.length > 0 && (
				<div className="space-y-3">
					<h3 className="flex items-center gap-2 font-medium text-sm">
						<CheckCircle2 className="h-4 w-4 text-green-600" />
						Active Volunteer Roles
					</h3>
					<div className="space-y-2">
						{activeMemberships.map((membership) => (
							<div
								key={membership.id}
								className="flex items-center gap-3 rounded-lg border p-3"
							>
								<div className="flex-1 min-w-0">
									<p className="font-medium text-sm truncate">
										{membership.competitionName}
									</p>
									<div className="mt-1 flex flex-wrap gap-1">
										{membership.roleTypes.map((roleType) => (
											<Badge
												key={roleType}
												variant="secondary"
												className="text-xs"
											>
												{formatRoleType(roleType)}
											</Badge>
										))}
									</div>
								</div>
								<Button
									asChild
									size="sm"
									variant="outline"
									className="shrink-0"
								>
									<Link
										href={`/compete/${membership.competitionSlug}/my-schedule`}
									>
										My Schedule
									</Link>
								</Button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
