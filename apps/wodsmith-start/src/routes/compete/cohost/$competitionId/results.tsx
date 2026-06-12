/**
 * Cohost Competition Results Route
 *
 * Renders the shared organizer ResultsPage with cohost-permissioned
 * publish/save callbacks and cohost link targets so the page stays in sync
 * with the organizer route. The loader uses cohost server fns with
 * FORBIDDEN graceful-degradation catch defaults.
 */

import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback } from "react"
import { z } from "zod"
import type { SaveScoreFn } from "@/components/organizer/results/results-entry-form"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import {
  type AllEventsResultsStatusResponse,
  cohostGetDivisionResultsStatusFn,
  cohostPublishDivisionResultsFn,
} from "@/server-fns/cohost/cohost-results-fns"
import { cohostGetHeatsForCompetitionFn } from "@/server-fns/cohost/cohost-schedule-fns"
import {
  cohostGetEventScoreEntryDataFn,
  cohostSaveCompetitionScoreFn,
} from "@/server-fns/cohost/cohost-scoring-fns"
import { cohostGetEventSubmissionsFn } from "@/server-fns/cohost/cohost-submission-fns"
import { cohostGetWorkoutsFn } from "@/server-fns/cohost/cohost-workout-fns"
import { ResultsPage } from "../../organizer/$competitionId/-pages/results-page"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

// Search params schema for event and division selection
const searchParamsSchema = z.object({
  event: z.string().optional(),
  division: z.string().optional(),
})

