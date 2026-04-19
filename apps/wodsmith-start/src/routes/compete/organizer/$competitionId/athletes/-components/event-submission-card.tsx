import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { OrganizerVideoLinksEditor } from "@/components/compete/organizer-video-links-editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import {
  decodeScore,
  formatScore,
  getDefaultScoreType,
  type ScoreStatus as LibScoreStatus,
  type ScoreType,
  type WorkoutScheme,
} from "@/lib/scoring"
import { deleteOrganizerVideoSubmissionFn } from "@/server-fns/organizer-athlete-fns"
import { OrganizerScoreEditor } from "./organizer-score-editor"
import type {
  AthleteDetailEvent,
  AthleteDetailScore,
  AthleteDetailVideoSubmission,
} from "./types"

interface EventSubmissionCardProps {
  event: AthleteDetailEvent
  registrationId: string
  competitionId: string
  organizingTeamId: string
  divisionId: string | null
  submissions: AthleteDetailVideoSubmission[]
  scores: AthleteDetailScore[]
  teamSize: number
  captainUserId: string
  formatDateTime: (d: Date | string | null | undefined) => string
}

function safeDecode(value: number, scheme: string): string {
  try {
    return decodeScore(value, scheme as WorkoutScheme, { compact: false })
  } catch {
    return String(value)
  }
}

// `formatScore` canonically renders capped results as `CAP (15:30)` for
// multi-round or `CAP (142 reps)` for single-round, plus `DQ` / `WD` for
// terminal statuses. It doesn't cover `dnf` / `dns`, which we short-circuit
// here so the number slot doesn't decay to "N/A".
function formatCaptainScore(
  score: AthleteDetailScore,
  event: AthleteDetailEvent,
): string {
  if (score.scoreStatus === "dnf") return "DNF"
  if (score.scoreStatus === "dns") return "DNS"
  const scheme = event.scheme as WorkoutScheme
  const scoreType =
    (event.scoreType as ScoreType | null) ?? getDefaultScoreType(scheme)
  const hasMultipleRounds = score.scoreRounds.length > 1
  try {
    return formatScore({
      scheme,
      scoreType,
      value: score.scoreValue,
      status: score.scoreStatus as LibScoreStatus,
      timeCap:
        score.scoreStatus === "cap" &&
        !hasMultipleRounds &&
        event.timeCap &&
        score.secondaryScore !== null
          ? {
              ms: event.timeCap * 1000,
              secondaryValue: score.secondaryScore,
            }
          : undefined,
    })
  } catch {
    return score.scoreValue !== null
      ? safeDecode(score.scoreValue, event.scheme)
      : "—"
  }
}

export function EventSubmissionCard({
  event,
  registrationId,
  competitionId,
  organizingTeamId,
  divisionId,
  submissions,
  scores,
  teamSize,
  captainUserId,
  formatDateTime,
}: EventSubmissionCardProps) {
  const router = useRouter()
  const deleteSubmission = useServerFn(deleteOrganizerVideoSubmissionFn)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [enteringScore, setEnteringScore] = useState(false)

  const captainScore = scores.find((s) => s.userId === captainUserId)
  const captainSubmission = submissions.find((s) => s.videoIndex === 0) ?? null
  const deleteTarget = deleteTargetId
    ? (submissions.find((s) => s.id === deleteTargetId) ?? null)
    : null

  const captainDisplayScore = captainScore
    ? formatCaptainScore(captainScore, event)
    : null
  // Tiebreak is decoded with its *own* scheme ("time" → "M:SS.mmm",
  // "reps" → raw integer), not the main score scheme.
  const captainTiebreakDisplay =
    captainScore?.tieBreakScore != null
      ? event.tiebreakScheme === "time"
        ? safeDecode(captainScore.tieBreakScore, "time")
        : String(captainScore.tieBreakScore)
      : null
  const hasMultipleRounds =
    !!captainScore && captainScore.scoreRounds.length > 1

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteSubmission({
        data: { submissionId: deleteTarget.id, competitionId },
      })
      toast.success("Submission deleted")
      setDeleteTargetId(null)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete submission",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="truncate">{event.workoutName}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {event.scheme}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Window: {formatDateTime(event.submissionWindowStartsAt)} →{" "}
                {formatDateTime(event.submissionWindowEndsAt)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Score block — decoded display matches the submission verification page */}
          <div className="rounded-md border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Score
              </div>
              {!captainScore && !enteringScore && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => setEnteringScore(true)}
                >
                  Enter score
                </Button>
              )}
              {captainScore && !enteringScore && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => setEnteringScore(true)}
                  >
                    Edit
                  </Button>
                  {captainSubmission && (
                    <Button variant="ghost" size="sm" asChild className="h-7">
                      <Link
                        to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
                        params={{
                          competitionId,
                          eventId: event.trackWorkoutId,
                          submissionId: captainSubmission.id,
                        }}
                      >
                        Review &amp; adjust
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {enteringScore ? (
              <OrganizerScoreEditor
                event={event}
                competitionId={competitionId}
                organizingTeamId={organizingTeamId}
                registrationId={registrationId}
                userId={captainUserId}
                divisionId={divisionId}
                existing={
                  captainScore
                    ? {
                        scoreValue: captainScore.scoreValue,
                        scoreStatus: captainScore.scoreStatus,
                        tieBreakScore: captainScore.tieBreakScore,
                        secondaryScore: captainScore.secondaryScore,
                        scoreRounds: captainScore.scoreRounds,
                      }
                    : null
                }
                onCancel={() => setEnteringScore(false)}
                onSaved={() => setEnteringScore(false)}
              />
            ) : captainScore ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-mono font-bold">
                    {captainDisplayScore ?? "—"}
                  </span>
                  {captainTiebreakDisplay && (
                    <span className="text-xs text-muted-foreground font-mono">
                      Tiebreak: {captainTiebreakDisplay}
                    </span>
                  )}
                </div>
                {hasMultipleRounds && (
                  <div className="space-y-0.5 pt-1">
                    {captainScore.scoreRounds.map((round) => (
                      <div
                        key={round.roundIndex}
                        className="flex items-center gap-2 text-xs text-muted-foreground font-mono"
                      >
                        <span className="uppercase tracking-wider w-8">
                          R{round.roundIndex}
                        </span>
                        <span>
                          {safeDecode(round.scoreValue, event.scheme)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No score recorded yet.
              </div>
            )}
          </div>

          {/* Per-teammate video URL editor — compact mode keeps Save/Delete inline with the input */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
              Video Links
            </div>
            <OrganizerVideoLinksEditor
              submissions={submissions.map((s) => ({
                id: s.id,
                videoIndex: s.videoIndex,
                videoUrl: s.videoUrl,
              }))}
              competitionId={competitionId}
              teamSize={teamSize}
              registrationId={registrationId}
              trackWorkoutId={event.trackWorkoutId}
              compact
              renderSlotActions={({ submissionId }) =>
                submissionId ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteTargetId(submissionId)}
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label="Delete video"
                    title="Delete video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null
              }
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video submission</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.videoIndex === 0
                ? "This also removes the linked score for this event."
                : "This removes the teammate's video slot. The captain's score is preserved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
