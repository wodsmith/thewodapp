/**
 * Organizer Athletes Route
 *
 * Thin route shell: loads registrations, divisions, questions, answers,
 * waivers, signatures, pending invites, and pending transfers with organizer
 * server fns, then renders the shared AthletesPage with organizer defaults
 * (registration detail links, refund actions, organizer mutation fns).
 */
// @lat: [[organizer-dashboard#Registrations (Athletes)]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import {
  getOrganizerRegistrationsFn,
  getPendingTeammateInvitationsFn,
} from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { getPendingTransfersForCompetitionFn } from "@/server-fns/purchase-transfer-fns"
import {
  getCompetitionQuestionsFn,
  getCompetitionRegistrationAnswersFn,
} from "@/server-fns/registration-questions-fns"
import {
  getCompetitionWaiverSignaturesFn,
  getCompetitionWaiversFn,
} from "@/server-fns/waiver-fns"
import {
  AthletesPage,
  type AthletesSortColumn,
  type AthletesSortDirection,
  athletesSearchSchema,
} from "../-pages/athletes-page"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/athletes/",
)({
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
      getOrganizerRegistrationsFn({
        data: { competitionId, divisionFilter },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: { competitionId, teamId: competition.organizingTeamId },
      }),
      getCompetitionQuestionsFn({
        data: { competitionId },
      }),
      getCompetitionRegistrationAnswersFn({
        data: { competitionId, teamId: competition.organizingTeamId },
      }),
      getCompetitionWaiversFn({
        data: { competitionId },
      }),
      getCompetitionWaiverSignaturesFn({
        data: { competitionId, teamId: competition.organizingTeamId },
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
      canRefund: registrationsResult.canRefund,
      refundsByPurchaseId: registrationsResult.refundsByPurchaseId,
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
      teamId: competition.organizingTeamId,
    }
  },
})

function RouteComponent() {
  const { competition } = parentRoute.useLoaderData()
  const {
    registrations,
    canRefund,
    refundsByPurchaseId,
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
    teamId,
  } = Route.useLoaderData()
  const { tab } = Route.useSearch()

  return (
    <AthletesPage
      competition={competition}
      seriesGroupId={competition.groupId}
      teamId={teamId}
      tab={tab}
      registrations={registrations}
      canRefund={canRefund}
      refundsByPurchaseId={refundsByPurchaseId}
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
      registrationDetailRoute="/compete/organizer/$competitionId/athletes/$registrationId"
    />
  )
}
