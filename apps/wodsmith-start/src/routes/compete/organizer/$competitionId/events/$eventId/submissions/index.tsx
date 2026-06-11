/**
 * Organizer Video Submissions List Route
 *
 * Lists all video submissions for an online competition event.
 * Allows organizers to review submissions, filter by division/status, and
 * navigate to individual submissions. The page body lives in the shared
 * SubmissionsPage, which the cohost route also renders.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionEventFn } from "@/server-fns/competition-workouts-fns"
import { getOrganizerSubmissionsFn } from "@/server-fns/video-submission-fns"
import {
  SubmissionsPage,
  submissionsSearchSchema,
} from "../../../-pages/events/submissions-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/events/$eventId/submissions/",
)({
  component: RouteComponent,
  validateSearch: submissionsSearchSchema,
  loaderDeps: ({ search }) => ({
    division: search?.division,
    status: search?.status,
  }),
  loader: async ({ params, deps }) => {
    // First get competition to know the teamId
    const { competition } = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Only allow for online competitions
    if (competition.competitionType !== "online") {
      throw new Error(
        "Video submissions are only available for online competitions",
      )
    }

    // Parallel fetch event details, divisions, and submissions
    const [eventResult, divisionsResult, submissionsResult] = await Promise.all(
      [
        getCompetitionEventFn({
          data: {
            trackWorkoutId: params.eventId,
            teamId: competition.organizingTeamId,
          },
        }),
        getCompetitionDivisionsWithCountsFn({
          data: {
            competitionId: params.competitionId,
            teamId: competition.organizingTeamId,
          },
        }),
        getOrganizerSubmissionsFn({
          data: {
            trackWorkoutId: params.eventId,
            competitionId: params.competitionId,
            divisionFilter: deps?.division,
            statusFilter: deps?.status,
          },
        }),
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

  return (
    <SubmissionsPage
      competitionId={competition.id}
      event={event}
      divisions={divisions}
      submissions={submissions}
      currentDivisionFilter={currentDivisionFilter}
      currentStatusFilter={currentStatusFilter}
      initialSort={search.sort}
    />
  )
}
