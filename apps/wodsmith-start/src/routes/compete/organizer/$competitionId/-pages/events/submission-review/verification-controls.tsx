/**
 * Submission Review — Verification Controls
 *
 * Verification controls + audit log for the shared submission review page.
 * Defaults to the organizer server fns; cohost routes inject
 * cohost-permissioned callbacks via the page's `overrides` prop.
 */

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertTriangle, Ban, CheckCircle, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import {
  getSchemeLabel,
  getScoreHelpText,
  getScorePlaceholder,
} from "@/components/compete/score-entry-helpers"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
  decodeScore,
  type ParseResult,
  parseScore,
  type WorkoutScheme,
} from "@/lib/scoring"
import { cn } from "@/lib/utils"
import {
  deleteVerificationLogFn,
  type EventDetails,
  type SubmissionDetail,
  type VerificationLogEntry,
  verifySubmissionScoreFn,
} from "@/server-fns/submission-verification-fns"

/**
 * Mirrors the verifySubmissionScoreFn input schema (minus the cohost-only
 * competitionTeamId). The cohost cohostVerifySubmissionScoreFn accepts the
 * same fields except adjustedRoundScores.
 */
export interface VerifyScoreInput {
  competitionId: string
  trackWorkoutId: string
  scoreId: string
  action: "verify" | "adjust" | "invalid"
  adjustedScore?: string
  adjustedRoundScores?: Array<{ roundNumber: number; score: string }>
  adjustedScoreStatus?: "scored" | "cap"
  secondaryScore?: string
  tieBreakScore?: string
  reviewerNotes?: string
  penaltyType?: "minor" | "major"
  penaltyPercentage?: number
  noRepCount?: number
}

/** Mirrors the deleteVerificationLogFn input schema. */
export interface DeleteVerificationLogInput {
  logId: string
  competitionId: string
}

// ============================================================================
// Verification Controls Component
// ============================================================================

interface VerificationControlsProps {
  submission: SubmissionDetail
  event: EventDetails
  competitionId: string
  trackWorkoutId: string
  logs: VerificationLogEntry[]
  roundScores?: Array<{
    roundNumber: number
    value: number
    displayScore: string | null
    status?: string | null
  }> | null
  submissionReviewerNotes?: string | null
  /** Cohost routes inject a cohost-permissioned verify/adjust/invalid mutation. */
  onVerifyScore?: (params: VerifyScoreInput) => Promise<unknown>
  /** Cohost routes inject a cohost-permissioned audit-log delete mutation. */
  onDeleteVerificationLog?: (
    params: DeleteVerificationLogInput,
  ) => Promise<unknown>
}

