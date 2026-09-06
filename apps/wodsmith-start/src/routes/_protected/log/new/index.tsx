import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WorkoutImportEntry } from "@/components/workout-import/workout-import-entry"
import type { TiebreakScheme, WorkoutScheme } from "@/db/schema"
import { trackEvent } from "@/lib/posthog"
import { cn } from "@/lib/utils"
import {
  getPersonalLibraryScalingLevelsFn,
  getPersonalTrainingDayFn,
  savePersonalLibraryResultFn,
  savePersonalTrainingSessionFn,
} from "@/server-fns/training-personal-fns"
import { parseScore } from "@/utils/score-parser-new"

export const Route = createFileRoute("/_protected/log/new/")({
  component: LogNewPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    workoutId?: string
    teamId?: string
    date?: string
    personalSessionId?: string
    personalItemId?: string
    personalRevision?: number
  } => ({
    workoutId:
      typeof search.workoutId === "string" ? search.workoutId : undefined,
    teamId: typeof search.teamId === "string" ? search.teamId : undefined,
    date: typeof search.date === "string" ? search.date : undefined,
    personalSessionId:
      typeof search.personalSessionId === "string"
        ? search.personalSessionId
        : undefined,
    personalItemId:
      typeof search.personalItemId === "string"
        ? search.personalItemId
        : undefined,
    personalRevision:
      Number.isInteger(Number(search.personalRevision)) &&
      Number(search.personalRevision) > 0
        ? Number(search.personalRevision)
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (
      !deps.personalSessionId ||
      !deps.personalItemId ||
      !deps.teamId ||
      !deps.date
    ) {
      const query = new URLSearchParams()
      if (deps.workoutId) query.set("workoutId", deps.workoutId)
      if (deps.teamId) query.set("teamId", deps.teamId)
      if (deps.date) query.set("date", deps.date)
      throw redirect({
        href: `${deps.workoutId ? "/training" : "/workouts"}?${query}`,
      })
    }
    const day = await getPersonalTrainingDayFn({
      data: { teamId: deps.teamId, trainingDate: deps.date },
    })
    const personal = day.personalSession
    if (!personal || personal.id !== deps.personalSessionId)
      throw new Error("Your session is no longer available.")
    const item = personal.items.find(
      (entry) => entry.id === deps.personalItemId,
    )
    if (!item || item.kind !== "library")
      throw new Error("This workout is no longer in your session.")
    const previous = day.libraryResults.find(
      (result) => result.itemId === item.id,
    )
    if (previous)
      throw redirect({
        href: `/log/${encodeURIComponent(previous.scoreId)}/edit?redirectUrl=${encodeURIComponent(`/training?teamId=${personal.teamId}&date=${personal.trainingDate}`)}`,
      })
    const levelsResult = await getPersonalLibraryScalingLevelsFn({
      data: { personalSessionId: personal.id, itemId: item.id },
    })
    return {
      selectedWorkout: { ...item.workout, id: item.workoutId },
      scalingLevels: levelsResult.levels,
      teamId: personal.teamId,
      trainingDate: personal.trainingDate,
      personalSessionId: personal.id,
      personalItemId: item.id,
      personalRevision: personal.revision,
    }
  },
})

