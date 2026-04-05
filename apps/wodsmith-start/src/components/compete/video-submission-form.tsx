"use client"

import { useServerFn } from "@tanstack/react-start"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import {
  VideoUrlInput,
  type VideoUrlValidationState,
} from "@/components/ui/video-url-input"
import type { ParseResult, ScoreType, WorkoutScheme } from "@/lib/scoring"
import { decodeScore, parseScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import { getSupportedPlatformsText } from "@/schemas/video-url"
import { submitVideoFn } from "@/server-fns/video-submission-fns"
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

interface VideoSubmissionFormProps {
  trackWorkoutId: string
  competitionId: string
  timezone?: string | null
  initialData?: {
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
    } | null
    existingScore?: {
      scoreValue: number | null
      displayScore: string | null
      status: string | null
      secondaryValue: number | null
      tiebreakValue: number | null
    } | null
  }
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

/** Returns a human-readable label for a video slot based on index */
function videoSlotLabel(index: number): string {
  return index === 0 ? "Captain" : `Teammate ${index + 1}`
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
        isValid: false,
        isPending: false,
        error: null,
        parsedUrl: null,
      },
      existingSubmission: existing,
    }
  })
}

export function VideoSubmissionForm({
  trackWorkoutId,
  competitionId,
  timezone,
  initialData,
}: VideoSubmissionFormProps) {
  const teamSize = initialData?.teamSize ?? 1
  const isCaptain = initialData?.isCaptain ?? true
  const existingSubmissions = initialData?.submissions ?? []

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
  const [scoreData, setScoreData] = useState(initialData?.existingScore ?? null)

  // Score form state
  const [scoreInput, setScoreInput] = useState(
    initialData?.existingScore?.displayScore ?? "",
  )
  const [secondaryScore, setSecondaryScore] = useState(
    initialData?.existingScore?.secondaryValue?.toString() ?? "",
  )
  const [tiebreakScore, setTiebreakScore] = useState(() => {
    const tiebreakValue = initialData?.existingScore?.tiebreakValue
    const tiebreakScheme = initialData?.workout?.tiebreakScheme
    if (tiebreakValue === null || tiebreakValue === undefined) return ""
    if (tiebreakScheme === "time") {
      return decodeScore(tiebreakValue, "time", { compact: true })
    }
    return tiebreakValue.toString()
  })
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitVideo = useServerFn(submitVideoFn)

  const workout = initialData?.workout

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
  const parseResult: ParseResult | null =
    workout && scoreInput.trim() ? parseScore(scoreInput, workout.scheme) : null

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
      initialData?.existingScore?.status === "cap" &&
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

  // If user is not registered, show message
  if (!initialData?.isRegistered) {
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
              Only your team captain can submit videos and scores for this event.
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
                    {teamSize > 1
                      ? `${videoSlotLabel(sub.videoIndex)}: `
                      : ""}
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
  if (!initialData?.canSubmit && initialData?.reason) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Submit Your Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission Closed</AlertTitle>
            <AlertDescription>{initialData.reason}</AlertDescription>
          </Alert>
          {initialData?.submissionWindow && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Opens:</strong>{" "}
                {formatSubmissionTime(
                  initialData.submissionWindow.opensAt,
                  timezone,
                )}
              </p>
              <p>
                <strong>Closes:</strong>{" "}
                {formatSubmissionTime(
                  initialData.submissionWindow.closesAt,
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

    // Validate score — reuse derived parseResult
    if (scoreInput.trim() && workout) {
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

      for (const { slot, index } of slotsToSubmit) {
        const isFirstSlot = index === slotsToSubmit[0].index
        const result = await submitVideo({
          data: {
            trackWorkoutId,
            competitionId,
            videoUrl: slot.url.trim(),
            notes: slot.notes.trim() || undefined,
            videoIndex: index,
            // Only send score with the first video slot
            score: isFirstSlot ? scoreInput.trim() || undefined : undefined,
            scoreStatus:
              isFirstSlot && scoreInput.trim() ? scoreStatus : undefined,
            secondaryScore:
              isFirstSlot && scoreStatus === "cap"
                ? secondaryScore.trim() || undefined
                : undefined,
            tiebreakScore: isFirstSlot
              ? tiebreakScore.trim() || undefined
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

        if (scoreInput.trim() && workout && parseResult) {
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
        canEdit={initialData.canSubmit}
        editReason={initialData.reason}
        timezone={timezone}
        onEdit={() => setIsEditing(true)}
      />
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
                  ? `Submit your team's score and up to ${teamSize} videos`
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
          {/* Score Section */}
          {workout && (
            <>
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

              {/* Secondary Score (reps at cap) - shown when time equals time cap */}
              {scoreStatus === "cap" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  You hit the time cap. Enter the reps you completed below.
                </p>
              )}
              {showSecondaryInput && (
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
                    {workout.tiebreakScheme === "time" ? "Time" : "Reps"})
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
                      : "Reps completed for tiebreak"}
                  </p>
                </div>
              )}

              <Separator />
            </>
          )}

          {/* Video URL Inputs */}
          {videoSlots.map((slot, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`videoUrl-${index}`}>
                {teamSize > 1
                  ? `${videoSlotLabel(index)}'s Video (optional)`
                  : "Video URL"}
              </Label>
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
              {index === 0 && (
                <p className="text-xs text-muted-foreground">
                  Upload your video to {getSupportedPlatformsText()} (unlisted
                  is fine) and paste the link
                </p>
              )}

              {/* Per-slot notes */}
              {teamSize > 1 && (
                <Textarea
                  placeholder={`Notes for ${videoSlotLabel(index).toLowerCase()}'s video (optional)`}
                  value={slot.notes}
                  onChange={(e) => updateSlot(index, { notes: e.target.value })}
                  rows={1}
                  disabled={isSubmitting}
                  maxLength={1000}
                />
              )}
            </div>
          ))}

          {/* Single notes field for individual submissions */}
          {teamSize === 1 && (
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
