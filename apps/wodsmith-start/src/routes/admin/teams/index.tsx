/**
 * Admin Teams List Route
 *
 * Lists all teams in the system for platform administrators.
 * Shows team name, type, member count, and competition count.
 */

import {createFileRoute, Link} from '@tanstack/react-router'
import {format} from 'date-fns'
import {Building2, Calendar, User, Users} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getAllTeamsForAdminFn,
  getAdminTeamStatsFn,
  type AdminTeamWithStats,
} from '@/server-fns/admin-team-fns'

export const Route = createFileRoute('/admin/teams/')({
  loader: async () => {
    const [teamsResult, statsResult] = await Promise.all([
      getAllTeamsForAdminFn(),
      getAdminTeamStatsFn(),
    ])
    return {
      teams: teamsResult.teams,
      stats: statsResult.stats,
    }
  },
  component: AdminTeamsPage,
})

function getTeamTypeBadge(team: AdminTeamWithStats) {
  if (team.isPersonalTeam) {
    return (
      <Badge variant="secondary" className="text-xs">
        <User className="mr-1 h-3 w-3" />
        Personal
      </Badge>
    )
  }

  switch (team.type) {
    case 'gym':
      return (
        <Badge variant="default" className="text-xs">
          <Building2 className="mr-1 h-3 w-3" />
          Gym
        </Badge>
      )
    case 'competition_event':
      return (
        <Badge variant="outline" className="text-xs">
          <Calendar className="mr-1 h-3 w-3" />
          Competition Event
        </Badge>
      )
    case 'competition_team':
      return (
        <Badge variant="outline" className="text-xs">
          <Users className="mr-1 h-3 w-3" />
          Athlete Team
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          {team.type}
        </Badge>
      )
  }
}

function AdminTeamsPage() {
  const {teams, stats} = Route.useLoaderData()

  return (
    <div className="max-w-6xl">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <a href="/admin" className="hover:text-foreground">
          Admin
        </a>
        <span>/</span>
        <span className="text-foreground">Teams</span>
      </nav>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="mt-1 text-muted-foreground">
            Manage all teams in the platform
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Teams</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gyms</CardDescription>
              <CardTitle className="text-2xl">{stats.gyms}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Personal</CardDescription>
              <CardTitle className="text-2xl">{stats.personal}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Competition Events</CardDescription>
              <CardTitle className="text-2xl">
                {stats.competitionEvents}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Teams Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Teams</CardTitle>
            <CardDescription>
              {teams.length} team{teams.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4 opacity-50" />
                <p>No teams found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="text-center">Competitions</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        <Link
                          to="/admin/teams/$teamId"
                          params={{teamId: team.id}}
                          className="font-medium hover:underline"
                        >
                          {team.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {team.slug}
                        </p>
                      </TableCell>
                      <TableCell>{getTeamTypeBadge(team)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{team.memberCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{team.competitionCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {team.createdAt
                          ? format(new Date(team.createdAt), 'MMM d, yyyy')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
