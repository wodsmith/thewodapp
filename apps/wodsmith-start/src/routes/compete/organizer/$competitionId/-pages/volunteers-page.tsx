/**
 * Competition Volunteers Page
 *
 * Shared page body for the organizer and cohost volunteers routes. The
 * organizer route renders it with defaults (organizer server fns) and the
 * organizer-only waiver status column data; the cohost route injects
 * cohost-permissioned callback bundles for the roster, shifts, judge
 * scheduling, and signup-question editing.
 */

import { useNavigate, useRouter } from "@tanstack/react-router"
import type { ComponentProps } from "react"
import { useEffect } from "react"
import type { RegistrationQuestionsOverrides } from "@/components/competition-settings/registration-questions-editor"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvitedVolunteersList } from "../-components/invited-volunteers-list"
import type { JudgeSchedulingOverrides } from "../-components/judges"
import { JudgeSchedulingContainer } from "../-components/judges"
import { ShiftList } from "../-components/shifts/shift-list"
import { VolunteersList } from "../-components/volunteers-list"

type VolunteersListProps = ComponentProps<typeof VolunteersList>
type ShiftListProps = ComponentProps<typeof ShiftList>
type JudgeSchedulingProps = ComponentProps<typeof JudgeSchedulingContainer>

export type VolunteersPageTab =
  | "roster"
  | "shifts"
  | "schedule"
  | "registration-rules"

/** Roster mutation callbacks; cohost routes inject cohost server fns. */
export type VolunteersListCallbacks = Pick<
  VolunteersListProps,
  | "onBulkAssignRole"
  | "onInviteVolunteer"
  | "onAddRoleType"
  | "onRemoveRoleType"
  | "onUpdateMetadata"
  | "onGrantScoreAccess"
  | "onRevokeScoreAccess"
>

/** Shift CRUD/assignment callbacks; cohost routes inject cohost server fns. */
export type ShiftListCallbacks = Pick<
  ShiftListProps,
  | "onDeleteShift"
  | "onCreateShift"
  | "onUpdateShift"
  | "onGetVolunteers"
  | "onAssignVolunteer"
  | "onUnassignVolunteer"
>

interface VolunteersPageProps {
  competition: {
    id: string
    slug: string
    organizingTeamId: string
    competitionType: JudgeSchedulingProps["competitionType"]
    defaultHeatsPerRotation: number | null
    defaultLaneShiftPattern: string | null
  }
  competitionTeamId: string
  /** Active tab from the route's `tab` search param. */
  tab: VolunteersPageTab
  /** Selected event id from the route's `event` search param. */
  eventFromUrl?: string
  invitations: VolunteersListProps["invitations"]
  volunteersWithAccess: VolunteersListProps["volunteers"]
  events: JudgeSchedulingProps["events"]
  pendingDirectInvites: ComponentProps<typeof InvitedVolunteersList>["invites"]
  judges: JudgeSchedulingProps["judges"]
  heats: JudgeSchedulingProps["heats"]
  judgeAssignments: JudgeSchedulingProps["judgeAssignments"]
  rotations: JudgeSchedulingProps["rotations"]
  eventDefaultsMap: JudgeSchedulingProps["eventDefaultsMap"]
  versionHistoryMap: JudgeSchedulingProps["versionHistoryMap"]
  activeVersionMap: JudgeSchedulingProps["activeVersionMap"]
  shifts: ShiftListProps["shifts"]
  volunteerAssignments: VolunteersListProps["volunteerAssignments"]
  volunteerQuestions: VolunteersListProps["volunteerQuestions"]
  answersByInvitation: VolunteersListProps["answersByInvitation"]
  emailToInvitationId: VolunteersListProps["emailToInvitationId"]
  /** Organizer-only; cohost loaders cannot fetch waiver statuses, hiding the waiver columns. */
  volunteerWaiverStatus?: VolunteersListProps["volunteerWaiverStatus"]
  /** Team id handed to the signup questions editor. Defaults to the organizing team; cohosts pass competitionTeamId alongside questionOverrides. */
  questionsTeamId?: string
  /** Cohost routes inject cohost-permissioned roster mutations. */
  volunteersListCallbacks?: VolunteersListCallbacks
  /** Cohost routes inject cohost-permissioned shift mutations. */
  shiftListCallbacks?: ShiftListCallbacks
  /** Cohost routes inject cohost-permissioned question CRUD. */
  questionOverrides?: RegistrationQuestionsOverrides
  /** Cohost routes inject cohost-permissioned judge rotation mutations. */
  judgeSchedulingOverrides?: JudgeSchedulingOverrides
}

