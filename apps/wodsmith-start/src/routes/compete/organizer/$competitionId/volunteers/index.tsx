/**
 * Organizer Volunteer Roster Page
 *
 * Lists confirmed volunteers, pending applications, and pending direct invites.
 */
// @lat: [[organizer-dashboard#Volunteers]]

import { createFileRoute } from "@tanstack/react-router"
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
import { InvitedVolunteersList } from "../-components/invited-volunteers-list"
import { VolunteersList } from "../-components/volunteers-list"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/volunteers/",
)({
  staleTime: 10_000,
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

    const [
      invitations,
      volunteers,
      directInvites,
      volunteerAssignments,
      volunteerQuestionsResult,
      volunteerAnswersResult,
      volunteerWaiverStatus,
    ] = await Promise.all([
      getPendingVolunteerInvitationsFn({
        data: { competitionTeamId },
      }),
      getCompetitionVolunteersFn({
        data: { competitionTeamId },
      }),
      getDirectVolunteerInvitesFn({
        data: { competitionTeamId },
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
    ])

    // Batched second stage: score access for all volunteers in a constant
    // number of queries.
    const scoreAccessMap = await getScoreAccessMapFn({
      data: {
        userIds: volunteers
          .map((volunteer) => volunteer.user?.id)
          .filter((id): id is string => Boolean(id)),
        competitionTeamId,
      },
    })

    const volunteersWithAccess = volunteers.map((volunteer) => ({
      ...volunteer,
      hasScoreAccess: volunteer.user
        ? (scoreAccessMap[volunteer.user.id] ?? false)
        : false,
    }))

    const pendingDirectInvites = directInvites.filter(
      (i) => i.status === "pending",
    )

    return {
      competition,
      competitionTeamId,
      invitations,
      volunteersWithAccess,
      pendingDirectInvites,
      volunteerAssignments,
      volunteerQuestions: volunteerQuestionsResult.questions,
      answersByInvitation: volunteerAnswersResult.answersByInvitation,
      emailToInvitationId: volunteerAnswersResult.emailToInvitationId,
      volunteerWaiverStatus,
    }
  },
  component: VolunteerRosterPage,
})

function VolunteerRosterPage() {
  const {
    competition,
    competitionTeamId,
    invitations,
    volunteersWithAccess,
    pendingDirectInvites,
    volunteerAssignments,
    volunteerQuestions,
    answersByInvitation,
    emailToInvitationId,
    volunteerWaiverStatus,
  } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-8">
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
    </div>
  )
}
