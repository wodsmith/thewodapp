// @lat: [[crew#Volunteer Shifts Page]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCrewShiftBoardFn } from "@/server-fns/crew-roster-shift-fns"
import { ShiftList } from "./-components/shifts/shift-list"

export const Route = createFileRoute("/events/$eventId/shifts")({
  loader: async ({ params }) => {
    const shiftBoard = await getCrewShiftBoardFn({
      data: { eventId: params.eventId },
    })
    return { shiftBoard }
  },
  component: VolunteerShiftsPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function VolunteerShiftsPage() {
  const { eventId } = parentRoute.useParams()
  const { shiftBoard } = Route.useLoaderData()
  const timezone = shiftBoard.event.timezone ?? "America/Denver"

  return (
    <ShiftList
      eventId={eventId}
      timezone={timezone}
      defaultDate={shiftBoard.event.startDate}
      shifts={shiftBoard.shifts}
      roster={shiftBoard.roster}
    />
  )
}
