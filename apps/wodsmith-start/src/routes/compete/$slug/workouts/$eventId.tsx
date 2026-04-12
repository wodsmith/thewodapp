import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Dumbbell,
  ExternalLink,
  FileText,
  Filter,
  Link as LinkIcon,
  MapPin,
  Target,
  Timer,
  Trophy,
} from "lucide-react"
import { z } from "zod"
import { VideoSubmissionForm } from "@/components/compete/video-submission-form"
import { CompetitionTabs } from "@/components/competition-tabs"
import { EventHeatSchedule } from "@/components/event-heat-schedule"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { getUserCompetitionRegistrationsFn } from "@/server-fns/competition-detail-fns"
import {
  getPublicEventHeatsFn,
  getVenueForTrackWorkoutByDivisionFn,
} from "@/server-fns/competition-heats-fns"
import {
  getPublicEventDetailsFn,
  getPublishedCompetitionWorkoutsFn,
  getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { getPublicEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getEventJudgingSheetsFn } from "@/server-fns/judging-sheet-fns"
import { getVideoSubmissionFn } from "@/server-fns/video-submission-fns"
import { getGoogleMapsUrl, hasAddressData } from "@/utils/address"
import { getSessionFromCookie } from "@/utils/auth"
import { formatTrackOrder } from "@/utils/format-track-order"

const eventSearchSchema = z.object({
  division: z.string().optional(),
})

// Server function to get ALL athlete registered divisions for this competition
const getAthleteRegisteredDivisionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ competitionId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.user?.id) {
      return { divisionIds: [] }
    }

    const result = await getUserCompetitionRegistrationsFn({
      data: { competitionId: data.competitionId, userId: session.user.id },
    })

    const divisionIds = result.registrations
      .map((r) => r.divisionId)
      .filter((id): id is string => id !== null)

    return { divisionIds }
  })

