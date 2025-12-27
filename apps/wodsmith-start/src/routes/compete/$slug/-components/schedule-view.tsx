'use client'

import type {VolunteerMembershipMetadata} from '@/db/schemas/volunteers'
import type {EventWithRotations} from '@/server-fns/volunteer-schedule-fns'
import {formatUTCDateRange} from '@/utils/date-utils'
import {EventSection} from './event-section'
import {VolunteerProfileCard} from './volunteer-profile-card'

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
 * Check if volunteer has a judge role
 */
function hasJudgeRole(metadata: VolunteerMembershipMetadata | null): boolean {
  if (!metadata?.volunteerRoleTypes) return false
  return metadata.volunteerRoleTypes.some((role) =>
    ['judge', 'head_judge'].includes(role),
  )
}

/**
 * Client component that displays volunteer schedule
 * Shows judging assignments only for volunteers with judge roles
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

  const isJudge = hasJudgeRole(volunteerMetadata)
  const pageTitle = isJudge ? 'My Judging Schedule' : 'My Volunteer Schedule'

  // No judging assignments (or not a judge)
  if (events.length === 0) {
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

  // Has judging assignments - show them
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
