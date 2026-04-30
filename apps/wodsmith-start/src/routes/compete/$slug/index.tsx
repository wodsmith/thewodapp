import { useEffect, useMemo, useState } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { AthleteScoreSubmissionPanel } from "@/components/compete/athlete-score-submission-panel"
import { CompetitionLocationCard } from "@/components/competition-location-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import {
  type ChildEvent,
  CompetitionWorkoutCard,
  type SubmissionStatus,
} from "@/components/competition-workout-card"
import { EventDetailsContent } from "@/components/event-details-content"
import { RegistrationSidebar } from "@/components/registration-sidebar"
import {
  getPublicScheduleDataFn,
  type PublicScheduleEvent,
} from "@/server-fns/competition-heats-fns"
import {
  getBatchWorkoutDivisionDescriptionsFn,
  getPublishedCompetitionWorkoutsWithDetailsFn,
  type DivisionDescription,
} from "@/server-fns/competition-workouts-fns"
import { getPublicEventDivisionMappingsFn } from "@/server-fns/event-division-mapping-fns"
import { getBatchSubmissionStatusFn } from "@/server-fns/video-submission-fns"
import { useDeferredSchedule } from "@/utils/use-deferred-schedule"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/")({
  component: CompetitionOverviewPage,
  staleTime: 30_000,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    const divisions = parentMatch.loaderData?.divisions

    if (!competition) {
      return {
        workouts: [],
        divisionDescriptionsMap: {},
        submissionStatusMap: {} as Record<string, SubmissionStatus>,
        deferredSchedule: Promise.resolve({
          events: [] as PublicScheduleEvent[],
        }),
        eventDivisionMappings: { mappings: [], hasMappings: false },
      }
    }

    const competitionId = competition.id

    // Defer schedule data - it's below the fold and not needed immediately
    const deferredSchedule = getPublicScheduleDataFn({
      data: { competitionId },
    })

    const workoutsResult = await getPublishedCompetitionWorkoutsWithDetailsFn({
      data: { competitionId },
    })

    const workouts = workoutsResult.workouts
    const divisionIds = divisions?.map((d) => d.id) ?? []
    const divisionDescriptionsMap: Record<string, DivisionDescription[]> = {}

    if (divisionIds.length > 0 && workouts.length > 0) {
      const workoutIds = workouts.map((w) => w.workoutId)
      const batchResult = await getBatchWorkoutDivisionDescriptionsFn({
        data: { workoutIds, divisionIds },
      })
      Object.assign(divisionDescriptionsMap, batchResult.descriptionsByWorkout)
    }

    // Fetch submission statuses and event-division mappings in parallel
    const userRegistration = parentMatch.loaderData?.userRegistration
    let submissionStatusMap: Record<string, SubmissionStatus> = {}

    const [submissionResult, eventDivisionMappings] = await Promise.all([
      competition.competitionType === "online" &&
      userRegistration &&
      workouts.length > 0
        ? getBatchSubmissionStatusFn({
            data: {
              competitionId,
              trackWorkoutIds: workouts.map((w) => w.id),
            },
          })
        : Promise.resolve(null),
      getPublicEventDivisionMappingsFn({
        data: { competitionId },
      }).catch(() => ({ mappings: [] as Array<{ trackWorkoutId: string; divisionId: string }>, hasMappings: false })),
    ])

    if (submissionResult) {
      submissionStatusMap = submissionResult.statuses
    }

    return {
      workouts,
      divisionDescriptionsMap,
      submissionStatusMap,
      deferredSchedule,
      eventDivisionMappings,
    }
  },
})

