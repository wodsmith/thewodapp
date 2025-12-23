import {createFileRoute, Link, useNavigate} from '@tanstack/react-router'
import {useState} from 'react'
import {ArrowLeft, Search} from 'lucide-react'
import {getWorkoutsFn, getWorkoutByIdFn} from '@/server-fns/workout-fns'
import {submitLogFn, getScalingLevelsFn} from '@/server-fns/log-fns'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'

export const Route = createFileRoute('/_protected/log/new/')({
  component: LogNewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    workoutId: (search.workoutId as string) || undefined,
  }),
  loaderDeps: ({search}) => ({workoutId: search.workoutId}),
  loader: async ({context, deps}) => {
    const session = context.session
    const teamId = session?.teams?.[0]?.id

    if (!teamId) {
      return {workouts: [], selectedWorkout: null, scalingLevels: []}
    }

    // Fetch workouts
    const workoutsResult = await getWorkoutsFn({data: {teamId}})

    // If a workout is pre-selected, fetch its details and scaling levels
    let selectedWorkout = null
    let scalingLevels: Array<{id: string; label: string; position: number}> = []

    if (deps.workoutId) {
      const workoutResult = await getWorkoutByIdFn({data: {id: deps.workoutId}})
      selectedWorkout = workoutResult.workout

      if (selectedWorkout) {
        const levelsResult = await getScalingLevelsFn({
          data: {workoutId: deps.workoutId},
        })
        scalingLevels = levelsResult.levels
      }
    }

    return {
      workouts: workoutsResult.workouts,
      selectedWorkout,
      scalingLevels,
      teamId,
    }
  },
})

function LogNewPage() {
  const {workouts, selectedWorkout, scalingLevels, teamId} =
    Route.useLoaderData()
  const {workoutId} = Route.useSearch()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [score, setScore] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [selectedScalingLevelId, setSelectedScalingLevelId] = useState<
    string | undefined
  >(scalingLevels[0]?.id)
  const [asRx, setAsRx] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredWorkouts = workouts.filter((workout) =>
    workout.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleWorkoutSelect = (id: string) => {
    navigate({
      to: '/log/new',
      search: {workoutId: id},
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workoutId || !teamId) return

    setIsSubmitting(true)
    setError(null)

    try {
      await submitLogFn({
        data: {
          workoutId,
          teamId,
          date,
          score,
          notes,
          scalingLevelId: selectedScalingLevelId,
          asRx,
        },
      })

      // Navigate back to workouts or log page
      navigate({to: '/workouts/$workoutId', params: {workoutId}})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save log')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/workouts" search={{view: 'row', q: ''}}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">LOG RESULT</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workout Selection */}
        <div>
          {selectedWorkout ? (
            <Card>
              <CardHeader>
                <CardTitle>Selected Workout</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-xl font-bold mb-2">
                  {selectedWorkout.name}
                </h3>
                {selectedWorkout.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap mb-4">
                    {selectedWorkout.description}
                  </p>
                )}
                <div className="flex gap-2 mb-4">
                  <Badge variant="outline">
                    {selectedWorkout.scheme.toUpperCase()}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({to: '/log/new', search: {workoutId: undefined}})
                  }
                >
                  Choose Different Workout
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Select Workout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search workouts..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="h-[400px] overflow-y-auto border rounded-md">
                  {filteredWorkouts.length > 0 ? (
                    <div className="divide-y">
                      {filteredWorkouts.map((workout) => (
                        <button
                          key={workout.id}
                          type="button"
                          onClick={() => handleWorkoutSelect(workout.id)}
                          className="w-full text-left p-4 hover:bg-muted transition-colors"
                        >
                          <h3 className="font-semibold">{workout.name}</h3>
                          <span className="text-xs text-muted-foreground">
                            {workout.scheme.toUpperCase()}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-muted-foreground">No workouts found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Log Form */}
        <div>
          {selectedWorkout ? (
            <Card>
              <CardHeader>
                <CardTitle>Log Result for {selectedWorkout.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Scaling Level */}
                  {scalingLevels.length > 0 && (
                    <div className="space-y-2">
                      <Label>Scaling Level</Label>
                      <div className="flex flex-wrap gap-2">
                        {scalingLevels.map((level) => (
                          <Button
                            key={level.id}
                            type="button"
                            variant={
                              selectedScalingLevelId === level.id
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            onClick={() => {
                              setSelectedScalingLevelId(level.id)
                              // Position 0 or 1 is typically Rx
                              setAsRx(level.position <= 1)
                            }}
                          >
                            {level.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Score */}
                  <div className="space-y-2">
                    <Label htmlFor="score">Score</Label>
                    <Input
                      id="score"
                      type="text"
                      placeholder={getScorePlaceholder(selectedWorkout.scheme)}
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      required
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {getScoreHint(selectedWorkout.scheme)}
                    </p>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="How did it feel? Any modifications?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="text-sm text-destructive">{error}</div>
                  )}

                  {/* Submit */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate({
                          to: '/workouts',
                          search: {view: 'row', q: ''},
                        })
                      }
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Save Result'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex h-full min-h-[400px] items-center justify-center">
                <p className="text-center text-muted-foreground">
                  Select a workout from the list to log a result
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function getScorePlaceholder(scheme: string): string {
  switch (scheme) {
    case 'time':
    case 'time-with-cap':
      return '90 (secs) or 1:30'
    case 'rounds-reps':
      return '5+12 or 5.12'
    case 'load':
      return '225'
    default:
      return 'Enter score...'
  }
}

function getScoreHint(scheme: string): string {
  switch (scheme) {
    case 'time':
    case 'time-with-cap':
      return 'Enter time as seconds (90) or MM:SS format (1:30)'
    case 'rounds-reps':
      return 'Enter as rounds+reps (5+12) or rounds.reps (5.12)'
    case 'load':
      return 'Enter weight in lbs'
    case 'reps':
      return 'Enter total reps'
    case 'calories':
      return 'Enter total calories'
    default:
      return ''
  }
}
