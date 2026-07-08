// @lat: [[crew#Import CSV Preview#Preview Records]]
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { VolunteerImportWizard } from "@/components/crew/volunteer-import-wizard"

export const Route = createFileRoute("/events/$eventId/volunteers_/import")({
  component: VolunteerImportPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function VolunteerImportPage() {
  const { eventId } = parentRoute.useParams()
  return <VolunteerImportWizard eventId={eventId} />
}
