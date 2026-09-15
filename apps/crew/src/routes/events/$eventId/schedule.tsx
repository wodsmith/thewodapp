import { createFileRoute } from "@tanstack/react-router"
import { CrewScheduleSharingPanel } from "@/components/crew/schedule-sharing-panel"
import { getCrewPublishedScheduleManagerFn } from "@/server-fns/crew-published-schedule-fns"

export const Route = createFileRoute("/events/$eventId/schedule")({
  loader: ({ params }) =>
    getCrewPublishedScheduleManagerFn({ data: { eventId: params.eventId } }),
  component: EventSchedulePage,
})

function EventSchedulePage() {
  const data = Route.useLoaderData()
  return <CrewScheduleSharingPanel key={data.event.id} initialData={data} />
}
