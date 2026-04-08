import {
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Dumbbell, Filter } from "lucide-react"
import { z } from "zod"
import { CompetitionTabs } from "@/components/competition-tabs"
import {
  CompetitionWorkoutCard,
  type SubmissionStatus,
} from "@/components/competition-workout-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getUserCompetitionRegistrationFn } from "@/server-fns/competition-detail-fns"
import {
  getPublicScheduleDataFn,
  getVenueForTrackWorkoutFn,
  type PublicScheduleEvent,
} from "@/server-fns/competition-heats-fns"
import {
  type DivisionDescription,
  getBatchWorkoutDivisionDescriptionsFn,
  getPublishedCompetitionWorkoutsWithDetailsFn,
} from "@/server-fns/competition-workouts-fns"
import { getPublicEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getBatchSubmissionStatusFn } from "@/server-fns/video-submission-fns"
import { getSessionFromCookie } from "@/utils/auth"
import { useDeferredSchedule } from "@/utils/use-deferred-schedule"

// Server function to get athlete's registered division for this competition
const getAthleteRegisteredDivisionFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ competitionId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.user?.id) {
      return { divisionId: null }
    }

    const result = await getUserCompetitionRegistrationFn({
      data: { competitionId: data.competitionId, userId: session.user.id },
    })

    return { divisionId: result.registration?.divisionId ?? null }
  })

const parentRoute = getRouteApi("/compete/$slug")

const workoutsSearchSchema = z.object({
  division: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/workouts/")({
  component: CompetitionWorkoutsPage,
  validateSearch: (search) => workoutsSearchSchema.parse(search),
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    const divisions = parentMatch.loaderData?.divisions

    if (!competition) {
      return {
        workouts: [],
        divisionDescriptionsMap: {},
        venueMap: {},
        athleteRegisteredDivisionId: null,
        submissionStatusMap: {} as Record<string, SubmissionStatus>,
        deferredSchedule: Promise.resolve({
          events: [] as PublicScheduleEvent[],
        }),
        eventDivisionMappings: {
          mappings: [] as Array<{ trackWorkoutId: string; divisionId: string }>,
          hasMappings: false,
        },
      }
    }

    const competitionId = competition.id

    // Defer schedule data - not needed for initial render
    const deferredSchedule = getPublicScheduleDataFn({
      data: { competitionId },
    })

    // Fetch workouts, registered division, and event-division mappings in parallel
    const [workoutsResult, athleteDivisionResult, eventDivisionMappingResult] =
      await Promise.all([
        getPublishedCompetitionWorkoutsWithDetailsFn({
          data: { competitionId },
        }),
        getAthleteRegisteredDivisionFn({
          data: { competitionId },
        }),
        getPublicEventDivisionMappingsFn({
          data: { competitionId },
        }),
      ])

    const workouts = workoutsResult.workouts
    const athleteRegisteredDivisionId = athleteDivisionResult.divisionId

    // Fetch division descriptions and venues for all workouts in parallel
    const divisionIds = divisions?.map((d) => d.id) ?? []
    const divisionDescriptionsMap: Record<string, DivisionDescription[]> = {}

    type VenueInfo = {
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
    const venueMap: Record<string, VenueInfo | null> = {}

    if (divisionIds.length > 0 && workouts.length > 0) {
      const workoutIds = workouts.map((w) => w.workoutId)
      const batchResult = await getBatchWorkoutDivisionDescriptionsFn({
        data: { workoutIds, divisionIds },
      })
      Object.assign(divisionDescriptionsMap, batchResult.descriptionsByWorkout)
    }

    // Fetch venue data for each workout
    if (workouts.length > 0) {
      const venuePromises = workouts.map(async (event) => {
        const result = await getVenueForTrackWorkoutFn({
          data: { trackWorkoutId: event.id },
        })
        return { trackWorkoutId: event.id, venueData: result }
      })

      const venueResults = await Promise.all(venuePromises)
      for (const { trackWorkoutId, venueData } of venueResults) {
        if (venueData.venue) {
          // Transform database address to simplified format
          venueMap[trackWorkoutId] = {
            id: venueData.venue.id,
            name: venueData.venue.name,
            address: venueData.venue.address
              ? {
                  streetLine1: venueData.venue.address.streetLine1 ?? undefined,
                  city: venueData.venue.address.city ?? undefined,
                  stateProvince:
                    venueData.venue.address.stateProvince ?? undefined,
                  postalCode: venueData.venue.address.postalCode ?? undefined,
                  countryCode: venueData.venue.address.countryCode ?? undefined,
                }
              : null,
          }
        } else {
          venueMap[trackWorkoutId] = null
        }
      }
    }

    // Fetch submission statuses for online competitions
    let submissionStatusMap: Record<string, SubmissionStatus> = {}
    if (
      competition.competitionType === "online" &&
      athleteRegisteredDivisionId &&
      workouts.length > 0
    ) {
      const result = await getBatchSubmissionStatusFn({
        data: {
          competitionId,
          trackWorkoutIds: workouts.map((w) => w.id),
        },
      })
      submissionStatusMap = result.statuses
    }

    return {
      workouts,
      divisionDescriptionsMap,
      venueMap,
      athleteRegisteredDivisionId,
      submissionStatusMap,
      deferredSchedule,
      eventDivisionMappings: eventDivisionMappingResult,
    }
  },
})

