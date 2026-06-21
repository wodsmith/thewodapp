import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
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
import { competitionCan } from "@/lib/competitions/capabilities"
import {
  getPublicScheduleDataFn,
  type PublicScheduleEvent,
} from "@/server-fns/competition-heats-fns"
import type { DivisionDescription } from "@/server-fns/competition-workouts-fns"
import { getPublicWorkoutsPageDataFn } from "@/server-fns/competition-workouts-page-fns"
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
        divisionDescriptionsMap: {} as Record<string, DivisionDescription[]>,
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

    const divisionIds = divisions?.map((d) => d.id) ?? []
    const userRegistration = parentMatch.loaderData?.userRegistration

    // Single consolidated call for workouts + division descriptions +
    // event-division mappings + the viewer's submission statuses (fetched
    // server-side in the same wave as the descriptions, only for registered
    // athletes on competitions that support video submissions).
    const pageData = await getPublicWorkoutsPageDataFn({
      data: {
        competitionId,
        divisionIds,
        includeSubmissionStatuses:
          competitionCan(competition.competitionType, "videoSubmissions") &&
          !!userRegistration,
      },
    })

    const submissionStatusMap: Record<string, SubmissionStatus> =
      pageData.submissionStatuses ?? {}

    return {
      workouts: pageData.workouts,
      divisionDescriptionsMap: pageData.divisionDescriptionsMap,
      submissionStatusMap,
      deferredSchedule,
      eventDivisionMappings: pageData.eventDivisionMappings,
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
    pendingTeamInvites,
    pendingCompetitionInvites,
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
    competitionCan(competition.competitionType, "videoSubmissions") &&
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
          <CompetitionTabs
            slug={competition.slug}
            settings={competition.settings}
          />
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
                    {workouts
                      .filter((w) => !w.parentEventId)
                      .map((event) => {
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
                            childDivisionDescriptionsMap={
                              divisionDescriptionsMap
                            }
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
          pendingTeamInvites={pendingTeamInvites}
          pendingCompetitionInvites={pendingCompetitionInvites}
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
