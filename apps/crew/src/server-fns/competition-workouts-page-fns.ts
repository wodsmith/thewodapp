/**
 * Consolidated Public Workouts Page Data Server Function
 *
 * Collapses the data fetching for the public competition overview and
 * workouts-list pages into a single GET server function. Composes existing
 * server fns in-process (each opens its own DB connection, so the parallel
 * branches genuinely run concurrently) instead of issuing multiple
 * sequential round trips from the route loaders.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { getBatchVenuesForTrackWorkoutsFn } from "@/server-fns/competition-heats-fns"
import {
  type DivisionDescription,
  getBatchWorkoutDivisionDescriptionsFn,
  getPublishedCompetitionWorkoutsWithDetailsFn,
} from "@/server-fns/competition-workouts-fns"
import { getPublicEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getBatchSubmissionStatusFn } from "@/server-fns/video-submission-fns"

// ============================================================================
// Types
// ============================================================================

export interface PublicWorkoutVenueInfo {
  id: string
  name: string
  address: {
    streetLine1?: string
    city?: string
    stateProvince?: string
    postalCode?: string
    countryCode?: string
  } | null
}

export interface PublicEventDivisionMappings {
  mappings: Array<{ trackWorkoutId: string; divisionId: string }>
  hasMappings: boolean
}

// ============================================================================
// Input Schema
// ============================================================================

const getPublicWorkoutsPageDataInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionIds: z.array(z.string()),
  includeVenues: z.boolean().optional().default(false),
  includeSubmissionStatuses: z.boolean().optional().default(false),
})

// ============================================================================
// Server Function
// ============================================================================

/**
 * Get all data needed for the public competition workouts views in one call.
 *
 * Wave 1 (parallel): published workouts with details + event-division
 * mappings. Wave 2 (parallel, needs workout IDs from wave 1): division
 * descriptions + venues (only when `includeVenues` is set) + the viewer's
 * submission statuses (only when `includeSubmissionStatuses` is set — the
 * routes set it for registered athletes on online competitions, keeping the
 * default path fully public with no session work).
 */
export const getPublicWorkoutsPageDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getPublicWorkoutsPageDataInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const {
      competitionId,
      divisionIds,
      includeVenues,
      includeSubmissionStatuses,
    } = data

    // Wave 1: workouts and event-division mappings are independent.
    // Each in-process server fn call opens its own DB connection.
    const [workoutsResult, eventDivisionMappings] = await Promise.all([
      getPublishedCompetitionWorkoutsWithDetailsFn({
        data: { competitionId },
      }),
      getPublicEventDivisionMappingsFn({
        data: { competitionId },
      }),
    ])

    const workouts = workoutsResult.workouts
    const workoutIds = workouts.map((w) => w.workoutId)
    const trackWorkoutIds = workouts.map((w) => w.id)

    // Wave 2: division descriptions, venues, and submission statuses all
    // need the workout IDs from wave 1, so they run as one parallel batch.
    const [descriptionsResult, batchVenuesResult, submissionStatusResult] =
      await Promise.all([
        divisionIds.length > 0 && workoutIds.length > 0
          ? getBatchWorkoutDivisionDescriptionsFn({
              data: { workoutIds, divisionIds },
            })
          : Promise.resolve({
              descriptionsByWorkout: {} as Record<
                string,
                DivisionDescription[]
              >,
            }),
        includeVenues && trackWorkoutIds.length > 0
          ? getBatchVenuesForTrackWorkoutsFn({
              data: { trackWorkoutIds },
            })
          : Promise.resolve({
              venues: {} as Awaited<
                ReturnType<typeof getBatchVenuesForTrackWorkoutsFn>
              >["venues"],
            }),
        includeSubmissionStatuses && trackWorkoutIds.length > 0
          ? getBatchSubmissionStatusFn({
              data: { competitionId, trackWorkoutIds },
            })
          : Promise.resolve({
              statuses: {} as Awaited<
                ReturnType<typeof getBatchSubmissionStatusFn>
              >["statuses"],
            }),
      ])

    // Narrow raw venue rows to the shape the workout cards consume.
    const venuesMap: Record<string, PublicWorkoutVenueInfo | null> = {}
    if (includeVenues) {
      for (const trackWorkoutId of trackWorkoutIds) {
        const v = batchVenuesResult.venues[trackWorkoutId] ?? null
        if (v) {
          venuesMap[trackWorkoutId] = {
            id: v.id,
            name: v.name,
            address: v.address
              ? {
                  streetLine1: v.address.streetLine1 ?? undefined,
                  city: v.address.city ?? undefined,
                  stateProvince: v.address.stateProvince ?? undefined,
                  postalCode: v.address.postalCode ?? undefined,
                  countryCode: v.address.countryCode ?? undefined,
                }
              : null,
          }
        } else {
          venuesMap[trackWorkoutId] = null
        }
      }
    }

    return {
      workouts,
      divisionDescriptionsMap: descriptionsResult.descriptionsByWorkout,
      eventDivisionMappings,
      venuesMap,
      submissionStatuses: submissionStatusResult.statuses,
    }
  })
