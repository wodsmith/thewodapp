/**
 * Competition Event Edit Route
 *
 * Organizer page for editing a single competition event. Loader data comes
 * from the event layout route; renders the shared EventDetailPage body.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
import { EventDetailPage } from "../../-pages/events/event-detail-page"

// Get parent route APIs to access loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")
const eventRoute = getRouteApi(
  "/compete/organizer/$competitionId/events/$eventId",
)

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/events/$eventId/",
)({
  validateSearch: z.object({
    tab: z.string().optional(),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const {
    event,
    divisions,
    movements,
    sponsors,
    divisionDescriptions,
    resources,
    judgingSheets,
    isOnline,
    submissionOpensAt,
    submissionClosesAt,
    timezone,
    childEvents,
    childDivisionDescriptions,
    eventDivisionMappings,
  } = eventRoute.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()
  const { tab } = Route.useSearch()

  return (
    <EventDetailPage
      competition={competition}
      event={event}
      divisions={divisions}
      movements={movements}
      sponsors={sponsors}
      divisionDescriptions={divisionDescriptions}
      resources={resources}
      judgingSheets={judgingSheets}
      isOnline={isOnline}
      submissionOpensAt={submissionOpensAt}
      submissionClosesAt={submissionClosesAt}
      timezone={timezone}
      childEvents={childEvents}
      childDivisionDescriptions={childDivisionDescriptions}
      eventDivisionMappings={eventDivisionMappings}
      tab={tab}
    />
  )
}
