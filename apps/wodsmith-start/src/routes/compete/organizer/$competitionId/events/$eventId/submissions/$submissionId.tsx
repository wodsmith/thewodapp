/**
 * Organizer Video Submission Review Detail Route
 *
 * Single submission review page where organizers can watch the video,
 * see the claimed score, verify/adjust the score, and mark as reviewed.
 * Renders the shared SubmissionReviewPage with organizer defaults.
 */

import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import {
  getReviewNotesForRegistrationFn,
  getWorkoutMovementsFn,
} from "@/server-fns/review-note-fns"
import {
  type EventDetails,
  getEventDetailsForVerificationFn,
  getSubmissionDetailFn,
  getVerificationLogsFn,
  type SubmissionDetail,
  type VerificationLogEntry,
} from "@/server-fns/submission-verification-fns"
import {
  getOrganizerSubmissionDetailFn,
  getSiblingSubmissionsFn,
} from "@/server-fns/video-submission-fns"
import { getSubmissionVoteDetailsFn } from "@/server-fns/video-vote-fns"
import { SubmissionReviewPage } from "../../../-pages/events/submission-review-page"

/**
 * Accept an optional `back` search param so callers (e.g. the organizer
 * leaderboard preview) can deep-link here and have the back button return
 * to whatever filtered view the user was on. Restricted to app-relative
 * paths to avoid open-redirect: must start with "/" and must not start
 * with "//" (protocol-relative).
 */
const submissionDetailSearchSchema = z.object({
  back: z
    .string()
    .refine((v) => v.startsWith("/") && !v.startsWith("//"), {
      message: "back must be an app-relative path",
    })
    .optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId",
)({
  validateSearch: submissionDetailSearchSchema,
  component: RouteComponent,
  loader: async ({ params }) => {
    // Fetch review data (required)
    const reviewResult = await getOrganizerSubmissionDetailFn({
      data: {
        submissionId: params.submissionId,
        competitionId: params.competitionId,
      },
    })

    if (!reviewResult.submission) {
      throw new Error("Submission not found")
    }

    // If we have a score ID, fetch verification data and audit logs.
    // Otherwise still fetch event details so the no-score branch can render
    // the manual-entry form ([[lat.md/domain#Score Adjustments#Manual Score Entry]]).
    let verificationSubmission: SubmissionDetail | null = null
    let event: EventDetails | null = null
    let verificationLogs: VerificationLogEntry[] = []
    const scoreId = reviewResult.submission.scoreId
    if (scoreId) {
      try {
        const [verificationResult, logsResult] = await Promise.all([
          getSubmissionDetailFn({
            data: {
              competitionId: params.competitionId,
              trackWorkoutId: params.eventId,
              scoreId,
            },
          }),
          getVerificationLogsFn({
            data: {
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
    } else {
      try {
        const eventResult = await getEventDetailsForVerificationFn({
          data: {
            competitionId: params.competitionId,
            trackWorkoutId: params.eventId,
          },
        })
        event = eventResult.event
      } catch {
        // Event lookup failed — entry form won't render, falls back to placeholder
      }
    }

    // Fetch siblings for tabbed video UI
    const siblingsResult = await getSiblingSubmissionsFn({
      data: {
        submissionId: params.submissionId,
        competitionId: params.competitionId,
      },
    })

    // Fetch review notes for ALL sibling submissions (aggregated tally)
    let allReviewNotes: Array<{
      id: string
      type: string
      content: string
      timestampSeconds: number | null
      movementId: string | null
      movementName: string | null
      videoSubmissionId: string
      createdAt: Date
      reviewer: {
        id: string
        firstName: string | null
        lastName: string | null
        avatar: string | null
      }
    }> = []

    if (reviewResult.submission.registrationId) {
      try {
        const notesResult = await getReviewNotesForRegistrationFn({
          data: {
            registrationId: reviewResult.submission.registrationId,
            trackWorkoutId: reviewResult.submission.trackWorkoutId,
            competitionId: params.competitionId,
          },
        })
        allReviewNotes = notesResult.notes
      } catch {
        // Fall back gracefully if registration notes fetch fails
      }
    }

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
      getWorkoutMovementsFn({
        data: {
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
      siblings: siblingsResult.siblings,
      siblingsTeamSize: siblingsResult.teamSize,
      siblingsRegistrationId: siblingsResult.registrationId,
      siblingsTrackWorkoutId: siblingsResult.trackWorkoutId,
      verificationSubmission,
      event,
      verificationLogs,
      allReviewNotes,
      workoutMovements,
      voteDetails,
    }
  },
})

function RouteComponent() {
  const {
    submission,
    siblings,
    siblingsTeamSize,
    siblingsRegistrationId,
    siblingsTrackWorkoutId,
    verificationSubmission,
    event,
    verificationLogs,
    allReviewNotes,
    workoutMovements,
    voteDetails,
  } = Route.useLoaderData()
  const params = Route.useParams()
  const { back: backUrl } = Route.useSearch()

  return (
    <SubmissionReviewPage
      competitionId={params.competitionId}
      eventId={params.eventId}
      submissionId={params.submissionId}
      submission={submission}
      siblings={siblings}
      videoLinksEditor={{
        teamSize: siblingsTeamSize,
        registrationId: siblingsRegistrationId,
        trackWorkoutId: siblingsTrackWorkoutId,
      }}
      verificationSubmission={verificationSubmission}
      event={event}
      verificationLogs={verificationLogs}
      reviewNotes={allReviewNotes}
      workoutMovements={workoutMovements}
      voteDetails={voteDetails}
      backUrl={backUrl}
    />
  )
}
