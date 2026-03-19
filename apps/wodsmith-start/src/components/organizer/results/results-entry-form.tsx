"use client"

import { useRouter } from "@tanstack/react-router"
import { intervalToDuration } from "date-fns"
import { Filter, HelpCircle } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  EventScoreEntryAthlete,
  EventScoreEntryData,
  HeatScoreGroup as HeatScoreGroupType,
} from "@/types/competition-scores"
import { cn } from "@/lib/utils"
import { formatTrackOrder } from "@/utils/format-track-order"
import { HeatScoreGroup } from "./heat-score-group"
import {
  type ScoreEntryData,
  ScoreInputRow,
  type ScoreInputRowHandle,
} from "./score-input-row"

function getErrorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "err" in error) {
    const maybeErr = (error as { err?: unknown }).err
    if (maybeErr && typeof maybeErr === "object" && "message" in maybeErr) {
      const maybeMessage = (maybeErr as { message?: unknown }).message
      if (typeof maybeMessage === "string") return maybeMessage
    }
  }

  if (error instanceof Error) return error.message
  return undefined
}

/** Server function type for saving competition scores */
export type SaveScoreFn = (params: {
  competitionId: string
  organizingTeamId: string
  trackWorkoutId: string
  workoutId: string
  registrationId: string
  userId: string
  divisionId: string | null
  score: string
  scoreStatus: string
  tieBreakScore: string | null
  secondaryScore: string | null
  roundScores?: Array<{ score: string }>
  workout: {
    scheme: string
    scoreType: string | null
    repsPerRound: number | null
    roundsToScore: number | null
    timeCap: number | null
    tiebreakScheme: string | null
  }
}) => Promise<{ resultId: string; isNew: boolean }>

interface SubEventData {
  event: EventScoreEntryData["event"]
  athletes: EventScoreEntryAthlete[]
}

interface ResultsEntryFormProps {
  competitionId: string
  organizingTeamId: string
  events: Array<{ id: string; name: string; trackOrder: number }>
  selectedEventId?: string
  event: EventScoreEntryData["event"]
  athletes: EventScoreEntryAthlete[]
  heats: HeatScoreGroupType[]
  unassignedRegistrationIds: string[]
  divisions: Array<{ id: string; label: string }>
  selectedDivisionId?: string
  /** Server function to save scores */
  saveScore: SaveScoreFn
  /** Sub-event score data for parent events. Renders grouped rows per athlete. */
  subEventScoreData?: SubEventData[]
}

