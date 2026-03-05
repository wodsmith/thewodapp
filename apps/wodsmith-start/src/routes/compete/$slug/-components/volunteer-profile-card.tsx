"use client"

import { ChevronDown, ChevronUp, Edit2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { EditVolunteerDialog } from "./edit-volunteer-dialog"

interface VolunteerProfileCardProps {
	metadata: VolunteerMembershipMetadata | null
	membershipId: string
	competitionSlug: string
}

/**
 * Format role type for display
 */
function formatRoleType(role: string): string {
	const roleLabels: Record<string, string> = {
		judge: "Judge",
		head_judge: "Head Judge",
		scorekeeper: "Scorekeeper",
		emcee: "Emcee",
		floor_manager: "Floor Manager",
		media: "Media",
		general: "General",
		equipment: "Equipment",
		medical: "Medical",
		check_in: "Check-in",
		staff: "Staff",
		athlete_control: "Athlete Control",
		equipment_team: "Equipment Team",
	}
	return roleLabels[role] || role
}

/**
 * Display volunteer profile info with edit capability
 * Shows roles, availability, credentials, notes
 */
export function VolunteerProfileCard({
	metadata,
	membershipId,
	competitionSlug,
}: VolunteerProfileCardProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	const volunteerRoles = metadata?.volunteerRoleTypes || []
	const availability = metadata?.availability
	const credentials = metadata?.credentials
	const availabilityNotes = metadata?.availabilityNotes

	// Format availability display
	const availabilityLabel = availability
		? availability === VOLUNTEER_AVAILABILITY.MORNING
			? "Morning"
			: availability === VOLUNTEER_AVAILABILITY.AFTERNOON
				? "Afternoon"
				: "All Day"
		: "Not set"

	const availabilityVariant =
		availability === VOLUNTEER_AVAILABILITY.ALL_DAY ? "default" : "secondary"

	return (
		<>
			<Card className="bg-muted/30 border-muted">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-lg font-medium">
							My Volunteer Info
						</CardTitle>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsDialogOpen(true)}
							>
								<Edit2 className="h-3.5 w-3.5 mr-1.5" />
								Edit
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-3 pt-0">
					{/* Always show roles and availability */}
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						{/* Volunteer Roles */}
						{volunteerRoles.length > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground">Role:</span>
								<div className="flex flex-wrap gap-1">
									{volunteerRoles.map((role) => (
										<Badge key={role} variant="outline">
											{formatRoleType(role)}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Availability */}
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">
								Availability:
							</span>
							<Badge variant={availabilityVariant}>{availabilityLabel}</Badge>
						</div>
					</div>

					{/* Expandable section */}
					{isExpanded && (
						<div className="space-y-3 pt-2 border-t">
							{credentials && (
								<div>
									<p className="text-sm font-medium mb-1">Credentials</p>
									<p className="text-sm text-muted-foreground">{credentials}</p>
								</div>
							)}

							{availabilityNotes && (
								<div>
									<p className="text-sm font-medium mb-1">Additional Notes</p>
									<p className="text-sm text-muted-foreground line-clamp-3">
										{availabilityNotes}
									</p>
								</div>
							)}

							{!credentials && !availabilityNotes && (
								<p className="text-sm text-muted-foreground italic">
									No additional information. Click Edit to add details.
								</p>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			<EditVolunteerDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				metadata={metadata}
				membershipId={membershipId}
				competitionSlug={competitionSlug}
			/>
		</>
	)
}
