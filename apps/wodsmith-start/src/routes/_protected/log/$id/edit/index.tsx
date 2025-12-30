import {createFileRoute, Link, useNavigate} from '@tanstack/react-router'
import {ArrowLeft} from 'lucide-react'
import {useState} from 'react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import type {TiebreakScheme, WorkoutScheme} from '@/db/schema'
import {cn} from '@/lib/utils'
import {decodeScore} from '@/lib/scoring'
import {
  getLogByIdFn,
  getScalingLevelsFn,
  getScoreRoundsFn,
  updateLogFn,
} from '@/server-fns/log-fns'
import {getWorkoutByIdFn} from '@/server-fns/workout-fns'
import {parseScore} from '@/utils/score-parser-new'

export const Route = createFileRoute('/_protected/log/$id/edit/')({
  component: LogEditPage,
  loader: async ({params}) => {
    // Fetch the existing log
    const logResult = await getLogByIdFn({data: {id: params.id}})
    if (!logResult.score) {
      throw new Error('Log not found')
    }

    const score = logResult.score

    // Fetch workout details
    const workoutResult = await getWorkoutByIdFn({
      data: {id: score.workoutId},
    })

    // Fetch scaling levels for this workout
    const levelsResult = await getScalingLevelsFn({
      data: {workoutId: score.workoutId},
    })

    // Fetch existing round scores if this is a multi-round workout
    let existingRounds: Array<{
      roundNumber: number
      value: number
      status: string | null
    }> = []
    const numRounds = score.workoutRoundsToScore ?? 1
    if (numRounds > 1) {
      const roundsResult = await getScoreRoundsFn({data: {scoreId: score.id}})
      existingRounds = roundsResult.rounds
    }

    return {
      score,
      workout: workoutResult.workout,
      scalingLevels: levelsResult.levels,
      existingRounds,
    }
  },
})

function LogEditPage() {
  const {score, workout, scalingLevels, existingRounds} = Route.useLoaderData()
  const navigate = useNavigate()
  const {id} = Route.useParams()

  // Initialize form state with existing values
  const [date, setDate] = useState(() => {
    // Format date from the score's recordedAt
    const recordedDate = new Date(score.date)
    return recordedDate.toISOString().split('T')[0]
  })

  const [notes, setNotes] = useState(score.notes ?? '')
  const [selectedScalingLevelId, setSelectedScalingLevelId] = useState<
    string | undefined
  >(score.scalingLevelId ?? scalingLevels[0]?.id)
  const [asRx, setAsRx] = useState(score.asRx)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Multi-round support
  const numRounds = score.workoutRoundsToScore ?? 1
  const isMultiRound = numRounds > 1
  const scheme = (score.workoutScheme ?? score.scheme) as WorkoutScheme

  // Decode existing score for single-score display
  const decodedScore =
    score.scoreValue !== null ? decodeScore(score.scoreValue, scheme) : ''
  const [singleScore, setSingleScore] = useState(decodedScore)

  // Initialize round scores from existing rounds
  const [roundScores, setRoundScores] = useState<string[]>(() => {
    if (!isMultiRound || existingRounds.length === 0) {
      return Array(numRounds).fill('')
    }

    // Decode each round value back to display string
    return Array.from({length: numRounds}, (_, index) => {
      const round = existingRounds.find((r) => r.roundNumber === index + 1)
      if (!round) return ''
      return decodeScore(round.value, scheme) ?? ''
    })
  })

  // Handle round score changes
  const handleRoundScoreChange = (roundIndex: number, value: string) => {
    setRoundScores((prev) => {
      const updated = [...prev]
      updated[roundIndex] = value
      return updated
    })
  }

  // Parse round scores for validation/preview
  const getRoundParseResult = (roundIndex: number) => {
    const roundScore = roundScores[roundIndex]
    if (!roundScore?.trim() || !workout) return null
    return parseScore(
      roundScore,
      workout.scheme as WorkoutScheme,
      workout.timeCap ?? undefined,
      workout.tiebreakScheme as TiebreakScheme | null,
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workout) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Build update data
      const updateData: {
        id: string
        date: string
        notes?: string
        scalingLevelId?: string
        asRx: boolean
        roundScores?: Array<{score: string}>
        scoreValue?: number | null
      } = {
        id,
        date,
        notes,
        scalingLevelId: selectedScalingLevelId,
        asRx,
      }

      if (isMultiRound) {
        updateData.roundScores = roundScores.map((s) => ({score: s}))
      } else {
        // For single score, we need to parse and encode
        if (singleScore.trim()) {
          const parseResult = parseScore(
            singleScore,
            scheme,
            workout.timeCap ?? undefined,
            workout.tiebreakScheme as TiebreakScheme | null,
          )
          if (parseResult.isValid && parseResult.rawValue !== null) {
            updateData.scoreValue = parseResult.rawValue
          } else {
            throw new Error(parseResult.error || 'Invalid score')
          }
        }
      }

      await updateLogFn({data: updateData})

      // Navigate back to the log or workout page
      navigate({to: '/workouts/$workoutId', params: {workoutId: workout.id}})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update log')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!workout) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Workout not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/workouts/$workoutId" params={{workoutId: workout.id}}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">EDIT LOG</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workout Info */}
        <Card>
          <CardHeader>
            <CardTitle>Workout</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="text-xl font-bold mb-2">{workout.name}</h3>
            {workout.description && (
              <p className="text-muted-foreground whitespace-pre-wrap mb-4">
                {workout.description}
              </p>
            )}
            <div className="flex gap-2">
              <Badge variant="outline">{workout.scheme.toUpperCase()}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Result for {workout.name}</CardTitle>
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
                <Label htmlFor="score">
                  {isMultiRound ? `Score (${numRounds} rounds)` : 'Score'}
                </Label>

                {isMultiRound ? (
                  <div className="space-y-2">
                    {roundScores.map((roundScore, index) => {
                      const parseResult = getRoundParseResult(index)
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-10 shrink-0">
                            R{index + 1}:
                          </span>
                          <Input
                            type="text"
                            placeholder={getScorePlaceholder(workout.scheme)}
                            value={roundScore}
                            onChange={(e) =>
                              handleRoundScoreChange(index, e.target.value)
                            }
                            className={cn(
                              'font-mono h-9 flex-1',
                              parseResult?.error &&
                                !parseResult?.isValid &&
                                'border-destructive focus:ring-destructive',
                            )}
                          />
                          {/* Preview to the right of input */}
                          {parseResult?.isValid && (
                            <span className="text-xs text-muted-foreground w-20 shrink-0">
                              {parseResult.formatted}
                            </span>
                          )}
                          {parseResult?.error && !parseResult?.isValid && (
                            <span
                              className="text-xs text-destructive w-20 shrink-0 truncate"
                              title={parseResult.error}
                            >
                              Invalid
                            </span>
                          )}
                        </div>
                      )
                    })}
                    <p className="text-xs text-muted-foreground">
                      {getScoreHint(workout.scheme)}
                    </p>
                  </div>
                ) : (
                  <>
                    <Input
                      id="score"
                      type="text"
                      placeholder={getScorePlaceholder(workout.scheme)}
                      value={singleScore}
                      onChange={(e) => setSingleScore(e.target.value)}
                      required
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {getScoreHint(workout.scheme)}
                    </p>
                  </>
                )}
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
              {error && <div className="text-sm text-destructive">{error}</div>}

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: '/workouts/$workoutId',
                      params: {workoutId: workout.id},
                    })
                  }
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
