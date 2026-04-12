"use client"

import { useServerFn } from "@tanstack/react-start"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  VideoUrlInput,
  type VideoUrlValidationState,
} from "@/components/ui/video-url-input"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import type { ParseResult, ScoreType, WorkoutScheme } from "@/lib/scoring"
import { decodeScore, parseScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import { getSupportedPlatformsText, parseVideoUrl } from "@/schemas/video-url"
import {
  getVideoSubmissionFn,
  submitVideoFn,
} from "@/server-fns/video-submission-fns"
import { isSafeUrl } from "@/utils/url"
import { VideoSubmissionPreview } from "./video-submission-preview"

interface VideoSubmissionData {
  id: string
  videoIndex: number
  videoUrl: string
  notes: string | null
  submittedAt: Date
  updatedAt: Date
  reviewStatus: ReviewStatus
  statusUpdatedAt: Date | null
  reviewerNotes: string | null
}

interface RegisteredDivision {
  divisionId: string
  label: string
}

interface VideoSubmissionInitialData {
  submissions: VideoSubmissionData[]
  teamSize: number
  isCaptain: boolean
  canSubmit: boolean
  reason?: string
  isRegistered: boolean
  submissionWindow?: {
    opensAt: string
    closesAt: string
  } | null
  workout?: {
    workoutId: string
    name: string
    scheme: WorkoutScheme
    scoreType: ScoreType | null
    timeCap: number | null
    tiebreakScheme: string | null
    repsPerRound: number | null
    roundsToScore: number | null
  } | null
  existingScore?: {
    scoreValue: number | null
    displayScore: string | null
    status: string | null
    secondaryValue: number | null
    tiebreakValue: number | null
    roundScores?: Array<{
      roundNumber: number
      value: number
      displayScore: string | null
    }>
  } | null
}

interface VideoSubmissionFormProps {
  trackWorkoutId: string
  competitionId: string
  timezone?: string | null
  registeredDivisions?: RegisteredDivision[]
  initialData?: VideoSubmissionInitialData
  initialDivisionId?: string
}

function formatSubmissionTime(
  date: Date | string,
  timezone?: string | null,
): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(d)
}

function getSchemeLabel(scheme: WorkoutScheme): string {
  switch (scheme) {
    case "time":
    case "time-with-cap":
      return "Time"
    case "rounds-reps":
      return "Rounds + Reps"
    case "reps":
      return "Reps"
    case "load":
      return "Load (lbs)"
    case "calories":
      return "Calories"
    case "meters":
      return "Meters"
    case "feet":
      return "Feet"
    case "points":
      return "Points"
    case "emom":
      return "Time"
    case "pass-fail":
      return "Rounds Passed"
    default:
      return "Score"
  }
}

function getPlaceholder(scheme: WorkoutScheme): string {
  switch (scheme) {
    case "time":
    case "time-with-cap":
    case "emom":
      return "e.g., 5:30 or 330"
    case "rounds-reps":
      return "e.g., 5+12 or 5.12"
    case "reps":
      return "e.g., 150"
    case "load":
      return "e.g., 225"
    case "calories":
      return "e.g., 50"
    case "meters":
      return "e.g., 1000"
    case "feet":
      return "e.g., 3000"
    case "points":
      return "e.g., 100"
    case "pass-fail":
      return "Rounds passed"
    default:
      return "Enter score"
  }
}

function getHelpText(scheme: WorkoutScheme, timeCap?: number | null): string {
  switch (scheme) {
    case "time":
      return "Enter as minutes:seconds (5:30) or total seconds (330)"
    case "time-with-cap":
      return timeCap
        ? `Enter as minutes:seconds (5:30) or total seconds. Time cap: ${Math.floor(timeCap / 60)}:${String(timeCap % 60).padStart(2, "0")}`
        : "Enter as minutes:seconds (5:30) or total seconds"
    case "rounds-reps":
      return "Enter as rounds+reps (5+12) or rounds.reps (5.12)"
    case "emom":
      return "Enter as minutes:seconds or total seconds"
    default:
      return ""
  }
}

