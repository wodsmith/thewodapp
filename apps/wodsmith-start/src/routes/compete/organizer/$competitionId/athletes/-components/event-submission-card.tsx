import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EnterScoreForm } from "@/components/compete/enter-score-form"
import { OrganizerVideoLinksEditor } from "@/components/compete/organizer-video-links-editor"
import { VideoPlayerEmbed } from "@/components/compete/video-player-embed"
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
import { deleteOrganizerVideoSubmissionFn } from "@/server-fns/organizer-athlete-fns"
import type { EventDetails } from "@/server-fns/submission-verification-fns"
import { ManualSubmissionDialog } from "./manual-submission-dialog"
import {
  type AthleteDetailEvent,
  type AthleteDetailMember,
  type AthleteDetailScore,
  type AthleteDetailVideoSubmission,
  memberDisplayName,
} from "./types"

interface EventSubmissionCardProps {
  event: AthleteDetailEvent
  registrationId: string
  competitionId: string
  submissions: AthleteDetailVideoSubmission[]
  scores: AthleteDetailScore[]
  members: AthleteDetailMember[]
  teamSize: number
  captainUserId: string
  formatDateTime: (d: Date | string | null | undefined) => string
}

export function EventSubmissionCard({
  event,
  registrationId,
  competitionId,
  submissions,
  scores,
  members,
  teamSize,
  captainUserId,
  formatDateTime,
}: EventSubmissionCardProps) {
  const router = useRouter()
  const deleteSubmission = useServerFn(deleteOrganizerVideoSubmissionFn)

  const [deleteTarget, setDeleteTarget] =
    useState<AthleteDetailVideoSubmission | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [editingVideoLinks, setEditingVideoLinks] = useState(false)
  const [enteringScoreForSubmission, setEnteringScoreForSubmission] = useState<
    string | null
  >(null)

  const captainScore = scores.find((s) => s.userId === captainUserId)
  const submissionByIndex = new Map<number, AthleteDetailVideoSubmission>()
  for (const s of submissions) submissionByIndex.set(s.videoIndex, s)

  const slots = Array.from({ length: Math.max(teamSize, 1) }, (_, i) => ({
    index: i,
    submission: submissionByIndex.get(i) ?? null,
  }))

  const hasAnySubmission = submissions.length > 0

  const eventDetails: EventDetails = {
    id: event.trackWorkoutId,
    trackOrder: event.ordinal,
    workout: {
      id: event.trackWorkoutId,
      name: event.workoutName,
      description: "",
      scheme: event.scheme,
      scoreType: event.scoreType,
      timeCap: event.timeCap,
      roundsToScore: 1,
      repsPerRound: null,
      tiebreakScheme: event.tiebreakScheme,
    },
    submissionWindow: {
      opensAt: event.submissionWindowStartsAt
        ? new Date(event.submissionWindowStartsAt).toISOString()
        : null,
      closesAt: event.submissionWindowEndsAt
        ? new Date(event.submissionWindowEndsAt).toISOString()
        : null,
    },
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteSubmission({
        data: { submissionId: deleteTarget.id, competitionId },
      })
      toast.success("Submission deleted")
      setDeleteTarget(null)
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
            {hasAnySubmission && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingVideoLinks((v) => !v)}
                className="shrink-0"
              >
                {editingVideoLinks ? "Close video editor" : "Edit video URLs"}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {editingVideoLinks && (
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
            />
          )}

          {captainScore && (
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Score
                </span>
                <span className="font-mono font-medium">
                  {captainScore.scoreValue ?? "—"}
                </span>
                <Badge variant="outline" className="text-xs">
                  {captainScore.scoreStatus}
                </Badge>
              </div>
              {submissions[0] && (
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link
                    to="/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId"
                    params={{
                      competitionId,
                      eventId: event.trackWorkoutId,
                      submissionId: submissions[0].id,
                    }}
                  >
                    Review & adjust
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {slots.map(({ index, submission }) => {
              const slotLabel =
                teamSize <= 1
                  ? "Submission"
                  : index === 0
                    ? "Captain video"
                    : `Teammate video ${index}`
              const slotMember =
                submission &&
                members.find((m) => m.userId === submission.userId)

              if (!submission) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="rounded-md border border-dashed p-4 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{slotLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        No submission yet.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add manually
                    </Button>
                  </div>
                )
              }

              const hasScore = !!scores.find(
                (s) => s.userId === submission.userId,
              )

              return (
                <div key={submission.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium">{slotLabel}</div>
                      {slotMember && (
                        <span className="text-xs text-muted-foreground">
                          {memberDisplayName(slotMember)}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {submission.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!hasScore && submission.videoIndex === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEnteringScoreForSubmission(
                              enteringScoreForSubmission === submission.id
                                ? null
                                : submission.id,
                            )
                          }
                        >
                          {enteringScoreForSubmission === submission.id
                            ? "Close"
                            : "Enter score"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(submission)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md overflow-hidden border bg-black">
                    <VideoPlayerEmbed url={submission.videoUrl} />
                  </div>
                  {submission.notes && (
                    <div className="text-xs text-muted-foreground">
                      Notes: {submission.notes}
                    </div>
                  )}
                  {enteringScoreForSubmission === submission.id && (
                    <EnterScoreForm
                      videoSubmissionId={submission.id}
                      competitionId={competitionId}
                      trackWorkoutId={event.trackWorkoutId}
                      event={eventDetails}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
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

      <ManualSubmissionDialog
        open={showManualDialog}
        onOpenChange={setShowManualDialog}
        registrationId={registrationId}
        competitionId={competitionId}
        trackWorkoutId={event.trackWorkoutId}
        members={members}
        teamSize={teamSize}
        existingSubmissionIndexes={submissions.map((s) => s.videoIndex)}
      />
    </>
  )
}
