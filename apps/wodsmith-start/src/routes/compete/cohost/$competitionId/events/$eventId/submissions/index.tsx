/**
 * Cohost Video Submissions List Route
 *
 * Renders the shared organizer SubmissionsPage with cohost link targets so
 * the page stays in sync with the organizer route. Uses cohost server fns for
 * auth and adapts their leaner submission rows to the organizer page shape.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import type { ComponentProps } from "react"
import { useMemo } from "react"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import { cohostGetOrganizerSubmissionsFn } from "@/server-fns/cohost/cohost-submission-fns"
import { cohostGetEventFn } from "@/server-fns/cohost/cohost-workout-fns"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import {
  SubmissionsPage,
  submissionsSearchSchema,
} from "../../../../../organizer/$competitionId/-pages/events/submissions-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/events/$eventId/submissions/",
)({
  component: RouteComponent,
  validateSearch: submissionsSearchSchema,
  loaderDeps: ({ search }) => ({
    division: search?.division,
    status: search?.status,
  }),
  loader: async ({ params, deps }) => {
    const { competition } = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    const competitionTeamId = competition.competitionTeamId!

    // Only allow for online competitions
    if (competition.competitionType !== "online") {
      throw new Error(
        "Video submissions are only available for online competitions",
      )
    }

    // Parallel fetch event details, divisions, and submissions
    const [eventResult, divisionsResult, submissionsResult] = await Promise.all(
      [
        cohostGetEventFn({
          data: {
            trackWorkoutId: params.eventId,
            competitionTeamId,
          },
        }),
        cohostGetDivisionsWithCountsFn({
          data: {
            competitionId: params.competitionId,
            competitionTeamId,
          },
        }).catch(() => ({ divisions: [] })),
        cohostGetOrganizerSubmissionsFn({
          data: {
            trackWorkoutId: params.eventId,
            competitionId: params.competitionId,
            competitionTeamId,
            divisionFilter: deps?.division,
            statusFilter: deps?.status,
          },
        }).catch(() => ({
          submissions: [],
          totals: { total: 0, reviewed: 0, pending: 0 },
        })),
      ],
    )

    if (!eventResult.event) {
      throw new Error("Event not found")
    }

    return {
      event: eventResult.event,
      divisions: divisionsResult.divisions,
      submissions: submissionsResult.submissions,
      totals: submissionsResult.totals,
      currentDivisionFilter: deps?.division,
      currentStatusFilter: deps?.status || "all",
    }
  },
})

type SubmissionRow = ComponentProps<
  typeof SubmissionsPage
>["submissions"][number]

function RouteComponent() {
  const {
    event,
    divisions,
    submissions,
    currentDivisionFilter,
    currentStatusFilter,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const search = Route.useSearch()

  // The cohost server fn returns a leaner row than the organizer fn (no
  // videoIndex, division teamSize, round breakdowns, or server-computed
  // registrationAllReviewed). Adapt it to the organizer page shape with
  // neutral defaults so the shared page renders identically.
  const adaptedSubmissions = useMemo<SubmissionRow[]>(() => {
    // Approximate the organizer fn's per-registration review status from the
    // loaded set: a registration is "all reviewed" when every one of its
    // loaded videos has been reviewed.
    const allReviewedByRegistration = new Map<string, boolean>()
    for (const s of submissions) {
      const prev = allReviewedByRegistration.get(s.registrationId) ?? true
      allReviewedByRegistration.set(
        s.registrationId,
        prev && s.reviewStatus === "reviewed",
      )
    }

    return submissions.map((s, index) => ({
      ...s,
      // Preserve server order; only used to pick the primary row per group
      videoIndex: index,
      division: s.division ? { ...s.division, teamSize: 1 } : null,
      score: s.score
        ? {
            ...s.score,
            // The cohost fn decodes the raw value without the CAP annotation
            // the organizer fn's formatScore adds, so keep the cap visible
            displayScore:
              s.score.status === "cap" && s.score.displayScore
                ? `${s.score.displayScore} (cap)`
                : s.score.displayScore,
            secondaryValue: null,
            roundScores: [],
            cappedRoundCount: 0,
            totalRoundCount: 0,
          }
        : null,
      registrationAllReviewed:
        allReviewedByRegistration.get(s.registrationId) ?? false,
    }))
  }, [submissions])

  return (
    <SubmissionsPage
      competitionId={competition.id}
      event={event}
      divisions={divisions}
      submissions={adaptedSubmissions}
      currentDivisionFilter={currentDivisionFilter}
      currentStatusFilter={currentStatusFilter}
      initialSort={search.sort}
      eventDetailRoute="/compete/cohost/$competitionId/events/$eventId"
      submissionsListRoute="/compete/cohost/$competitionId/events/$eventId/submissions"
      submissionDetailRoute="/compete/cohost/$competitionId/events/$eventId/submissions/$submissionId"
    />
  )
}
