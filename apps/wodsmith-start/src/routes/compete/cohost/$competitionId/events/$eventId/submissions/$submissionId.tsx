/**
 * Cohost Video Submission Review Detail Route
 *
 * Renders the shared organizer SubmissionReviewPage with cohost-permissioned
 * mutation overrides so the page stays in sync with the organizer route.
 * Organizer-only sections (sibling video tabs, manual score entry, video
 * links editor) are omitted because no cohost server fns exist for them.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  cohostCreateReviewNoteFn,
  cohostDeleteReviewNoteFn,
  cohostGetReviewNotesFn,
  cohostGetWorkoutMovementsFn,
  cohostUpdateReviewNoteFn,
} from "@/server-fns/cohost/cohost-review-note-fns"
import {
  cohostDeleteVerificationLogFn,
  cohostGetOrganizerSubmissionDetailFn,
  cohostGetSubmissionDetailFn,
  cohostGetVerificationLogsFn,
  cohostMarkSubmissionReviewedFn,
  cohostUnmarkSubmissionReviewedFn,
  cohostVerifySubmissionScoreFn,
} from "@/server-fns/cohost/cohost-submission-fns"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import type {
  EventDetails,
  SubmissionDetail,
  VerificationLogEntry,
} from "@/server-fns/submission-verification-fns"
import { getSubmissionVoteDetailsFn } from "@/server-fns/video-vote-fns"
import {
  type SubmissionReviewOverrides,
  SubmissionReviewPage,
} from "../../../../../organizer/$competitionId/-pages/events/submission-review-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/events/$eventId/submissions/$submissionId",
)({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { competition } = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })
    const competitionTeamId = competition!.competitionTeamId!

    // Fetch review data (required)
    const reviewResult = await cohostGetOrganizerSubmissionDetailFn({
      data: {
        competitionTeamId,
        submissionId: params.submissionId,
        competitionId: params.competitionId,
      },
    }).catch(() => ({ submission: null }))

    if (!reviewResult.submission) {
      throw new Error("Submission not found")
    }

    // If we have a score ID, fetch verification data and audit logs
    let verificationSubmission: SubmissionDetail | null = null
    let event: EventDetails | null = null
    let verificationLogs: VerificationLogEntry[] = []
    const scoreId = reviewResult.submission.scoreId
    if (scoreId) {
      try {
        const [verificationResult, logsResult] = await Promise.all([
          cohostGetSubmissionDetailFn({
            data: {
              competitionTeamId,
              competitionId: params.competitionId,
              trackWorkoutId: params.eventId,
              scoreId,
            },
          }),
          cohostGetVerificationLogsFn({
            data: {
              competitionTeamId,
              scoreId,
              competitionId: params.competitionId,
            },
          }),
        ])
        verificationSubmission = verificationResult.submission
        event = verificationResult.event
        verificationLogs = logsResult.logs
      } catch {
        // Verification data not available - controls won't show
      }
    }

    // Fetch review notes
    const notesResult = await cohostGetReviewNotesFn({
      data: {
        competitionTeamId,
        videoSubmissionId: params.submissionId,
        competitionId: params.competitionId,
      },
    }).catch(() => ({ notes: [] }))

    // Fetch workout movements and vote details in parallel
    let workoutMovements: Array<{ id: string; name: string; type: string }> = []
    let voteDetails: {
      upvotes: number
      downvotes: number
      reasonBreakdown: Array<{ reason: string | null; count: number }>
      downvoteDetails: Array<{
        reason: string | null
        reasonDetail: string | null
        votedAt: Date
      }>
    } | null = null

    const [movementsSettled, votesSettled] = await Promise.allSettled([
      cohostGetWorkoutMovementsFn({
        data: {
          competitionTeamId,
          trackWorkoutId: params.eventId,
          competitionId: params.competitionId,
        },
      }),
      getSubmissionVoteDetailsFn({
        data: {
          videoSubmissionId: params.submissionId,
          competitionId: params.competitionId,
        },
      }),
    ])

    if (movementsSettled.status === "fulfilled") {
      workoutMovements = movementsSettled.value.movements
    }
    if (votesSettled.status === "fulfilled") {
      voteDetails = votesSettled.value
    }

    return {
      submission: reviewResult.submission,
      verificationSubmission,
      event,
      verificationLogs,
      reviewNotes: notesResult.notes,
      workoutMovements,
      voteDetails,
    }
  },
})

function RouteComponent() {
  const {
    submission,
    verificationSubmission,
    event,
    verificationLogs,
    reviewNotes,
    workoutMovements,
    voteDetails,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const competitionTeamId = competition.competitionTeamId!
  const params = Route.useParams()

  const verifyScore = useServerFn(cohostVerifySubmissionScoreFn)
  const deleteVerificationLog = useServerFn(cohostDeleteVerificationLogFn)
  const markReviewed = useServerFn(cohostMarkSubmissionReviewedFn)
  const unmarkReviewed = useServerFn(cohostUnmarkSubmissionReviewedFn)
  const createReviewNote = useServerFn(cohostCreateReviewNoteFn)
  const updateReviewNote = useServerFn(cohostUpdateReviewNoteFn)
  const deleteReviewNote = useServerFn(cohostDeleteReviewNoteFn)

  const overrides: SubmissionReviewOverrides = {
    // The cohost fn has no multi-round support, but cohost submission data
    // never includes round scores so the multi-round adjust path never runs.
    verifyScore: async ({ adjustedRoundScores: _unsupported, ...input }) =>
      verifyScore({ data: { ...input, competitionTeamId } }),
    deleteVerificationLog: async (input) =>
      deleteVerificationLog({ data: { ...input, competitionTeamId } }),
    markReviewed: async (input) =>
      markReviewed({ data: { ...input, competitionTeamId } }),
    unmarkReviewed: async (input) =>
      unmarkReviewed({ data: { ...input, competitionTeamId } }),
    createReviewNote: async (input) =>
      createReviewNote({ data: { ...input, competitionTeamId } }),
    updateReviewNote: async (input) =>
      updateReviewNote({ data: { ...input, competitionTeamId } }),
    deleteReviewNote: async (input) =>
      deleteReviewNote({ data: { ...input, competitionTeamId } }),
  }

  return (
    <SubmissionReviewPage
      competitionId={params.competitionId}
      eventId={params.eventId}
      submissionId={params.submissionId}
      submission={submission}
      verificationSubmission={verificationSubmission}
      event={event}
      verificationLogs={verificationLogs}
      reviewNotes={reviewNotes.map((n) => ({
        ...n,
        videoSubmissionId: submission.id,
      }))}
      workoutMovements={workoutMovements}
      voteDetails={voteDetails}
      submissionsListRoute="/compete/cohost/$competitionId/events/$eventId/submissions"
      enableManualScoreEntry={false}
      overrides={overrides}
    />
  )
}