function CompetitionOverviewPage() {
  const {
    competition,
    userRegistration,
    isVolunteer,
    registrationStatus,
    session,
    divisions,
    competitionCapacity,
    sponsors,
    userDivision,
    userDivisions,
    maxSpots,
  } = parentRoute.useLoaderData()

  const { slug } = Route.useParams()
  const {
    workouts,
    divisionDescriptionsMap,
    submissionStatusMap,
    deferredSchedule,
    eventDivisionMappings,
  } = Route.useLoaderData()

  const isRegistered = !!userRegistration
  const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1
  const timezone = competition.timezone ?? "America/Denver"
  const scheduleMap = useDeferredSchedule({ deferredSchedule, timezone })

  // Build parent -> child events map
  const childEventsMap = new Map<string, ChildEvent[]>()
  for (const w of workouts) {
    if (w.parentEventId) {
      const children = childEventsMap.get(w.parentEventId) ?? []
      children.push({
        id: w.id,
        workoutId: w.workoutId,
        workout: {
          name: w.workout.name,
          description: w.workout.description,
          scheme: w.workout.scheme,
          timeCap: w.workout.timeCap,
        },
        pointsMultiplier: w.pointsMultiplier,
        trackOrder: w.trackOrder,
      })
      childEventsMap.set(w.parentEventId, children)
    }
  }
  for (const children of childEventsMap.values()) {
    children.sort((a, b) => a.trackOrder - b.trackOrder)
  }

  const showScorePanel =
    competition.competitionType === "online" &&
    isRegistered &&
    !!session &&
    userDivisions.length > 0 &&
    workouts.length > 0

  const scorePanelWorkouts = useMemo(
    () =>
      workouts.map((w) => ({
        id: w.id,
        workoutId: w.workoutId,
        trackOrder: w.trackOrder,
        parentEventId: w.parentEventId,
        workout: {
          name: w.workout.name,
          scheme: w.workout.scheme,
        },
      })),
    [workouts],
  )

  // Track lg breakpoint to render score panel in one location only
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)")
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener("change", onChange)
    setIsDesktop(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  const scorePanelEl = showScorePanel ? (
    <AthleteScoreSubmissionPanel
      competitionId={competition.id}
      slug={slug}
      userDivisions={userDivisions}
      workouts={scorePanelWorkouts}
      eventDivisionMappings={eventDivisionMappings}
    />
  ) : null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main Content Column */}
      <div className="space-y-4">
        {/* Sticky Tabs */}
        <div className="sticky top-4 z-10">
          <CompetitionTabs slug={competition.slug} />
        </div>

        {/* Score panel — desktop only (in main column) */}
        {isDesktop && scorePanelEl}

        {/* Content Panel */}
        <div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <EventDetailsContent
            competition={competition}
            divisions={divisions.length > 0 ? divisions : undefined}
            sponsors={sponsors}
            workoutsContent={
              workouts.length > 0 ? (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold mb-4">Workouts</h2>
                  <div className="space-y-6">
                    {workouts.filter((w) => !w.parentEventId).map((event) => {
                      const divisionDescriptionsResult =
                        divisionDescriptionsMap[event.workoutId]
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
                            divisionDescriptionsResult ?? []
                          }
                          sponsorName={event.sponsorName}
                          sponsorLogoUrl={event.sponsorLogoUrl}
                          selectedDivisionId="default"
                          isRegistered={isRegistered}
                          submissionStatus={
                            submissionStatusMap[event.id] ?? null
                          }
                          timeCap={event.workout.timeCap}
                          schedule={scheduleMap?.get(event.id) ?? null}
                          childEvents={childEventsMap.get(event.id)}
                          childDivisionDescriptionsMap={divisionDescriptionsMap}
                        />
                      )
                    })}
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
      </div>

      {/* Sidebar - Order first on mobile/tablet for prominent Register button */}
      <aside className="order-first min-w-0 space-y-4 lg:order-none lg:sticky lg:top-4 lg:self-start">
        {/* Score panel — mobile only (above registrations) */}
        {!isDesktop && scorePanelEl}
        <RegistrationSidebar
          competition={competition}
          isRegistered={isRegistered}
          registrationOpen={registrationStatus.registrationOpen}
          maxSpots={maxSpots}
          userDivision={userDivision?.label}
          registrationId={userRegistration?.id}
          isTeamRegistration={isTeamRegistration}
          isCaptain={userRegistration?.userId === session?.userId}
          isVolunteer={isVolunteer}
          userRegistrations={userDivisions}
          session={session}
          competitionCapacity={competitionCapacity}
        />
        <CompetitionLocationCard
          address={competition.address}
          competitionType={competition.competitionType}
          organizingTeamName={competition.organizingTeam?.name}
        />
      </aside>
    </div>
  )
}
