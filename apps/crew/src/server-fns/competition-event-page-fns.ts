/**
 * Consolidated Public Event Page Server Function
 *
 * Collapses the public event-detail page's loader waterfall into a single
 * server round-trip. Composes existing public server fns in-process — each
 * composed fn opens its own DB connection via getDb(), so the Promise.all
 * batches below execute in true parallel on the wire (a single mysql2
 * connection would serialize them).
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { getVenueForTrackWorkoutByDivisionFn } from "@/server-fns/competition-heats-fns"
import {
  type DivisionDescription,
  getBatchWorkoutDivisionDescriptionsFn,
  getPublicEventDetailsFn,
  getPublishedCompetitionWorkoutsFn,
} from "@/server-fns/competition-workouts-fns"
import { getPublicEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getEventJudgingSheetsFn } from "@/server-fns/judging-sheet-fns"

const getPublicEventPageDataInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  divisionIds: z.array(z.string().min(1)),
})

/**
 * Fetch everything the public event-detail page needs in one call.
 *
 * Wave 1 runs the fully independent fetches in parallel. Wave 2 runs the
 * event-dependent fetch (division descriptions need the event's workoutId) —
 * still server-side, so the page pays one round-trip instead of a
 * client-visible waterfall. Published heats are intentionally NOT fetched
 * here: the heat schedule hydrates client-side from a deferred promise, so
 * the route keeps it off the loader's critical path.
 *
 * Returns `event: null` when the event doesn't exist or isn't published —
 * callers should treat that as not-found.
 */
export const getPublicEventPageDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getPublicEventPageDataInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { competitionId, trackWorkoutId, divisionIds } = data

    // The venue card defaults to the first division — same default the
    // event-detail route used before this consolidation.
    const defaultDivisionId = divisionIds[0] ?? null

    // Wave 1 — independent fetches. Each composed server fn calls getDb()
    // internally, so these run on separate connections in true parallel.
    const [
      eventResult,
      judgingSheetsResult,
      eventDivisionMappings,
      allWorkoutsResult,
      venueResult,
    ] = await Promise.all([
      getPublicEventDetailsFn({
        data: { eventId: trackWorkoutId, competitionId },
      }),
      getEventJudgingSheetsFn({ data: { trackWorkoutId } }),
      getPublicEventDivisionMappingsFn({ data: { competitionId } }),
      getPublishedCompetitionWorkoutsFn({ data: { competitionId } }),
      defaultDivisionId
        ? getVenueForTrackWorkoutByDivisionFn({
            data: { trackWorkoutId, divisionId: defaultDivisionId },
          })
        : Promise.resolve({ venue: null }),
    ])

    const event = eventResult.event

    // Wave 2 — depends on the event row: division descriptions need the
    // parent + child workoutIds.
    const childEvents = event
      ? allWorkoutsResult.workouts.filter(
          (w) => w.parentEventId === trackWorkoutId,
        )
      : []
    const descriptionWorkoutIds = event
      ? [event.workoutId, ...childEvents.map((c) => c.workoutId)]
      : []

    const descriptionsResult =
      divisionIds.length > 0 && descriptionWorkoutIds.length > 0
        ? await getBatchWorkoutDivisionDescriptionsFn({
            data: { workoutIds: descriptionWorkoutIds, divisionIds },
          })
        : {
            descriptionsByWorkout: {} as Record<string, DivisionDescription[]>,
          }

    return {
      event,
      resources: eventResult.resources,
      heatTimes: eventResult.heatTimes,
      judgingSheets: judgingSheetsResult.sheets,
      eventDivisionMappings,
      workouts: allWorkoutsResult.workouts,
      venue: venueResult.venue,
      descriptionsByWorkout: descriptionsResult.descriptionsByWorkout,
    }
  })
