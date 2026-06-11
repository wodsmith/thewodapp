import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { JudgeAssignmentVersion } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
  getJudgeSchedulingDataForEventsFn,
  getJudgeVolunteersFn,
} from "@/server-fns/judge-scheduling-fns"
import {
  getVolunteerAnswersFn,
  getVolunteerQuestionsFn,
} from "@/server-fns/registration-questions-fns"
import {
  getCompetitionVolunteersFn,
  getDirectVolunteerInvitesFn,
  getPendingVolunteerInvitationsFn,
  getScoreAccessMapFn,
  getVolunteerAssignmentsFn,
  getVolunteerWaiverStatusesFn,
} from "@/server-fns/volunteer-fns"
import { getCompetitionShiftsFn } from "@/server-fns/volunteer-shift-fns"
import { InvitedVolunteersList } from "./-components/invited-volunteers-list"
import { JudgeSchedulingContainer } from "./-components/judges"
import { ShiftList } from "./-components/shifts/shift-list"
import { VolunteersList } from "./-components/volunteers-list"

// Search params schema for tab navigation and event selection
const searchParamsSchema = z.object({
  tab: z
    .enum(["roster", "shifts", "schedule", "registration-rules"])
    .optional()
    .default("roster"),
  event: z.string().optional(),
})

/** Per-event defaults for judge rotations */
interface EventDefaults {
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: LaneShiftPattern | null
  minHeatBuffer: number | null
}

// @lat: [[organizer-dashboard#Volunteers]]
export const Route = createFileRoute(
  "/compete/organizer/$competitionId/volunteers",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    const competitionTeamId = competition.competitionTeamId

    // Parallel fetch: invitations, volunteers, events, direct invites, judges, shifts, assignments, volunteer questions, volunteer answers, heats
    const [
      invitations,
      volunteers,
      eventsResult,
      directInvites,
      judges,
      shifts,
      volunteerAssignments,
      volunteerQuestionsResult,
      volunteerAnswersResult,
      volunteerWaiverStatus,
      heatsResult,
    ] = await Promise.all([
      getPendingVolunteerInvitationsFn({
        data: { competitionTeamId },
      }),
      getCompetitionVolunteersFn({
        data: { competitionTeamId },
      }),
      getCompetitionWorkoutsFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
      getDirectVolunteerInvitesFn({
        data: { competitionTeamId },
      }),
      getJudgeVolunteersFn({
        data: { competitionTeamId },
      }),
      getCompetitionShiftsFn({
        data: { competitionId: competition.id },
      }),
      getVolunteerAssignmentsFn({
        data: { competitionId: competition.id },
      }),
      getVolunteerQuestionsFn({
        data: { competitionId: competition.id },
      }),
      getVolunteerAnswersFn({
        data: {
          competitionTeamId,
          organizingTeamId: competition.organizingTeamId,
        },
      }),
      getVolunteerWaiverStatusesFn({
        data: {
          competitionId: competition.id,
          competitionTeamId,
          organizingTeamId: competition.organizingTeamId,
        },
      }),
      getHeatsForCompetitionFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
    ])
    const volunteerQuestions = volunteerQuestionsResult.questions
    const { answersByInvitation, emailToInvitationId } = volunteerAnswersResult

    const events = eventsResult.workouts
    const heats = heatsResult.heats

    // Batched second stage: score access for all volunteers + judge
    // scheduling data for all events, each a constant number of queries.
    const [scoreAccessMap, judgeSchedulingData] = await Promise.all([
      getScoreAccessMapFn({
        data: {
          userIds: volunteers
            .map((volunteer) => volunteer.user?.id)
            .filter((id): id is string => Boolean(id)),
          competitionTeamId,
        },
      }),
      getJudgeSchedulingDataForEventsFn({
        data: { trackWorkoutIds: events.map((event) => event.id) },
      }),
    ])

    const volunteersWithAccess = volunteers.map((volunteer) => ({
      ...volunteer,
      hasScoreAccess: volunteer.user
        ? (scoreAccessMap[volunteer.user.id] ?? false)
        : false,
    }))

    const judgeAssignments = judgeSchedulingData.judgeAssignments
    const rotations = events.flatMap(
      (event) => judgeSchedulingData.rotationsByEvent[event.id] ?? [],
    )
    // Build event defaults map for each event (cast to EventDefaults for type safety)
    const eventDefaultsMap = new Map<string, EventDefaults>()
    const versionHistoryMap = new Map<string, JudgeAssignmentVersion[]>()
    const activeVersionMap = new Map<string, JudgeAssignmentVersion | null>()
    for (const event of events) {
      const defaults = judgeSchedulingData.eventDefaultsByEvent[event.id]
      eventDefaultsMap.set(event.id, {
        defaultHeatsCount: defaults?.defaultHeatsCount ?? null,
        defaultLaneShiftPattern:
          (defaults?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
        minHeatBuffer: defaults?.minHeatBuffer ?? null,
      })
      versionHistoryMap.set(
        event.id,
        judgeSchedulingData.versionHistoryByEvent[event.id] ?? [],
      )
      activeVersionMap.set(
        event.id,
        judgeSchedulingData.activeVersionByEvent[event.id] ?? null,
      )
    }

    // Filter pending direct invites for conditional rendering
    const pendingDirectInvites = directInvites.filter(
      (i) => i.status === "pending",
    )

    return {
      competition,
      competitionTeamId,
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
    }
  },
  component: VolunteersPage,
})

function VolunteersPage() {
  const {
    competition,
    competitionTeamId,
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
  } = Route.useLoaderData()

  const { tab, event: eventFromUrl } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()

  const handleTabChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        tab: value as "roster" | "shifts" | "schedule" | "registration-rules",
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
              <SelectItem value="schedule">Judge assignments</SelectItem>
            )}
            <SelectItem value="registration-rules">Signup questions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Tabs */}
      <TabsList className="mb-6 hidden sm:inline-flex">
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="shifts">Shifts</TabsTrigger>
        {isInPerson && (
          <TabsTrigger value="schedule">Judge assignments</TabsTrigger>
        )}
        <TabsTrigger value="registration-rules">Signup questions</TabsTrigger>
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
          />
        </section>
      </TabsContent>

      {/* Shifts Tab */}
      <TabsContent value="shifts" className="mt-6">
        <ShiftList
          competitionId={competition.id}
          competitionTeamId={competitionTeamId}
          shifts={shifts}
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
          />
        </TabsContent>
      )}

      {/* Signup questions tab */}
      <TabsContent value="registration-rules">
        <RegistrationQuestionsEditor
          entityType="competition"
          entityId={competition.id}
          teamId={competition.organizingTeamId}
          questions={volunteerQuestions}
          onQuestionsChange={handleQuestionsChange}
          questionTarget="volunteer"
        />
      </TabsContent>
    </Tabs>
  )
}