export function VerificationControls({
  submission,
  event,
  competitionId,
  trackWorkoutId,
  logs,
  roundScores,
  submissionReviewerNotes,
  onVerifyScore,
  onDeleteVerificationLog,
}: VerificationControlsProps) {
  const router = useRouter()
  const defaultVerifyFn = useServerFn(verifySubmissionScoreFn)
  const verify =
    onVerifyScore ??
    (async (params: VerifyScoreInput) => defaultVerifyFn({ data: params }))

  const isMultiRound = (roundScores?.length ?? 0) > 1
  const sortedRoundScores = isMultiRound
    ? [...(roundScores ?? [])].sort((a, b) => a.roundNumber - b.roundNumber)
    : []
  const initialRoundInputs = sortedRoundScores.map((r) => r.displayScore ?? "")

  const [isPenalizing, setIsPenalizing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reviewerNotes, setReviewerNotes] = useState("")

  // Adjustment form state (penalty is optional)
  const [penaltyType, setPenaltyType] = useState<"none" | "minor" | "major">(
    "none",
  )
  const [noRepCount, setNoRepCount] = useState("")
  const [penaltyScore, setPenaltyScore] = useState(
    submission.score.displayValue,
  )
  const [penaltyRoundScores, setPenaltyRoundScores] =
    useState<string[]>(initialRoundInputs)
  const [penaltySecondaryScore, setPenaltySecondaryScore] = useState(
    submission.score.secondaryValue !== null
      ? String(submission.score.secondaryValue)
      : "",
  )
  const [penaltyTiebreakScore, setPenaltyTiebreakScore] = useState("")

  // Scheme config from event.workout — mirrors video-submission-form.tsx so
  // the Adjust Score form validates with the same rules athletes submit under.
  const scheme = event.workout.scheme as WorkoutScheme
  const timeCap = event.workout.timeCap
  const tiebreakScheme = event.workout.tiebreakScheme as WorkoutScheme | null

  const penaltyParseResult: ParseResult | null =
    !isMultiRound && penaltyScore.trim()
      ? parseScore(penaltyScore, scheme)
      : null

  const penaltyRoundParseResults: (ParseResult | null)[] = isMultiRound
    ? penaltyRoundScores.map((s) => (s.trim() ? parseScore(s, scheme) : null))
    : []

  // Auto-derive cap status from parsed time vs the time cap for single-round
  // workouts. Multi-round status is derived server-side per round.
  const penaltyStatus: "scored" | "cap" = (() => {
    if (isMultiRound) {
      return penaltyRoundParseResults.some(
        (r) =>
          r?.isValid &&
          r.encoded !== null &&
          scheme === "time-with-cap" &&
          timeCap &&
          r.encoded >= timeCap * 1000,
      )
        ? "cap"
        : "scored"
    }
    if (
      penaltyParseResult?.isValid &&
      penaltyParseResult.encoded !== null &&
      scheme === "time-with-cap" &&
      timeCap
    ) {
      const capMs = timeCap * 1000
      if (penaltyParseResult.encoded >= capMs) return "cap"
    }
    return "scored"
  })()

  const showPenaltySecondaryInput =
    !isMultiRound && scheme === "time-with-cap" && penaltyStatus === "cap"

  const verificationStatus = submission.verification.status

  async function handleVerify() {
    setIsSubmitting(true)
    setError(null)
    try {
      await verify({
        competitionId,
        trackWorkoutId,
        scoreId: submission.id,
        action: "verify",
      })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmitPenalty = isMultiRound
    ? penaltyRoundScores.length > 0 &&
      penaltyRoundScores.every((s) => s.trim().length > 0)
    : penaltyScore.trim().length > 0

  async function handleApplyPenalty() {
    setError(null)
    if (isMultiRound) {
      for (let i = 0; i < penaltyRoundScores.length; i++) {
        const input = penaltyRoundScores[i]
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
      if (!penaltyScore.trim()) {
        setError("Please enter an adjusted score")
        return
      }
      if (!penaltyParseResult?.isValid) {
        setError(penaltyParseResult?.error ?? "Invalid score")
        return
      }
    }

    setIsSubmitting(true)
    try {
      if (isMultiRound) {
        await verify({
          competitionId,
          trackWorkoutId,
          scoreId: submission.id,
          action: "adjust",
          adjustedRoundScores: penaltyRoundScores.map((score, i) => ({
            roundNumber: i + 1,
            score: score.trim(),
          })),
          adjustedScoreStatus: penaltyStatus,
          tieBreakScore: penaltyTiebreakScore.trim() || undefined,
          reviewerNotes: reviewerNotes.trim() || undefined,
          penaltyType: penaltyType === "none" ? undefined : penaltyType,
          noRepCount: noRepCount ? Number.parseInt(noRepCount, 10) : undefined,
        })
      } else {
        await verify({
          competitionId,
          trackWorkoutId,
          scoreId: submission.id,
          action: "adjust",
          adjustedScore: penaltyScore,
          adjustedScoreStatus: penaltyStatus,
          secondaryScore:
            penaltyStatus === "cap"
              ? penaltySecondaryScore.trim() || undefined
              : undefined,
          tieBreakScore: penaltyTiebreakScore.trim() || undefined,
          reviewerNotes: reviewerNotes.trim() || undefined,
          penaltyType: penaltyType === "none" ? undefined : penaltyType,
          noRepCount: noRepCount ? Number.parseInt(noRepCount, 10) : undefined,
        })
      }

      setIsPenalizing(false)
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleMarkInvalid() {
    setIsSubmitting(true)
    setError(null)
    try {
      await verify({
        competitionId,
        trackWorkoutId,
        scoreId: submission.id,
        action: "invalid",
        reviewerNotes: reviewerNotes.trim() || undefined,
      })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark invalid")
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusBadge = () => {
    if (!verificationStatus) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
          Pending Review
        </Badge>
      )
    }
    if (verificationStatus === "verified") {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          Verified
        </Badge>
      )
    }
    if (verificationStatus === "invalid") {
      return (
        <Badge className="bg-gray-100 text-gray-700 border-gray-300">
          <Ban className="h-3 w-3 mr-1" />
          Invalid
        </Badge>
      )
    }
    if (submission.verification.penaltyType) {
      return (
        <Badge
          variant="outline"
          className="bg-orange-500 text-white border-orange-500"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          {submission.verification.penaltyType === "major"
            ? "Major Penalty"
            : "Minor Penalty"}
        </Badge>
      )
    }
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
        Adjusted
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Controls</CardTitle>
        <CardDescription>
          Review the video and confirm or correct the athlete&apos;s claimed
          score
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          {statusBadge()}
        </div>

        {/* Claimed score */}
        <div>
          <span className="text-sm text-muted-foreground">Athlete claimed</span>
          <p className="font-mono font-semibold">
            {submission.score.displayValue || "-"}{" "}
            {submission.score.status === "cap" && (
              <span className="text-muted-foreground text-sm font-normal">
                (capped
                {submission.score.secondaryValue !== null
                  ? `, ${submission.score.secondaryValue} reps`
                  : ""}
                )
              </span>
            )}
            {tiebreakScheme && (
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                &middot; TB: {submission.score.tiebreakValue || "—"}
              </span>
            )}
          </p>
        </div>

        {/* Penalty info display (when already penalized) */}
        {submission.verification.penaltyType && (
          <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 space-y-1">
            <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
              {submission.verification.penaltyType === "major"
                ? "Major"
                : "Minor"}{" "}
              Penalty Applied
            </p>
            <div className="flex gap-4 text-xs text-orange-600 dark:text-orange-400">
              {submission.verification.penaltyPercentage !== null && (
                <span>
                  {submission.verification.penaltyPercentage}% deduction
                </span>
              )}
              {submission.verification.noRepCount !== null && (
                <span>{submission.verification.noRepCount} no-reps</span>
              )}
            </div>
            {submissionReviewerNotes && (
              <p className="text-xs text-orange-600 dark:text-orange-400 italic mt-1">
                Note: {submissionReviewerNotes}
              </p>
            )}
          </div>
        )}

        {/* Invalid info display */}
        {verificationStatus === "invalid" && (
          <div className="rounded-md border border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 p-3 space-y-1">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              This submission has been marked invalid. The workout score has
              been zeroed.
            </p>
            {submissionReviewerNotes && (
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                Reason: {submissionReviewerNotes}
              </p>
            )}
          </div>
        )}

        <Separator />

        {/* Action buttons */}
        {!isPenalizing && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={
                verificationStatus === "verified" ? "secondary" : "default"
              }
              disabled={isSubmitting}
              onClick={handleVerify}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {verificationStatus === "verified" ? "Re-verify" : "Verify Score"}
            </Button>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsPenalizing(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Adjust Score
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isSubmitting}>
                  <Ban className="h-4 w-4 mr-2" />
                  Mark Invalid
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark Submission Invalid</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will zero the athlete&apos;s score for this workout
                    only. Their other competition scores will remain unaffected.
                    Use this for wrong movements, wrong weight/equipment, edited
                    video, or an unacceptable volume of no-reps.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="invalid-notes" className="text-xs">
                    Reason (optional)
                  </Label>
                  <Textarea
                    id="invalid-notes"
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder="e.g. Wrong movement performed, edited video..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleMarkInvalid}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Mark Invalid
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Adjust score form */}
        {isPenalizing && (
          <div className="space-y-3 rounded-md border border-orange-200 p-3">
            <p className="text-sm font-medium">Adjust Score</p>

            {/* Penalty type selector (optional) */}
            <div className="space-y-2">
              <Label className="text-xs">Penalty (optional)</Label>
              <RadioGroup
                value={penaltyType}
                onValueChange={(v) =>
                  setPenaltyType(v as "none" | "minor" | "major")
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="penalty-none" />
                  <Label htmlFor="penalty-none" className="text-xs font-normal">
                    None
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minor" id="penalty-minor" />
                  <Label
                    htmlFor="penalty-minor"
                    className="text-xs font-normal"
                  >
                    Minor
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="major" id="penalty-major" />
                  <Label
                    htmlFor="penalty-major"
                    className="text-xs font-normal"
                  >
                    Major
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* No-rep count */}
            <div className="space-y-2">
              <Label htmlFor="no-rep-count" className="text-xs">
                No-rep count (optional)
              </Label>
              <Input
                id="no-rep-count"
                value={noRepCount}
                onChange={(e) => setNoRepCount(e.target.value)}
                placeholder="e.g. 12"
                type="number"
                min="0"
                className="font-mono"
              />
            </div>

            {/* Adjusted score */}
            {isMultiRound ? (
              <div className="space-y-2">
                <Label className="text-xs">
                  Adjusted {getSchemeLabel(scheme)} per round
                </Label>
                <div className="space-y-2">
                  {penaltyRoundScores.map((value, i) => {
                    const roundResult = penaltyRoundParseResults[i]
                    return (
                      <div
                        key={sortedRoundScores[i]?.roundNumber ?? i + 1}
                        className="space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wider w-8 text-muted-foreground">
                            R{i + 1}
                          </span>
                          <Input
                            value={value}
                            onChange={(e) =>
                              setPenaltyRoundScores((prev) => {
                                const next = [...prev]
                                next[i] = e.target.value
                                return next
                              })
                            }
                            placeholder={getScorePlaceholder(scheme)}
                            className={cn(
                              "font-mono",
                              roundResult?.error &&
                                !roundResult?.isValid &&
                                "border-destructive",
                            )}
                          />
                        </div>
                        {roundResult?.isValid && (
                          <p className="pl-10 text-[11px] text-green-600 dark:text-green-400">
                            Parsed as: {roundResult.formatted}
                          </p>
                        )}
                        {roundResult?.error && (
                          <p className="pl-10 text-[11px] text-destructive">
                            {roundResult.error}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {getScoreHelpText(scheme, timeCap) && (
                  <p className="text-[11px] text-muted-foreground">
                    {getScoreHelpText(scheme, timeCap)}
                  </p>
                )}
                {scheme === "time-with-cap" && timeCap ? (
                  <p className="text-[11px] text-muted-foreground">
                    Status is derived from each round&apos;s time vs the
                    per-round cap.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="penalty-score" className="text-xs">
                    Adjusted {getSchemeLabel(scheme)}
                  </Label>
                  <Input
                    id="penalty-score"
                    value={penaltyScore}
                    onChange={(e) => setPenaltyScore(e.target.value)}
                    placeholder={getScorePlaceholder(scheme)}
                    className={cn(
                      "font-mono",
                      penaltyParseResult?.error &&
                        !penaltyParseResult?.isValid &&
                        "border-destructive",
                    )}
                  />
                  {getScoreHelpText(scheme, timeCap) && (
                    <p className="text-[11px] text-muted-foreground">
                      {getScoreHelpText(scheme, timeCap)}
                    </p>
                  )}
                  {penaltyParseResult?.isValid && (
                    <p className="text-[11px] text-green-600 dark:text-green-400">
                      Parsed as: {penaltyParseResult.formatted}
                      {penaltyStatus === "cap" && " (Time Cap)"}
                    </p>
                  )}
                  {penaltyParseResult?.error && (
                    <p className="text-[11px] text-destructive">
                      {penaltyParseResult.error}
                    </p>
                  )}
                </div>
                {penaltyStatus === "cap" && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Time cap hit. Enter the reps completed at the cap below.
                  </p>
                )}
                {showPenaltySecondaryInput && (
                  <div className="space-y-2">
                    <Label htmlFor="penalty-secondary" className="text-xs">
                      Reps at cap
                    </Label>
                    <Input
                      id="penalty-secondary"
                      value={penaltySecondaryScore}
                      onChange={(e) => setPenaltySecondaryScore(e.target.value)}
                      placeholder="e.g. 42"
                      type="number"
                      min="0"
                    />
                  </div>
                )}
              </>
            )}
            {tiebreakScheme && (
              <div className="space-y-2">
                <Label htmlFor="penalty-tiebreak" className="text-xs">
                  Tiebreak ({tiebreakScheme === "time" ? "Time" : "Reps/Weight"}
                  )
                </Label>
                <Input
                  id="penalty-tiebreak"
                  value={penaltyTiebreakScore}
                  onChange={(e) => setPenaltyTiebreakScore(e.target.value)}
                  placeholder={
                    tiebreakScheme === "time" ? "e.g. 3:45" : "e.g. 100"
                  }
                  className="font-mono"
                />
              </div>
            )}

            {/* Reviewer notes */}
            <div className="space-y-2">
              <Label htmlFor="penalty-notes" className="text-xs">
                Note to athlete (optional)
              </Label>
              <Textarea
                id="penalty-notes"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Explain the adjustment..."
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                disabled={isSubmitting || !canSubmitPenalty}
                onClick={handleApplyPenalty}
              >
                {isSubmitting ? "Applying..." : "Adjust Score"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  setIsPenalizing(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Reviewer info */}
        {submission.verification.verifiedAt &&
          submission.verification.verifiedByName && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <CheckCircle className="h-3 w-3" />
              <span>
                Reviewed by {submission.verification.verifiedByName} &middot;{" "}
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                }).format(new Date(submission.verification.verifiedAt))}
              </span>
            </div>
          )}

        {/* Audit Log */}
        {logs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Audit Log</p>
              <div className="space-y-2">
                {logs.map((log) => (
                  <AuditLogEntry
                    key={log.id}
                    log={log}
                    competitionId={competitionId}
                    scoreId={submission.id}
                    trackWorkoutId={trackWorkoutId}
                    timeCap={event.workout.timeCap}
                    submissionReviewerNotes={submissionReviewerNotes}
                    onVerifyScore={onVerifyScore}
                    onDeleteVerificationLog={onDeleteVerificationLog}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Audit Log Entry Component
// ============================================================================

function AuditLogEntry({
  log,
  competitionId,
  scoreId,
  trackWorkoutId,
  timeCap,
  submissionReviewerNotes,
  onVerifyScore,
  onDeleteVerificationLog,
}: {
  log: VerificationLogEntry
  competitionId: string
  scoreId: string
  trackWorkoutId: string
  timeCap: number | null
  submissionReviewerNotes?: string | null
  onVerifyScore?: (params: VerifyScoreInput) => Promise<unknown>
  onDeleteVerificationLog?: (
    params: DeleteVerificationLogInput,
  ) => Promise<unknown>
}) {
  const router = useRouter()
  const defaultDeleteFn = useServerFn(deleteVerificationLogFn)
  const defaultVerifyFn = useServerFn(verifySubmissionScoreFn)
  const deleteLog =
    onDeleteVerificationLog ??
    (async (params: DeleteVerificationLogInput) =>
      defaultDeleteFn({ data: params }))
  const verify =
    onVerifyScore ??
    (async (params: VerifyScoreInput) => defaultVerifyFn({ data: params }))
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editPenaltyType, setEditPenaltyType] = useState<
    "minor" | "major" | null
  >((log.penaltyType as "minor" | "major") ?? null)
  const [editNoRepCount, setEditNoRepCount] = useState(
    log.noRepCount?.toString() ?? "",
  )
  const [editScore, setEditScore] = useState(
    log.newScoreValue !== null && log.scheme
      ? decodeScore(log.newScoreValue, log.scheme as WorkoutScheme, {
          compact: false,
        })
      : "",
  )
  const [editStatus, setEditStatus] = useState<"scored" | "cap">(
    (log.newStatus as "scored" | "cap") ?? "scored",
  )

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteLog({ logId: log.id, competitionId })
      await router.invalidate()
    } catch {
      setIsDeleting(false)
    }
  }

  async function handleUpdate() {
    try {
      await verify({
        competitionId,
        trackWorkoutId,
        scoreId,
        action: "adjust",
        adjustedScore: editScore,
        adjustedScoreStatus: editStatus,
        penaltyType: editPenaltyType ?? undefined,
        noRepCount: editNoRepCount
          ? Number.parseInt(editNoRepCount, 10)
          : undefined,
      })
      setIsEditing(false)
      await router.invalidate()
    } catch {
      // keep editing open on error
    }
  }

  const [isSaving, setIsSaving] = useState(false)

  if (isEditing) {
    return (
      <div className="space-y-3 rounded-md border border-orange-200 p-3">
        <p className="text-sm font-medium">Edit penalty</p>

        {/* Penalty type selector */}
        <div className="space-y-2">
          <Label className="text-xs">Penalty type</Label>
          <RadioGroup
            value={editPenaltyType ?? "none"}
            onValueChange={(v) => {
              if (v === "none") {
                setEditPenaltyType(null)
                return
              }
              setEditPenaltyType(v as "minor" | "major")
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id={`edit-penalty-none-${log.id}`} />
              <Label
                htmlFor={`edit-penalty-none-${log.id}`}
                className="text-xs font-normal"
              >
                None
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="minor"
                id={`edit-penalty-minor-${log.id}`}
              />
              <Label
                htmlFor={`edit-penalty-minor-${log.id}`}
                className="text-xs font-normal"
              >
                Minor
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="major"
                id={`edit-penalty-major-${log.id}`}
              />
              <Label
                htmlFor={`edit-penalty-major-${log.id}`}
                className="text-xs font-normal"
              >
                Major
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* No-rep count */}
        <div className="space-y-2">
          <Label htmlFor={`edit-norep-${log.id}`} className="text-xs">
            No-rep count (optional)
          </Label>
          <Input
            id={`edit-norep-${log.id}`}
            value={editNoRepCount}
            onChange={(e) => setEditNoRepCount(e.target.value)}
            placeholder="e.g. 12"
            type="number"
            min="0"
            className="font-mono"
          />
        </div>

        {/* Adjusted score */}
        <div className="space-y-2">
          <Label htmlFor={`edit-score-${log.id}`} className="text-xs">
            Adjusted score
          </Label>
          <Input
            id={`edit-score-${log.id}`}
            value={editScore}
            onChange={(e) => setEditScore(e.target.value)}
            placeholder={timeCap ? "10:30" : "155"}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-status-${log.id}`} className="text-xs">
            Status
          </Label>
          <Select
            value={editStatus}
            onValueChange={(v) => setEditStatus(v as "scored" | "cap")}
          >
            <SelectTrigger id={`edit-status-${log.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scored">Scored</SelectItem>
              {timeCap && <SelectItem value="cap">Capped</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            disabled={isSaving || !editScore.trim()}
            onClick={async () => {
              setIsSaving(true)
              await handleUpdate()
              setIsSaving(false)
            }}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={() => {
              setIsEditing(false)
              setEditPenaltyType((log.penaltyType as "minor" | "major") ?? null)
              setEditNoRepCount(log.noRepCount?.toString() ?? "")
              setEditScore(
                log.newScoreValue !== null && log.scheme
                  ? decodeScore(
                      log.newScoreValue,
                      log.scheme as WorkoutScheme,
                      { compact: false },
                    )
                  : "",
              )
              setEditStatus((log.newStatus as "scored" | "cap") ?? "scored")
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded border px-3 py-2 text-xs space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium capitalize">
          {log.action}
          {log.penaltyType && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-orange-500 text-white border-orange-500"
            >
              {log.penaltyType} penalty
            </Badge>
          )}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(log.performedAt))}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete log entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this audit log entry. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <p className="text-muted-foreground">by {log.performedByName}</p>
      {(log.action === "adjusted" || log.action === "invalid") &&
        log.newScoreValue !== null && (
          <p className="text-muted-foreground">
            {log.originalScoreValue !== null && log.scheme
              ? decodeScore(
                  log.originalScoreValue,
                  log.scheme as WorkoutScheme,
                  { compact: false },
                )
              : "—"}{" "}
            &rarr;{" "}
            {log.scheme
              ? decodeScore(log.newScoreValue, log.scheme as WorkoutScheme, {
                  compact: false,
                })
              : log.newScoreValue}
            {log.newStatus && log.newStatus !== log.originalStatus
              ? ` (${log.newStatus})`
              : ""}
          </p>
        )}
      {log.penaltyPercentage !== null && (
        <p className="text-muted-foreground">
          {log.penaltyPercentage}% deduction
          {log.noRepCount !== null && ` · ${log.noRepCount} no-reps`}
        </p>
      )}
      {log.noRepCount !== null && log.penaltyPercentage === null && (
        <p className="text-muted-foreground">{log.noRepCount} no-reps</p>
      )}
      {submissionReviewerNotes && (
        <p className="text-muted-foreground italic">
          Note: {submissionReviewerNotes}
        </p>
      )}
    </div>
  )
}
