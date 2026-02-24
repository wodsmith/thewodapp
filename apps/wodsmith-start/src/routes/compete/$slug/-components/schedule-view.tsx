"use client"

import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import type {
	EventWithRotations,
	VolunteerShiftData,
} from "@/server-fns/volunteer-schedule-fns"
import { formatUTCDateRange } from "@/utils/date-utils"
import { EventSection } from "./event-section"
import { ShiftCard } from "./shift-card"
import { VolunteerProfileCard } from "./volunteer-profile-card"

interface ScheduleViewProps {
	events: EventWithRotations[]
	shifts: VolunteerShiftData[]
	competitionName: string
	volunteerMetadata: VolunteerMembershipMetadata | null
	membershipId: string
	competitionSlug: string
	competitionStartDate: string | null // YYYY-MM-DD format
	competitionEndDate: string | null // YYYY-MM-DD format
}

/**
 * Check if volunteer has a judge role
 */
function hasJudgeRole(metadata: VolunteerMembershipMetadata | null): boolean {
	if (!metadata?.volunteerRoleTypes) return false
	return metadata.volunteerRoleTypes.some((role) =>
		["judge", "head_judge"].includes(role),
	)
}

/**
 * Client component that displays volunteer schedule
 * Shows judging assignments only for volunteers with judge roles
 * Shows shifts for all volunteers who have shift assignments
 */
export function ScheduleView({
	events,
	shifts,
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

	const isJudge = hasJudgeRole(volunteerMetadata)
	const hasShifts = shifts.length > 0
	const hasEvents = events.length > 0

	// Show "My Judging Schedule" only if judge with events and no shifts
	// Otherwise show "My Volunteer Schedule" when shifts exist or generic volunteer
	const pageTitle =
		isJudge && hasEvents && !hasShifts
			? "My Judging Schedule"
			: "My Volunteer Schedule"

	// No assignments at all - show empty state
	if (!hasEvents && !hasShifts) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
					<p className="text-muted-foreground">
						{competitionName}
						{dateRangeText && ` • ${dateRangeText}`}
					</p>
				</div>

				{/* Volunteer Profile Card - always visible */}
				<VolunteerProfileCard
					metadata={volunteerMetadata}
					membershipId={membershipId}
					competitionSlug={competitionSlug}
				/>

				{/* Show appropriate empty message based on role */}
				{isJudge ? (
					<div className="bg-muted/50 rounded-lg border border-dashed p-6 text-center">
						<p className="text-muted-foreground">
							No judging assignments yet. Check back after the organizer
							publishes the schedule.
						</p>
					</div>
				) : (
					<div className="bg-muted/50 rounded-lg border border-dashed p-6 text-center">
						<p className="text-muted-foreground">
							Thank you for volunteering! The organizer will reach out with
							details about your role.
						</p>
					</div>
				)}

				<div className="bg-muted rounded-lg border p-4 text-sm text-muted-foreground">
					<p className="font-semibold mb-1">Need help?</p>
					<p>
						If you have questions, please contact the competition organizers.
					</p>
				</div>
			</div>
		)
	}

	// Has assignments - show them
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
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

			{/* My Shifts Section */}
			<div className="space-y-4">
				<h2 className="text-xl font-semibold">My Shifts</h2>
				{hasShifts ? (
					<div className="space-y-3">
						{shifts.map((shift) => (
							<ShiftCard key={shift.id} shift={shift} />
						))}
					</div>
				) : (
					<div className="bg-muted/50 rounded-lg border border-dashed p-6 text-center">
						<p className="text-muted-foreground">No shifts assigned yet</p>
					</div>
				)}
			</div>

			{/* Events/Judging Section */}
			{hasEvents && (
				<div className="space-y-8">
					{events.map((event) => (
						<EventSection key={event.trackWorkoutId} event={event} />
					))}
				</div>
			)}

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
