/**
 * Organizer Judge Assignments Page
 *
 * Judge scheduling and rotations for in-person competitions. Online
 * competitions are redirected to the volunteer roster.
 */

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import type { JudgeAssignmentVersion } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
  getJudgeSchedulingDataForEventsFn,
  getJudgeVolunteersFn,
} from "@/server-fns/judge-scheduling-fns"
import { JudgeSchedulingContainer } from "../-components/judges"

// Search params schema for event selection
const searchParamsSchema = z.object({
  event: z.string().optional(),
})

/** Per-event defaults for judge rotations */
interface EventDefaults {
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: LaneShiftPattern | null
  minHeatBuffer: number | null
}

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/volunteers/judges",
)({
  staleTime: 10_000,
  validateSearch: searchParamsSchema,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    // Judge scheduling only applies to in-person competitions
    if (competition.competitionType !== "in-person") {
      throw redirect({
        to: "/compete/organizer/$competitionId/volunteers",
        params: { competitionId: params.competitionId },
      })
    }

    const competitionTeamId = competition.competitionTeamId

    const [eventsResult, judges, heatsResult] = await Promise.all([
      getCompetitionWorkoutsFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
      getJudgeVolunteersFn({
        data: { competitionTeamId },
      }),
      getHeatsForCompetitionFn({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
        },
      }),
    ])

    const events = eventsResult.workouts
    const heats = heatsResult.heats

    // Second stage: judge scheduling data for all events in a constant
    // number of queries.
    const judgeSchedulingData = await getJudgeSchedulingDataForEventsFn({
      data: { trackWorkoutIds: events.map((event) => event.id) },
    })

    const judgeAssignments = judgeSchedulingData.judgeAssignments
    const rotations = events.flatMap(
      (event) => judgeSchedulingData.rotationsByEvent[event.id] ?? [],
    )
    // Build event defaults map for each event (cast to EventDefaults for type safety)
    const eventDefaultsMap = new Map<string, EventDefaults>()
    const versionHistoryMap = new Map<string, JudgeAssignmentVersion[]>()
    const activeVersionMap = new Map<string, JudgeAssignmentVersion | null>()
    for (const event of events) {
      const defaults = judgeSchedulingData.eventDefaultsByEvent[event.id]
      eventDefaultsMap.set(event.id, {
        defaultHeatsCount: defaults?.defaultHeatsCount ?? null,
        defaultLaneShiftPattern:
          (defaults?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
        minHeatBuffer: defaults?.minHeatBuffer ?? null,
      })
      versionHistoryMap.set(
        event.id,
        judgeSchedulingData.versionHistoryByEvent[event.id] ?? [],
      )
      activeVersionMap.set(
        event.id,
        judgeSchedulingData.activeVersionByEvent[event.id] ?? null,
      )
    }

    return {
      competition,
      events,
      heats,
      judges,
      judgeAssignments,
      rotations,
      eventDefaultsMap,
      versionHistoryMap,
      activeVersionMap,
    }
  },
  component: JudgeAssignmentsPage,
})

function JudgeAssignmentsPage() {
  const {
    competition,
    events,
    heats,
    judges,
    judgeAssignments,
    rotations,
    eventDefaultsMap,
    versionHistoryMap,
    activeVersionMap,
  } = Route.useLoaderData()

  const { event: eventFromUrl } = Route.useSearch()
  const navigate = useNavigate()

  const handleEventChange = (eventId: string) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, event: eventId }),
      replace: true,
    })
  }

  // Determine selected event - from URL or first event
  // Validate eventFromUrl exists in events before using it
  const selectedEventId =
    eventFromUrl && events.some((event) => event.id === eventFromUrl)
      ? eventFromUrl
      : events[0]?.id || ""

  return (
    <JudgeSchedulingContainer
      competitionId={competition.id}
      competitionSlug={competition.slug}
      organizingTeamId={competition.organizingTeamId}
      competitionType={competition.competitionType}
      events={events}
      heats={heats}
      judges={judges}
      judgeAssignments={judgeAssignments}
      rotations={rotations}
      eventDefaultsMap={eventDefaultsMap}
      versionHistoryMap={versionHistoryMap}
      activeVersionMap={activeVersionMap}
      competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
      competitionDefaultPattern={
        (competition.defaultLaneShiftPattern as "stay" | "shift_right") ??
        "shift_right"
      }
      selectedEventId={selectedEventId}
      onEventChange={handleEventChange}
    />
  )
}
