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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  enterSubmissionScoreFn,
  type EventDetails,
} from "@/server-fns/submission-verification-fns"

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
 */
export function EnterScoreForm({
  videoSubmissionId,
  competitionId,
  trackWorkoutId,
  event,
}: EnterScoreFormProps) {
  const router = useRouter()
  const enterFn = useServerFn(enterSubmissionScoreFn)

  const roundsToScore = Math.max(1, event.workout.roundsToScore ?? 1)
  const isMultiRound = roundsToScore > 1

  const [score, setScore] = useState("")
  const [roundScores, setRoundScores] = useState<string[]>(() =>
    Array.from({ length: roundsToScore }, () => ""),
  )
  const [scoreStatus, setScoreStatus] = useState<"scored" | "cap">("scored")
  const [secondaryScore, setSecondaryScore] = useState("")
  const [reviewerNotes, setReviewerNotes] = useState("")
  const [noRepCount, setNoRepCount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const placeholder = event.workout.timeCap ? "10:30" : "155"

  const canSubmit = isMultiRound
    ? roundScores.every((s) => s.trim().length > 0)
    : score.trim().length > 0

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isMultiRound) {
        await enterFn({
          data: {
            competitionId,
            trackWorkoutId,
            videoSubmissionId,
            roundScores: roundScores.map((s, i) => ({
              roundNumber: i + 1,
              score: s.trim(),
            })),
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
            score: score.trim(),
            scoreStatus,
            secondaryScore: secondaryScore || undefined,
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
          <div className="space-y-2">
            <Label className="text-xs">Score per round</Label>
            <div className="space-y-2">
              {roundScores.map((value, i) => (
                <div
                  key={`enter-r-${i + 1}`}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs uppercase tracking-wider w-8 text-muted-foreground">
                    R{i + 1}
                  </span>
                  <Input
                    value={value}
                    onChange={(e) =>
                      setRoundScores((prev) => {
                        const next = [...prev]
                        next[i] = e.target.value
                        return next
                      })
                    }
                    placeholder={placeholder}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
            {event.workout.timeCap ? (
              <p className="text-[11px] text-muted-foreground">
                Status is derived per round from the time vs the per-round cap.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="enter-score" className="text-xs">
                Score
              </Label>
              <Input
                id="enter-score"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder={placeholder}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enter-status" className="text-xs">
                Status
              </Label>
              <Select
                value={scoreStatus}
                onValueChange={(v) => setScoreStatus(v as "scored" | "cap")}
              >
                <SelectTrigger id="enter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scored">Scored</SelectItem>
                  {event.workout.timeCap && (
                    <SelectItem value="cap">Capped</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {scoreStatus === "cap" && (
              <div className="space-y-2">
                <Label htmlFor="enter-secondary" className="text-xs">
                  Reps at cap
                </Label>
                <Input
                  id="enter-secondary"
                  value={secondaryScore}
                  onChange={(e) => setSecondaryScore(e.target.value)}
                  placeholder="e.g. 42"
                  type="number"
                  min="0"
                />
              </div>
            )}
          </>
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
