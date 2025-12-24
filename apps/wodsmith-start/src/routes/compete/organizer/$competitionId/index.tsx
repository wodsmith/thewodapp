/**
 * Competition Organizer Overview Page
 *
 * Dashboard/overview page for organizers to see competition stats,
 * details, and quick actions.
 */

import {createFileRoute, getRouteApi, Link} from '@tanstack/react-router'
import {FileText, TrendingUp, Users} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {getCompetitionRegistrationsFn} from '@/server-fns/competition-detail-fns'
import {formatUTCDateFull} from '@/utils/date-utils'

// Get parent route API to access its loader data
const parentRoute = getRouteApi('/compete/organizer/$competitionId')

export const Route = createFileRoute('/compete/organizer/$competitionId/')({
  component: CompetitionOverviewPage,
  loader: async ({params}) => {
    // Get registrations for this competition
    const {registrations} = await getCompetitionRegistrationsFn({
      data: {competitionId: params.competitionId},
    })

    return {registrations}
  },
})

function CompetitionOverviewPage() {
  const {registrations} = Route.useLoaderData()
  // Get competition from parent layout loader data
  const {competition} = parentRoute.useLoaderData()

  // Format datetime for display (local time for timestamps)
  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Calculate registration status
  const getRegistrationStatusText = () => {
    if (!competition.registrationOpensAt || !competition.registrationClosesAt) {
      return null
    }
    const now = new Date()
    if (now < new Date(competition.registrationOpensAt)) {
      return 'Not yet open'
    }
    if (now > new Date(competition.registrationClosesAt)) {
      return 'Closed'
    }
    return 'Open'
  }

  return (
    <>
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
                Competition Dates
              </div>
              <div className="mt-1 text-sm">
                {formatUTCDateFull(competition.startDate)} -{' '}
                {formatUTCDateFull(competition.endDate)}
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
              <Link to={`/compete/organizer/${competition.id}/edit`}>
                <Button variant="outline" size="sm" className="mt-2">
                  Configure Registration
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Registrations Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>Athletes registered</CardDescription>
            </div>
            <Link to={`/compete/organizer/${competition.id}/athletes`}>
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
                      ? 'registration'
                      : 'registrations'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Summary Card - Placeholder for now */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Paid registrations</CardDescription>
            </div>
            <Link to={`/compete/organizer/${competition.id}/revenue`}>
              <Button variant="outline" size="sm">
                <TrendingUp className="mr-2 h-4 w-4" />
                Details
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Revenue tracking coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
