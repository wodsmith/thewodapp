/**
 * Organizer Athletes Page
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/athletes/page.tsx
 */

import {createFileRoute, getRouteApi, useNavigate} from '@tanstack/react-router'
import {z} from 'zod'
import {Calendar, Mail, Users} from 'lucide-react'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {getOrganizerRegistrationsFn} from '@/server-fns/competition-detail-fns'
import {getCompetitionDivisionsWithCountsFn} from '@/server-fns/competition-divisions-fns'

const parentRoute = getRouteApi('/compete/organizer/$competitionId')

const athletesSearchSchema = z.object({
  division: z.string().optional(),
})

export const Route = createFileRoute(
  '/compete/organizer/$competitionId/athletes',
)({
  component: AthletesPage,
  validateSearch: athletesSearchSchema,
  loader: async ({params, search}) => {
    const {competitionId} = params
    const {division: divisionFilter} = search

    // Parallel fetch: registrations and divisions for filtering
    const [registrationsResult, divisionsResult] = await Promise.all([
      getOrganizerRegistrationsFn({
        data: {competitionId, divisionFilter},
      }),
      getCompetitionDivisionsWithCountsFn({data: {competitionId}}),
    ])

    return {
      registrations: registrationsResult.registrations,
      divisions: divisionsResult.divisions,
      currentDivisionFilter: divisionFilter,
    }
  },
})

function AthletesPage() {
  const {competition} = parentRoute.useLoaderData()
  const {registrations, divisions, currentDivisionFilter} =
    Route.useLoaderData()
  const navigate = useNavigate()

  const handleDivisionChange = (value: string) => {
    navigate({
      to: '/compete/organizer/$competitionId/athletes',
      params: {competitionId: competition.id},
      search: value === 'all' ? {} : {division: value},
    })
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '?'
  }

  const getPendingCount = (pendingTeammates: string | null): number => {
    if (!pendingTeammates) return 0
    try {
      const pending = JSON.parse(pendingTeammates) as unknown[]
      return pending.length
    } catch {
      return 0
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Registered Athletes</h2>
        <p className="text-muted-foreground text-sm">
          {registrations.length} registration
          {registrations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {registrations.length === 0 && !currentDivisionFilter ? (
        <Card>
          <CardHeader>
            <CardTitle>No Registrations</CardTitle>
            <CardDescription>
              No athletes have registered for this competition yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <Select
              value={currentDivisionFilter || 'all'}
              onValueChange={handleDivisionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.label} ({division.registrationCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {registrations.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Registrations</CardTitle>
                <CardDescription>
                  No athletes are registered in this division.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Registered
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((registration, index) => {
                      const pendingCount = getPendingCount(
                        registration.pendingTeammates,
                      )
                      const isTeamDivision =
                        (registration.division?.teamSize ?? 1) > 1

                      // Get teammates (non-captain members)
                      const teammates =
                        registration.athleteTeam?.memberships?.filter(
                          (m) => m.userId !== registration.userId && m.user,
                        ) ?? []

                      return (
                        <TableRow key={registration.id}>
                          <TableCell className="text-muted-foreground font-mono text-sm align-top pt-4">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              {/* Captain */}
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={registration.user?.avatar ?? undefined}
                                    alt={`${registration.user?.firstName ?? ''} ${registration.user?.lastName ?? ''}`}
                                  />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(
                                      registration.user?.firstName ?? null,
                                      registration.user?.lastName ?? null,
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {registration.user?.firstName ?? ''}{' '}
                                    {registration.user?.lastName ?? ''}
                                    {isTeamDivision && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        (captain)
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {registration.user?.email}
                                  </span>
                                </div>
                              </div>
                              {/* Teammates */}
                              {teammates.length > 0 && (
                                <div className="ml-11 flex flex-col gap-1">
                                  {teammates.map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center gap-2 text-sm text-muted-foreground"
                                    >
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage
                                          src={member.user?.avatar ?? undefined}
                                          alt={`${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`}
                                        />
                                        <AvatarFallback className="text-[10px]">
                                          {getInitials(
                                            member.user?.firstName ?? null,
                                            member.user?.lastName ?? null,
                                          )}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>
                                        {member.user?.firstName ?? ''}{' '}
                                        {member.user?.lastName ?? ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top pt-4">
                            <Badge variant="outline">
                              {registration.division?.label ?? 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top pt-4">
                            {isTeamDivision ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">
                                  {registration.teamName ?? '—'}
                                </span>
                                {pendingCount > 0 && (
                                  <span className="text-xs text-amber-600 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {pendingCount} pending
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm align-top pt-4">
                            {formatDate(registration.registeredAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