function parseTiebreakValue(
  input: string,
  scheme: string | null,
): number | null {
  if (!input.trim()) return null
  if (scheme === "time") {
    // Parse time input (M:SS or total seconds) to milliseconds
    const timeParts = input.split(":")
    if (timeParts.length === 2) {
      const minutes = Number.parseInt(timeParts[0], 10)
      const seconds = Number.parseInt(timeParts[1], 10)
      if (!Number.isNaN(minutes) && !Number.isNaN(seconds)) {
        return (minutes * 60 + seconds) * 1000
      }
    }
    const totalSeconds = Number.parseInt(input, 10)
    if (!Number.isNaN(totalSeconds)) {
      return totalSeconds * 1000
    }
    return null
  }
  const value = Number.parseInt(input, 10)
  return Number.isNaN(value) ? null : value
}

interface VideoSlotState {
  url: string
  notes: string
  validation: VideoUrlValidationState
  existingSubmission: VideoSubmissionData | null
}

/** Returns a human-readable label for a video slot based on partner index */
function videoSlotLabel(index: number): string {
  return `Partner ${index + 1}`
}

function createInitialSlots(
  teamSize: number,
  submissions: VideoSubmissionData[],
): VideoSlotState[] {
  const submissionByIndex = new Map(submissions.map((s) => [s.videoIndex, s]))
  return Array.from({ length: teamSize }, (_, i) => {
    const existing = submissionByIndex.get(i) ?? null
    return {
      url: existing?.videoUrl ?? "",
      notes: existing?.notes ?? "",
      validation: {
        isValid: !!existing?.videoUrl,
        isPending: false,
        error: null,
        parsedUrl: existing?.videoUrl ? parseVideoUrl(existing.videoUrl) : null,
      },
      existingSubmission: existing,
    }
  })
}