export function VolunteersPage({
  competition,
  competitionTeamId,
  tab,
  eventFromUrl,
  invitations,
  volunteersWithAccess,
  events,
  pendingDirectInvites,
  judges,
  heats,
  judgeAssignments,
  rotations,
  eventDefaultsMap,
  versionHistoryMap,
  activeVersionMap,
  shifts,
  volunteerAssignments,
  volunteerQuestions,
  answersByInvitation,
  emailToInvitationId,
  volunteerWaiverStatus,
  questionsTeamId,
  volunteersListCallbacks,
  shiftListCallbacks,
  questionOverrides,
  judgeSchedulingOverrides,
}: VolunteersPageProps) {
  const navigate = useNavigate()
  const router = useRouter()

  const handleTabChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        tab: value as VolunteersPageTab,
      }),
      replace: true,
    })
  }

  const handleEventChange = (eventId: string) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, event: eventId }),
      replace: true,
    })
  }

  // Determine selected event - from URL or first event
  // Validate eventFromUrl exists in events before using it
  const selectedEventId =
    eventFromUrl && events.some((event) => event.id === eventFromUrl)
      ? eventFromUrl
      : events[0]?.id || ""

  // Check if schedule tab should be available (in-person competitions only)
  const isInPerson = competition.competitionType === "in-person"

  // Derive effective tab - fall back to roster if schedule isn't allowed
  const effectiveTab = !isInPerson && tab === "schedule" ? "roster" : tab

  // Sync URL/state when competition type changes and schedule tab is no longer valid
  useEffect(() => {
    if (!isInPerson && tab === "schedule") {
      navigate({
        to: ".",
        search: { tab: "roster" },
        replace: true,
      })
    }
  }, [isInPerson, tab, navigate])

  const handleQuestionsChange = () => {
    router.invalidate()
  }

  return (
    <Tabs
      value={effectiveTab}
      onValueChange={handleTabChange}
      className="w-full"
    >
      {/* Mobile: Select dropdown */}
      <div className="mb-6 sm:hidden">
        <Select value={effectiveTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roster">Roster</SelectItem>
            <SelectItem value="shifts">Shifts</SelectItem>
            {isInPerson && (
              <SelectItem value="schedule">Judge Schedule</SelectItem>
            )}
            <SelectItem value="registration-rules">Signup Questions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Tabs */}
      <TabsList className="mb-6 hidden sm:inline-flex">
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="shifts">Shifts</TabsTrigger>
        {isInPerson && (
          <TabsTrigger value="schedule">Judge Schedule</TabsTrigger>
        )}
        <TabsTrigger value="registration-rules">Signup Questions</TabsTrigger>
      </TabsList>

      {/* Roster Tab - Volunteer Management */}
      <TabsContent value="roster" className="flex flex-col gap-8">
        {/* Invited Volunteers Section - Only show if there are pending direct invites */}
        {pendingDirectInvites.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Invited Volunteers</h2>
              <p className="text-sm text-muted-foreground">
                {pendingDirectInvites.length} pending{" "}
                {pendingDirectInvites.length === 1 ? "invite" : "invites"}
              </p>
            </div>
            <InvitedVolunteersList invites={pendingDirectInvites} />
          </section>
        )}

        {/* Volunteers Section */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Volunteers</h2>
            <p className="text-sm text-muted-foreground">
              {invitations.length + volunteersWithAccess.length} total (
              {invitations.length} application
              {invitations.length === 1 ? "" : "s"},{" "}
              {volunteersWithAccess.length} approved)
            </p>
          </div>

          <VolunteersList
            competitionId={competition.id}
            competitionSlug={competition.slug}
            competitionTeamId={competitionTeamId}
            organizingTeamId={competition.organizingTeamId}
            invitations={invitations}
            volunteers={volunteersWithAccess}
            volunteerAssignments={volunteerAssignments}
            volunteerQuestions={volunteerQuestions}
            answersByInvitation={answersByInvitation}
            emailToInvitationId={emailToInvitationId}
            volunteerWaiverStatus={volunteerWaiverStatus}
            {...volunteersListCallbacks}
          />
        </section>
      </TabsContent>

      {/* Shifts Tab */}
      <TabsContent value="shifts" className="mt-6">
        <ShiftList
          competitionId={competition.id}
          competitionTeamId={competitionTeamId}
          shifts={shifts}
          {...shiftListCallbacks}
        />
      </TabsContent>

      {/* Schedule Tab - Judge Scheduling & Rotations (in-person only) */}
      {isInPerson && (
        <TabsContent value="schedule">
          <JudgeSchedulingContainer
            competitionId={competition.id}
            competitionSlug={competition.slug}
            organizingTeamId={competition.organizingTeamId}
            competitionType={competition.competitionType}
            events={events}
            heats={heats}
            judges={judges}
            judgeAssignments={judgeAssignments}
            rotations={rotations}
            eventDefaultsMap={eventDefaultsMap}
            versionHistoryMap={versionHistoryMap}
            activeVersionMap={activeVersionMap}
            competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
            competitionDefaultPattern={
              (competition.defaultLaneShiftPattern as "stay" | "shift_right") ??
              "shift_right"
            }
            selectedEventId={selectedEventId}
            onEventChange={handleEventChange}
            overrides={judgeSchedulingOverrides}
          />
        </TabsContent>
      )}

      {/* Signup Questions Tab */}
      <TabsContent value="registration-rules">
        <RegistrationQuestionsEditor
          entityType="competition"
          entityId={competition.id}
          teamId={questionsTeamId ?? competition.organizingTeamId}
          questions={volunteerQuestions}
          onQuestionsChange={handleQuestionsChange}
          questionTarget="volunteer"
          overrides={questionOverrides}
        />
      </TabsContent>
    </Tabs>
  )
}