function LogNewPage() {
  const {
    selectedWorkout,
    scalingLevels,
    teamId,
    trainingDate,
    personalSessionId,
    personalItemId,
    personalRevision,
  } = Route.useLoaderData()
  const navigate = useNavigate()
  const importedItems = useRef(new Map<string, string>())
  const workoutId = selectedWorkout?.id
  const returnTo = `/training?teamId=${encodeURIComponent(teamId)}&date=${trainingDate}`

  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")

  const [selectedScalingLevelId, setSelectedScalingLevelId] = useState<
    string | undefined
  >(scalingLevels[0]?.id)
  const [asRx, setAsRx] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Multi-round support
  const numRounds = selectedWorkout?.roundsToScore ?? 1
  const isMultiRound = numRounds > 1
  const [roundScores, setRoundScores] = useState<string[]>(() =>
    Array(numRounds).fill(""),
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: A different personal occurrence needs fresh score inputs even when its scoring shape is unchanged.
  useEffect(() => {
    setScore("")
    setRoundScores(Array(numRounds).fill(""))
    setSelectedScalingLevelId(scalingLevels[0]?.id)
    setAsRx(true)
  }, [personalItemId, numRounds, scalingLevels])

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
    if (!roundScore?.trim() || !selectedWorkout) return null
    if (
      selectedWorkout.scheme === "time-with-cap" &&
      /^CAP\s*\+\s*\d+$/i.test(roundScore.trim())
    )
      return {
        isValid: true,
        formatted: roundScore.toUpperCase(),
        error: undefined,
      }
    return parseScore(
      roundScore,
      selectedWorkout.scheme as WorkoutScheme,
      selectedWorkout.timeCap ?? undefined,
      selectedWorkout.tiebreakScheme as TiebreakScheme | null,
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workoutId || !teamId) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await savePersonalLibraryResultFn({
        data: {
          personalSessionId,
          itemId: personalItemId,
          expectedRevision: personalRevision,
          score: isMultiRound ? "" : score,
          notes,
          scalingLevelId: selectedScalingLevelId,
          asRx,
          roundScores: isMultiRound
            ? roundScores.map((value) => ({ score: value }))
            : undefined,
        },
      })

      trackEvent("workout_result_logged", {
        score_id: result.scoreId,
        workout_id: workoutId,
        workout_name: selectedWorkout?.name,
        workout_scheme: selectedWorkout?.scheme,
        has_scheduled_instance: false,
      })

      // Navigate back to workouts or log page
      window.location.assign(returnTo)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save log"
      trackEvent("workout_result_logged_failed", {
        error_message: message,
        workout_id: workoutId,
      })
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <a href={returnTo} aria-label="Back to my session">
            <ArrowLeft className="h-5 w-5" />
          </a>
        </Button>
        <h1 className="text-2xl font-bold">Log result</h1>
      </div>

      <div className="mb-6 space-y-2">
        <WorkoutImportEntry
          destination={{ kind: "personal" }}
          saveLabel="Create and use workout"
          onSaved={async (result) => {
            // A retried save receipt must reuse its personal occurrence, even
            // when the composition was saved but its response was lost.
            let itemId = importedItems.current.get(result.workoutId)
            if (!itemId) {
              itemId = crypto.randomUUID()
              importedItems.current.set(result.workoutId, itemId)
            }
            const day = await getPersonalTrainingDayFn({
              data: { teamId, trainingDate },
            })
            const personal = day.personalSession
            if (!personal || personal.id !== personalSessionId) {
              throw new Error("Your session is no longer available.")
            }
            const existing = personal.items.find((item) => item.id === itemId)
            if (
              existing &&
              (existing.kind !== "library" ||
                existing.workoutId !== result.workoutId)
            ) {
              throw new Error(
                "Your session changed. Reload before adding this workout.",
              )
            }
            const saved = existing
              ? personal
              : await savePersonalTrainingSessionFn({
                  data: {
                    teamId,
                    trainingDate,
                    expectedRevision: personal.revision,
                    items: [
                      ...personal.items,
                      {
                        id: itemId,
                        kind: "library",
                        workoutId: result.workoutId,
                      },
                    ],
                  },
                })
            await navigate({
              to: "/log/new",
              search: {
                workoutId: result.workoutId,
                teamId: saved.teamId,
                date: saved.trainingDate,
                personalSessionId: saved.id,
                personalItemId: itemId,
                personalRevision: saved.revision,
              },
            })
          }}
        />
        <p className="text-sm text-muted-foreground">
          Create a missing workout and add it to your session on {trainingDate}.
          Notes are kept; score and scaling start fresh for the new workout.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workout Selection */}
        <div>
          {selectedWorkout ? (
            <Card>
              <CardHeader>
                <CardTitle>Workout</CardTitle>
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
              </CardContent>
            </Card>
          ) : (
            <p>This workout is no longer available.</p>
          )}
        </div>

        {/* Log Form */}
        <div>
          {selectedWorkout ? (
            <Card>
              <CardHeader>
                <CardTitle>Log result for {selectedWorkout.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={trainingDate}
                      readOnly
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
                                ? "default"
                                : "outline"
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
                      {isMultiRound ? `Score (${numRounds} rounds)` : "Score"}
                    </Label>

                    {isMultiRound ? (
                      <div className="space-y-2">
                        {roundScores.map((roundScore, index) => {
                          const parseResult = getRoundParseResult(index)
                          return (
                            <div
                              // biome-ignore lint/suspicious/noArrayIndexKey: Round inputs are positional and never reorder
                              key={index}
                              className="flex items-center gap-2"
                            >
                              <span className="text-xs text-muted-foreground w-10 shrink-0">
                                R{index + 1}:
                              </span>
                              <Input
                                type="text"
                                placeholder={getScorePlaceholder(
                                  selectedWorkout.scheme,
                                )}
                                value={roundScore}
                                onChange={(e) =>
                                  handleRoundScoreChange(index, e.target.value)
                                }
                                className={cn(
                                  "font-mono h-9 flex-1",
                                  parseResult?.error &&
                                    !parseResult?.isValid &&
                                    "border-destructive focus:ring-destructive",
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
                          {getScoreHint(selectedWorkout.scheme)}
                        </p>
                      </div>
                    ) : (
                      <>
                        <Input
                          id="score"
                          type="text"
                          placeholder={getScorePlaceholder(
                            selectedWorkout.scheme,
                          )}
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                          required
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          {getScoreHint(selectedWorkout.scheme)}
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
                  {error && (
                    <div className="text-sm text-destructive">{error}</div>
                  )}

                  {/* Submit */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.location.assign(returnTo)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : "Save result"}
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
    case "time":
    case "time-with-cap":
      return "90 (secs) or 1:30"
    case "rounds-reps":
      return "5+12 or 5.12"
    case "load":
      return "225"
    default:
      return "Enter score..."
  }
}

function getScoreHint(scheme: string): string {
  switch (scheme) {
    case "time-with-cap":
      return "Enter a finish time (1:30), or CAP+reps completed (CAP+123)."
    case "time":
      return "Enter time as seconds (90) or MM:SS format (1:30)"
    case "rounds-reps":
      return "Enter as rounds+reps (5+12) or rounds.reps (5.12)"
    case "load":
      return "Enter weight in lbs"
    case "reps":
      return "Enter total reps"
    case "calories":
      return "Enter total calories"
    default:
      return ""
  }
}
