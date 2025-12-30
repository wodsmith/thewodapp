import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {BookOpen, Check, Loader2, Plus, Search, Users} from 'lucide-react'
import {useMemo, useState} from 'react'
import {toast} from 'sonner'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {PROGRAMMING_TRACK_TYPE} from '@/db/schemas/programming'
import {
  getPublicTracksWithSubscriptionsFn,
  type ProgrammingTrackWithTeamSubscriptions,
  subscribeToTrackFn,
} from '@/server-fns/programming-fns'

interface UserTeam {
  id: string
  name: string
}

interface LoaderData {
  tracks: ProgrammingTrackWithTeamSubscriptions[]
  userTeams: UserTeam[]
}

export const Route = createFileRoute('/_protected/programming/')({
  component: PublicProgrammingPage,
  loader: async ({context}): Promise<LoaderData> => {
    const session = context.session
    const userTeams = (session?.teams || []) as UserTeam[]
    const userTeamIds = userTeams.map((t) => t.id)

    if (userTeamIds.length === 0) {
      return {
        tracks: [] as ProgrammingTrackWithTeamSubscriptions[],
        userTeams: [],
      }
    }

    const {tracks} = await getPublicTracksWithSubscriptionsFn({
      data: {userTeamIds},
    })

    return {
      tracks,
      userTeams,
    }
  },
})

function PublicProgrammingPage() {
  const {tracks, userTeams} = Route.useLoaderData() as LoaderData
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [subscribingTrackId, setSubscribingTrackId] = useState<string | null>(
    null,
  )

  const subscribeToTrack = useServerFn(subscribeToTrackFn)

  // Filter tracks by search query
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) {
      return tracks
    }
    const query = searchQuery.toLowerCase()
    return tracks.filter(
      (track: ProgrammingTrackWithTeamSubscriptions) =>
        track.name.toLowerCase().includes(query) ||
        track.description?.toLowerCase().includes(query) ||
        track.ownerTeam?.name.toLowerCase().includes(query),
    )
  }, [tracks, searchQuery])

  // Check if user's team is subscribed to a track
  const isTeamSubscribed = (
    track: ProgrammingTrackWithTeamSubscriptions,
    teamId: string,
  ) => {
    return track.subscribedTeams.some(
      (sub) => sub.teamId === teamId && sub.isActive,
    )
  }

  // Check if track is owned by any of user's teams
  const isOwnedByUserTeam = (track: ProgrammingTrackWithTeamSubscriptions) => {
    return userTeams.some((team: UserTeam) => team.id === track.ownerTeamId)
  }

  // Handle subscribe action
  const handleSubscribe = async (trackId: string, teamId: string) => {
    setSubscribingTrackId(trackId)
    try {
      await subscribeToTrack({data: {trackId, teamId}})
      toast.success('Subscribed to programming track')
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to subscribe',
      )
    } finally {
      setSubscribingTrackId(null)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
        return 'bg-green-500 text-white'
      case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
        return 'bg-blue-500 text-white'
      case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
        return 'bg-purple-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
        return 'Self-programmed'
      case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
        return 'Team-owned'
      case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
        return '3rd Party'
      default:
        return type
    }
  }

  if (userTeams.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No team found. Please join or create a team to browse programming
            tracks.
          </p>
        </div>
      </div>
    )
  }

  // Get the first team for quick subscribe (can be expanded to team selector later)
  const primaryTeam = userTeams[0]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-4xl font-bold">BROWSE PROGRAMMING</h1>
          <p className="text-muted-foreground mt-2">
            Discover public programming tracks from gyms and coaches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/programming/subscriptions">
              <BookOpen className="h-5 w-5 mr-2" />
              My Subscriptions
            </Link>
          </Button>
          <Button asChild>
            <Link to="/settings/programming">
              <Plus className="h-5 w-5 mr-2" />
              Create Track
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tracks by name, description, or creator..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tracks Grid */}
      {filteredTracks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-muted rounded-lg bg-muted/50">
          <p className="text-muted-foreground mb-4 text-lg">
            {searchQuery.trim()
              ? 'No tracks found matching your search.'
              : 'No public programming tracks available yet.'}
          </p>
          {!searchQuery.trim() && (
            <Button variant="outline" asChild>
              <Link to="/settings/programming">
                <Plus className="h-5 w-5 mr-2" />
                Create and share your own track
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTracks.map(
            (track: ProgrammingTrackWithTeamSubscriptions) => {
              const isOwned = isOwnedByUserTeam(track)
              const isSubscribed =
                primaryTeam && isTeamSubscribed(track, primaryTeam.id)
              const isLoading = subscribingTrackId === track.id

              return (
                <Card key={track.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link
                          to="/programming/$trackId"
                          params={{trackId: track.id}}
                          className="hover:underline underline-offset-4"
                        >
                          <CardTitle className="text-lg truncate">
                            {track.name}
                          </CardTitle>
                        </Link>
                        {track.ownerTeam && (
                          <CardDescription className="mt-1">
                            by {track.ownerTeam.name}
                          </CardDescription>
                        )}
                      </div>
                      <Badge className={getTypeColor(track.type)}>
                        {getTypeLabel(track.type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {track.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {track.description}
                      </p>
                    )}
                    <div className="mt-auto pt-4 border-t flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {track.subscribedTeams.length} subscriber
                          {track.subscribedTeams.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {isOwned ? (
                        <Badge variant="secondary">Your Track</Badge>
                      ) : isSubscribed ? (
                        <Badge className="bg-green-500 text-white">
                          <Check className="h-3 w-3 mr-1" />
                          Subscribed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            primaryTeam &&
                            handleSubscribe(track.id, primaryTeam.id)
                          }
                          disabled={isLoading || !primaryTeam}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Subscribing...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Subscribe
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            },
          )}
        </div>
      )}
    </div>
  )
}