function CompetitionWorkoutsPage() {
  const {
    workouts,
    divisionDescriptionsMap,
    venueMap,
    athleteRegisteredDivisionId,
    submissionStatusMap,
    deferredSchedule,
    eventDivisionMappings,
  } = Route.useLoaderData()
  const { competition, divisions } = parentRoute.useLoaderData()
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const timezone = competition.timezone ?? "America/Denver"
  const scheduleMap = useDeferredSchedule({ deferredSchedule, timezone })

  // Default to athlete's registered division if logged in, otherwise first division
  const defaultDivisionId =
    athleteRegisteredDivisionId ||
    (divisions && divisions.length > 0 ? divisions[0].id : "default")
  const selectedDivisionId = search.division || defaultDivisionId

  const handleDivisionChange = (divisionId: string) => {
    navigate({
      search: (prev) => ({ ...prev, division: divisionId }),
      replace: true, // Replace history entry to avoid cluttering back button
    })
  }

  if (workouts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="sticky top-4 z-10">
          <CompetitionTabs slug={competition.slug} />
        </div>
        <div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Workouts</h2>
            <Alert variant="default" className="border-dashed">
              <Dumbbell className="h-4 w-4" />
              <AlertTitle>Workouts not yet released</AlertTitle>
              <AlertDescription>
                Competition workouts will be announced closer to the event.
                Check back soon or follow the event organizer for updates.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-4 z-10">
        <CompetitionTabs slug={competition.slug} />
      </div>
      <div className="rounded-2xl border border-black/10 bg-black/5 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <div className="space-y-8">
          {/* Header with Division Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                Workouts
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
                  {workouts.length}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Viewing variations for{" "}
                <span className="font-medium text-foreground">
                  {divisions?.find((d) => d.id === selectedDivisionId)?.label ||
                    "All Divisions"}
                </span>
              </p>
            </div>

            {divisions && divisions.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Select
                  value={selectedDivisionId}
                  onValueChange={handleDivisionChange}
                >
                  <SelectTrigger className="w-full sm:w-[240px] h-10 font-medium">
                    <SelectValue placeholder="Select Division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((division) => (
                      <SelectItem
                        key={division.id}
                        value={division.id}
                        className="cursor-pointer"
                      >
                        {division.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Workouts List */}
          <WorkoutsList
            workouts={workouts}
            slug={slug}
            divisionDescriptionsMap={divisionDescriptionsMap}
            selectedDivisionId={selectedDivisionId}
            athleteRegisteredDivisionId={athleteRegisteredDivisionId}
            submissionStatusMap={submissionStatusMap}
            venueMap={venueMap}
            scheduleMap={scheduleMap}
            eventDivisionMappings={eventDivisionMappings}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Workouts list with parent/child grouping.
 * Parent events render as expandable cards; standalone events render as-is.
 */
type EnrichedWorkout = Awaited<
  ReturnType<typeof getPublishedCompetitionWorkoutsWithDetailsFn>
>["workouts"][number]

type VenueInfo = {
  id: string
  name: string
  address: {
    streetLine1?: string
    city?: string
    stateProvince?: string
    postalCode?: string
    countryCode?: string
  } | null
} | null

type ScheduleInfo = {
  startTime: string
  endTime: string | null
  heatCount: number
  venueName: string | null
  divisions: string[]
} | null

function WorkoutsList({
  workouts,
  slug,
  divisionDescriptionsMap,
  selectedDivisionId,
  athleteRegisteredDivisionId,
  submissionStatusMap,
  venueMap,
  scheduleMap,
  eventDivisionMappings,
}: {
  workouts: EnrichedWorkout[]
  slug: string
  divisionDescriptionsMap: Record<string, DivisionDescription[]>
  selectedDivisionId: string
  athleteRegisteredDivisionId: string | null
  submissionStatusMap: Record<string, SubmissionStatus>
  venueMap: Record<string, VenueInfo>
  scheduleMap: Map<string, ScheduleInfo> | null
  eventDivisionMappings: {
    mappings: Array<{ trackWorkoutId: string; divisionId: string }>
    hasMappings: boolean
  }
}) {
  // Show only top-level events (standalone + parents). Sub-events are shown on the parent's detail page.
  let topLevelWorkouts = workouts.filter((w) => !w.parentEventId)

  // Filter by event-division mappings when they exist
  if (eventDivisionMappings.hasMappings && selectedDivisionId) {
    const mappedEventIds = new Set(
      eventDivisionMappings.mappings
        .filter((m) => m.divisionId === selectedDivisionId)
        .map((m) => m.trackWorkoutId),
    )
    topLevelWorkouts = topLevelWorkouts.filter((w) => mappedEventIds.has(w.id))
  }

  return (
    <div className="space-y-6">
      {topLevelWorkouts.map((event) => {
        return (
          <CompetitionWorkoutCard
            key={event.id}
            eventId={event.id}
            slug={slug}
            trackOrder={event.trackOrder}
            name={event.workout.name}
            scheme={event.workout.scheme}
            description={event.workout.description}
            roundsToScore={event.workout.roundsToScore}
            pointsMultiplier={event.pointsMultiplier}
            movements={event.workout.movements}
            tags={event.workout.tags}
            divisionDescriptions={
              divisionDescriptionsMap?.[event.workoutId] ?? []
            }
            sponsorName={event.sponsorName}
            sponsorLogoUrl={event.sponsorLogoUrl}
            selectedDivisionId={selectedDivisionId}
            isRegistered={!!athleteRegisteredDivisionId}
            submissionStatus={submissionStatusMap[event.id] ?? null}
            timeCap={event.workout.timeCap}
            venue={venueMap?.[event.id]}
            schedule={scheduleMap?.get(event.id) ?? null}
          />
        )
      })}
    </div>
  )
}
