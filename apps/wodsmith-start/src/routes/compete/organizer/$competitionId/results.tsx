/**
 * Competition Results Route
 *
 * For in-person competitions: Organizer page for entering competition results/scores.
 * For online competitions: Shows submissions overview with links to video verification.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/page.tsx
 */
// @lat: [[organizer-dashboard#Results Entry]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getEventScoreEntryDataWithHeatsBatchFn,
  getEventScoreEntryDataWithHeatsFn,
} from "@/server-fns/competition-score-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
  type AllEventsResultsStatusResponse,
  getDivisionResultsStatusFn,
} from "@/server-fns/division-results-fns"
import { getSubmissionCountsByEventFn } from "@/server-fns/video-submission-fns"
import { ResultsPage } from "./-pages/results-page"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Search params schema for event and division selection
const searchParamsSchema = z.object({
  event: z.string().optional(),
  division: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/results",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  component: RouteComponent,
  loaderDeps: ({ search }) => ({
    eventId: search.event,
    divisionId: search.division,
  }),
  loader: async ({ params, deps, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const isOnline = competition.competitionType === "online"

    // Fetch events and divisions in parallel
    const [eventsResult, divisionsResult] = await Promise.all([
      getCompetitionWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
    ])

    const events = eventsResult.workouts
    const divisions = divisionsResult.divisions

    // For online competitions, fetch submission counts in a single aggregate
    // query for every reviewable event (sub-events when present, otherwise the
    // standalone event itself) instead of materializing per-event submission
    // rows just to count them.
    if (isOnline) {
      const reviewableEventIds: string[] = []
      for (const event of events) {
        if (event.parentEventId) {
          reviewableEventIds.push(event.id)
          continue
        }
        const hasChildren = events.some((e) => e.parentEventId === event.id)
        if (!hasChildren) reviewableEventIds.push(event.id)
      }

      const submissionCounts =
        reviewableEventIds.length > 0
          ? (
              await getSubmissionCountsByEventFn({
                data: {
                  competitionId: params.competitionId,
                  trackWorkoutIds: reviewableEventIds,
                },
              })
            ).counts
          : {}

      return {
        isOnline: true as const,
        events,
        submissionCounts,
      }
    }

    // Determine which event to show (from URL or first event)
    // Filter top-level events for the dropdown (exclude sub-events)
    const topLevelEvents = events.filter((e) => !e.parentEventId)
    // Normalize: if URL points to a child event, resolve to its parent
    const requestedEvent = deps.eventId
      ? events.find((e) => e.id === deps.eventId)
      : undefined
    const selectedEventId =
      requestedEvent?.parentEventId ??
      requestedEvent?.id ??
      topLevelEvents[0]?.id

    // Check if selected event is a parent (has children)
    const childEvents = events
      .filter((e) => e.parentEventId === selectedEventId)
      .sort((a, b) => a.trackOrder - b.trackOrder)
    const isParentEvent = childEvents.length > 0

    type ScoreEntryDataWithHeats = Awaited<
      ReturnType<typeof getEventScoreEntryDataWithHeatsFn>
    >

    // Fetch division results status and score entry data in parallel. For
    // parent events, all child events come back from one batched call
    // instead of one round trip (and query set) per child.
    const [divisionResultsStatus, scoreData] = await Promise.all([
      getDivisionResultsStatusFn({
        data: {
          competitionId: params.competitionId,
          organizingTeamId: competition.organizingTeamId,
        },
      }),
      (async (): Promise<{
        childScoreDataList: ScoreEntryDataWithHeats[]
        scoreEntryData: ScoreEntryDataWithHeats | null
      }> => {
        if (isParentEvent) {
          const batch = await getEventScoreEntryDataWithHeatsBatchFn({
            data: {
              competitionId: params.competitionId,
              organizingTeamId: competition.organizingTeamId,
              trackWorkoutIds: childEvents.map((child) => child.id),
              divisionId: deps.divisionId,
            },
          })
          return {
            // A missing entry means the child event no longer exists in the
            // DB — fail loudly like the per-child fetch used to ("Event not
            // found") instead of rendering an incomplete entry grid.
            childScoreDataList: childEvents.map((child) => {
              const childData = batch[child.id]
              if (!childData) {
                throw new Error(
                  `Missing score entry data for child event ${child.id}`,
                )
              }
              return childData
            }),
            scoreEntryData: null,
          }
        }
        const effectiveEvent = selectedEventId
          ? events.find((e) => e.id === selectedEventId)
          : undefined
        if (!effectiveEvent) {
          return { childScoreDataList: [], scoreEntryData: null }
        }
        return {
          childScoreDataList: [],
          scoreEntryData: await getEventScoreEntryDataWithHeatsFn({
            data: {
              competitionId: params.competitionId,
              organizingTeamId: competition.organizingTeamId,
              trackWorkoutId: effectiveEvent.id,
              divisionId: deps.divisionId,
            },
          }),
        }
      })(),
    ])
    const { childScoreDataList, scoreEntryData } = scoreData

    return {
      isOnline: false as const,
      events: topLevelEvents,
      divisions,
      selectedEventId,
      selectedDivisionId: deps.divisionId,
      scoreEntryData,
      childEvents,
      isParentEvent,
      childScoreDataList,
      // When called without eventId, returns AllEventsResultsStatusResponse
      divisionResultsStatus:
        divisionResultsStatus as AllEventsResultsStatusResponse,
    }
  },
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()
  const { competitionId } = Route.useParams()
  // Get competition from parent route for organizingTeamId
  const { competition } = parentRoute.useLoaderData()

  return (
    <ResultsPage
      competitionId={competitionId}
      organizingTeamId={competition.organizingTeamId}
      data={loaderData}
    />
  )
}
