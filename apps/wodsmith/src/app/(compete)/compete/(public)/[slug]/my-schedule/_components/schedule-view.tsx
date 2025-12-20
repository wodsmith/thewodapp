"use client"

import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import type { EventWithRotations } from "@/server/judge-schedule"
import { formatUTCDateRange } from "@/utils/date-utils"
import { EventSection } from "./event-section"
import { VolunteerProfileCard } from "./volunteer-profile-card"

interface ScheduleViewProps {
	events: EventWithRotations[]
	competitionName: string
	volunteerMetadata: VolunteerMembershipMetadata | null
	membershipId: string
	competitionSlug: string
	competitionStartDate: Date | null
	competitionEndDate: Date | null
}

/**
 * Client component that displays all judge rotations grouped by event
 */
export function ScheduleView({
	events,
	competitionName,
	volunteerMetadata,
	membershipId,
	competitionSlug,
	competitionStartDate,
	competitionEndDate,
}: ScheduleViewProps) {
	// Format date range for display
	const dateRangeText =
		competitionStartDate && competitionEndDate
			? formatUTCDateRange(competitionStartDate, competitionEndDate)
			: null

	// Empty state: Show volunteer info but indicate no assignments
	if (events.length === 0) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold mb-2">My Judging Schedule</h1>
					<p className="text-muted-foreground">
						{competitionName}
						{dateRangeText && ` • ${dateRangeText}`}
					</p>
				</div>

				{/* Volunteer Profile Card - still visible in empty state */}
				<VolunteerProfileCard
					metadata={volunteerMetadata}
					membershipId={membershipId}
					competitionSlug={competitionSlug}
				/>

				{/* Less prominent empty state message */}
				<div className="bg-muted/50 rounded-lg border border-dashed p-6 text-center">
					<p className="text-muted-foreground">
						No judging assignments yet. Check back after the organizer publishes
						the schedule.
					</p>
				</div>

				<div className="bg-muted rounded-lg border p-4 text-sm text-muted-foreground">
					<p className="font-semibold mb-1">Need help?</p>
					<p>
						If you have questions about your assignments, please contact the
						competition organizers.
					</p>
				</div>
			</div>
		)
	}

	// Normal state: Show header, profile, and assignments
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold mb-2">My Judging Schedule</h1>
				<p className="text-muted-foreground">
					{competitionName}
					{dateRangeText && ` • ${dateRangeText}`}
				</p>
			</div>

			{/* Volunteer Profile Card */}
			<VolunteerProfileCard
				metadata={volunteerMetadata}
				membershipId={membershipId}
				competitionSlug={competitionSlug}
			/>

			<div className="space-y-8">
				{events.map((event) => (
					<EventSection key={event.trackWorkoutId} event={event} />
				))}
			</div>

			<div className="bg-muted rounded-lg border p-4 text-sm text-muted-foreground">
				<p className="font-semibold mb-1">Need help?</p>
				<p>
					If you have questions about your assignments, please contact the
					competition organizers.
				</p>
			</div>
		</div>
	)
}
