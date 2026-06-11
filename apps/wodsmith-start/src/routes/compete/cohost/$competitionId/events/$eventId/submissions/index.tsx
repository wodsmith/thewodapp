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
        // Status filtering happens client-side so the per-registration
        // review state can be computed from the full set (the cohost fn has
        // no server-side registrationAllReviewed). Division filtering is
        // registration-safe (all of a registration's videos share a division).
        cohostGetOrganizerSubmissionsFn({
          data: {
            trackWorkoutId: params.eventId,
            competitionId: params.competitionId,
            competitionTeamId,
            divisionFilter: deps?.division,
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
    }
  },
})

type SubmissionRow = ComponentProps<
  typeof SubmissionsPage
>["submissions"][number]

function RouteComponent() {
  const { event, divisions, submissions, currentDivisionFilter } =
    Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const search = Route.useSearch()
  const currentStatusFilter = search.status || "all"

  // The cohost server fn returns a leaner row than the organizer fn (no
  // round breakdowns or server-computed registrationAllReviewed). Adapt it
  // to the organizer page shape so the shared page renders identically.
  const adaptedSubmissions = useMemo<SubmissionRow[]>(() => {
    // The loader fetches all statuses, so the organizer fn's per-registration
    // review status can be computed from the complete set before the status
    // filter hides rows: a registration is "all reviewed" when every one of
    // its videos has been reviewed.
    const allReviewedByRegistration = new Map<string, boolean>()
    for (const s of submissions) {
      const prev = allReviewedByRegistration.get(s.registrationId) ?? true
      allReviewedByRegistration.set(
        s.registrationId,
        prev && s.reviewStatus === "reviewed",
      )
    }

    return submissions
      .filter(
        (s) =>
          currentStatusFilter === "all" ||
          s.reviewStatus === currentStatusFilter,
      )
      .map((s) => ({
        ...s,
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
  }, [submissions, currentStatusFilter])

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
