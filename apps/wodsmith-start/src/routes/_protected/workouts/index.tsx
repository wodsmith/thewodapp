import {createFileRoute, Link, useNavigate} from '@tanstack/react-router'
import {Plus, Search, LayoutList, LayoutGrid} from 'lucide-react'
import {useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {ScheduledWorkoutsSection} from '@/components/scheduled-workouts-section'
import {WorkoutCard} from '@/components/workout-card'
import WorkoutRowCard from '@/components/workout-row-card'
import {
  getWorkoutsFn,
  getScheduledWorkoutsWithResultsFn,
  type ScheduledWorkoutWithResult,
} from '@/server-fns/workout-fns'

// Helper to get start of local day
function startOfLocalDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to get end of local day
function endOfLocalDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export const Route = createFileRoute('/_protected/workouts/')({
  component: WorkoutsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as 'row' | 'card') || 'row',
    q: (search.q as string) || '',
  }),
  loader: async ({context}) => {
    // Get teamId and userId from session
    const session = context.session
    const teamId = session?.teams?.[0]?.id
    const userId = session?.userId

    if (!teamId) {
      return {
        workouts: [],
        scheduledWorkouts: [] as ScheduledWorkoutWithResult[],
        teamId: null,
        userId: null,
      }
    }

    // Fetch workouts and scheduled workouts in parallel
    const today = new Date()
    const [workoutsResult, scheduledResult] = await Promise.all([
      getWorkoutsFn({data: {teamId}}),
      userId
        ? getScheduledWorkoutsWithResultsFn({
            data: {
              teamId,
              userId,
              startDate: startOfLocalDay(today).toISOString(),
              endDate: endOfLocalDay(today).toISOString(),
            },
          })
        : Promise.resolve({scheduledWorkoutsWithResults: []}),
    ])

    return {
      workouts: workoutsResult.workouts,
      scheduledWorkouts: scheduledResult.scheduledWorkoutsWithResults,
      teamId,
      userId,
    }
  },
})

function WorkoutsPage() {
  const {workouts, scheduledWorkouts, teamId, userId} = Route.useLoaderData()
  const navigate = useNavigate({from: Route.fullPath})
  const {view, q} = Route.useSearch()
  const [searchQuery, setSearchQuery] = useState(q)

  // Filter workouts by search query
  const filteredWorkouts = useMemo(() => {
    if (!searchQuery.trim()) {
      return workouts
    }
    const query = searchQuery.toLowerCase()
    return workouts.filter((workout) =>
      workout.name.toLowerCase().includes(query),
    )
  }, [workouts, searchQuery])

  // Handle view toggle
  const handleViewChange = (newView: 'row' | 'card') => {
    navigate({
      search: (prev) => ({...prev, view: newView}),
    })
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setSearchQuery(newQuery)
    navigate({
      search: (prev) => ({...prev, q: newQuery}),
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold">WORKOUTS</h1>
        <Button asChild>
          <Link to="/workouts/new">
            <Plus className="h-5 w-5 mr-2" />
            Create Workout
          </Link>
        </Button>
      </div>

      {/* Scheduled Workouts Section */}
      {teamId && userId && (
        <ScheduledWorkoutsSection
          teamId={teamId}
          userId={userId}
          initialWorkouts={scheduledWorkouts}
        />
      )}

      {/* Search + View Toggle */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workouts..."
            className="pl-10"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={view === 'row' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => handleViewChange('row')}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'card' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => handleViewChange('card')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Workout List */}
      {filteredWorkouts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {searchQuery.trim()
              ? 'No workouts found matching your search.'
              : 'No workouts found. Create your first workout to get started.'}
          </p>
        </div>
      ) : view === 'row' ? (
        <ul className="space-y-2">
          {filteredWorkouts.map((workout) => (
            <WorkoutRowCard key={workout.id} workout={workout} />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkouts.map((workout, index) => (
            <Link
              key={workout.id}
              to="/workouts/$workoutId"
              params={{workoutId: workout.id}}
            >
              <WorkoutCard
                trackOrder={index + 1}
                name={workout.name}
                scheme={workout.scheme}
                description={workout.description}
                scoreType={null}
                roundsToScore={null}
                pointsMultiplier={null}
                notes={null}
                divisionDescriptions={[]}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
