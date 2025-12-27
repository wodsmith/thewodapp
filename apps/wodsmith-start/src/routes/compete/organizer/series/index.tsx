import {createFileRoute, Link} from '@tanstack/react-router'
import {Plus, FolderOpen} from 'lucide-react'
import {getCompetitionGroupsFn} from '@/server-fns/competition-fns'
import {Button} from '@/components/ui/button'
import {OrganizerSeriesList} from '@/components/organizer-series-list'

export const Route = createFileRoute('/compete/organizer/series/')({
  loader: async ({context}) => {
    const session = context.session

    // Get all user teams - for now using first team
    const userTeams = session?.teams || []
    const selectedTeamId = userTeams[0]?.id

    if (!selectedTeamId) {
      return {
        groups: [],
        teamId: null,
      }
    }

    const {groups} = await getCompetitionGroupsFn({
      data: {teamId: selectedTeamId},
    })

    return {
      groups,
      teamId: selectedTeamId,
    }
  },
  component: SeriesPage,
})

function SeriesPage() {
  const {groups, teamId} = Route.useLoaderData()

  if (!teamId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Team Found</h1>
          <p className="text-muted-foreground mb-6">
            You need to be part of a team to manage competition series.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Competition Series</h1>
              <p className="text-muted-foreground mt-1">
                Organize competitions into series for recurring events
              </p>
            </div>
            <Button className="w-full sm:w-auto" asChild>
              <Link to="/compete/organizer/series/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Series
              </Link>
            </Button>
          </div>
        </div>

        {/* Series List or Empty State */}
        {groups.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No series yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Create a series to organize related competitions together, like
                annual events or recurring challenges.
              </p>
              <Button asChild>
                <Link to="/compete/organizer/series/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Series
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <OrganizerSeriesList groups={groups} teamId={teamId} />
        )}
      </div>
    </div>
  )
}
