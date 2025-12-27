import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {ArrowLeft} from 'lucide-react'
import {
  getProgrammingTrackByIdFn,
  getTrackWorkoutsFn,
} from '@/server-fns/programming-fns'
import {Button} from '@/components/ui/button'
import {TrackHeader} from '@/components/track-header'
import {TrackWorkoutList} from '@/components/track-workout-list'
import {AddWorkoutToTrackDialog} from '@/components/add-workout-to-track-dialog'

export const Route = createFileRoute(
  '/_protected/settings/programming/$trackId/',
)({
  component: TrackDetailPage,
  loader: async ({params}) => {
    const trackResult = await getProgrammingTrackByIdFn({
      data: {trackId: params.trackId},
    })

    const workoutsResult = await getTrackWorkoutsFn({
      data: {trackId: params.trackId},
    })

    return {
      track: trackResult.track,
      trackWorkouts: workoutsResult.workouts,
    }
  },
})

function TrackDetailPage() {
  const {track, trackWorkouts} = Route.useLoaderData()
  const router = useRouter()

  const handleRefresh = () => {
    // Invalidate and refetch the loader data
    router.invalidate()
  }

  const handleWorkoutRemoved = () => {
    // Invalidate and refetch the loader data
    router.invalidate()
  }

  if (!track) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Track Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The programming track you're looking for doesn't exist or has been
            removed.
          </p>
          <Button asChild>
            <Link to="/settings/programming">Back to Programming</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button and header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/settings/programming">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      {/* Track Header Component */}
      <TrackHeader track={track} onSuccess={handleRefresh} />

      {/* Track Workouts Section */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-mono">TRACK WORKOUTS</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground font-mono">
              {trackWorkouts.length} workout(s)
            </p>
            {track.ownerTeamId && (
              <AddWorkoutToTrackDialog
                trackId={track.id}
                teamId={track.ownerTeamId}
                onSuccess={handleRefresh}
              />
            )}
          </div>
        </div>
        <TrackWorkoutList
          trackWorkouts={trackWorkouts}
          onWorkoutRemoved={handleWorkoutRemoved}
        />
      </div>
    </div>
  )
}
