/**
 * Cohost Competition Event Layout Route
 *
 * Layout route for a single competition event. Loads event details,
 * divisions, movements, sponsors, and judging sheets for child routes.
 * Uses cohost server fns for auth.
 */

import { Outlet, createFileRoute } from "@tanstack/react-router"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import { cohostGetCompetitionEventsFn } from "@/server-fns/cohost/cohost-event-fns"
import {
  cohostGetEventFn,
  cohostGetWorkoutsFn,
  cohostGetWorkoutDivisionDescriptionsFn,
} from "@/server-fns/cohost/cohost-workout-fns"
import { cohostGetEventResourcesFn } from "@/server-fns/cohost/cohost-event-resources-fns"
import { getEventJudgingSheetsFn } from "@/server-fns/judging-sheet-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { cohostGetCompetitionSponsorsFn } from "@/server-fns/cohost/cohost-sponsor-fns"

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/events/$eventId",
)({
  staleTime: 10_000,
  component: () => <Outlet />,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!
    const isOnline = competition.competitionType === "online"

    // Parallel fetch event, divisions, movements, sponsors, resources, judging sheets, and competition events
    const [
      eventResult,
      divisionsResult,
      movementsResult,
      sponsorsResult,
      resourcesResult,
      judgingSheetsResult,
      competitionEventsResult,
    ] = await Promise.all([
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
      getAllMovementsFn().catch(() => ({ movements: [] })),
      cohostGetCompetitionSponsorsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ groups: [], ungroupedSponsors: [] })),
      cohostGetEventResourcesFn({
        data: {
          eventId: params.eventId,
          competitionTeamId,
        },
      }).catch(() => ({ resources: [] })),
      getEventJudgingSheetsFn({
        data: { trackWorkoutId: params.eventId },
      }).catch(() => ({ sheets: [] })),
      // Fetch competition events (submission windows) for online competitions
      isOnline
        ? cohostGetCompetitionEventsFn({
            data: {
              competitionId: params.competitionId,
              competitionTeamId,
            },
          }).catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] }),
    ])

    if (!eventResult.event) {
      throw new Error("Event not found")
    }

    // Flatten sponsors from groups and ungrouped
    const allSponsors = [
      ...sponsorsResult.groups.flatMap((g) => g.sponsors),
      ...sponsorsResult.ungroupedSponsors,
    ]

    // Fetch division descriptions for this workout
    const divisionIds = divisionsResult.divisions.map((d) => d.id)
    let divisionDescriptions: Array<{
      divisionId: string
      divisionLabel: string
      description: string | null
    }> = []

    if (divisionIds.length > 0) {
      const descriptionsResult = await cohostGetWorkoutDivisionDescriptionsFn({
        data: {
          workoutId: eventResult.event.workoutId,
          divisionIds,
          competitionTeamId,
        },
      }).catch(() => ({ descriptions: [] }))
      divisionDescriptions = descriptionsResult.descriptions
    }

    // Find this event's submission window
    const competitionEvent = competitionEventsResult.events.find(
      (ce) => ce.trackWorkoutId === params.eventId,
    )

    // Fetch child events if this is a parent event
    const allWorkoutsResult = await cohostGetWorkoutsFn({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
      },
    }).catch(() => ({ workouts: [] }))
    const childEvents = allWorkoutsResult.workouts
      .filter((w) => w.parentEventId === params.eventId)
      .sort((a, b) => a.trackOrder - b.trackOrder)

    // Fetch division descriptions for each child event
    const childDivisionDescriptions: Record<
      string,
      Array<{
        divisionId: string
        divisionLabel: string
        description: string | null
      }>
    > = {}
    if (childEvents.length > 0 && divisionIds.length > 0) {
      const childDescResults = await Promise.all(
        childEvents.map((child) =>
          cohostGetWorkoutDivisionDescriptionsFn({
            data: {
              workoutId: child.workoutId,
              divisionIds,
              competitionTeamId,
            },
          }).catch(() => ({ descriptions: [] })),
        ),
      )
      for (let i = 0; i < childEvents.length; i++) {
        childDivisionDescriptions[childEvents[i].workoutId] =
          childDescResults[i].descriptions
      }
    }

    return {
      event: eventResult.event,
      divisions: divisionsResult.divisions,
      movements: movementsResult.movements,
      sponsors: allSponsors,
      divisionDescriptions,
      resources: resourcesResult.resources,
      judgingSheets: judgingSheetsResult.sheets,
      isOnline,
      submissionOpensAt: competitionEvent?.submissionOpensAt ?? null,
      submissionClosesAt: competitionEvent?.submissionClosesAt ?? null,
      timezone: competition.timezone || "America/Denver",
      childEvents,
      childDivisionDescriptions,
    }
  },
})
