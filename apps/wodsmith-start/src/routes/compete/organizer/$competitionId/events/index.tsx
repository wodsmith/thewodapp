/**
 * Competition Events Route
 *
 * Organizer page for managing competition events (workouts).
 * Fetches events, divisions, movements, and sponsors in parallel.
 * Uses parent route loader data for competition data.
 */
// @lat: [[organizer-dashboard#Event Management]]

import {
  createFileRoute,
  getRouteApi,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Info } from "lucide-react"
import { z } from "zod"
import { EventDivisionMapper } from "@/components/event-division-mapper"
import { OrganizerEventManager } from "@/components/events/organizer-event-manager"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getBatchWorkoutDivisionDescriptionsFn,
  getCompetitionWorkoutsFn,
} from "@/server-fns/competition-workouts-fns"
import { getEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getCompetitionEventSeriesMappingStatusFn } from "@/server-fns/series-event-template-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

const eventsSearchSchema = z.object({
  tab: z.enum(["workouts", "advanced-settings"]).optional().default("workouts"),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/events/",
)({
  staleTime: 10_000,
  component: EventsPage,
  validateSearch: eventsSearchSchema,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    // Parallel fetch events, divisions, movements, sponsors, and series mapping status
    const [
      eventsResult,
      divisionsResult,
      movementsResult,
      sponsorsResult,
      seriesMappingStatus,
      mappingData,
    ] = await Promise.all([
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
      getAllMovementsFn(),
      getCompetitionSponsorsFn({
        data: { competitionId: params.competitionId },
      }),
      getCompetitionEventSeriesMappingStatusFn({
        data: { competitionId: params.competitionId },
      }),
      getEventDivisionMappingsFn({
        data: { competitionId: params.competitionId },
      }),
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
      const result = await getBatchWorkoutDivisionDescriptionsFn({
        data: { workoutIds, divisionIds },
      })
      divisionDescriptionsByWorkout = result.descriptionsByWorkout
    }

    return {
      events: eventsResult.workouts,
      divisions: divisionsResult.divisions,
      movements: movementsResult.movements,
      sponsors: allSponsors,
      divisionDescriptionsByWorkout,
      competition,
      seriesMappingStatus,
      mappingData,
    }
  },
})

function EventsPage() {
  const {
    events,
    divisions,
    movements,
    sponsors,
    divisionDescriptionsByWorkout,
    seriesMappingStatus,
    mappingData,
  } = Route.useLoaderData()
  // Get competition from parent layout loader data (for consistency with other pages)
  const { competition } = parentRoute.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()

  const handleTabChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        tab: value as "workouts" | "advanced-settings",
      }),
      replace: true,
    })
  }

  // Build a lookup map from competition event ID -> template event name
  const seriesEventMap = new Map<string, string>()
  if (seriesMappingStatus.hasTemplate) {
    for (const mapping of seriesMappingStatus.mappings) {
      seriesEventMap.set(mapping.competitionEventId, mapping.templateEventName)
    }
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="workouts">Workouts</TabsTrigger>
        <TabsTrigger value="advanced-settings">Advanced settings</TabsTrigger>
      </TabsList>

      <TabsContent value="workouts">
        <OrganizerEventManager
          competitionId={competition.id}
          organizingTeamId={competition.organizingTeamId}
          events={events}
          movements={movements}
          divisions={divisions}
          divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
          sponsors={sponsors}
          seriesName={
            seriesMappingStatus.hasTemplate
              ? seriesMappingStatus.seriesName
              : null
          }
          seriesEventMap={seriesEventMap}
        />
      </TabsContent>

      <TabsContent value="advanced-settings" className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Event visibility
          </h2>
          <p className="text-muted-foreground">
            Control which events are visible to each division when your
            competition needs division-specific workouts or variants.
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Advanced setting</AlertTitle>
          <AlertDescription>
            Most competitions can leave this alone. By default, every event is
            visible to every division. Use this only when some divisions should
            see a different event lineup.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Division event mapping</CardTitle>
            <CardDescription>
              Check the boxes to map events to divisions. Click an event name to
              toggle all divisions, or click a division header to toggle all
              events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventDivisionMapper
              competitionId={competition.id}
              data={mappingData}
              onSaved={async () => {
                await router.invalidate()
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
