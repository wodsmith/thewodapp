import {useCallback, useMemo, useState} from 'react'
import {format} from 'date-fns'
import {Calendar, RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {ScheduledWorkoutCard} from '@/components/scheduled-workout-card'
import {
  getScheduledWorkoutsWithResultsFn,
  type ScheduledWorkoutWithResult,
} from '@/server-fns/workout-fns'

type ViewMode = 'daily' | 'weekly'

interface ScheduledWorkoutsSectionProps {
  teamId: string
  userId: string
  initialWorkouts?: ScheduledWorkoutWithResult[]
}

// Helper to get local date key (YYYY-MM-DD)
function getLocalDateKey(date: Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

// Helper to get start of local week (Sunday)
function startOfLocalWeek(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to get end of local week (Saturday)
function endOfLocalWeek(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (6 - day))
  d.setHours(23, 59, 59, 999)
  return d
}

// Helper to parse date key to Date
function toLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function ScheduledWorkoutsSection({
  teamId,
  userId,
  initialWorkouts = [],
}: ScheduledWorkoutsSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [workouts, setWorkouts] =
    useState<ScheduledWorkoutWithResult[]>(initialWorkouts)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get date range based on view mode
  const getDateRange = useCallback((mode: ViewMode) => {
    if (mode === 'daily') {
      return {
        start: startOfLocalDay(),
        end: endOfLocalDay(),
      }
    }
    return {
      start: startOfLocalWeek(),
      end: endOfLocalWeek(),
    }
  }, [])

  // Fetch workouts for the current view mode
  const fetchWorkouts = useCallback(
    async (mode: ViewMode) => {
      setIsLoading(true)
      setError(null)

      try {
        const {start, end} = getDateRange(mode)
        const result = await getScheduledWorkoutsWithResultsFn({
          data: {
            teamId,
            userId,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        })
        setWorkouts(result.scheduledWorkoutsWithResults)
      } catch (err) {
        console.error('Failed to fetch scheduled workouts:', err)
        setError('Failed to load workouts. Try again.')
        setWorkouts([])
      } finally {
        setIsLoading(false)
      }
    },
    [teamId, userId, getDateRange],
  )

  // Handle view mode change
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode)
      fetchWorkouts(mode)
    },
    [fetchWorkouts],
  )

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchWorkouts(viewMode)
  }, [fetchWorkouts, viewMode])

  // Group workouts by date for weekly view
  const workoutsByDate = useMemo(() => {
    const grouped: Record<string, ScheduledWorkoutWithResult[]> = {}

    for (const workout of workouts) {
      const dateKey = getLocalDateKey(new Date(workout.scheduledDate))
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(workout)
    }

    return grouped
  }, [workouts])

  // Filter workouts for daily view (only today)
  const todaysWorkouts = useMemo(() => {
    const todayKey = getLocalDateKey(new Date())
    return workouts.filter((w) => {
      const workoutDateKey = getLocalDateKey(new Date(w.scheduledDate))
      return workoutDateKey === todayKey
    })
  }, [workouts])

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 bg-muted animate-pulse rounded" />
        <div className="h-7 w-64 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="border-2 border-muted">
            <CardContent className="p-6">
              <div className="h-8 w-3/4 bg-muted animate-pulse rounded mb-3" />
              <div className="h-10 w-32 bg-muted animate-pulse rounded mb-4" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
              </div>
              <div className="mt-6 pt-4 border-t">
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // Render empty state
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h4 className="text-base font-medium text-foreground mb-2">
        {viewMode === 'daily'
          ? 'No workouts scheduled for today'
          : 'No workouts scheduled this week'}
      </h4>
      <p className="text-sm text-muted-foreground max-w-sm">
        {viewMode === 'daily'
          ? 'Check back tomorrow or switch to the weekly view to see upcoming workouts.'
          : 'New workouts will appear here when they are scheduled for your team.'}
      </p>
    </div>
  )

  // Render error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Calendar className="h-12 w-12 text-destructive/50 mb-4" />
      <h4 className="text-base font-medium text-foreground mb-2">{error}</h4>
      <Button size="sm" variant="secondary" onClick={handleRefresh}>
        Retry
      </Button>
    </div>
  )

  // Render workouts for daily view
  const renderDailyWorkouts = () => {
    if (todaysWorkouts.length === 0) {
      return renderEmpty()
    }

    const todayKey = getLocalDateKey(new Date())

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">
            {format(toLocalDate(todayKey), 'EEEE, MMMM d, yyyy')}
          </h3>
        </div>
        <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {todaysWorkouts.map((workout) => (
            <ScheduledWorkoutCard key={workout.id} workoutData={workout} />
          ))}
        </div>
      </div>
    )
  }

  // Render workouts for weekly view
  const renderWeeklyWorkouts = () => {
    const sortedDates = Object.keys(workoutsByDate).sort()

    if (sortedDates.length === 0) {
      return renderEmpty()
    }

    return (
      <div className="space-y-6">
        {sortedDates.map((dateKey) => (
          <div key={dateKey} className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-base">
                {format(toLocalDate(dateKey), 'EEEE, MMMM d, yyyy')}
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              {workoutsByDate[dateKey].map((workout) => (
                <ScheduledWorkoutCard key={workout.id} workoutData={workout} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20 text-center sm:text-left">
        Scheduled Workouts
      </h2>

      <Card className="p-6">
        <CardContent className="p-0">
          {/* Toggle and Refresh Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end mb-4 gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'daily' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('daily')}
                className="rounded-r-none"
              >
                Today
              </Button>
              <Button
                variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('weekly')}
                className="rounded-l-none"
              >
                This Week
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              className="h-8 w-8 p-0"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>

          {/* Content */}
          <div className="min-h-[200px]">
            {isLoading
              ? renderSkeleton()
              : error
                ? renderError()
                : viewMode === 'daily'
                  ? renderDailyWorkouts()
                  : renderWeeklyWorkouts()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