export function ResultsEntryForm({
  competitionId,
  organizingTeamId,
  events,
  selectedEventId,
  event,
  athletes,
  heats,
  unassignedRegistrationIds,
  divisions,
  selectedDivisionId,
  saveScore,
  subEventScoreData,
}: ResultsEntryFormProps) {
  const router = useRouter()
  const isSubEventMode = !!subEventScoreData && subEventScoreData.length > 0
  const getStateKey = useCallback(
    (registrationId: string, eventId?: string) =>
      eventId ? `${registrationId}-${eventId}` : registrationId,
    [],
  )

  const [scores, setScores] = useState<Record<string, ScoreEntryData>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set(
      isSubEventMode
        ? subEventScoreData.flatMap((sub) =>
            sub.athletes
              .filter((a) => a.existingResult)
              .map((a) => getStateKey(a.registrationId, sub.event.id)),
          )
        : athletes
            .filter((a) => a.existingResult)
            .map((a) => a.registrationId),
    ),
  )
  const [focusedIndex, setFocusedIndex] = useState(0)
  const rowRefs = useRef<Map<string, ScoreInputRowHandle>>(new Map())
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  // Check if we have heats to display
  const hasHeats = heats.length > 0

  // Create athlete map for quick lookup by registrationId
  const athleteMap = useMemo(
    () => new Map(athletes.map((a) => [a.registrationId, a])),
    [athletes],
  )

  // Get unassigned athletes
  const unassignedAthleteIdSet = useMemo(
    () => new Set(unassignedRegistrationIds),
    [unassignedRegistrationIds],
  )
  const unassignedAthletes = useMemo(
    () => athletes.filter((a) => unassignedAthleteIdSet.has(a.registrationId)),
    [athletes, unassignedAthleteIdSet],
  )

  // Build a flat list of all athletes in heat order for focus navigation
  const allAthletesInOrder = useMemo(() => {
    if (!hasHeats) return athletes
    return [
      // Athletes in heats (ordered by heat, then lane)
      ...heats.flatMap((heat) =>
        heat.assignments
          .slice()
          .sort((a, b) => a.laneNumber - b.laneNumber)
          .map((assignment) => athleteMap.get(assignment.registrationId))
          .filter((a): a is EventScoreEntryAthlete => a !== undefined),
      ),
      // Unassigned athletes
      ...unassignedAthletes,
    ]
  }, [athleteMap, athletes, hasHeats, heats, unassignedAthletes])

  // Handle score change with auto-save
  const handleScoreChange = useCallback(
    async (
      athlete: EventScoreEntryAthlete,
      data: ScoreEntryData,
      eventOverride?: EventScoreEntryData["event"],
    ) => {
      const targetEvent = eventOverride || event
      const stateKey = eventOverride
        ? getStateKey(athlete.registrationId, eventOverride.id)
        : athlete.registrationId

      setScores((prev) => ({
        ...prev,
        [stateKey]: data,
      }))

      // Auto-save
      setSavingIds((prev) => new Set(prev).add(stateKey))

      // Send the original score string directly - the server will encode it properly
      // This preserves milliseconds for time-based workouts (e.g., "2:01.567")
      const scoreToSend = data.score

      // Serialize saves to avoid client-side concurrency hangs when saving fast.
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          try {
            const result = await saveScore({
              competitionId,
              organizingTeamId,
              trackWorkoutId: targetEvent.id,
              workoutId: targetEvent.workout.id,
              registrationId: athlete.registrationId,
              userId: athlete.userId,
              divisionId: athlete.divisionId,
              score: scoreToSend,
              scoreStatus: data.scoreStatus,
              tieBreakScore: data.tieBreakScore,
              secondaryScore: data.secondaryScore,
              roundScores: data.roundScores,
              workout: {
                scheme: targetEvent.workout.scheme,
                scoreType: targetEvent.workout.scoreType,
                repsPerRound: targetEvent.workout.repsPerRound,
                roundsToScore: targetEvent.workout.roundsToScore,
                timeCap: targetEvent.workout.timeCap,
                tiebreakScheme: targetEvent.workout.tiebreakScheme,
              },
            })

            if (result) {
              setSavedIds((prev) => new Set(prev).add(stateKey))
              const displayName =
                athlete.teamName || `${athlete.firstName} ${athlete.lastName}`
              toast.success(`Score saved for ${displayName}`)
            }
          } catch (error) {
            toast.error(getErrorMessage(error) || "Failed to save score")
          } finally {
            setSavingIds((prev) => {
              const next = new Set(prev)
              next.delete(stateKey)
              return next
            })
          }
        })
        .catch(() => {})
    },
    [
      competitionId,
      organizingTeamId,
      event,
      saveScore,
      getStateKey,
    ],
  )

  // Handle tab to next athlete (uses allAthletesInOrder for consistent navigation)
  const handleTabNext = useCallback(
    (currentIndex: number) => {
      const athleteList = hasHeats ? allAthletesInOrder : athletes
      const nextIndex = Math.min(currentIndex + 1, athleteList.length - 1)
      setFocusedIndex(nextIndex)

      // Focus the next row's input
      const nextAthlete = athleteList[nextIndex]
      if (nextAthlete) {
        rowRefs.current.get(nextAthlete.registrationId)?.focusPrimary()
      }
    },
    [athletes, hasHeats, allAthletesInOrder],
  )

  // Event filter change
  const handleEventChange = (eventId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set("event", eventId)
    // Clear division filter when changing events
    url.searchParams.delete("division")
    router.navigate({ to: url.pathname + url.search })
  }

  // Division filter change
  const handleDivisionChange = (value: string) => {
    const url = new URL(window.location.href)
    if (value === "all") {
      url.searchParams.delete("division")
    } else {
      url.searchParams.set("division", value)
    }
    router.navigate({ to: url.pathname + url.search })
  }

  // Stats — in sub-event mode, count actual athlete/sub-event pairs (not all combinations)
  const scoredCount = savedIds.size
  const totalCount = isSubEventMode
    ? athletes.reduce((count, athlete) => {
        for (const sub of subEventScoreData!) {
          if (sub.athletes.some((a) => a.registrationId === athlete.registrationId)) {
            count++
          }
        }
        return count
      }, 0)
    : athletes.length

  // Get score format examples based on workout scheme
  const scoreExamples = useMemo(() => {
    const numRounds = event.workout.roundsToScore ?? 1
    const isMultiRound = numRounds > 1

    switch (event.workout.scheme) {
      case "pass-fail":
        return {
          format: `Rounds Passed (0-${numRounds})`,
          examples: ["0", String(Math.floor(numRounds / 2)), String(numRounds)],
        }
      case "time":
      case "time-with-cap":
        return {
          format: isMultiRound
            ? `Time per round (${numRounds} rounds)`
            : "Time (MM:SS or M:SS)",
          examples: ["3:45", "12:30", "1:05:30"],
        }
      case "rounds-reps":
        return {
          format: isMultiRound
            ? `Rounds + Reps (${numRounds} scores)`
            : "Rounds + Reps",
          examples: ["5+12", "10+0", "7+15"],
        }
      case "reps":
        return {
          format: isMultiRound
            ? `Reps per round (${numRounds} rounds)`
            : "Total Reps",
          examples: ["150", "87", "203"],
        }
      case "load":
        return {
          format: "Weight (lbs or kg)",
          examples: ["225", "315", "185"],
        }
      case "calories":
        return {
          format: isMultiRound
            ? `Calories per round (${numRounds} rounds)`
            : "Total Calories",
          examples: ["150", "200", "175"],
        }
      case "meters":
        return {
          format: isMultiRound
            ? `Distance per round (${numRounds} rounds)`
            : "Distance (meters)",
          examples: ["5000", "2000", "1500"],
        }
      case "points":
        return {
          format: isMultiRound
            ? `Points per round (${numRounds} rounds)`
            : "Total Points",
          examples: ["100", "85", "92"],
        }
      default:
        return {
          format: "Score",
          examples: ["100", "3:45", "5+12"],
        }
    }
  }, [event.workout.roundsToScore, event.workout.scheme])
  const isTimeCapped = event.workout.scheme === "time-with-cap"
  const hasTiebreak = !!event.workout.tiebreakScheme
  const timeCap = event.workout.timeCap

  // Format time cap for display (seconds to MM:SS or H:MM:SS)
  const formatTimeCap = useCallback((seconds: number): string => {
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 })
    const hours = duration.hours ?? 0
    const mins = duration.minutes ?? 0
    const secs = duration.seconds ?? 0

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }, [])

  return (
    <div className="space-y-4">
      {/* Event Info & Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>{event.workout.name}</CardTitle>
              {isSubEventMode ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {subEventScoreData!.length} sub-events
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  {event.workout.scheme.replace("-", " ").toUpperCase()}
                  {isTimeCapped && timeCap && ` • Cap: ${formatTimeCap(timeCap)}`}
                  {event.workout.tiebreakScheme &&
                    ` • Tie-break: ${event.workout.tiebreakScheme}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                {scoredCount}/{totalCount} Scored
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium">Event:</span>
              <Select value={selectedEventId} onValueChange={handleEventChange}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      Event {formatTrackOrder(e.trackOrder)}: {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Division:</span>
              <Select
                value={selectedDivisionId || "all"}
                onValueChange={handleDivisionChange}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divisions</SelectItem>
                  {divisions.map((div) => (
                    <SelectItem key={div.id} value={div.id}>
                      {div.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Callout (hidden for sub-event mode since schemes vary) */}
      {!isSubEventMode && (<Collapsible>
        <Alert className="bg-muted/50">
          <HelpCircle className="h-4 w-4" />
          <AlertDescription className="flex items-start justify-between">
            <div className="flex-1">
              <span className="font-medium">Format:</span>{" "}
              <span className="text-muted-foreground">
                {scoreExamples.format} (e.g.,{" "}
                {scoreExamples.examples.join(", ")})
              </span>
              {isTimeCapped && (
                <>
                  <span className="mx-2 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    Type <strong>CAP</strong> for{" "}
                    {timeCap ? formatTimeCap(timeCap) : "time cap"}
                  </span>
                </>
              )}
              <span className="mx-2 text-muted-foreground">•</span>
              <span className="text-muted-foreground">Results auto-save</span>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-0 px-2 text-xs"
              >
                More info
              </Button>
            </CollapsibleTrigger>
          </AlertDescription>
          <CollapsibleContent className="mt-3 pt-3 border-t">
            <div className="text-sm">
              <p className="font-medium mb-1">Entering Scores</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>
                  • Type the score and press{" "}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                    Tab
                  </kbd>{" "}
                  or{" "}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                    Enter
                  </kbd>{" "}
                  to move to the next athlete
                </li>
                <li>
                  • Results auto-save when you move to the next field or click
                  away
                </li>
                <li>• Time formats: 3:45, 12:30, or 1:05:30 for hours</li>
                {isTimeCapped && (
                  <li>
                    • Type <strong>CAP</strong> if the athlete hit the{" "}
                    {timeCap ? formatTimeCap(timeCap) : "time"} cap
                  </li>
                )}
              </ul>
            </div>
          </CollapsibleContent>
        </Alert>
      </Collapsible>
      )}

      {/* Score Entry Table */}
      <Card>
        <CardContent className="p-0">
          {/* Table Header (hidden for sub-event mode since each row has its own scheme) */}
          {!isSubEventMode && (
            <div
              className={`hidden sm:grid gap-3 border-b bg-muted/30 p-3 text-sm font-medium text-muted-foreground ${hasTiebreak ? "grid-cols-[60px_1fr_2fr_1fr_100px]" : "grid-cols-[60px_1fr_2fr_100px]"}`}
            >
              <div className="text-center">{hasHeats ? "LANE" : "#"}</div>
              <div>TEAM / ATHLETE</div>
              <div>
                {(event.workout.roundsToScore ?? 1) > 1
                  ? `SCORES (${event.workout.roundsToScore} ROUNDS)`
                  : event.workout.scheme === "pass-fail"
                    ? "ROUNDS PASSED"
                    : "SCORE"}
              </div>
              {hasTiebreak && <div>TIE-BREAK</div>}
              <div className="text-center">STATUS</div>
            </div>
          )}

          {/* Score Entry Rows */}
          <div>
            {athletes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No athletes found
                {selectedDivisionId && " for this division"}
              </div>
            ) : isSubEventMode ? (
              /* Sub-event grouped layout: athlete header + one row per sub-event */
              athletes.map((athlete, index) => (
                <div
                  key={athlete.registrationId}
                  className={cn(
                    "border-b last:border-b-0",
                    index % 2 === 1 && "bg-muted/10",
                  )}
                >
                  {/* Athlete group header */}
                  <div className="flex items-center gap-3 px-3 pt-3 pb-1">
                    <div className="w-[60px] text-center text-sm font-mono text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {athlete.teamName ||
                          `${athlete.lastName}, ${athlete.firstName}`}
                      </div>
                      {athlete.teamName &&
                        athlete.teamMembers.length > 0 && (
                          <div className="text-xs text-muted-foreground truncate">
                            {athlete.teamMembers.map((m, i) => (
                              <span key={m.userId}>
                                {i > 0 && ", "}
                                {m.firstName} {m.lastName}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {athlete.divisionLabel}
                    </Badge>
                  </div>
                  {/* Sub-event score rows */}
                  {subEventScoreData!.map((sub, subIndex) => {
                    const subAthlete = sub.athletes.find(
                      (a) =>
                        a.registrationId === athlete.registrationId,
                    )
                    if (!subAthlete) return null
                    const stateKey = getStateKey(
                      athlete.registrationId,
                      sub.event.id,
                    )
                    return (
                      <ScoreInputRow
                        key={stateKey}
                        ref={(handle) => {
                          if (handle) {
                            rowRefs.current.set(stateKey, handle)
                          } else {
                            rowRefs.current.delete(stateKey)
                          }
                        }}
                        athlete={subAthlete}
                        subEventLabel={sub.event.workout.name}
                        workoutScheme={sub.event.workout.scheme}
                        tiebreakScheme={sub.event.workout.tiebreakScheme}
                        timeCap={sub.event.workout.timeCap ?? undefined}
                        roundsToScore={
                          sub.event.workout.roundsToScore ?? 1
                        }
                        scoreType={sub.event.workout.scoreType}
                        showTiebreak={
                          !!sub.event.workout.tiebreakScheme
                        }
                        value={scores[stateKey]}
                        isSaving={savingIds.has(stateKey)}
                        isSaved={savedIds.has(stateKey)}
                        onChange={(data) =>
                          handleScoreChange(
                            subAthlete,
                            data,
                            sub.event,
                          )
                        }
                        onTabNext={() => {
                          // Navigate to next sub-event row for same athlete, or first sub-event of next athlete
                          const nextSubIndex = subIndex + 1
                          if (nextSubIndex < subEventScoreData!.length) {
                            // Next sub-event for same athlete
                            const nextSub = subEventScoreData![nextSubIndex]
                            const nextKey = getStateKey(athlete.registrationId, nextSub.event.id)
                            rowRefs.current.get(nextKey)?.focusPrimary()
                          } else {
                            // First sub-event of next athlete
                            const nextAthleteIndex = index + 1
                            if (nextAthleteIndex < athletes.length) {
                              const nextAthlete = athletes[nextAthleteIndex]
                              const firstSub = subEventScoreData![0]
                              const nextKey = getStateKey(nextAthlete.registrationId, firstSub.event.id)
                              rowRefs.current.get(nextKey)?.focusPrimary()
                            }
                          }
                        }}
                      />
                    )
                  })}
                </div>
              ))
            ) : hasHeats ? (
              /* Heat-based layout */
              <>
                {heats.map((heat) => {
                  // Calculate starting index for this heat
                  const startIndex = allAthletesInOrder.findIndex((a) =>
                    heat.assignments.some(
                      (assignment) =>
                        assignment.registrationId === a.registrationId,
                    ),
                  )
                  return (
                    <HeatScoreGroup
                      key={heat.heatId}
                      heat={heat}
                      athleteMap={athleteMap}
                      workoutScheme={event.workout.scheme}
                      tiebreakScheme={event.workout.tiebreakScheme}
                      timeCap={timeCap ?? undefined}
                      roundsToScore={event.workout.roundsToScore ?? 1}
                      scoreType={event.workout.scoreType}
                      showTiebreak={hasTiebreak}
                      scores={scores}
                      savingIds={savingIds}
                      savedIds={savedIds}
                      onScoreChange={handleScoreChange}
                      onTabNext={handleTabNext}
                      rowRefs={rowRefs}
                      startIndex={startIndex >= 0 ? startIndex : 0}
                      defaultOpen={true}
                    />
                  )
                })}

                {/* Unassigned athletes section */}
                {unassignedAthletes.length > 0 && (
                  <div className="border-t">
                    <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b">
                      <span className="font-medium text-amber-800 dark:text-amber-200">
                        Unassigned Athletes
                      </span>
                      <span className="ml-2 text-sm text-amber-600 dark:text-amber-400">
                        ({unassignedAthletes.length} athletes not in any heat)
                      </span>
                    </div>
                    {unassignedAthletes.map((athlete) => {
                      const globalIndex = allAthletesInOrder.findIndex(
                        (a) => a.registrationId === athlete.registrationId,
                      )
                      return (
                        <div key={athlete.registrationId}>
                          <ScoreInputRow
                            ref={(handle) => {
                              if (handle) {
                                rowRefs.current.set(
                                  athlete.registrationId,
                                  handle,
                                )
                              } else {
                                rowRefs.current.delete(athlete.registrationId)
                              }
                            }}
                            athlete={athlete}
                            workoutScheme={event.workout.scheme}
                            tiebreakScheme={event.workout.tiebreakScheme}
                            timeCap={timeCap ?? undefined}
                            roundsToScore={event.workout.roundsToScore ?? 1}
                            scoreType={event.workout.scoreType}
                            showTiebreak={hasTiebreak}
                            value={scores[athlete.registrationId]}
                            isSaving={savingIds.has(athlete.registrationId)}
                            isSaved={savedIds.has(athlete.registrationId)}
                            onChange={(data) =>
                              handleScoreChange(athlete, data)
                            }
                            onTabNext={() => handleTabNext(globalIndex)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Flat layout (no heats) */
              athletes.map((athlete, index) => (
                <div key={athlete.registrationId}>
                  <ScoreInputRow
                    ref={(handle) => {
                      if (handle) {
                        rowRefs.current.set(athlete.registrationId, handle)
                      } else {
                        rowRefs.current.delete(athlete.registrationId)
                      }
                    }}
                    athlete={athlete}
                    workoutScheme={event.workout.scheme}
                    tiebreakScheme={event.workout.tiebreakScheme}
                    timeCap={timeCap ?? undefined}
                    roundsToScore={event.workout.roundsToScore ?? 1}
                    scoreType={event.workout.scoreType}
                    showTiebreak={hasTiebreak}
                    value={scores[athlete.registrationId]}
                    isSaving={savingIds.has(athlete.registrationId)}
                    isSaved={savedIds.has(athlete.registrationId)}
                    onChange={(data) => handleScoreChange(athlete, data)}
                    onTabNext={() => handleTabNext(index)}
                    autoFocus={index === focusedIndex && index === 0}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
