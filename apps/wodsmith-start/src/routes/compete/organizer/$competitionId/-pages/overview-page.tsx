/**
 * Competition Overview Page
 *
 * Shared page body for the organizer and cohost overview routes. The
 * organizer route renders it with defaults; the cohost route injects
 * cohost-permissioned mutation callbacks, cohost link targets, and a
 * permissions object that gates organizer-only sections.
 */
// @lat: [[organizer-dashboard#Cohost Dashboard#Shared Component Callback Pattern#Shared Page Components]]

import { Link } from "@tanstack/react-router"
import { ClipboardCheck, FileText, TrendingUp, Users } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import type { getCompetitionRevenueStatsFn } from "@/server-fns/commerce-fns"
import type { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import {
  formatUTCDateFull,
  getLocalDateKey,
  isSameUTCDay,
} from "@/utils/date-utils"
import { QuickActionsDivisionResults } from "../-components/quick-actions-division-results"
import { QuickActionsEvents } from "../-components/quick-actions-events"
import { QuickActionsHeats } from "../-components/quick-actions-heats"
import { QuickActionsSubmissionWindows } from "../-components/quick-actions-submission-windows"

type QuickActionsEventsProps = ComponentProps<typeof QuickActionsEvents>
type QuickActionsHeatsProps = ComponentProps<typeof QuickActionsHeats>
type QuickActionsDivisionResultsProps = ComponentProps<
  typeof QuickActionsDivisionResults
>
type QuickActionsSubmissionWindowsProps = ComponentProps<
  typeof QuickActionsSubmissionWindows
>

type Competition = NonNullable<
  Awaited<ReturnType<typeof getCompetitionByIdFn>>["competition"]
>

type RevenueStats = Pick<
  Awaited<ReturnType<typeof getCompetitionRevenueStatsFn>>["stats"],
  "totalGrossCents" | "totalOrganizerNetCents" | "purchaseCount"
>

interface OverviewPageProps {
  /** Organizing team for organizers, competition team for cohosts. */
  teamId: string
  competition: Competition
  /** Only the count is displayed; organizer and cohost fns return different row shapes. */
  registrations: readonly unknown[]
  revenueStats: RevenueStats
  events: QuickActionsEventsProps["events"]
  heats: QuickActionsHeatsProps["heats"]
  divisionResults: QuickActionsDivisionResultsProps["divisionResults"]
  competitionEvents: QuickActionsSubmissionWindowsProps["competitionEvents"]
  isOnline: boolean
  timezone: string
  /** Cohost permissions; undefined = organizer = full access. */
  permissions?: CohostMembershipMetadata
  /** Cohost routes inject a cohost-permissioned workout update (event/heat publish). */
  onUpdateWorkout?: NonNullable<QuickActionsEventsProps["onUpdateWorkout"]> &
    NonNullable<QuickActionsHeatsProps["onUpdateWorkout"]>
  /** Cohost routes inject cohost-permissioned division result publishing. */
  onPublishDivisionResults?: QuickActionsDivisionResultsProps["onPublishDivisionResults"]
  onPublishAllDivisionResults?: QuickActionsDivisionResultsProps["onPublishAllDivisionResults"]
  /** Base route prefix for submission window links (defaults to organizer). */
  routePrefix?: QuickActionsSubmissionWindowsProps["routePrefix"]
  /** Route for per-event results links (defaults to organizer results route). */
  resultsLinkTo?: QuickActionsEventsProps["resultsLinkTo"]
  /** Route for the registrations "View all" link (defaults to organizer athletes route). */
  athletesLinkTo?: string
  /** Route for the revenue "Details" link (defaults to organizer revenue route). */
  revenueLinkTo?: string
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function OverviewPage({
  teamId,
  competition,
  registrations,
  revenueStats,
  events,
  heats,
  divisionResults,
  competitionEvents,
  isOnline,
  timezone,
  permissions,
  onUpdateWorkout,
  onPublishDivisionResults,
  onPublishAllDivisionResults,
  routePrefix,
  resultsLinkTo,
  athletesLinkTo = "/compete/organizer/$competitionId/athletes",
  revenueLinkTo = "/compete/organizer/$competitionId/revenue",
}: OverviewPageProps) {
  // Organizer routes pass no permissions object and get full access.
  const isOrganizer = !permissions
  const canEditEvents = !permissions || permissions.editEvents
  const canViewRevenue = !permissions || permissions.revenue

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
              organizingTeamId={teamId}
              divisionResults={divisionResults}
              onPublishDivisionResults={onPublishDivisionResults}
              onPublishAllDivisionResults={onPublishAllDivisionResults}
            />
          )}

          {/* Submission Windows (online) or Heat Schedules (in-person) */}
          {isOnline ? (
            <QuickActionsSubmissionWindows
              competitionId={competition.id}
              events={events}
              competitionEvents={competitionEvents}
              timezone={timezone}
              routePrefix={routePrefix}
            />
          ) : (
            <QuickActionsHeats
              events={events}
              heats={heats}
              organizingTeamId={teamId}
              competitionSlug={competition.slug}
              onUpdateWorkout={onUpdateWorkout}
            />
          )}

          {/* Events - Full Width (cohosts need the editEvents permission) */}
          {canEditEvents && (
            <QuickActionsEvents
              events={events}
              organizingTeamId={teamId}
              competitionId={competition.id}
              onUpdateWorkout={onUpdateWorkout}
              resultsLinkTo={resultsLinkTo}
            />
          )}
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
                  ? "Competition date"
                  : "Competition dates"}
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
              {/* Organizer-only: cohosts have no competition edit route */}
              {isOrganizer && (
                <Link
                  to="/compete/organizer/$competitionId/edit"
                  params={{ competitionId: competition.id }}
                >
                  <Button variant="outline" size="sm" className="mt-2">
                    Configure registration
                  </Button>
                </Link>
              )}
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
            <div className="flex flex-wrap gap-2">
              {/* Organizer-only: there is no cohost check-in route */}
              {!isOnline && isOrganizer && (
                <Link
                  to="/compete/organizer/$competitionId/check-in"
                  params={{ competitionId: competition.id }}
                >
                  <Button size="sm">
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Go to Check-In
                  </Button>
                </Link>
              )}
              <Link
                to={athletesLinkTo as string}
                params={{ competitionId: competition.id }}
              >
                <Button variant="outline" size="sm">
                  <Users className="mr-2 h-4 w-4" />
                  View all
                </Button>
              </Link>
            </div>
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

        {/* Revenue Summary Card (cohosts need the revenue permission) */}
        {canViewRevenue && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Revenue</CardTitle>
                <CardDescription>Paid registrations</CardDescription>
              </div>
              <Link
                to={revenueLinkTo}
                params={{ competitionId: competition.id }}
              >
                <Button variant="outline" size="sm">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Details
                </Button>
              </Link>
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
