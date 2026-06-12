/**
 * Competition Cohost Athletes Route
 *
 * Renders the shared organizer AthletesPage with cohost-permissioned mutation
 * callbacks so the page stays in sync with the organizer route. The loader
 * uses cohost server fns; the waiver fetches swallow only FORBIDDEN errors
 * (graceful degradation) and rethrow everything else. Edit UI is gated by the
 * cohost `editRegistrations` permission inside the shared page, and there is
 * no registration detail route for cohosts so detail links are omitted.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import type { RegistrationQuestionsOverrides } from "@/components/competition-settings/registration-questions-editor"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import {
  cohostCreateManualRegistrationFn,
  cohostGetCompetitionRegistrationAnswersFn,
  cohostGetOrganizerRegistrationsFn,
  cohostGetRegistrationQuestionsFn,
  cohostRemoveRegistrationFn,
  cohostTransferRegistrationDivisionFn,
} from "@/server-fns/cohost/cohost-registration-fns"
import {
  cohostCreateQuestionFn,
  cohostDeleteQuestionFn,
  cohostReorderQuestionsFn,
  cohostUpdateQuestionFn,
} from "@/server-fns/cohost/cohost-registration-questions-fns"
import {
  cohostGetCompetitionWaiverSignaturesFn,
  cohostGetCompetitionWaiversFn,
} from "@/server-fns/cohost/cohost-waiver-fns"
import { getPendingTeammateInvitationsFn } from "@/server-fns/competition-detail-fns"
import { getPendingTransfersForCompetitionFn } from "@/server-fns/purchase-transfer-fns"
import {
  AthletesPage,
  type AthletesSortColumn,
  type AthletesSortDirection,
  athletesSearchSchema,
} from "../../organizer/$competitionId/-pages/athletes-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute("/compete/cohost/$competitionId/athletes")(
  {
    staleTime: 10_000,
    component: RouteComponent,
    validateSearch: athletesSearchSchema,
    loaderDeps: ({ search }) => ({
      division: search?.division,
      questionFilters: search?.questionFilters,
      waiverFilters: search?.waiverFilters,
      sortBy: search?.sortBy,
      sortDir: search?.sortDir,
    }),
    loader: async ({ params, deps, parentMatchPromise }) => {
      const { competitionId } = params
      const divisionFilter = deps?.division

      const parentMatch = await parentMatchPromise
      const { competition } = parentMatch.loaderData!

      const competitionTeamId = competition.competitionTeamId!

      // Parallel fetch: registrations, divisions, questions, answers, waivers, signatures, pending invites, and pending transfers
      const [
        registrationsResult,
        divisionsResult,
        questionsResult,
        answersResult,
        waiversResult,
        signaturesResult,
        pendingInvitesResult,
        pendingTransfersResult,
      ] = await Promise.all([
        cohostGetOrganizerRegistrationsFn({
          data: { competitionId, competitionTeamId, divisionFilter },
        }),
        cohostGetDivisionsWithCountsFn({
          data: { competitionId, competitionTeamId },
        }),
        cohostGetRegistrationQuestionsFn({
          data: { competitionId, competitionTeamId },
        }),
        cohostGetCompetitionRegistrationAnswersFn({
          data: { competitionId, competitionTeamId },
        }),
        cohostGetCompetitionWaiversFn({
          data: { competitionId, competitionTeamId },
        }).catch((error) => {
          if (
            error instanceof Error &&
            error.message.startsWith("FORBIDDEN:")
          ) {
            return { waivers: [] }
          }
          throw error
        }),
        cohostGetCompetitionWaiverSignaturesFn({
          data: { competitionId, competitionTeamId },
        }).catch((error) => {
          if (
            error instanceof Error &&
            error.message.startsWith("FORBIDDEN:")
          ) {
            return { signatures: [] }
          }
          throw error
        }),
        getPendingTeammateInvitationsFn({
          data: { competitionId },
        }),
        getPendingTransfersForCompetitionFn({
          data: { competitionId },
        }),
      ])

      return {
        registrations: registrationsResult.registrations,
        divisions: divisionsResult.divisions,
        questions: questionsResult.questions,
        answersByRegistration: answersResult.answersByRegistration,
        waivers: waiversResult.waivers,
        signaturesByUser: signaturesResult.signatures.reduce(
          (acc, sig) => {
            const key = `${sig.userId}-${sig.waiverId}`
            acc[key] = sig.signedAt
            return acc
          },
          {} as Record<string, Date>,
        ),
        pendingInvites: pendingInvitesResult.pendingInvites,
        pendingTransfers: pendingTransfersResult,
        currentDivisionFilter: divisionFilter,
        currentQuestionFilters: deps?.questionFilters || {},
        currentWaiverFilters: deps?.waiverFilters || [],
        currentSortBy: deps?.sortBy as AthletesSortColumn | undefined,
        currentSortDir: deps?.sortDir as AthletesSortDirection | undefined,
        competitionTeamId,
      }
    },
  },
)

function RouteComponent() {
  const { competition, permissions } = parentRoute.useLoaderData()
  const {
    registrations,
    divisions,
    questions,
    answersByRegistration,
    waivers,
    signaturesByUser,
    pendingInvites,
    pendingTransfers,
    currentDivisionFilter,
    currentQuestionFilters,
    currentWaiverFilters,
    currentSortBy,
    currentSortDir,
    competitionTeamId,
  } = Route.useLoaderData()
  const { tab } = Route.useSearch()

  const cohostCreateManualRegistration = useServerFn(
    cohostCreateManualRegistrationFn,
  )
  const cohostTransferDivision = useServerFn(
    cohostTransferRegistrationDivisionFn,
  )
  const cohostRemoveRegistration = useServerFn(cohostRemoveRegistrationFn)

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

  return (
    <AthletesPage
      competition={competition}
      teamId={competitionTeamId}
      tab={tab}
      permissions={permissions}
      registrations={registrations}
      divisions={divisions}
      questions={questions}
      answersByRegistration={answersByRegistration}
      waivers={waivers}
      signaturesByUser={signaturesByUser}
      pendingInvites={pendingInvites}
      pendingTransfers={pendingTransfers}
      currentDivisionFilter={currentDivisionFilter}
      currentQuestionFilters={currentQuestionFilters}
      currentWaiverFilters={currentWaiverFilters}
      currentSortBy={currentSortBy}
      currentSortDir={currentSortDir}
      onCreateRegistration={async (data) =>
        cohostCreateManualRegistration({
          data: { ...data, competitionTeamId },
        })
      }
      onTransferDivision={async (data) =>
        cohostTransferDivision({
          data: { ...data, competitionTeamId },
        })
      }
      onRemoveRegistration={async ({ registrationId, competitionId }) =>
        cohostRemoveRegistration({
          data: { registrationId, competitionId, competitionTeamId },
        })
      }
      transferRegistrationDisabled
      transferRegistrationDisabledMessage="Registration transfers are not available for cohosts. Please contact the competition organizer."
      questionOverrides={questionOverrides}
    />
  )
}