export function VideoSubmissionForm({
  trackWorkoutId,
  competitionId,
  timezone,
  registeredDivisions,
  initialData,
  initialDivisionId,
}: VideoSubmissionFormProps) {
  const hasMultipleDivisions = (registeredDivisions?.length ?? 0) > 1

  // Division selection state — prefer initialDivisionId (from URL param), fall back to first
  const [selectedDivisionId, setSelectedDivisionId] = useState<
    string | undefined
  >(initialDivisionId ?? registeredDivisions?.[0]?.divisionId)

  // Track the current data (may be swapped when switching divisions)
  const [currentData, setCurrentData] = useState<
    VideoSubmissionInitialData | undefined
  >(initialData)
  const [isDivisionLoading, setIsDivisionLoading] = useState(false)

  const teamSize = currentData?.teamSize ?? 1
  const isCaptain = currentData?.isCaptain ?? true
  const existingSubmissions = currentData?.submissions ?? []

  const [videoSlots, setVideoSlots] = useState<VideoSlotState[]>(() =>
    createInitialSlots(teamSize, existingSubmissions),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const hasAnySubmission = existingSubmissions.length > 0
  const [hasSubmitted, setHasSubmitted] = useState(hasAnySubmission)
  // Show preview by default if there's an existing submission
  const [isEditing, setIsEditing] = useState(!hasAnySubmission)

  // Local state for submissions/score to avoid mutating props
  const [submissionsData, setSubmissionsData] =
    useState<VideoSubmissionData[]>(existingSubmissions)
  const [scoreData, setScoreData] = useState(currentData?.existingScore ?? null)

  // Score form state
  const [scoreInput, setScoreInput] = useState(
    currentData?.existingScore?.displayScore ?? "",
  )
  const [secondaryScore, setSecondaryScore] = useState(
    currentData?.existingScore?.secondaryValue?.toString() ?? "",
  )
  const [tiebreakScore, setTiebreakScore] = useState(() => {
    const tiebreakValue = currentData?.existingScore?.tiebreakValue
    const tiebreakScheme = currentData?.workout?.tiebreakScheme
    if (tiebreakValue === null || tiebreakValue === undefined) return ""
    if (tiebreakScheme === "time") {
      return decodeScore(tiebreakValue, "time", { compact: true })
    }
    return tiebreakValue.toString()
  })
  // Per-round score inputs for multi-round workouts
  const [roundScoreInputs, setRoundScoreInputs] = useState<string[]>(() => {
    const roundsToScore = currentData?.workout?.roundsToScore ?? 1
    if (roundsToScore <= 1) return []
    const existingRounds = currentData?.existingScore?.roundScores ?? []
    return Array.from({ length: roundsToScore }, (_, i) => {
      const existing = existingRounds.find((r) => r.roundNumber === i + 1)
      return existing?.displayScore ?? ""
    })
  })
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitVideo = useServerFn(submitVideoFn)
  const fetchSubmission = useServerFn(getVideoSubmissionFn)

  const workout = currentData?.workout
  const roundsToScore = workout?.roundsToScore ?? 1
  const isMultiRound = roundsToScore > 1

  // Handle division switch — fetch submission data for the new division
  const handleDivisionChange = useCallback(
    async (divisionId: string) => {
      if (divisionId === selectedDivisionId) return
      setIsDivisionLoading(true)
      setError(null)
      setSuccess(null)

      try {
        const result = await fetchSubmission({
          data: {
            trackWorkoutId,
            competitionId,
            divisionId,
          },
        })

        setSelectedDivisionId(divisionId)
        // Reset all form state for the new division
        setCurrentData(result)
        const subs = result.submissions ?? []
        setSubmissionsData(subs)
        setVideoSlots(createInitialSlots(result.teamSize, subs))
        setScoreData(result.existingScore ?? null)
        setScoreInput(result.existingScore?.displayScore ?? "")
        setSecondaryScore(
          result.existingScore?.secondaryValue?.toString() ?? "",
        )
        if (
          result.existingScore?.tiebreakValue != null &&
          result.workout?.tiebreakScheme
        ) {
          setTiebreakScore(
            result.workout.tiebreakScheme === "time"
              ? decodeScore(result.existingScore.tiebreakValue, "time", {
                  compact: true,
                })
              : result.existingScore.tiebreakValue.toString(),
          )
        } else {
          setTiebreakScore("")
        }
        // Reset round score inputs for the new division's workout
        const newRoundsToScore = result.workout?.roundsToScore ?? 1
        if (newRoundsToScore > 1) {
          const existingRounds = result.existingScore?.roundScores ?? []
          setRoundScoreInputs(
            Array.from({ length: newRoundsToScore }, (_, i) => {
              const existing = existingRounds.find(
                (r) => r.roundNumber === i + 1,
              )
              return existing?.displayScore ?? ""
            }),
          )
        } else {
          setRoundScoreInputs([])
        }
        setHasSubmitted(subs.length > 0)
        setIsEditing(subs.length === 0)
      } catch {
        setError("Failed to load submission data for this division")
      } finally {
        setIsDivisionLoading(false)
      }
    },
    [selectedDivisionId, trackWorkoutId, competitionId, fetchSubmission],
  )

  // Sync form state from loader props when initialDivisionId changes (e.g., URL navigation).
  // The route loader already re-fetches with the correct division, so initialData is fresh —
  // no need to trigger another network request via handleDivisionChange.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only react to initialDivisionId — initialData is read but shouldn't trigger re-sync
  useEffect(() => {
    if (initialDivisionId && initialDivisionId !== selectedDivisionId) {
      setSelectedDivisionId(initialDivisionId)
      if (initialData) {
        setCurrentData(initialData)
        const subs = initialData.submissions ?? []
        setSubmissionsData(subs)
        setVideoSlots(createInitialSlots(initialData.teamSize, subs))
        setScoreData(initialData.existingScore ?? null)
        setScoreInput(initialData.existingScore?.displayScore ?? "")
        setSecondaryScore(
          initialData.existingScore?.secondaryValue?.toString() ?? "",
        )
        if (
          initialData.existingScore?.tiebreakValue != null &&
          initialData.workout?.tiebreakScheme
        ) {
          setTiebreakScore(
            initialData.workout.tiebreakScheme === "time"
              ? decodeScore(initialData.existingScore.tiebreakValue, "time", {
                  compact: true,
                })
              : initialData.existingScore.tiebreakValue.toString(),
          )
        } else {
          setTiebreakScore("")
        }
        const newRoundsToScore = initialData.workout?.roundsToScore ?? 1
        if (newRoundsToScore > 1) {
          const existingRounds = initialData.existingScore?.roundScores ?? []
          setRoundScoreInputs(
            Array.from({ length: newRoundsToScore }, (_, i) => {
              const existing = existingRounds.find(
                (r) => r.roundNumber === i + 1,
              )
              return existing?.displayScore ?? ""
            }),
          )
        } else {
          setRoundScoreInputs([])
        }
        setHasSubmitted(subs.length > 0)
        setIsEditing(subs.length === 0)
      }
    }
  }, [initialDivisionId])

  // Transition to preview mode after success message displays
  useEffect(() => {
    if (!success) return
    successTimerRef.current = setTimeout(() => {
      setSuccess(null)
      setIsEditing(false)
    }, 1500)
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [success])

  // Derived state — parseResult is a pure function of scoreInput + scheme
  // For multi-round, parse each round independently
  const roundParseResults: (ParseResult | null)[] = isMultiRound && workout
    ? roundScoreInputs.map((input) =>
        input.trim() ? parseScore(input, workout.scheme) : null,
      )
    : []

  const parseResult: ParseResult | null =
    !isMultiRound && workout && scoreInput.trim()
      ? parseScore(scoreInput, workout.scheme)
      : null

  // Derive status from whether time meets or exceeds time cap
  const scoreStatus: "scored" | "cap" = (() => {
    if (
      parseResult?.isValid &&
      parseResult.encoded !== null &&
      workout?.scheme === "time-with-cap" &&
      workout?.timeCap
    ) {
      const timeCapMs = workout.timeCap * 1000
      if (parseResult.encoded >= timeCapMs) {
        return "cap"
      }
    }

    if (
      !parseResult &&
      currentData?.existingScore?.status === "cap" &&
      workout?.scheme === "time-with-cap"
    ) {
      return "cap"
    }

    return "scored"
  })()

  // Helper to update a specific video slot
  const updateSlot = (index: number, updates: Partial<VideoSlotState>) => {
    setVideoSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...updates } : slot)),
    )
  }

  const selectedDivisionLabel = registeredDivisions?.find(
    (d) => d.divisionId === selectedDivisionId,
  )?.label

  // Division selector rendered at the top of submission forms
  const divisionSelector = hasMultipleDivisions ? (
    <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-500 dark:bg-orange-950">
      <Label
        htmlFor="submission-division"
        className="text-sm font-medium whitespace-nowrap text-orange-900 dark:text-orange-100"
      >
        Submitting for:
      </Label>
      <Select
        value={selectedDivisionId}
        onValueChange={handleDivisionChange}
        disabled={isDivisionLoading || isSubmitting}
      >
        <SelectTrigger
          id="submission-division"
          className="h-9 font-medium bg-background text-foreground"
        >
          <SelectValue placeholder="Select division" />
        </SelectTrigger>
        <SelectContent>
          {registeredDivisions?.map((div) => (
            <SelectItem
              key={div.divisionId}
              value={div.divisionId}
              className="cursor-pointer"
            >
              {div.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : selectedDivisionLabel ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Division:</span>
      <Badge variant="secondary">{selectedDivisionLabel}</Badge>
    </div>
  ) : null

  // Loading overlay when switching divisions
  if (isDivisionLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Submit Your Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {divisionSelector}
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading submission data...
          </div>
        </CardContent>
      </Card>
    )
  }

  // If user is not registered, show message
  if (!currentData?.isRegistered) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Submit Your Result</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Registration Required</AlertTitle>
            <AlertDescription>
              You must be registered for this competition to submit your result.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Non-captain team members see a read-only view
  if (!isCaptain) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Team Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Captain Only</AlertTitle>
            <AlertDescription>
              Only your team captain can submit videos and scores for this
              event.
            </AlertDescription>
          </Alert>
          {scoreData?.displayScore && (
            <div>
              <p className="text-sm font-medium">Team score:</p>
              <p className="text-lg font-mono font-bold">
                {scoreData.displayScore}
                {scoreData.status === "cap" && " (Capped)"}
              </p>
            </div>
          )}
          {submissionsData.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Submitted videos ({submissionsData.length}
                {teamSize > 1 ? ` of ${teamSize}` : ""}):
              </p>
              {submissionsData.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <a
                    href={isSafeUrl(sub.videoUrl) ? sub.videoUrl : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {teamSize > 1 ? `${videoSlotLabel(sub.videoIndex)}: ` : ""}
                    {sub.videoUrl}
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // If submission window is not open, show status
  if (!currentData?.canSubmit && currentData?.reason) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Submit Your Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {divisionSelector}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission Closed</AlertTitle>
            <AlertDescription>{currentData.reason}</AlertDescription>
          </Alert>
          {currentData?.submissionWindow && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Opens:</strong>{" "}
                {formatSubmissionTime(
                  currentData.submissionWindow.opensAt,
                  timezone,
                )}
              </p>
              <p>
                <strong>Closes:</strong>{" "}
                {formatSubmissionTime(
                  currentData.submissionWindow.closesAt,
                  timezone,
                )}
              </p>
            </div>
          )}
          {(hasSubmitted || scoreData?.displayScore) && (
            <div className="pt-2 border-t space-y-3">
              {scoreData?.displayScore && (
                <div>
                  <p className="text-sm font-medium">
                    {teamSize > 1 ? "Team score:" : "Your claimed score:"}
                  </p>
                  <p className="text-lg font-mono font-bold">
                    {scoreData.displayScore}
                    {scoreData.status === "cap" && " (Capped)"}
                  </p>
                </div>
              )}
              {submissionsData.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {teamSize > 1
                      ? `Submitted videos (${submissionsData.length} of ${teamSize}):`
                      : "Your submitted video:"}
                  </p>
                  {submissionsData.map((sub) => (
                    <a
                      key={sub.id}
                      href={isSafeUrl(sub.videoUrl) ? sub.videoUrl : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {teamSize > 1 ? `Video ${sub.videoIndex + 1}: ` : ""}
                      {sub.videoUrl}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // For teams, require ALL video links; for individuals, require at least one
    if (teamSize > 1) {
      const missingSlots = videoSlots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => !slot.url.trim())
      if (missingSlots.length > 0) {
        const labels = missingSlots
          .map(({ index }) => videoSlotLabel(index))
          .join(", ")
        setError(`Missing video links for: ${labels}`)
        return
      }
    }

    // Find slots that have a video URL to submit
    const slotsToSubmit = videoSlots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.url.trim())

    if (slotsToSubmit.length === 0) {
      setError("Please enter at least one video URL")
      return
    }

    // Validate all filled slots have valid URLs
    for (const { slot, index } of slotsToSubmit) {
      if (!slot.validation.isValid) {
        const label = teamSize > 1 ? `${videoSlotLabel(index)}: ` : ""
        setError(
          `${label}${slot.validation.error ?? "Please enter a valid video URL"}`,
        )
        return
      }
    }

    // Validate score — multi-round or single
    if (isMultiRound && workout) {
      const filledRounds = roundScoreInputs.filter((s) => s.trim())
      if (filledRounds.length > 0 && filledRounds.length < roundsToScore) {
        setError(
          `Please enter scores for all ${roundsToScore} rounds, or leave them all empty`,
        )
        return
      }
      for (let i = 0; i < roundScoreInputs.length; i++) {
        const input = roundScoreInputs[i]
        if (input.trim()) {
          const result = parseScore(input, workout.scheme)
          if (!result.isValid) {
            setError(
              `Round ${i + 1}: ${result.error || "Please check your score entry"}`,
            )
            return
          }
        }
      }
    } else if (scoreInput.trim() && workout) {
      if (!parseResult?.isValid) {
        setError(
          `Invalid score: ${parseResult?.error || "Please check your score entry"}`,
        )
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Submit each video slot (score only sent with the first)
      const results: Array<{
        success: boolean
        submissionId?: string
        isUpdate?: boolean
        videoIndex: number
      }> = []

      // Build round scores array for multi-round workouts
      const roundScoresPayload = isMultiRound
        ? roundScoreInputs
            .filter((s) => s.trim())
            .map((s) => ({ score: s.trim() }))
        : undefined

      for (const { slot, index } of slotsToSubmit) {
        const isFirstSlot = index === slotsToSubmit[0].index
        const result = await submitVideo({
          data: {
            trackWorkoutId,
            competitionId,
            divisionId: selectedDivisionId,
            videoUrl: slot.url.trim(),
            notes: slot.notes.trim() || undefined,
            videoIndex: index,
            // Only send score with the first video slot
            score: isFirstSlot && !isMultiRound
              ? scoreInput.trim() || undefined
              : undefined,
            scoreStatus:
              isFirstSlot && !isMultiRound && scoreInput.trim()
                ? scoreStatus
                : undefined,
            secondaryScore:
              isFirstSlot && !isMultiRound && scoreStatus === "cap"
                ? secondaryScore.trim() || undefined
                : undefined,
            tiebreakScore: isFirstSlot
              ? tiebreakScore.trim() || undefined
              : undefined,
            roundScores:
              isFirstSlot && roundScoresPayload?.length
                ? roundScoresPayload
                : undefined,
          },
        })
        results.push({ ...result, videoIndex: index })
      }

      const allSuccess = results.every((r) => r.success)
      if (allSuccess) {
        const anyUpdate = results.some((r) => r.isUpdate)
        setSuccess(
          anyUpdate
            ? "Submission updated successfully!"
            : "Submitted successfully!",
        )
        setHasSubmitted(true)

        // Update local submission data
        const newSubmissions = [...submissionsData]
        for (const result of results) {
          const slot = videoSlots[result.videoIndex]
          const existingIdx = newSubmissions.findIndex(
            (s) => s.videoIndex === result.videoIndex,
          )
          const newSub: VideoSubmissionData = {
            id: result.submissionId ?? "",
            videoIndex: result.videoIndex,
            videoUrl: slot.url.trim(),
            notes: slot.notes.trim() || null,
            submittedAt:
              existingIdx >= 0
                ? newSubmissions[existingIdx].submittedAt
                : new Date(),
            updatedAt: new Date(),
            reviewStatus:
              existingIdx >= 0
                ? newSubmissions[existingIdx].reviewStatus
                : "pending",
            statusUpdatedAt:
              existingIdx >= 0
                ? newSubmissions[existingIdx].statusUpdatedAt
                : null,
            reviewerNotes:
              existingIdx >= 0
                ? newSubmissions[existingIdx].reviewerNotes
                : null,
          }
          if (existingIdx >= 0) {
            newSubmissions[existingIdx] = newSub
          } else {
            newSubmissions.push(newSub)
          }
        }
        setSubmissionsData(newSubmissions)

        if (isMultiRound && roundScoresPayload?.length && workout) {
          // For multi-round, we don't compute the aggregate client-side —
          // just store the round display values for preview
          setScoreData({
            scoreValue: null,
            displayScore: roundScoreInputs.filter((s) => s.trim()).join(" + "),
            status: "scored",
            secondaryValue: null,
            tiebreakValue: tiebreakScore
              ? parseTiebreakValue(tiebreakScore, workout.tiebreakScheme)
              : null,
            roundScores: roundScoreInputs
              .filter((s) => s.trim())
              .map((s, i) => ({
                roundNumber: i + 1,
                value: 0,
                displayScore: s.trim(),
              })),
          })
        } else if (scoreInput.trim() && workout && parseResult) {
          setScoreData({
            scoreValue: parseResult.encoded,
            displayScore: parseResult.formatted ?? scoreInput,
            status: scoreStatus,
            secondaryValue: secondaryScore ? Number(secondaryScore) : null,
            tiebreakValue: tiebreakScore
              ? parseTiebreakValue(tiebreakScore, workout.tiebreakScheme)
              : null,
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isTimeCapped = workout?.scheme === "time-with-cap"
  const showSecondaryInput = isTimeCapped && scoreStatus === "cap"

  // Show preview when there are submissions and we're not editing
  if (hasSubmitted && submissionsData.length > 0 && !isEditing) {
    return (
      <div className="space-y-3">
        {divisionSelector}
        <VideoSubmissionPreview
          submissions={submissionsData}
          teamSize={teamSize}
          score={scoreData}
          workout={
            workout
              ? {
                  name: workout.name,
                  scheme: workout.scheme,
                  scoreType: workout.scoreType,
                  timeCap: workout.timeCap,
                  tiebreakScheme: workout.tiebreakScheme,
                }
              : undefined
          }
          canEdit={currentData.canSubmit}
          editReason={currentData.reason}
          timezone={timezone}
          onEdit={() => setIsEditing(true)}
        />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {hasSubmitted
                ? "Update Your Result"
                : teamSize > 1
                  ? "Submit Team Result"
                  : "Submit Your Result"}
            </CardTitle>
            <CardDescription>
              {hasSubmitted
                ? "Update your submission below"
                : teamSize > 1
                  ? `Submit your team's score and ${teamSize} partner videos`
                  : "Submit your score and video for this event"}
            </CardDescription>
          </div>
          {hasSubmitted && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Division Selector */}
          {divisionSelector}

          {/* Score Section */}
          {workout && (
            <>
              {isMultiRound ? (
                /* Per-round score inputs for multi-round workouts */
                <div className="space-y-3">
                  <Label>
                    {getSchemeLabel(workout.scheme)} per Round
                  </Label>
                  {roundScoreInputs.map((input, i) => {
                    const roundResult = roundParseResults[i]
                    return (
                      <div key={i} className="space-y-1">
                        <Label
                          htmlFor={`round-score-${i}`}
                          className="text-sm font-normal text-muted-foreground"
                        >
                          Round {i + 1}
                        </Label>
                        <Input
                          id={`round-score-${i}`}
                          value={input}
                          onChange={(e) => {
                            const updated = [...roundScoreInputs]
                            updated[i] = e.target.value
                            setRoundScoreInputs(updated)
                          }}
                          placeholder={getPlaceholder(workout.scheme)}
                          className={cn(
                            "font-mono",
                            roundResult?.error &&
                              !roundResult?.isValid &&
                              "border-destructive",
                          )}
                          disabled={isSubmitting}
                        />
                        {roundResult?.isValid && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Parsed as: {roundResult.formatted}
                          </p>
                        )}
                        {roundResult?.error && (
                          <p className="text-xs text-destructive">
                            {roundResult.error}
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {getHelpText(workout.scheme, workout.timeCap) && (
                    <p className="text-xs text-muted-foreground">
                      {getHelpText(workout.scheme, workout.timeCap)}
                    </p>
                  )}
                </div>
              ) : (
                /* Single score input */
                <div className="space-y-2">
                  <Label htmlFor="score-input">
                    {teamSize > 1 ? "Team " : "Your "}
                    {getSchemeLabel(workout.scheme)}
                  </Label>
                  <Input
                    id="score-input"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder={getPlaceholder(workout.scheme)}
                    className={cn(
                      "font-mono",
                      parseResult?.error &&
                        !parseResult?.isValid &&
                        "border-destructive",
                    )}
                    disabled={isSubmitting}
                  />
                  {getHelpText(workout.scheme, workout.timeCap) && (
                    <p className="text-xs text-muted-foreground">
                      {getHelpText(workout.scheme, workout.timeCap)}
                    </p>
                  )}
                  {parseResult?.isValid && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Parsed as: {parseResult.formatted}
                      {scoreStatus === "cap" && " (Time Cap)"}
                    </p>
                  )}
                  {parseResult?.error && (
                    <p className="text-xs text-destructive">
                      {parseResult.error}
                    </p>
                  )}
                </div>
              )}

              {/* Secondary Score (reps at cap) - shown when time equals time cap */}
              {!isMultiRound && scoreStatus === "cap" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  You hit the time cap. Enter the reps you completed below.
                </p>
              )}
              {!isMultiRound && showSecondaryInput && (
                <div className="space-y-2">
                  <Label htmlFor="secondary-input">Reps Completed at Cap</Label>
                  <Input
                    id="secondary-input"
                    type="number"
                    value={secondaryScore}
                    onChange={(e) => setSecondaryScore(e.target.value)}
                    placeholder="e.g., 150"
                    min="0"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total reps/work completed when the time cap hit
                  </p>
                </div>
              )}

              {/* Tiebreak Score */}
              {workout.tiebreakScheme && (
                <div className="space-y-2">
                  <Label htmlFor="tiebreak-input">
                    Tiebreak (
                    {workout.tiebreakScheme === "time" ? "Time" : "Reps/Weight"})
                  </Label>
                  <Input
                    id="tiebreak-input"
                    value={tiebreakScore}
                    onChange={(e) => setTiebreakScore(e.target.value)}
                    placeholder={
                      workout.tiebreakScheme === "time"
                        ? "e.g., 3:45"
                        : "e.g., 100"
                    }
                    className="font-mono"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {workout.tiebreakScheme === "time"
                      ? "Time to complete specified reps/work"
                      : "Reps or weight completed for tiebreak"}
                  </p>
                </div>
              )}

              <Separator />
            </>
          )}

          {/* Partner Submission Links — separate section for teams */}
          {teamSize > 1 && (
            <div className="space-y-3">
              <div>
                <Label className="text-base">Partner Submission Links</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Each partner must provide a video link. Upload to{" "}
                  {getSupportedPlatformsText()} (unlisted is fine) and paste the
                  link.
                </p>
              </div>
              {videoSlots.map((slot, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`videoUrl-${index}`}>
                    {videoSlotLabel(index)}&apos;s Video
                  </Label>
                  <VideoUrlInput
                    id={`videoUrl-${index}`}
                    value={slot.url}
                    onChange={(url) => updateSlot(index, { url })}
                    onValidationChange={(validation) =>
                      updateSlot(index, { validation })
                    }
                    required
                    disabled={isSubmitting}
                    showPlatformBadge
                    showPreviewLink
                  />
                  <Textarea
                    placeholder={`Notes for ${videoSlotLabel(index).toLowerCase()}'s video`}
                    value={slot.notes}
                    onChange={(e) =>
                      updateSlot(index, { notes: e.target.value })
                    }
                    rows={1}
                    disabled={isSubmitting}
                    maxLength={1000}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Individual video submission */}
          {teamSize === 1 && (
            <>
              {videoSlots.map((slot, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`videoUrl-${index}`}>Video URL</Label>
                  <VideoUrlInput
                    id={`videoUrl-${index}`}
                    value={slot.url}
                    onChange={(url) => updateSlot(index, { url })}
                    onValidationChange={(validation) =>
                      updateSlot(index, { validation })
                    }
                    required={false}
                    disabled={isSubmitting}
                    showPlatformBadge
                    showPreviewLink
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload your video to {getSupportedPlatformsText()} (unlisted
                    is fine) and paste the link
                  </p>
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information about your submission..."
                  value={videoSlots[0]?.notes ?? ""}
                  onChange={(e) => updateSlot(0, { notes: e.target.value })}
                  rows={2}
                  disabled={isSubmitting}
                  maxLength={1000}
                />
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="border-green-500 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full bg-orange-500 text-white hover:bg-orange-600" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : hasSubmitted ? (
              "Update Submission"
            ) : (
              "Submit Result"
            )}
          </Button>

          {/* Previous Submission Info */}
          {hasSubmitted && submissionsData.length > 0 && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Last submitted:{" "}
              {formatSubmissionTime(
                submissionsData[submissionsData.length - 1].submittedAt,
                timezone,
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
