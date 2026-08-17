/**
 * Organizer Volunteer Shifts Page
 *
 * Manages volunteer shift definitions and assignments for a competition.
 */
// @lat: [[organizer-dashboard#Volunteers#Volunteer Shifts]]

import { createFileRoute, redirect } from "@tanstack/react-router"
import { competitionCan } from "@/lib/competitions/capabilities"
import { getCompetitionShiftsFn } from "@/server-fns/volunteer-shift-fns"
import { ShiftList } from "../-components/shifts/shift-list"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/volunteers/shifts",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Volunteer shifts are capability-gated (benchmark boards exclude them)
    if (!competitionCan(competition.competitionType, "volunteerShifts")) {
      throw redirect({
        to: "/compete/organizer/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    const shifts = await getCompetitionShiftsFn({
      data: { competitionId: competition.id },
    })

    return {
      competition,
      competitionTeamId: competition.competitionTeamId,
      shifts,
    }
  },
  component: VolunteerShiftsPage,
})

function VolunteerShiftsPage() {
  const { competition, competitionTeamId, shifts } = Route.useLoaderData()

  return (
    <ShiftList
      competitionId={competition.id}
      competitionTeamId={competitionTeamId}
      shifts={shifts}
    />
  )
}
