/**
 * Cohost Competition Volunteers Route
 *
 * Renders the shared organizer VolunteersPage with cohost-permissioned
 * callback bundles so the page stays in sync with the organizer route.
 * Cohosts CAN manage volunteers (invite, assign roles, schedule judges).
 */

import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import type { RegistrationQuestionsOverrides } from "@/components/competition-settings/registration-questions-editor"
import type { JudgeAssignmentVersion } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import {
  cohostAdjustRotationsForOccupiedLanesFn,
  cohostBatchCreateRotationsFn,
  cohostBatchDeleteRotationsFn,
  cohostBatchUpdateVolunteerRotationsFn,
  cohostCreateJudgeRotationFn,
  cohostDeleteJudgeRotationFn,
  cohostDeleteVolunteerRotationsFn,
  cohostPublishRotationsFn,
  cohostRollbackToVersionFn,
  cohostUpdateEventDefaultsFn,
  cohostUpdateJudgeRotationFn,
} from "@/server-fns/cohost/cohost-judge-rotation-fns"
import {
  cohostCreateQuestionFn,
  cohostDeleteQuestionFn,
  cohostReorderQuestionsFn,
  cohostUpdateQuestionFn,
} from "@/server-fns/cohost/cohost-registration-questions-fns"
import { cohostGetHeatsForCompetitionFn } from "@/server-fns/cohost/cohost-schedule-fns"
import {
  cohostAddVolunteerRoleTypeFn,
  cohostAssignVolunteerToShiftFn,
  cohostBulkAssignVolunteerRoleFn,
  cohostCreateShiftFn,
  cohostDeleteShiftFn,
  cohostGetCompetitionShiftsFn,
  cohostGetCompetitionVolunteersFn,
  cohostGetDirectVolunteerInvitesFn,
  cohostGetPendingVolunteerInvitationsFn,
  cohostGetVolunteerAssignmentsFn,
  cohostGrantScoreAccessFn,
  cohostInviteVolunteerFn,
  cohostRemoveVolunteerRoleTypeFn,
  cohostRevokeScoreAccessFn,
  cohostUnassignVolunteerFromShiftFn,
  cohostUpdateShiftFn,
  cohostUpdateVolunteerMetadataFn,
} from "@/server-fns/cohost/cohost-volunteer-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"
import {
  getActiveVersionFn,
  getVersionHistoryFn,
} from "@/server-fns/judge-assignment-fns"
import {
  getJudgeHeatAssignmentsFn,
  getJudgeVolunteersFn,
  getRotationsForEventFn,
} from "@/server-fns/judge-scheduling-fns"
import {
  getVolunteerAnswersFn,
  getVolunteerQuestionsFn,
} from "@/server-fns/registration-questions-fns"
import { canInputScoresFn } from "@/server-fns/volunteer-fns"
import type { JudgeSchedulingOverrides } from "../../organizer/$competitionId/-components/judges"
import type {
  ShiftListCallbacks,
  VolunteersListCallbacks,
} from "../../organizer/$competitionId/-pages/volunteers-page"
import { VolunteersPage } from "../../organizer/$competitionId/-pages/volunteers-page"

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

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/volunteers",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    const competitionTeamId = competition.competitionTeamId

    // Parallel fetch: invitations, volunteers, events, direct invites, judges, shifts, assignments, volunteer questions, volunteer answers
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
    ] = await Promise.all([
      cohostGetPendingVolunteerInvitationsFn({
        data: { competitionTeamId },
      }).catch(() => []),
      cohostGetCompetitionVolunteersFn({
        data: { competitionTeamId },
      }).catch(() => []),
      cohostGetWorkoutsFn({
        data: {
          competitionId: competition.id,
          competitionTeamId,
        },
      }).catch(() => ({ workouts: [] })),
      cohostGetDirectVolunteerInvitesFn({
        data: { competitionTeamId },
      }).catch(() => []),
      getJudgeVolunteersFn({
        data: { competitionTeamId },
      }).catch(() => []),
      cohostGetCompetitionShiftsFn({
        data: { competitionTeamId, competitionId: competition.id },
      }).catch(() => []),
      cohostGetVolunteerAssignmentsFn({
        data: { competitionTeamId, competitionId: competition.id },
      }).catch(
        () =>
          ({}) as Awaited<ReturnType<typeof cohostGetVolunteerAssignmentsFn>>,
      ),
      getVolunteerQuestionsFn({
        data: { competitionId: competition.id },
      }).catch(() => ({ questions: [] })),
      getVolunteerAnswersFn({
        data: {
          competitionTeamId,
          organizingTeamId: competition.organizingTeamId,
        },
      }).catch(() => ({
        answersByInvitation: {} as Record<
          string,
          Array<{ id: string; questionId: string; answer: string }>
        >,
        emailToInvitationId: {} as Record<string, string>,
      })),
    ])
    const volunteerQuestions = volunteerQuestionsResult.questions
    const { answersByInvitation, emailToInvitationId } = volunteerAnswersResult

    const events = eventsResult.workouts

    // For each volunteer, check if they have score access
    const volunteersWithAccess = await Promise.all(
      volunteers.map(async (volunteer) => {
        const hasScoreAccess = volunteer.user
          ? await canInputScoresFn({
              data: {
                userId: volunteer.user.id,
                competitionTeamId,
              },
            }).catch(() => false)
          : false

        return {
          ...volunteer,
          hasScoreAccess,
        }
      }),
    )

    // Get heats for all events
    const heatsResult = await cohostGetHeatsForCompetitionFn({
      data: {
        competitionTeamId,
        competitionId: competition.id,
      },
    }).catch(() => ({ heats: [] }))
    const heats = heatsResult.heats

    // Get judge assignments, rotations, and version data for all events
    const [
      allAssignments,
      allRotationResults,
      allVersionHistory,
      allActiveVersions,
    ] = await Promise.all([
      Promise.all(
        events.map((event) =>
          getJudgeHeatAssignmentsFn({
            data: { trackWorkoutId: event.id },
          }).catch(() => []),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getRotationsForEventFn({ data: { trackWorkoutId: event.id } }).catch(
            () => ({ rotations: [], eventDefaults: null }),
          ),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getVersionHistoryFn({ data: { trackWorkoutId: event.id } }).catch(
            () => [],
          ),
        ),
      ),
      Promise.all(
        events.map((event) =>
          getActiveVersionFn({ data: { trackWorkoutId: event.id } }).catch(
            () => null,
          ),
        ),
      ),
    ])

    const judgeAssignments = allAssignments.flat()
    // Extract rotations from the new { rotations, eventDefaults } return type
    const rotations = allRotationResults.flatMap((result) => result.rotations)
    // Build event defaults map for each event (cast to EventDefaults for type safety)
    const eventDefaultsMap = new Map<string, EventDefaults>()
    for (const [index, event] of events.entries()) {
      const result = allRotationResults[index]
      eventDefaultsMap.set(event.id, {
        defaultHeatsCount: result?.eventDefaults?.defaultHeatsCount ?? null,
        defaultLaneShiftPattern:
          (result?.eventDefaults
            ?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
        minHeatBuffer: result?.eventDefaults?.minHeatBuffer ?? null,
      })
    }
    // Build version history map for each event
    const versionHistoryMap = new Map<string, JudgeAssignmentVersion[]>()
    for (const [index, event] of events.entries()) {
      versionHistoryMap.set(event.id, allVersionHistory[index] ?? [])
    }
    // Build active version map for each event
    const activeVersionMap = new Map<string, JudgeAssignmentVersion | null>()
    for (const [index, event] of events.entries()) {
      activeVersionMap.set(event.id, allActiveVersions[index] ?? null)
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
  } = Route.useLoaderData()

  const { tab, event } = Route.useSearch()

  // Wrap cohost question fns so they match the callback shape the editor expects
  const questionOverrides: RegistrationQuestionsOverrides = {
    createQuestion: ({ data }) =>
      cohostCreateQuestionFn({
        data: {
          competitionTeamId,
          competitionId: data.competitionId,
          type: data.type,
          label: data.label,
          helpText: data.helpText,
          options: data.options,
          required: data.required,
          forTeammates: data.forTeammates,
          questionTarget: data.questionTarget,
        },
      }),
    updateQuestion: ({ data }) =>
      cohostUpdateQuestionFn({
        data: {
          competitionTeamId,
          questionId: data.questionId,
          type: data.type,
          label: data.label,
          helpText: data.helpText,
          options: data.options,
          required: data.required,
          forTeammates: data.forTeammates,
        },
      }),
    deleteQuestion: ({ data }) =>
      cohostDeleteQuestionFn({
        data: {
          competitionTeamId,
          questionId: data.questionId,
        },
      }),
    reorderQuestions: ({ data }) =>
      cohostReorderQuestionsFn({
        data: {
          competitionTeamId,
          competitionId: data.competitionId,
          orderedQuestionIds: data.orderedQuestionIds,
        },
      }),
  }

  // Wrap cohost judge rotation fns for JudgeSchedulingContainer
  const judgeSchedulingOverrides: JudgeSchedulingOverrides = {
    rollbackToVersion: (args) =>
      cohostRollbackToVersionFn({
        data: { ...args.data, competitionTeamId },
      }),
    createJudgeRotation: (args) =>
      cohostCreateJudgeRotationFn({
        data: { ...args.data, competitionTeamId },
      }),
    updateJudgeRotation: (args) =>
      cohostUpdateJudgeRotationFn({
        data: { ...args.data, competitionTeamId },
      }),
    deleteJudgeRotation: (args) =>
      cohostDeleteJudgeRotationFn({
        data: { ...args.data, competitionTeamId },
      }),
    updateEventDefaults: (args) =>
      cohostUpdateEventDefaultsFn({
        data: { ...args.data, competitionTeamId },
      }),
    batchCreateRotations: (args) =>
      cohostBatchCreateRotationsFn({
        data: { ...args.data, competitionTeamId },
      }),
    deleteVolunteerRotations: (args) =>
      cohostDeleteVolunteerRotationsFn({
        data: { ...args.data, competitionTeamId },
      }),
    batchDeleteRotations: (args) =>
      cohostBatchDeleteRotationsFn({
        data: { ...args.data, competitionTeamId },
      }),
    batchUpdateVolunteerRotations: (args) =>
      cohostBatchUpdateVolunteerRotationsFn({
        data: { ...args.data, competitionTeamId },
      }),
    publishRotations: (args) =>
      cohostPublishRotationsFn({
        data: { ...args.data, competitionTeamId },
      }),
    adjustRotationsForOccupiedLanes: (args) =>
      cohostAdjustRotationsForOccupiedLanesFn({
        data: { ...args.data, competitionTeamId },
      }),
  }

  // Wrap cohost roster fns for VolunteersList
  const volunteersListCallbacks: VolunteersListCallbacks = {
    onBulkAssignRole: async ({
      membershipIds,
      competitionId: compId,
      roleType,
    }) => {
      const result = await cohostBulkAssignVolunteerRoleFn({
        data: {
          membershipIds,
          competitionTeamId,
          competitionId: compId,
          roleType,
        },
      })
      return { succeeded: result.succeeded, failed: result.failed }
    },
    onInviteVolunteer: async ({
      name,
      email,
      competitionTeamId: ctId,
      competitionId: compId,
      roleTypes,
    }) => {
      await cohostInviteVolunteerFn({
        data: {
          name,
          email,
          competitionTeamId: ctId,
          competitionId: compId,
          roleTypes,
        },
      })
      return { success: true }
    },
    onAddRoleType: async ({
      membershipId,
      competitionId: compId,
      roleType,
    }) => {
      await cohostAddVolunteerRoleTypeFn({
        data: {
          membershipId,
          competitionTeamId,
          competitionId: compId,
          roleType,
        },
      })
      return { success: true }
    },
    onRemoveRoleType: async ({
      membershipId,
      competitionId: compId,
      roleType,
    }) => {
      await cohostRemoveVolunteerRoleTypeFn({
        data: {
          membershipId,
          competitionTeamId,
          competitionId: compId,
          roleType,
        },
      })
      return { success: true }
    },
    onUpdateMetadata: async ({
      membershipId,
      competitionId: compId,
      metadata,
    }) => {
      await cohostUpdateVolunteerMetadataFn({
        data: {
          membershipId,
          competitionTeamId,
          competitionId: compId,
          metadata,
        },
      })
      return { success: true }
    },
    onGrantScoreAccess: async ({
      volunteerId,
      competitionTeamId: ctId,
      competitionId: compId,
      grantedBy,
    }) => {
      await cohostGrantScoreAccessFn({
        data: {
          volunteerId,
          competitionTeamId: ctId,
          competitionId: compId,
          grantedBy,
        },
      })
      return { success: true }
    },
    onRevokeScoreAccess: async ({
      userId,
      competitionTeamId: ctId,
      competitionId: compId,
    }) => {
      await cohostRevokeScoreAccessFn({
        data: { userId, competitionTeamId: ctId, competitionId: compId },
      })
      return { success: true }
    },
  }

  // Wrap cohost shift fns for ShiftList
  const shiftListCallbacks: ShiftListCallbacks = {
    onDeleteShift: async ({ shiftId }) => {
      await cohostDeleteShiftFn({
        data: { competitionTeamId, shiftId },
      })
      return { success: true }
    },
    onCreateShift: async (params) => {
      return cohostCreateShiftFn({
        data: { competitionTeamId, ...params },
      })
    },
    onUpdateShift: async (params) => {
      return cohostUpdateShiftFn({
        data: { competitionTeamId, ...params },
      })
    },
    onGetVolunteers: async ({ competitionTeamId: ctId }) => {
      return cohostGetCompetitionVolunteersFn({
        data: { competitionTeamId: ctId },
      })
    },
    onAssignVolunteer: async ({ shiftId, membershipId }) => {
      return cohostAssignVolunteerToShiftFn({
        data: { competitionTeamId, shiftId, membershipId },
      })
    },
    onUnassignVolunteer: async ({ shiftId, membershipId }) => {
      return cohostUnassignVolunteerFromShiftFn({
        data: { competitionTeamId, shiftId, membershipId },
      })
    },
  }

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
      questionsTeamId={competitionTeamId}
      volunteersListCallbacks={volunteersListCallbacks}
      shiftListCallbacks={shiftListCallbacks}
      questionOverrides={questionOverrides}
      judgeSchedulingOverrides={judgeSchedulingOverrides}
    />
  )
}
