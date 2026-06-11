import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
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
import { VolunteersPage } from "./-pages/volunteers-page"

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
  component: RouteComponent,
})

function RouteComponent() {
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

  const { tab, event } = Route.useSearch()

  return (
    <VolunteersPage
      competition={competition}
      competitionTeamId={competitionTeamId}
      tab={tab}
      eventFromUrl={event}
      invitations={invitations}
      volunteersWithAccess={volunteersWithAccess}
      events={events}
      pendingDirectInvites={pendingDirectInvites}
      judges={judges}
      heats={heats}
      judgeAssignments={judgeAssignments}
      rotations={rotations}
      eventDefaultsMap={eventDefaultsMap}
      versionHistoryMap={versionHistoryMap}
      activeVersionMap={activeVersionMap}
      shifts={shifts}
      volunteerAssignments={volunteerAssignments}
      volunteerQuestions={volunteerQuestions}
      answersByInvitation={answersByInvitation}
      emailToInvitationId={emailToInvitationId}
      volunteerWaiverStatus={volunteerWaiverStatus}
    />
  )
}
