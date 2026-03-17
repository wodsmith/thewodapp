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
  getBatchWorkoutDivisionDescriptionsFn,
  getPublishedCompetitionWorkoutsWithDetailsFn,
  type DivisionDescription,
} from "@/server-fns/competition-workouts-fns"
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
      }
    }

    const competitionId = competition.id

    // Defer schedule data - not needed for initial render
    const deferredSchedule = getPublicScheduleDataFn({
      data: { competitionId },
    })

    // Fetch workouts and optionally user's registered division in parallel
    const [workoutsResult, athleteDivisionResult] = await Promise.all([
      getPublishedCompetitionWorkoutsWithDetailsFn({
        data: { competitionId },
      }),
      getAthleteRegisteredDivisionFn({
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

/**
 * Format trackOrder for display:
 * - Whole numbers (standalone events): "05"
 * - Decimals (sub-events): "5.01"
 */
function formatTrackOrder(trackOrder: number): string {
  const n = Number(trackOrder)
  if (n % 1 === 0) return String(n).padStart(2, "0")
  const whole = Math.floor(n)
  const decimal = Math.round((n - whole) * 100)
  return `${whole}.${String(decimal).padStart(2, "0")}`
}

function WorkoutsList({
  workouts,
  slug,
  divisionDescriptionsMap,
  selectedDivisionId,
  athleteRegisteredDivisionId,
  submissionStatusMap,
  venueMap,
  scheduleMap,
}: {
  workouts: EnrichedWorkout[]
  slug: string
  divisionDescriptionsMap: Record<string, DivisionDescription[]>
  selectedDivisionId: string
  athleteRegisteredDivisionId: string | null
  submissionStatusMap: Record<string, SubmissionStatus>
  venueMap: Record<string, VenueInfo>
  scheduleMap: Map<string, ScheduleInfo> | null
}) {
  // Build a lookup of parent events by ID
  const parentById = new Map<string, EnrichedWorkout>()
  for (const w of workouts) {
    if (!w.parentEventId) {
      // Check if any other workout references this as parent
      const hasChildren = workouts.some((c) => c.parentEventId === w.id)
      if (hasChildren) {
        parentById.set(w.id, w)
      }
    }
  }

  // Build flat list: skip parent events (they become headers), keep everything else
  const flatItems: Array<
    | { type: "standalone"; event: EnrichedWorkout }
    | { type: "parent-header"; parent: EnrichedWorkout }
    | { type: "sub-event"; event: EnrichedWorkout; parent: EnrichedWorkout }
  > = []

  // Track which parent headers we've already inserted
  const insertedParentHeaders = new Set<string>()

  // Walk workouts in order (already sorted by trackOrder from server)
  for (const w of workouts) {
    if (parentById.has(w.id)) {
      // This is a parent event — skip it, we'll insert a header when we see its first child
      continue
    }
    if (w.parentEventId) {
      const parent = parentById.get(w.parentEventId)
      if (parent && !insertedParentHeaders.has(w.parentEventId)) {
        flatItems.push({ type: "parent-header", parent })
        insertedParentHeaders.add(w.parentEventId)
      }
      if (parent) {
        flatItems.push({ type: "sub-event", event: w, parent })
      }
    } else {
      flatItems.push({ type: "standalone", event: w })
    }
  }

  return (
    <div className="space-y-6">
      {flatItems.map((item) => {
        if (item.type === "parent-header") {
          const { parent } = item
          return (
            <div
              key={`header-${parent.id}`}
              className="flex items-center gap-3 pt-2"
            >
              <span className="font-mono text-sm font-semibold text-muted-foreground">
                {formatTrackOrder(parent.trackOrder)}
              </span>
              <h3 className="font-semibold text-lg">
                {parent.workout.name}
              </h3>
              {parent.sponsorName && (
                <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-2 py-1 rounded shrink-0">
                  Presented by {parent.sponsorName}
                </span>
              )}
              <div className="flex-1 border-t border-border" />
            </div>
          )
        }

        const event =
          item.type === "standalone" ? item.event : item.event

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
