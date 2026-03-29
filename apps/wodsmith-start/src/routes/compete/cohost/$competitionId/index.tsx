/**
 * Competition Cohost Overview Page
 *
 * Dashboard/overview page for cohosts to see competition stats,
 * details, and quick actions. Mirrors the organizer overview
 * but uses cohost server functions with competitionTeamId auth.
 */

import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { FileText, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cohostGetRevenueStatsFn } from "@/server-fns/cohost/cohost-revenue-fns"
import { cohostGetRegistrationsFn } from "@/server-fns/cohost/cohost-competition-fns"
import {
  cohostGetWorkoutsFn,
  cohostUpdateWorkoutFn,
} from "@/server-fns/cohost/cohost-workout-fns"
import { cohostGetHeatsForCompetitionFn } from "@/server-fns/cohost/cohost-schedule-fns"
import { cohostGetCompetitionEventsFn } from "@/server-fns/cohost/cohost-event-fns"
import {
  type AllEventsResultsStatusResponse,
  cohostGetDivisionResultsStatusFn,
  cohostPublishDivisionResultsFn,
  cohostPublishAllDivisionResultsFn,
} from "@/server-fns/cohost/cohost-results-fns"
import {
  formatUTCDateFull,
  getLocalDateKey,
  isSameUTCDay,
} from "@/utils/date-utils"
import { QuickActionsDivisionResults } from "../../organizer/$competitionId/-components/quick-actions-division-results"
import { QuickActionsEvents } from "../../organizer/$competitionId/-components/quick-actions-events"
import { QuickActionsHeats } from "../../organizer/$competitionId/-components/quick-actions-heats"
import { QuickActionsSubmissionWindows } from "../../organizer/$competitionId/-components/quick-actions-submission-windows"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute("/compete/cohost/$competitionId/")({
  staleTime: 10_000,
  component: CohostOverviewPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!
    const isOnline = competition.competitionType === "online"

    // Parallel fetch: registrations, revenue stats, events, heats/submission windows, and division results
    const [
      registrationsResult,
      revenueResult,
      eventsResult,
      heatsResult,
      divisionResultsResult,
      competitionEventsResult,
    ] = await Promise.all([
      cohostGetRegistrationsFn({
        data: { competitionId: params.competitionId, competitionTeamId },
      }).catch(() => ({ registrations: [] })),
      cohostGetRevenueStatsFn({
        data: { competitionId: params.competitionId, competitionTeamId },
      }).catch(() => ({ stats: { totalGrossCents: 0, totalOrganizerNetCents: 0, purchaseCount: 0 } })),
      cohostGetWorkoutsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ workouts: [] })),
      // Only fetch heats for in-person competitions
      isOnline
        ? Promise.resolve({ heats: [] })
        : cohostGetHeatsForCompetitionFn({
            data: { competitionId: params.competitionId, competitionTeamId },
          }).catch(() => ({ heats: [] })),
      cohostGetDivisionResultsStatusFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      }).catch(() => ({ divisions: [], events: [], totalPublishedCount: 0, totalCombinations: 0 } as AllEventsResultsStatusResponse)),
      // Fetch competition events (submission windows) for online competitions
      isOnline
        ? cohostGetCompetitionEventsFn({
            data: { competitionId: params.competitionId, competitionTeamId },
          }).catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] }),
    ])

    return {
      registrations: registrationsResult.registrations,
      revenueStats: revenueResult.stats,
      events: eventsResult.workouts,
      heats: heatsResult.heats,
      // When called without eventId, the server returns AllEventsResultsStatusResponse
      divisionResults: divisionResultsResult as AllEventsResultsStatusResponse,
      competitionTeamId,
      competitionEvents: competitionEventsResult.events,
      isOnline,
      timezone: competition.timezone || "America/Denver",
    }
  },
})

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function CohostOverviewPage() {
  const {
    registrations,
    revenueStats,
    events,
    heats,
    divisionResults,
    competitionTeamId,
    competitionEvents,
    isOnline,
    timezone,
  } = Route.useLoaderData()
  // Get competition and permissions from parent layout loader data
  const { competition, permissions } = parentRoute.useLoaderData()

  // Cohost server fn wrappers — these use competitionTeamId instead of organizingTeamId
  const cohostUpdateWorkout = useServerFn(cohostUpdateWorkoutFn)
  const cohostPublishDivisionResults = useServerFn(cohostPublishDivisionResultsFn)
  const cohostPublishAllDivisionResults = useServerFn(cohostPublishAllDivisionResultsFn)

  const handleCohostUpdateWorkout = async (params: {
    trackWorkoutId: string
    eventStatus?: "draft" | "published"
    heatStatus?: "draft" | "published"
  }) => {
    return cohostUpdateWorkout({
      data: {
        trackWorkoutId: params.trackWorkoutId,
        competitionTeamId,
        eventStatus: params.eventStatus,
        heatStatus: params.heatStatus,
      },
    })
  }

  const handleCohostPublishDivisionResults = async (params: {
    competitionId: string
    eventId: string
    divisionId: string
    publish: boolean
  }) => {
    return cohostPublishDivisionResults({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
        eventId: params.eventId,
        divisionId: params.divisionId,
        publish: params.publish,
      },
    })
  }

  const handleCohostPublishAllDivisionResults = async (params: {
    competitionId: string
    eventId: string
    publish: boolean
  }) => {
    return cohostPublishAllDivisionResults({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
        eventId: params.eventId,
        publish: params.publish,
      },
    })
  }

  // Format datetime for display (local time for timestamps, or YYYY-MM-DD strings)
  const formatDateTime = (date: string | Date) => {
    // Handle YYYY-MM-DD string format
    if (typeof date === "string") {
      const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (match) {
        const [, yearStr, monthStr, dayStr] = match
        const year = Number(yearStr)
        const month = Number(monthStr)
        const day = Number(dayStr)
        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ]
        return `${months[month - 1]} ${day}, ${year}`
      }
    }
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Calculate registration status using string comparison for YYYY-MM-DD dates
  const getRegistrationStatusText = () => {
    if (!competition.registrationOpensAt || !competition.registrationClosesAt) {
      return null
    }
    const todayStr = getLocalDateKey(new Date())
    if (todayStr < competition.registrationOpensAt) {
      return "Not yet open"
    }
    if (todayStr > competition.registrationClosesAt) {
      return "Closed"
    }
    return "Open"
  }

  return (
    <>
      {/* Publishing Controls - Full Width Stacked Layout */}
      {events.length > 0 && (
        <div className="space-y-4">
          {/* Division Results - Full Width */}
          {divisionResults.totalCombinations > 0 && (
            <QuickActionsDivisionResults
              competitionId={competition.id}
              organizingTeamId={competitionTeamId}
              divisionResults={divisionResults}
              onPublishDivisionResults={handleCohostPublishDivisionResults}
              onPublishAllDivisionResults={handleCohostPublishAllDivisionResults}
            />
          )}

          {/* Submission Windows (online) or Heat Schedules (in-person) */}
          {isOnline ? (
            <QuickActionsSubmissionWindows
              competitionId={competition.id}
              events={events}
              competitionEvents={competitionEvents}
              timezone={timezone}
              routePrefix="/compete/cohost"
            />
          ) : (
            <QuickActionsHeats
              events={events}
              heats={heats}
              organizingTeamId={competitionTeamId}
              competitionSlug={competition.slug}
              onUpdateWorkout={handleCohostUpdateWorkout}
            />
          )}

          {/* Events - Full Width */}
          <QuickActionsEvents
            events={events}
            organizingTeamId={competitionTeamId}
            competitionId={competition.id}
            onUpdateWorkout={handleCohostUpdateWorkout}
            resultsLinkTo="/compete/cohost/$competitionId/results"
          />
        </div>
      )}

      {/* Description Card */}
      {competition.description && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {competition.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Competition Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Competition Details</CardTitle>
          <CardDescription>
            Basic information about this competition
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {isSameUTCDay(competition.startDate, competition.endDate)
                  ? "Competition Date"
                  : "Competition Dates"}
              </div>
              <div className="mt-1 text-sm">
                {isSameUTCDay(competition.startDate, competition.endDate)
                  ? formatUTCDateFull(competition.startDate)
                  : `${formatUTCDateFull(competition.startDate)} - ${formatUTCDateFull(competition.endDate)}`}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Slug
              </div>
              <div className="mt-1 font-mono text-sm">{competition.slug}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Created
            </div>
            <div className="mt-1 text-sm">
              {formatDateTime(competition.createdAt)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Window Card */}
      <Card>
        <CardHeader>
          <CardTitle>Registration</CardTitle>
          <CardDescription>Registration window and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {competition.registrationOpensAt &&
          competition.registrationClosesAt ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Registration Opens
                  </div>
                  <div className="mt-1 text-sm">
                    {formatDateTime(competition.registrationOpensAt)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Registration Closes
                  </div>
                  <div className="mt-1 text-sm">
                    {formatDateTime(competition.registrationClosesAt)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <div className="mt-1 text-sm">
                  {getRegistrationStatusText()}
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No registration window configured
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Registrations Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>Athletes registered</CardDescription>
            </div>
            <Link
              to="/compete/cohost/$competitionId/athletes"
              params={{ competitionId: competition.id }}
            >
              <Button variant="outline" size="sm">
                <Users className="mr-2 h-4 w-4" />
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {registrations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No athletes have registered yet
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {registrations.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {registrations.length === 1
                      ? "registration"
                      : "registrations"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Summary Card - only shown if cohost has revenue permission */}
        {permissions?.revenue && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Revenue</CardTitle>
                <CardDescription>Paid registrations</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {revenueStats.purchaseCount > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Gross Revenue
                    </span>
                    <span className="font-medium">
                      {formatCents(revenueStats.totalGrossCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Your Net Revenue
                    </span>
                    <span className="font-bold text-green-600">
                      {formatCents(revenueStats.totalOrganizerNetCents)}
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-sm text-muted-foreground">
                      {revenueStats.purchaseCount} paid{" "}
                      {revenueStats.purchaseCount === 1
                        ? "registration"
                        : "registrations"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No paid registrations yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