export const Route = createFileRoute("/compete/cohost/$competitionId/results")({
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

    const competitionTeamId = competition.competitionTeamId!
    const isOnline = competition.competitionType === "online"

    // Fetch events and divisions in parallel
    const [eventsResult, divisionsResult] = await Promise.all([
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
    ])

    const events = eventsResult.workouts
    const divisions = divisionsResult.divisions

    // For online competitions, fetch submissions for each event and aggregate
    // to the {total, reviewed, pending} shape the shared page expects.
    // Cohost submissions come from score verification status, so "reviewed"
    // means the verification status moved past "pending".
    if (isOnline) {
      const countEntries = await Promise.all(
        events.map(async (event) => {
          const submissionsResult = await cohostGetEventSubmissionsFn({
            data: {
              competitionTeamId,
              competitionId: params.competitionId,
              trackWorkoutId: event.id,
            },
          }).catch(() => ({ submissions: [] }))
          const { submissions } = submissionsResult
          const pending = submissions.filter(
            (s: { status: string }) => s.status === "pending",
          ).length
          return [
            event.id,
            {
              total: submissions.length,
              reviewed: submissions.length - pending,
              pending,
            },
          ] as const
        }),
      )

      return {
        isOnline: true as const,
        events,
        submissionCounts: Object.fromEntries(countEntries),
      }
    }

    // For in-person competitions, fetch score entry data
    const divisionResultsStatus = await cohostGetDivisionResultsStatusFn({
      data: {
        competitionTeamId,
        competitionId: params.competitionId,
      },
    }).catch(
      () =>
        ({
          divisions: [],
          events: [],
          totalPublishedCount: 0,
          totalCombinations: 0,
        }) as AllEventsResultsStatusResponse,
    )

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

    // Fetch heats for building score entry data with heat groupings
    const heatsResult = await cohostGetHeatsForCompetitionFn({
      data: {
        competitionTeamId,
        competitionId: params.competitionId,
      },
    }).catch(() => ({ heats: [] }))
    const allHeats = heatsResult.heats

    // For parent events, load score data for ALL child events in parallel
    let childScoreDataList: Array<
      Awaited<ReturnType<typeof cohostGetEventScoreEntryDataFn>> & {
        heats: typeof processedHeats
        unassignedRegistrationIds: string[]
      }
    > = []
    let scoreEntryData:
      | (Awaited<ReturnType<typeof cohostGetEventScoreEntryDataFn>> & {
          heats: typeof processedHeats
          unassignedRegistrationIds: string[]
        })
      | null = null

    // Helper: build heats and unassigned IDs from score data and heat data
    function buildHeatsForEvent(
      trackWorkoutId: string,
      athletes: Array<{ registrationId: string }>,
    ) {
      const eventHeats = allHeats
        .filter((h: any) => h.trackWorkoutId === trackWorkoutId)
        .sort((a: any, b: any) => a.heatNumber - b.heatNumber)

      const assignedRegistrationIds = new Set<string>()
      const heats = eventHeats.map((heat: any) => {
        for (const assignment of heat.assignments ?? []) {
          assignedRegistrationIds.add(
            assignment.registration?.id ?? assignment.registrationId,
          )
        }
        return {
          heatId: heat.id,
          heatNumber: heat.heatNumber,
          scheduledTime: heat.scheduledTime,
          venue: heat.venue,
          division: heat.division,
          assignments: (heat.assignments ?? []).map((a: any) => ({
            laneNumber: a.laneNumber,
            registrationId: a.registration?.id ?? a.registrationId,
          })),
        }
      })

      const allRegistrationIds = new Set(athletes.map((a) => a.registrationId))
      const unassignedRegistrationIds = [...allRegistrationIds].filter(
        (id) => !assignedRegistrationIds.has(id),
      )

      return { heats, unassignedRegistrationIds }
    }

    if (isParentEvent && childEvents.length > 0) {
      const childScoreResults = await Promise.all(
        childEvents.map((child) =>
          cohostGetEventScoreEntryDataFn({
            data: {
              competitionTeamId,
              competitionId: params.competitionId,
              trackWorkoutId: child.id,
              divisionId: deps.divisionId,
            },
          }).catch(() => ({ athletes: [], event: null as any, divisions: [] })),
        ),
      )
      childScoreDataList = childScoreResults.map((scoreData, i) => {
        const { heats, unassignedRegistrationIds } = buildHeatsForEvent(
          childEvents[i].id,
          scoreData.athletes,
        )
        return { ...scoreData, heats, unassignedRegistrationIds }
      })
    } else if (selectedEventId && !isParentEvent) {
      // Standalone event - load single score entry data
      const effectiveEvent = events.find((e) => e.id === selectedEventId)
      if (effectiveEvent) {
        const scoreData = await cohostGetEventScoreEntryDataFn({
          data: {
            competitionTeamId,
            competitionId: params.competitionId,
            trackWorkoutId: effectiveEvent.id,
            divisionId: deps.divisionId,
          },
        }).catch(() => ({ athletes: [], event: null as any, divisions: [] }))
        const { heats, unassignedRegistrationIds } = buildHeatsForEvent(
          effectiveEvent.id,
          scoreData.athletes,
        )
        scoreEntryData = { ...scoreData, heats, unassignedRegistrationIds }
      }
    }

    // Processed heats type for reference
    const processedHeats: Array<{
      heatId: string
      heatNumber: number
      scheduledTime: Date | null
      venue: any
      division: any
      assignments: Array<{ laneNumber: number; registrationId: string }>
    }> = []

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
      divisionResultsStatus:
        divisionResultsStatus as AllEventsResultsStatusResponse,
    }
  },
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()
  const { competitionId } = Route.useParams()
  const router = useRouter()

  // Get competition from parent route
  const { competition } = parentRoute.useLoaderData()
  const competitionTeamId = competition.competitionTeamId!

  // Wrap server function for client-side publishing
  const publishDivisionResults = useServerFn(cohostPublishDivisionResultsFn)

  // Cohost-permissioned score saving - wraps the cohost server function
  const handleSaveScore = useCallback<SaveScoreFn>(
    async (params) => {
      const result = await cohostSaveCompetitionScoreFn({
        data: {
          competitionTeamId,
          competitionId: params.competitionId,
          trackWorkoutId: params.trackWorkoutId,
          workoutId: params.workoutId,
          registrationId: params.registrationId,
          userId: params.userId,
          divisionId: params.divisionId,
          score: params.score,
          scoreStatus: params.scoreStatus as
            | "scored"
            | "cap"
            | "dq"
            | "withdrawn"
            | "dns"
            | "dnf",
          tieBreakScore: params.tieBreakScore,
          secondaryScore: params.secondaryScore,
          roundScores: params.roundScores,
          workout: params.workout,
        },
      })
      await router.invalidate()
      return { resultId: result.scoreId, isNew: true }
    },
    [router, competitionTeamId],
  )

  return (
    <ResultsPage
      competitionId={competitionId}
      organizingTeamId={competition.organizingTeamId}
      data={loaderData}
      saveScore={handleSaveScore}
      onPublishDivisionResults={async ({ eventId, divisionId, publish }) => {
        await publishDivisionResults({
          data: {
            competitionTeamId,
            competitionId,
            eventId,
            divisionId,
            publish,
          },
        })
      }}
      submissionsRoute="/compete/cohost/$competitionId/events/$eventId/submissions"
    />
  )
}
