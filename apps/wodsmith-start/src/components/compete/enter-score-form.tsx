import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import type { ParseResult, WorkoutScheme } from "@/lib/scoring"
import { parseScore } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import {
  enterSubmissionScoreFn,
  type EventDetails,
} from "@/server-fns/submission-verification-fns"
import {
  getSchemeLabel,
  getScoreHelpText,
  getScorePlaceholder,
} from "./score-entry-helpers"

interface EnterScoreFormProps {
  videoSubmissionId: string
  competitionId: string
  trackWorkoutId: string
  event: EventDetails
}

/**
 * First-time score entry for video submissions whose athlete uploaded a
 * video without filling in the score field. Renders in the no-score branch
 * of both the organizer and volunteer review surfaces; once submitted, the
 * route invalidates and the standard `VerificationControls` takes over.
 *
 * Mirrors the score-entry UX of `video-submission-form.tsx` — schema-aware
 * parsing, auto-derived cap status for time-with-cap, tiebreak input — so
 * reviewers enter scores through the same validation path as athletes.
 */
export function EnterScoreForm({
  videoSubmissionId,
  competitionId,
  trackWorkoutId,
  event,
}: EnterScoreFormProps) {
  const router = useRouter()
  const enterFn = useServerFn(enterSubmissionScoreFn)

  const scheme = event.workout.scheme as WorkoutScheme
  const roundsToScore = Math.max(1, event.workout.roundsToScore ?? 1)
  const isMultiRound = roundsToScore > 1
  const timeCap = event.workout.timeCap
  const tiebreakScheme = event.workout.tiebreakScheme as WorkoutScheme | null

  const [scoreInput, setScoreInput] = useState("")
  const [roundScoreInputs, setRoundScoreInputs] = useState<string[]>(() =>
    Array.from({ length: roundsToScore }, () => ""),
  )
  const [secondaryScore, setSecondaryScore] = useState("")
  const [tiebreakInput, setTiebreakInput] = useState("")
  const [reviewerNotes, setReviewerNotes] = useState("")
  const [noRepCount, setNoRepCount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  const parseResult: ParseResult | null =
    !isMultiRound && scoreInput.trim()
      ? parseScore(scoreInput, scheme)
      : null

  const roundParseResults: (ParseResult | null)[] = isMultiRound
    ? roundScoreInputs.map((s) => (s.trim() ? parseScore(s, scheme) : null))
    : []

  const tiebreakParseResult: ParseResult | null =
    tiebreakScheme && tiebreakInput.trim()
      ? parseScore(tiebreakInput, tiebreakScheme)
      : null

  // Auto-derive cap status from parsed time vs the workout's time cap —
  // mirrors video-submission-form.tsx so reviewers don't need a separate
  // status picker.
  const scoreStatus: "scored" | "cap" = (() => {
    if (
      parseResult?.isValid &&
      parseResult.encoded !== null &&
      scheme === "time-with-cap" &&
      timeCap
    ) {
      const capMs = timeCap * 1000
      if (parseResult.encoded >= capMs) return "cap"
    }
    return "scored"
  })()

  const showSecondaryInput =
    !isMultiRound && scheme === "time-with-cap" && scoreStatus === "cap"

  const canSubmit = isMultiRound
    ? roundScoreInputs.every((s) => s.trim().length > 0)
    : scoreInput.trim().length > 0

  async function handleSubmit() {
    setError(null)
    setHasAttemptedSubmit(true)

    if (isMultiRound) {
      for (let i = 0; i < roundScoreInputs.length; i++) {
        const input = roundScoreInputs[i]
        if (!input.trim()) {
          setError(`Please enter a score for round ${i + 1}`)
          return
        }
        const r = parseScore(input, scheme)
        if (!r.isValid) {
          setError(`Round ${i + 1}: ${r.error ?? "invalid score"}`)
          return
        }
      }
    } else {
      if (!scoreInput.trim()) {
        setError("Please enter a score")
        return
      }
      if (!parseResult?.isValid) {
        setError(parseResult?.error ?? "Invalid score")
        return
      }
    }

    if (tiebreakScheme && tiebreakInput.trim() && !tiebreakParseResult?.isValid) {
      setError(tiebreakParseResult?.error ?? "Invalid tiebreak")
      return
    }

    setIsSubmitting(true)
    try {
      if (isMultiRound) {
        await enterFn({
          data: {
            competitionId,
            trackWorkoutId,
            videoSubmissionId,
            roundScores: roundScoreInputs.map((s, i) => ({
              roundNumber: i + 1,
              score: s.trim(),
            })),
            tieBreakScore: tiebreakInput.trim() || undefined,
            reviewerNotes: reviewerNotes.trim() || undefined,
            noRepCount: noRepCount
              ? Number.parseInt(noRepCount, 10)
              : undefined,
          },
        })
      } else {
        await enterFn({
          data: {
            competitionId,
            trackWorkoutId,
            videoSubmissionId,
            score: scoreInput.trim(),
            scoreStatus,
            secondaryScore:
              scoreStatus === "cap"
                ? secondaryScore.trim() || undefined
                : undefined,
            tieBreakScore: tiebreakInput.trim() || undefined,
            reviewerNotes: reviewerNotes.trim() || undefined,
            noRepCount: noRepCount
              ? Number.parseInt(noRepCount, 10)
              : undefined,
          },
        })
      }
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enter score")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Score</CardTitle>
        <CardDescription>
          The athlete uploaded a video without filling in the score field.
          Watch the video and enter what they actually scored — this creates
          the missing scores row and marks the submission reviewed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {isMultiRound ? (
          <div className="space-y-3">
            <Label>{getSchemeLabel(scheme)} per Round</Label>
            {roundScoreInputs.map((input, i) => {
              const roundResult = roundParseResults[i]
              return (
                <div key={`enter-r-${i + 1}`} className="space-y-1">
                  <Label
                    htmlFor={`enter-round-${i}`}
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Round {i + 1}
                  </Label>
                  <Input
                    id={`enter-round-${i}`}
                    value={input}
                    onChange={(e) => {
                      const next = [...roundScoreInputs]
                      next[i] = e.target.value
                      setRoundScoreInputs(next)
                    }}
                    placeholder={getScorePlaceholder(scheme)}
                    className={cn(
                      "font-mono",
                      ((roundResult?.error && !roundResult?.isValid) ||
                        (hasAttemptedSubmit && !input.trim())) &&
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
            {getScoreHelpText(scheme, timeCap) && (
              <p className="text-xs text-muted-foreground">
                {getScoreHelpText(scheme, timeCap)}
              </p>
            )}
            {scheme === "time-with-cap" && timeCap ? (
              <p className="text-[11px] text-muted-foreground">
                Status is derived per round from the time vs the per-round cap.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="enter-score">{getSchemeLabel(scheme)}</Label>
            <Input
              id="enter-score"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder={getScorePlaceholder(scheme)}
              className={cn(
                "font-mono",
                ((parseResult?.error && !parseResult?.isValid) ||
                  (hasAttemptedSubmit && !scoreInput.trim())) &&
                  "border-destructive",
              )}
              disabled={isSubmitting}
            />
            {getScoreHelpText(scheme, timeCap) && (
              <p className="text-xs text-muted-foreground">
                {getScoreHelpText(scheme, timeCap)}
              </p>
            )}
            {parseResult?.isValid && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Parsed as: {parseResult.formatted}
                {scoreStatus === "cap" && " (Time Cap)"}
              </p>
            )}
            {parseResult?.error && (
              <p className="text-xs text-destructive">{parseResult.error}</p>
            )}
          </div>
        )}

        {!isMultiRound && scoreStatus === "cap" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Time cap hit. Enter the reps completed at the cap below.
          </p>
        )}
        {showSecondaryInput && (
          <div className="space-y-2">
            <Label htmlFor="enter-secondary">Reps Completed at Cap</Label>
            <Input
              id="enter-secondary"
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

        {tiebreakScheme && (
          <div className="space-y-2">
            <Label htmlFor="enter-tiebreak">
              Tiebreak ({tiebreakScheme === "time" ? "Time" : "Reps/Weight"})
            </Label>
            <Input
              id="enter-tiebreak"
              value={tiebreakInput}
              onChange={(e) => setTiebreakInput(e.target.value)}
              placeholder={
                tiebreakScheme === "time" ? "e.g., 3:45" : "e.g., 100"
              }
              className={cn(
                "font-mono",
                tiebreakParseResult?.error &&
                  !tiebreakParseResult?.isValid &&
                  "border-destructive",
              )}
              disabled={isSubmitting}
            />
            {tiebreakParseResult?.isValid && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Parsed as: {tiebreakParseResult.formatted}
              </p>
            )}
            {tiebreakParseResult?.error && (
              <p className="text-xs text-destructive">
                {tiebreakParseResult.error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {tiebreakScheme === "time"
                ? "Time to complete specified reps/work"
                : "Reps or weight completed for tiebreak"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="enter-no-rep" className="text-xs">
            No-rep count (optional)
          </Label>
          <Input
            id="enter-no-rep"
            value={noRepCount}
            onChange={(e) => setNoRepCount(e.target.value)}
            placeholder="e.g. 12"
            type="number"
            min="0"
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="enter-notes" className="text-xs">
            Note to athlete (optional)
          </Label>
          <Textarea
            id="enter-notes"
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Why this score was entered..."
            rows={2}
            className="text-sm"
          />
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save Score"}
        </Button>
      </CardContent>
    </Card>
  )
}
