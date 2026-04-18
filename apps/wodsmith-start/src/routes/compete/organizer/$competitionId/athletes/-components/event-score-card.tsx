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
import type { ScoreStatus } from "@/db/schemas/workouts"
import {
  deleteCompetitionScoreFn,
  saveCompetitionScoreFn,
} from "@/server-fns/competition-score-fns"
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

const SCORE_STATUS_OPTIONS: { value: ScoreStatus; label: string }[] = [
  { value: "scored", label: "Scored" },
  { value: "cap", label: "Time cap" },
  { value: "dnf", label: "DNF" },
  { value: "dns", label: "DNS" },
  { value: "dq", label: "DQ" },
  { value: "withdrawn", label: "Withdrawn" },
]

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
  const saveScore = useServerFn(saveCompetitionScoreFn)
  const deleteScore = useServerFn(deleteCompetitionScoreFn)

  const captain = members.find((m) => m.isCaptain) ?? members[0]
  const captainScore = captain
    ? scores.find((s) => s.userId === captain.userId)
    : null

  const [editing, setEditing] = useState(false)
  const [scoreInput, setScoreInput] = useState(
    captainScore?.scoreValue != null ? String(captainScore.scoreValue) : "",
  )
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>(
    (captainScore?.scoreStatus as ScoreStatus) ?? "scored",
  )
  const [tiebreak, setTiebreak] = useState(
    captainScore?.tieBreakScore != null
      ? String(captainScore.tieBreakScore)
      : "",
  )
  const [isSaving, setIsSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const resetFromServer = () => {
    setScoreInput(
      captainScore?.scoreValue != null ? String(captainScore.scoreValue) : "",
    )
    setScoreStatus((captainScore?.scoreStatus as ScoreStatus) ?? "scored")
    setTiebreak(
      captainScore?.tieBreakScore != null
        ? String(captainScore.tieBreakScore)
        : "",
    )
  }

  const handleSave = async () => {
    if (!captain) return
    setIsSaving(true)
    try {
      await saveScore({
        data: {
          competitionId,
          organizingTeamId,
          trackWorkoutId: event.trackWorkoutId,
          workoutId: event.trackWorkoutId,
          registrationId,
          userId: captain.userId,
          divisionId,
          score: scoreInput.trim(),
          scoreStatus,
          tieBreakScore: tiebreak.trim() || null,
          workout: {
            scheme: event.scheme,
            scoreType: event.scoreType,
            timeCap: event.timeCap,
            tiebreakScheme: event.tiebreakScheme,
          },
        },
      })
      toast.success("Score saved")
      setEditing(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save score",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!captain) return
    setIsDeleting(true)
    try {
      await deleteScore({
        data: {
          organizingTeamId,
          competitionId,
          trackWorkoutId: event.trackWorkoutId,
          userId: captain.userId,
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
          {!captainScore && !editing ? (
            <div className="flex items-center justify-between rounded-md border border-dashed p-4">
              <div className="text-sm text-muted-foreground">
                No score entered for this event.
              </div>
              <Button size="sm" onClick={() => setEditing(true)}>
                Enter score
              </Button>
            </div>
          ) : null}

          {captainScore && !editing && (
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Score
              </span>
              <span className="font-mono font-medium text-base">
                {captainScore.scoreValue ?? "—"}
              </span>
              <Badge variant="outline" className="text-xs">
                {captainScore.scoreStatus}
              </Badge>
              {captainScore.tieBreakScore != null && (
                <span className="text-xs text-muted-foreground">
                  Tiebreak: {captainScore.tieBreakScore}
                </span>
              )}
            </div>
          )}

          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor={`score-${event.id}`}>Score</Label>
                  <Input
                    id={`score-${event.id}`}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    disabled={isSaving}
                    placeholder={
                      event.scheme === "time" ||
                      event.scheme === "time-with-cap"
                        ? "e.g. 4:32"
                        : "e.g. 180"
                    }
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`status-${event.id}`}>Status</Label>
                  <Select
                    value={scoreStatus}
                    onValueChange={(v) => setScoreStatus(v as ScoreStatus)}
                  >
                    <SelectTrigger id={`status-${event.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORE_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {event.tiebreakScheme && (
                <div className="space-y-1.5">
                  <Label htmlFor={`tb-${event.id}`}>
                    Tiebreak ({event.tiebreakScheme})
                  </Label>
                  <Input
                    id={`tb-${event.id}`}
                    value={tiebreak}
                    onChange={(e) => setTiebreak(e.target.value)}
                    disabled={isSaving}
                    className="font-mono max-w-xs"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save score"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false)
                    resetFromServer()
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
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
