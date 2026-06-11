/**
 * Cohost Competition Event Edit Route
 *
 * Renders the shared organizer EventDetailPage with cohost-permissioned
 * mutation overrides and cohost route links so the page stays in sync with
 * the organizer route. Loader data comes from the cohost event layout route.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
import {
  cohostCreateEventResourceFn,
  cohostDeleteEventResourceFn,
  cohostReorderEventResourcesFn,
  cohostUpdateEventResourceFn,
} from "@/server-fns/cohost/cohost-event-resources-fns"
import {
  cohostCreateJudgingSheetFn,
  cohostDeleteJudgingSheetFn,
  cohostUpdateJudgingSheetFn,
} from "@/server-fns/cohost/cohost-judging-sheet-fns"
import {
  cohostPublishAllHeatsForEventFn,
  cohostPublishHeatScheduleFn,
} from "@/server-fns/cohost/cohost-schedule-fns"
import { cohostSaveEventFn } from "@/server-fns/cohost/cohost-workout-fns"
import { EventDetailPage } from "../../../../organizer/$competitionId/-pages/events/event-detail-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")
const eventRoute = getRouteApi("/compete/cohost/$competitionId/events/$eventId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/events/$eventId/",
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
  } = eventRoute.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const { tab } = Route.useSearch()
  const competitionTeamId = competition.competitionTeamId!

  // Cohost override wrappers that inject competitionTeamId
  const resourceOverrides = {
    createFn: (args: { data: any }) =>
      cohostCreateEventResourceFn({
        data: { ...args.data, competitionTeamId },
      }),
    updateFn: (args: { data: any }) =>
      cohostUpdateEventResourceFn({
        data: { ...args.data, competitionTeamId },
      }),
    deleteFn: (args: { data: any }) =>
      cohostDeleteEventResourceFn({
        data: { ...args.data, competitionTeamId },
      }),
    reorderFn: (args: { data: any }) =>
      cohostReorderEventResourcesFn({
        data: { ...args.data, competitionTeamId },
      }),
  }

  const judgingOverrides = {
    createFn: (args: { data: any }) =>
      cohostCreateJudgingSheetFn({ data: { ...args.data, competitionTeamId } }),
    updateFn: (args: { data: any }) =>
      cohostUpdateJudgingSheetFn({ data: { ...args.data, competitionTeamId } }),
    deleteFn: (args: { data: any }) =>
      cohostDeleteJudgingSheetFn({ data: { ...args.data, competitionTeamId } }),
  }

  const eventFormOverrides = {
    saveFn: (args: { data: any }) =>
      cohostSaveEventFn({ data: { ...args.data, competitionTeamId } }),
  }

  const publishingOverrides = {
    publishHeatFn: (args: { data: any }) =>
      cohostPublishHeatScheduleFn({
        data: { ...args.data, competitionTeamId },
      }),
    publishAllFn: (args: { data: any }) =>
      cohostPublishAllHeatsForEventFn({
        data: { ...args.data, competitionTeamId },
      }),
  }

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
      tab={tab}
      routePrefix="/compete/cohost"
      eventFormOverrides={eventFormOverrides}
      resourceOverrides={resourceOverrides}
      judgingOverrides={judgingOverrides}
      publishingOverrides={publishingOverrides}
    />
  )
}