export const Route = createFileRoute("/compete/$slug/workouts/$eventId")({
  component: EventDetailsPage,
  validateSearch: (search) => eventSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ division: search.division }),
  loader: async ({ params, parentMatchPromise, deps }) => {
    const { eventId } = params

    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    const parentDivisions = parentMatch.loaderData?.divisions

    if (!competition) {
      throw notFound()
    }

    // Fetch event details, judging sheets, athlete's registered divisions,
    // and event-division mappings in parallel
    const [
      eventResult,
      judgingSheetsResult,
      athleteDivisionsResult,
      eventDivisionMappingResult,
    ] = await Promise.all([
      getPublicEventDetailsFn({
        data: { eventId, competitionId: competition.id },
      }),
      getEventJudgingSheetsFn({ data: { trackWorkoutId: eventId } }),
      getAthleteRegisteredDivisionsFn({
        data: { competitionId: competition.id },
      }),
      getPublicEventDivisionMappingsFn({
        data: { competitionId: competition.id },
      }),
    ])

    if (!eventResult.event) {
      throw notFound()
    }

    // Use divisions from parent
    const divisions = parentDivisions ?? []
    let divisionDescriptions: Array<{
      divisionId: string
      divisionLabel: string
      description: string | null
      position: number
    }> = []

    if (divisions.length > 0) {
      const descResult = await getWorkoutDivisionDescriptionsFn({
        data: {
          workoutId: eventResult.event.workoutId,
          divisionIds: divisions.map((d) => d.id),
        },
      })
      divisionDescriptions = descResult.descriptions
    }

    // Fetch venue for the first division (default)
    const defaultDivisionId = divisions.length > 0 ? divisions[0].id : null
    const venueResult = defaultDivisionId
      ? await getVenueForTrackWorkoutByDivisionFn({
          data: { trackWorkoutId: eventId, divisionId: defaultDivisionId },
        })
      : { venue: null }

    // Resolve athlete's registered divisions with labels
    const athleteRegisteredDivisionIds = athleteDivisionsResult.divisionIds
    const athleteRegisteredDivisions = athleteRegisteredDivisionIds
      .map((divId) => {
        const div = divisions.find((d) => d.id === divId)
        return div ? { divisionId: div.id, label: div.label } : null
      })
      .filter((d): d is { divisionId: string; label: string } => d !== null)

    // Defer heat schedule fetch - not needed for initial render
    const deferredEventHeats =
      eventResult.event.heatStatus === "published"
        ? getPublicEventHeatsFn({ data: { trackWorkoutId: eventId } })
        : Promise.resolve({ heats: [] })

    // Fetch all events - needed for child events and division-filtered "Event X of Y"
    const allWorkoutsResult = await getPublishedCompetitionWorkoutsFn({
      data: { competitionId: competition.id },
    })
    const childEvents = allWorkoutsResult.workouts
      .filter((w) => w.parentEventId === eventId)
      .sort((a, b) => a.trackOrder - b.trackOrder)

    // Top-level events for "Event X of Y" display (filtered by division in component)
    const allTopLevelEvents = allWorkoutsResult.workouts
      .filter((w) => !w.parentEventId)
      .sort((a, b) => a.trackOrder - b.trackOrder)
      .map((w) => ({ id: w.id, trackOrder: w.trackOrder }))

    // For online competitions, fetch video submissions
    // Prefer the URL's division param when it matches a registered AND event-mapped division,
    // so that the form initializes with the correct teamSize for team divisions.
    // Filter athlete divisions by event-division mappings (same logic as component-side filtering)
    const loaderEventMappings = eventDivisionMappingResult
    const loaderMappedDivisionIds = (() => {
      if (!loaderEventMappings.hasMappings || !athleteRegisteredDivisionIds.length) {
        return athleteRegisteredDivisionIds
      }
      const parentId = eventResult.event.parentEventId
      const relevantMappings = loaderEventMappings.mappings.filter(
        (m) =>
          m.trackWorkoutId === eventId ||
          (parentId && m.trackWorkoutId === parentId),
      )
      if (relevantMappings.length === 0) return athleteRegisteredDivisionIds
      const mappedSet = new Set(relevantMappings.map((m) => m.divisionId))
      return athleteRegisteredDivisionIds.filter((id) => mappedSet.has(id))
    })()
    const initialSubmissionDivisionId =
      (deps.division && loaderMappedDivisionIds.includes(deps.division)
        ? deps.division
        : loaderMappedDivisionIds[0]) ?? undefined
    const hasChildEvents = childEvents.length > 0

    // If event has children, fetch submissions per child; otherwise fetch for this event
    let videoSubmissionResult: Awaited<
      ReturnType<typeof getVideoSubmissionFn>
    > | null = null
    const childVideoSubmissions: Record<
      string,
      Awaited<ReturnType<typeof getVideoSubmissionFn>>
    > = {}

    if (competition.competitionType === "online") {
      if (hasChildEvents) {
        const childResults = await Promise.all(
          childEvents.map((child) =>
            getVideoSubmissionFn({
              data: {
                trackWorkoutId: child.id,
                competitionId: competition.id,
                divisionId: initialSubmissionDivisionId,
              },
            }),
          ),
        )
        for (let i = 0; i < childEvents.length; i++) {
          childVideoSubmissions[childEvents[i].id] = childResults[i]
        }
      } else {
        videoSubmissionResult = await getVideoSubmissionFn({
          data: {
            trackWorkoutId: eventId,
            competitionId: competition.id,
            divisionId: initialSubmissionDivisionId,
          },
        })
      }
    }

    // If this is a sub-event, find the parent event for context
    const parentEvent = eventResult.event.parentEventId
      ? (allWorkoutsResult.workouts.find(
          (w) => w.id === eventResult.event.parentEventId,
        ) ?? null)
      : null

    // Fetch division descriptions for children
    const childDivisionDescriptions: Record<
      string,
      Array<{
        divisionId: string
        divisionLabel: string
        description: string | null
        position: number
      }>
    > = {}
    if (childEvents.length > 0 && divisions.length > 0) {
      const divisionIds = divisions.map((d) => d.id)
      const results = await Promise.all(
        childEvents.map((child) =>
          getWorkoutDivisionDescriptionsFn({
            data: { workoutId: child.workoutId, divisionIds },
          }),
        ),
      )
      for (let i = 0; i < childEvents.length; i++) {
        childDivisionDescriptions[childEvents[i].workoutId] =
          results[i].descriptions
      }
    }

    // Determine if athlete's division is mapped to this event
    // Events with no mappings are visible to all divisions.
    // Only events with explicit mappings are filtered by division.
    const eventMappings = eventDivisionMappingResult
    let isEventMappedToAthleteDivision = true
    if (eventMappings.hasMappings && athleteRegisteredDivisionIds.length > 0) {
      const parentId = eventResult.event.parentEventId
      // Check if this event (or parent) has ANY mappings at all
      const eventHasMappings = eventMappings.mappings.some(
        (m) =>
          m.trackWorkoutId === eventId ||
          (parentId && m.trackWorkoutId === parentId),
      )
      // Only filter if this event has explicit mappings
      if (eventHasMappings) {
        isEventMappedToAthleteDivision = eventMappings.mappings.some(
          (m) =>
            athleteRegisteredDivisionIds.includes(m.divisionId) &&
            (m.trackWorkoutId === eventId ||
              (parentId && m.trackWorkoutId === parentId)),
        )
      }
    }

    return {
      competition,
      event: eventResult.event,
      resources: eventResult.resources,
      judgingSheets: judgingSheetsResult.sheets,
      heatTimes: eventResult.heatTimes,
      allTopLevelEvents,
      divisionDescriptions,
      divisions,
      athleteRegisteredDivisions,
      athleteRegisteredDivisionId: athleteRegisteredDivisionIds[0] ?? null,
      initialSubmissionDivisionId: initialSubmissionDivisionId ?? null,
      venue: venueResult.venue,
      videoSubmission: videoSubmissionResult,
      childVideoSubmissions,
      deferredEventHeats,
      childEvents,
      childDivisionDescriptions,
      parentEvent,
      isEventMappedToAthleteDivision,
      eventDivisionMappings: eventMappings,
    }
  },
})

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function getSchemeLabel(scheme: string, timeCap?: number | null): string {
  if (scheme === "time" || scheme === "time-with-cap") {
    return timeCap ? "For Time (Capped)" : "For Time"
  }
  if (scheme === "amrap") return "AMRAP"
  if (scheme === "emom") return "EMOM"
  if (scheme === "load") return "For Load"
  return scheme.replace(/-/g, " ").toUpperCase()
}

