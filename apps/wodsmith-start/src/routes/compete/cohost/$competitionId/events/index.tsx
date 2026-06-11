/**
 * Cohost Competition Events Route
 *
 * Renders the shared organizer EventsPage with cohost-permissioned mutation
 * overrides and cohost event detail links so the page stays in sync with the
 * organizer route. Fetches events, divisions, movements, and sponsors in
 * parallel via cohost server fns.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMemo } from "react"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import { cohostGetCompetitionSponsorsFn } from "@/server-fns/cohost/cohost-sponsor-fns"
import {
  cohostCreateWorkoutFn,
  cohostGetBatchDivisionDescriptionsFn,
  cohostGetWorkoutsFn,
  cohostRemoveWorkoutFn,
  cohostReorderEventsFn,
} from "@/server-fns/cohost/cohost-workout-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { EventsPage } from "../../../organizer/$competitionId/-pages/events/events-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute("/compete/cohost/$competitionId/events/")({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    // biome-ignore lint/style/noNonNullAssertion: established pattern for parent route data
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Parallel fetch events, divisions, movements, sponsors
    const [eventsResult, divisionsResult, movementsResult, sponsorsResult] =
      await Promise.all([
        cohostGetWorkoutsFn({
          data: {
            competitionId: params.competitionId,
            competitionTeamId,
          },
        }).catch(() => ({ workouts: [] })),
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
      ])

    // Flatten sponsors from groups and ungrouped
    const allSponsors = [
      ...sponsorsResult.groups.flatMap((g) => g.sponsors),
      ...sponsorsResult.ungroupedSponsors,
    ]

    // Batch fetch division descriptions for all events in a single call
    const divisionIds = divisionsResult.divisions.map((d) => d.id)
    let divisionDescriptionsByWorkout: Record<
      string,
      Array<{
        divisionId: string
        divisionLabel: string
        description: string | null
      }>
    > = {}

    if (divisionIds.length > 0 && eventsResult.workouts.length > 0) {
      const workoutIds = eventsResult.workouts.map((e) => e.workoutId)
      const result = await cohostGetBatchDivisionDescriptionsFn({
        data: { workoutIds, divisionIds, competitionTeamId },
      }).catch(() => ({ descriptionsByWorkout: {} }))
      divisionDescriptionsByWorkout = result.descriptionsByWorkout
    }

    return {
      events: eventsResult.workouts,
      divisions: divisionsResult.divisions,
      movements: movementsResult.movements,
      sponsors: allSponsors,
      divisionDescriptionsByWorkout,
      competition,
    }
  },
})

function RouteComponent() {
  const {
    events,
    divisions,
    movements,
    sponsors,
    divisionDescriptionsByWorkout,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()

  const competitionTeamId = competition.competitionTeamId!

  // Wrapper fns that adapt organizer call signatures (teamId) to cohost (competitionTeamId)
  const overrides = useMemo(
    () => ({
      createWorkoutFn: ((args: { data: Record<string, unknown> }) =>
        cohostCreateWorkoutFn({
          data: {
            competitionTeamId,
            competitionId: args.data.competitionId as string,
            name: args.data.name as string,
            scheme: args.data.scheme as string,
            scoreType: args.data.scoreType as string | null | undefined,
            description: args.data.description as string | undefined,
            roundsToScore: args.data.roundsToScore as number | null | undefined,
            repsPerRound: args.data.repsPerRound as number | null | undefined,
            tiebreakScheme: args.data.tiebreakScheme as
              | string
              | null
              | undefined,
            movementIds: args.data.movementIds as string[] | undefined,
            sourceWorkoutId: args.data.sourceWorkoutId as
              | string
              | null
              | undefined,
            parentEventId: args.data.parentEventId as string | undefined,
          },
        })) as any,
      removeWorkoutFn: ((args: { data: Record<string, unknown> }) =>
        cohostRemoveWorkoutFn({
          data: {
            competitionTeamId,
            trackWorkoutId: args.data.trackWorkoutId as string,
          },
        })) as any,
      reorderEventsFn: ((args: { data: Record<string, unknown> }) =>
        cohostReorderEventsFn({
          data: {
            competitionTeamId,
            competitionId: args.data.competitionId as string,
            updates: args.data.updates as Array<{
              trackWorkoutId: string
              trackOrder: number
            }>,
          },
        })) as any,
    }),
    [competitionTeamId],
  )

  return (
    <EventsPage
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      events={events}
      movements={movements}
      divisions={divisions}
      divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
      sponsors={sponsors}
      overrides={overrides}
      eventDetailRoute="/compete/cohost/$competitionId/events/$eventId"
    />
  )
}
