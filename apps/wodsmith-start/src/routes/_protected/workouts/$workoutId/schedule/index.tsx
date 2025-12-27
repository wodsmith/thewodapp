import {createFileRoute, Link, useNavigate} from '@tanstack/react-router'
import {format} from 'date-fns'
import {ArrowLeft, CalendarIcon} from 'lucide-react'
import {useState} from 'react'
import {getWorkoutByIdFn, scheduleWorkoutFn} from '@/server-fns/workout-fns'
import {Button} from '@/components/ui/button'
import {Calendar} from '@/components/ui/calendar'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {cn} from '@/utils/cn'

export const Route = createFileRoute(
  '/_protected/workouts/$workoutId/schedule/',
)({
  component: ScheduleWorkoutPage,
  loader: async ({params, context}) => {
    const session = context.session
    const result = await getWorkoutByIdFn({data: {id: params.workoutId}})

    // Get teams from session
    const teams = session?.teams || []

    return {workout: result.workout, teams}
  },
})

function ScheduleWorkoutPage() {
  const {workout, teams} = Route.useLoaderData()
  const {workoutId} = Route.useParams()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    teams.length > 0 ? teams[0]?.id || '' : '',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Workout Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The workout you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/workouts" search={{view: 'row', q: ''}}>
              Back to Workouts
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const handleSchedule = async () => {
    if (!selectedDate) {
      setError('Please select a date')
      return
    }

    if (!selectedTeamId) {
      setError('Please select a team')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await scheduleWorkoutFn({
        data: {
          teamId: selectedTeamId,
          workoutId,
          scheduledDate: selectedDate.toISOString(),
        },
      })

      // Navigate back to workout detail page
      navigate({
        to: '/workouts/$workoutId',
        params: {workoutId},
      })
    } catch (err) {
      console.error('Failed to schedule workout:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to schedule workout',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link to="/workouts/$workoutId" params={{workoutId}}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">SCHEDULE WORKOUT</h1>
        </div>
      </div>

      <div className="border-2 border-border rounded-lg p-6">
        <div className="mb-6">
          <h2 className="mb-2 font-bold text-lg">{workout.name}</h2>
          {workout.description && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {workout.description}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="date-picker"
                className="mb-2 block font-bold uppercase text-sm"
              >
                Select Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-picker"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border p-3 [--cell-size:2.5rem]"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {teams.length > 1 && (
              <div>
                <label
                  htmlFor="team-select"
                  className="mb-2 block font-bold uppercase text-sm"
                >
                  Schedule for Team
                </label>
                <Select
                  onValueChange={setSelectedTeamId}
                  value={selectedTeamId}
                >
                  <SelectTrigger
                    id="team-select"
                    className="w-full justify-start text-left font-normal h-10"
                  >
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <Button asChild variant="outline">
              <Link to="/workouts/$workoutId" params={{workoutId}}>
                Cancel
              </Link>
            </Button>
            <Button onClick={handleSchedule} disabled={isSubmitting}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Workout'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