function formatHeatTime(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(new Date(date))
}

function formatEventDateFromHeatTime(
  heatTime: Date,
  timezone?: string | null,
): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone ?? undefined,
  }).format(new Date(heatTime))
}

function EventDetailsPage() {
  const {
    competition,
    event,
    resources,
    judgingSheets,
    heatTimes,
    allTopLevelEvents,
    divisionDescriptions,
    divisions,
    athleteRegisteredDivisions,
    athleteRegisteredDivisionId,
    initialSubmissionDivisionId,
    venue,
    videoSubmission,
    childVideoSubmissions,
    deferredEventHeats,
    childEvents,
    childDivisionDescriptions,
    parentEvent,
    isEventMappedToAthleteDivision,
    eventDivisionMappings,
  } = Route.useLoaderData()
  const { slug, eventId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const workout = event.workout
  const formattedTimeCap = workout.timeCap ? formatTime(workout.timeCap) : null
  const schemeLabel = getSchemeLabel(workout.scheme, workout.timeCap)

  // Filter divisions by event-division mappings (if configured).
  // If this specific event has no mappings, show all divisions (unmapped = visible to all).
  const filteredDivisions =
    eventDivisionMappings.hasMappings && divisions
      ? (() => {
          const parentId = event.parentEventId
          const eventMappings = eventDivisionMappings.mappings.filter(
            (m) =>
              m.trackWorkoutId === eventId ||
              (parentId && m.trackWorkoutId === parentId),
          )
          // No mappings for this specific event → show all divisions
          if (eventMappings.length === 0) return divisions
          const mappedDivisionIds = new Set(eventMappings.map((m) => m.divisionId))
          return divisions.filter((d) => mappedDivisionIds.has(d.id))
        })()
      : divisions

  // Filter the athlete's registered divisions by event-division mappings
  // so the division picker only shows divisions mapped to this event
  const filteredRegisteredDivisions = (() => {
    if (!eventDivisionMappings.hasMappings || !athleteRegisteredDivisions.length) {
      return athleteRegisteredDivisions
    }
    const parentId = event.parentEventId
    const eventMappings = eventDivisionMappings.mappings.filter(
      (m) =>
        m.trackWorkoutId === eventId ||
        (parentId && m.trackWorkoutId === parentId),
    )
    if (eventMappings.length === 0) return athleteRegisteredDivisions
    const mappedDivisionIds = new Set(eventMappings.map((m) => m.divisionId))
    return athleteRegisteredDivisions.filter((d) => mappedDivisionIds.has(d.divisionId))
  })()

  // Constrain initialDivisionId to filtered divisions so unmapped divisions aren't used
  const effectiveSubmissionDivisionId =
    initialSubmissionDivisionId &&
    filteredRegisteredDivisions.some(
      (d) => d.divisionId === initialSubmissionDivisionId,
    )
      ? initialSubmissionDivisionId
      : filteredRegisteredDivisions[0]?.divisionId

  // For sidebar submission window display, use the first child's data for parent events
  const sidebarSubmission =
    videoSubmission ??
    (childEvents.length > 0
      ? Object.values(childVideoSubmissions)[0] ?? null
      : null)

  // Sort division descriptions by position
  const sortedDivisions = [...divisionDescriptions].sort(
    (a, b) => a.position - b.position,
  )

  // Default to athlete's registered division, otherwise first filtered division
  const defaultDivisionId =
    athleteRegisteredDivisionId ||
    (filteredDivisions && filteredDivisions.length > 0
      ? filteredDivisions[0].id
      : undefined)
  const selectedDivisionId = search.division || defaultDivisionId

  // Get the selected division's scale info (separate from base description)
  const selectedDivision = sortedDivisions.find(
    (d) => d.divisionId === selectedDivisionId,
  )
  const divisionScale = selectedDivision?.description?.trim() || null
  const divisionLabel = selectedDivision?.divisionLabel || null

  // Compute division-filtered "Event X of Y" display
  const visibleTopLevelEvents = (() => {
    if (!eventDivisionMappings.hasMappings || !selectedDivisionId) {
      return allTopLevelEvents
    }
    const eventsWithMappings = new Set(
      eventDivisionMappings.mappings.map((m) => m.trackWorkoutId),
    )
    const mappedToSelectedDiv = new Set(
      eventDivisionMappings.mappings
        .filter((m) => m.divisionId === selectedDivisionId)
        .map((m) => m.trackWorkoutId),
    )
    return allTopLevelEvents.filter(
      (e) => !eventsWithMappings.has(e.id) || mappedToSelectedDiv.has(e.id),
    )
  })()
  const lookupId = event.parentEventId ?? event.id
  const eventPosition =
    visibleTopLevelEvents.findIndex((e) => e.id === lookupId) + 1
  const totalVisibleEvents = visibleTopLevelEvents.length

  const handleDivisionChange = (divisionId: string) => {
    navigate({
      search: (prev) => ({ ...prev, division: divisionId }),
      replace: true,
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main Content */}
      <div className="space-y-4">
        {/* Competition Tabs */}
        <div className="sticky top-4 z-10">
          <CompetitionTabs slug={slug} />
        </div>

        {/* Back to Workouts */}
        <Link
          to="/compete/$slug/workouts"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Workouts
        </Link>

        {/* Glassmorphism Content Container */}
        <div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <div className="space-y-8">
            {/* Header with Division Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs font-medium">
                    Event {eventPosition > 0 ? eventPosition : formatTrackOrder(event.trackOrder)} of {totalVisibleEvents}
                  </Badge>
                  {event.sponsorName && (
                    <span className="text-xs text-muted-foreground">
                      Presented by{" "}
                      <span className="font-medium">{event.sponsorName}</span>
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {workout.name}
                </h1>
                {parentEvent && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Part of{" "}
                      <span className="font-medium">
                        {parentEvent.workout.name}
                      </span>
                    </p>
                    {parentEvent.workout.description && (
                      <p className="text-sm text-muted-foreground">
                        {parentEvent.workout.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {filteredDivisions && filteredDivisions.length > 0 && (
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
                      {filteredDivisions.map((division) => (
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

            {/* Event Description */}
            <div className="space-y-4">
              {/* Base workout description */}
              {workout.description && (
                <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                  {workout.description}
                </div>
              )}

              {/* Division-specific scale info */}
              {divisionScale && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-start gap-3">
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs font-medium"
                    >
                      {divisionLabel || "Division"}
                    </Badge>
                    <p className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                      {divisionScale}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sub-Workouts (parent events only) */}
            {childEvents.length > 0 && (
              <div className="space-y-6">
                <Separator />
                {childEvents.map((child) => {
                  const childDescriptions =
                    childDivisionDescriptions[child.workoutId] ?? []
                  const childDivisionDesc = childDescriptions.find(
                    (d) => d.divisionId === selectedDivisionId,
                  )
                  const childScale =
                    childDivisionDesc?.description?.trim() || null
                  const childScheme = getSchemeLabel(
                    child.workout.scheme,
                    child.workout.timeCap,
                  )
                  const childSubmission =
                    childVideoSubmissions[child.id] ?? null

                  return (
                    <div key={child.id} className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {child.workout.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {childScheme}
                          </Badge>
                          {child.pointsMultiplier &&
                            child.pointsMultiplier !== 100 && (
                              <span className="text-xs text-muted-foreground">
                                {child.pointsMultiplier / 100}x points
                              </span>
                            )}
                        </div>
                        <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                          {child.workout.description || "Details coming soon."}
                        </div>
                        {childScale && (
                          <div className="flex items-start gap-2 mt-1">
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-xs"
                            >
                              {childDivisionDesc?.divisionLabel || "Division"}
                            </Badge>
                            <p className="font-mono text-sm whitespace-pre-wrap text-muted-foreground">
                              {childScale}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Per-sub-event submission form for online competitions */}
                      {competition.competitionType === "online" &&
                        childSubmission && (
                          <VideoSubmissionForm
                            trackWorkoutId={child.id}
                            competitionId={competition.id}
                            timezone={competition.timezone}
                            registeredDivisions={filteredRegisteredDivisions}
                            initialData={childSubmission}
                            initialDivisionId={effectiveSubmissionDivisionId}
                          />
                        )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Heat Schedule */}
            {event.heatStatus === "published" && (
              <EventHeatSchedule
                deferredHeats={deferredEventHeats}
                timezone={competition.timezone}
              />
            )}

            {/* Video & Score Submission Form - For events without sub-events */}
            {/* Only show when event is mapped to athlete's division (or no mappings configured) */}
            {competition.competitionType === "online" &&
              videoSubmission &&
              childEvents.length === 0 &&
              isEventMappedToAthleteDivision && (
                <VideoSubmissionForm
                  trackWorkoutId={event.id}
                  competitionId={competition.id}
                  timezone={competition.timezone}
                  registeredDivisions={filteredRegisteredDivisions}
                  initialData={videoSubmission}
                  initialDivisionId={effectiveSubmissionDivisionId}
                />
              )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {/* Submission Info Card - For online competitions */}
        {competition.competitionType === "online" &&
          sidebarSubmission?.submissionWindow && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Submission Window</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Opens
                    </p>
                    <p className="font-medium text-sm">
                      {formatHeatTime(
                        new Date(sidebarSubmission.submissionWindow.opensAt),
                        competition.timezone,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Closes
                    </p>
                    <p className="font-medium text-sm">
                      {formatHeatTime(
                        new Date(sidebarSubmission.submissionWindow.closesAt),
                        competition.timezone,
                      )}
                    </p>
                  </div>
                </div>
                {sidebarSubmission.canSubmit ? (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Submission window is open
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {sidebarSubmission.reason}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        {/* Event Info Card - Metadata */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Workout Type */}
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Format
                </p>
                <p className="font-medium text-sm">{schemeLabel}</p>
              </div>
            </div>

            {/* Time Cap */}
            {formattedTimeCap && (
              <div className="flex items-start gap-3">
                <Timer className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Time Cap
                  </p>
                  <p className="font-medium text-sm">{formattedTimeCap}</p>
                </div>
              </div>
            )}

            {/* Movements */}
            {workout.movements && workout.movements.length > 0 && (
              <div className="flex items-start gap-3">
                <Dumbbell className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Movements
                  </p>
                  <p className="font-medium text-sm">
                    {workout.movements
                      .map((m: { id: string; name: string }) => m.name)
                      .join(", ")}
                  </p>
                </div>
              </div>
            )}

            {heatTimes && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Date
                  </p>
                  <p className="font-medium text-sm">
                    {formatEventDateFromHeatTime(
                      heatTimes.firstHeatStartTime,
                      competition.timezone,
                    )}
                  </p>
                </div>
              </div>
            )}

            {event.pointsMultiplier && event.pointsMultiplier !== 100 && (
              <div className="flex items-start gap-3">
                <Trophy className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Points Multiplier
                  </p>
                  <p className="font-medium text-sm">
                    {event.pointsMultiplier / 100}x
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Card */}
        {heatTimes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      First Heat Starts
                    </p>
                    <p className="font-medium text-sm">
                      {formatHeatTime(
                        heatTimes.firstHeatStartTime,
                        competition.timezone,
                      )}
                    </p>
                  </div>
                </div>
                {heatTimes.firstHeatStartTime.getTime() !==
                  heatTimes.lastHeatEndTime.getTime() && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Last Heat Ends
                      </p>
                      <p className="font-medium text-sm">
                        {formatHeatTime(
                          heatTimes.lastHeatEndTime,
                          competition.timezone,
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Timezone: {competition.timezone}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Venue Card */}
        {venue?.address && hasAddressData(venue.address) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Venue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{venue.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {venue.address.streetLine1}
                      {venue.address.streetLine2 && (
                        <>
                          <br />
                          {venue.address.streetLine2}
                        </>
                      )}
                      {(venue.address.city ||
                        venue.address.stateProvince ||
                        venue.address.postalCode) && (
                        <>
                          <br />
                          {[venue.address.city, venue.address.stateProvince]
                            .filter(Boolean)
                            .join(", ")}{" "}
                          {venue.address.postalCode}
                        </>
                      )}
                      {venue.address.countryCode &&
                        venue.address.countryCode !== "US" && (
                          <>
                            <br />
                            {venue.address.countryCode}
                          </>
                        )}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a
                    href={getGoogleMapsUrl(venue.address) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Get Directions
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Resources Card */}
        {resources && resources.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {resources.map((resource) => (
                  <li key={resource.id}>
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-sm hover:text-primary transition-colors group"
                      >
                        <LinkIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        <span className="flex-1">{resource.title}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">{resource.title}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Judge Sheets Card */}
        {judgingSheets && judgingSheets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Workout Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {judgingSheets.map((sheet) => (
                  <li key={sheet.id}>
                    <a
                      href={sheet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm hover:text-primary transition-colors group"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span className="flex-1">{sheet.title}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  )
}
