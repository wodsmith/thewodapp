// @lat: [[crew#Pilot Readiness Checklist]]
// @lat: [[crew#Staffing Page Gap Report]]
// @lat: [[crew#Day Of Operations Board]]
// @lat: [[crew#Pilot Exports]]
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import {
  CrewEventSidebarShell,
  getCrewOrganizerEventSidebarNavigation,
} from "@/components/crew-event-sidebar"
import { getCrewEventNavItems } from "@/lib/crew/navigation"
import { getCrewEventFn } from "@/server-fns/crew-event-settings-fns"
import { useSession } from "@/utils/auth-client"
import { resolveCrewViewer } from "@/utils/crew-access"

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ params }) => {
    const result = await getCrewEventFn({ data: { eventId: params.eventId } })
    if (!result.event) {
      throw notFound()
    }
    return { event: result.event }
  },
  component: EventShell,
})

function EventShell() {
  const { eventId } = Route.useParams()
  const { event } = Route.useLoaderData()
  const session = useSession()
  const viewer = resolveCrewViewer({ session })
  const navItems = getCrewEventNavItems({ viewerRole: viewer.role })
  const navigation = getCrewOrganizerEventSidebarNavigation({
    eventId,
    navItems,
  })

  return (
    <CrewEventSidebarShell
      variant="organizer"
      event={{
        id: event.competition.id,
        name: event.competition.name,
        startDate: event.competition.startDate,
        endDate: event.competition.endDate,
      }}
      navigation={navigation}
      eyebrow="Organizer Crew"
    >
      <Outlet />
    </CrewEventSidebarShell>
  )
}
