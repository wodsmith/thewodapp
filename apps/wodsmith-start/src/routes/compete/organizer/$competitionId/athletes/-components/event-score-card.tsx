import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
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
import { deleteCompetitionScoreFn } from "@/server-fns/competition-score-fns"
import { OrganizerScoreEditor } from "./organizer-score-editor"
import {
  type AthleteDetailEvent,
  type AthleteDetailMember,
  type AthleteDetailScore,
  memberDisplayName,
} from "./types"

interface EventScoreCardProps {
  event: AthleteDetailEvent
  registrationId: string
  competitionId: string
  organizingTeamId: string
  divisionId: string | null
  scores: AthleteDetailScore[]
  members: AthleteDetailMember[]
}

function safeDecode(value: number, scheme: string): string {
  try {
    return decodeScore(value, scheme as WorkoutScheme, { compact: false })
  } catch {
    return String(value)
  }
}

// Canonical score formatting — `CAP (15:30)` for multi-round caps,
// `CAP (142 reps)` for single-round caps, `DQ` / `WD` for terminal statuses.
// `dnf` / `dns` fall back to the badge-style label since `formatScore`
// doesn't cover them.
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

export function EventScoreCard({
  event,
  registrationId,
  competitionId,
  organizingTeamId,
  divisionId,
  scores,
  members,
}: EventScoreCardProps) {
  const router = useRouter()
  const deleteScore = useServerFn(deleteCompetitionScoreFn)

  const captain = members.find((m) => m.isCaptain) ?? members[0]
  const captainScore = captain
    ? scores.find((s) => s.userId === captain.userId)
    : null

  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    if (!captain) return
    e.preventDefault()
    setIsDeleting(true)
    try {
      await deleteScore({
        data: {
          organizingTeamId,
          competitionId,
          trackWorkoutId: event.trackWorkoutId,
          userId: captain.userId,
          divisionId: divisionId ?? undefined,
        },
      })
      toast.success("Score deleted")
      setDeleteOpen(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete score",
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
              <CardTitle className="truncate">{event.workoutName}</CardTitle>
              <CardDescription className="text-xs">
                Scheme: <span className="font-mono">{event.scheme}</span>
                {event.timeCap ? (
                  <span className="ml-2">Cap: {event.timeCap}s</span>
                ) : null}
              </CardDescription>
            </div>
            {captainScore && !editing && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  Edit score
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!captainScore && !editing && (
            <div className="flex items-center justify-between rounded-md border border-dashed p-4">
              <div className="text-sm text-muted-foreground">
                No score entered for this event.
              </div>
              <Button size="sm" onClick={() => setEditing(true)}>
                Enter score
              </Button>
            </div>
          )}

          {captainScore && !editing && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-mono font-bold">
                  {formatCaptainScore(captainScore, event)}
                </span>
                {captainScore.tieBreakScore != null && (
                  <span className="text-xs text-muted-foreground font-mono">
                    Tiebreak:{" "}
                    {event.tiebreakScheme === "time"
                      ? safeDecode(captainScore.tieBreakScore, "time")
                      : captainScore.tieBreakScore}
                  </span>
                )}
              </div>
              {captainScore.scoreRounds.length > 1 && (
                <div className="space-y-0.5">
                  {captainScore.scoreRounds.map((round) => (
                    <div
                      key={round.roundIndex}
                      className="flex items-center gap-2 text-xs text-muted-foreground font-mono"
                    >
                      <span className="uppercase tracking-wider w-8">
                        R{round.roundIndex}
                      </span>
                      <span>{safeDecode(round.scoreValue, event.scheme)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {editing && captain && (
            <OrganizerScoreEditor
              event={event}
              competitionId={competitionId}
              organizingTeamId={organizingTeamId}
              registrationId={registrationId}
              userId={captain.userId}
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
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete score</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the score for {captain ? memberDisplayName(captain) : ""}{" "}
              on <strong>{event.workoutName}</strong>? This removes the score
              record entirely.
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
