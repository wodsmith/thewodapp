/**
 * Submission Review Page
 *
 * Shared page body for the organizer and cohost video submission review
 * routes. The organizer route renders it with defaults (sibling video tabs,
 * manual score entry, video links editor); the cohost route injects
 * cohost-permissioned mutation overrides and omits the organizer-only
 * sections it has no cohost server fns for.
 */

import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Undo2,
  User,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { EnterScoreForm } from "@/components/compete/enter-score-form"
import { OrganizerVideoLinksEditor } from "@/components/compete/organizer-video-links-editor"
import {
  getVideoPlatformName,
  supportsInteractivePlayer,
  VideoPlayerEmbed,
  type VideoPlayerRef,
} from "@/components/compete/video-player-embed"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DOWNVOTE_REASON_LABELS,
  type DownvoteReason,
} from "@/db/schemas/video-votes"
import type {
  EventDetails,
  SubmissionDetail,
  VerificationLogEntry,
} from "@/server-fns/submission-verification-fns"
import {
  type getOrganizerSubmissionDetailFn,
  type getSiblingSubmissionsFn,
  markSubmissionReviewedFn,
  unmarkSubmissionReviewedFn,
} from "@/server-fns/video-submission-fns"
import { isSafeUrl } from "@/utils/url"
import {
  type CreateReviewNoteInput,
  type DeleteReviewNoteInput,
  MovementTallyCard,
  ReviewNoteForm,
  ReviewNotesList,
  type UpdateReviewNoteInput,
} from "./submission-review/review-notes"
import {
  type DeleteVerificationLogInput,
  VerificationControls,
  type VerifyScoreInput,
} from "./submission-review/verification-controls"

// ============================================================================
// Types
// ============================================================================

type ReviewSubmissionBase = NonNullable<
  Awaited<ReturnType<typeof getOrganizerSubmissionDetailFn>>["submission"]
>
type ReviewScoreBase = NonNullable<ReviewSubmissionBase["score"]>

/**
 * Page-level submission shape. Organizer-only fields (video index, per-round
 * scores, reviewer notes) are optional so the cohost detail fn result, which
 * does not return them, also fits.
 */
export type ReviewSubmission = Omit<
  ReviewSubmissionBase,
  "registrationId" | "videoIndex" | "reviewerNotes" | "score"
> & {
  videoIndex?: number
  reviewerNotes?: string | null
  score:
    | (Omit<ReviewScoreBase, "roundScores"> & {
        roundScores?: ReviewScoreBase["roundScores"] | null
      })
    | null
}

export type SiblingSubmission = Pick<
  Awaited<ReturnType<typeof getSiblingSubmissionsFn>>["siblings"][number],
  "id" | "videoIndex" | "videoUrl" | "notes" | "reviewedAt"
>

/** Mirrors the `notes` items of getReviewNotesForRegistrationFn. Cohost
 * routes tag their per-submission notes with the submission id. */
export interface SubmissionReviewNote {
  id: string
  type: string
  content: string
  timestampSeconds: number | null
  movementId: string | null
  movementName: string | null
  videoSubmissionId: string
  createdAt: Date
  reviewer: {
    id: string
    firstName: string | null
    lastName: string | null
    avatar: string | null
  }
}

export interface SubmissionVoteDetails {
  upvotes: number
  downvotes: number
  reasonBreakdown: Array<{ reason: string | null; count: number }>
  downvoteDetails: Array<{
    reason: string | null
    reasonDetail: string | null
    votedAt: Date
  }>
}

/** Mirrors the mark/unmarkSubmissionReviewedFn input schemas. */
export interface MarkReviewedInput {
  submissionId: string
  competitionId: string
}

/**
 * Cohost routes inject cohost-permissioned mutations. Every callback defaults
 * to the corresponding organizer server fn when omitted.
 */
export interface SubmissionReviewOverrides {
  verifyScore?: (params: VerifyScoreInput) => Promise<unknown>
  deleteVerificationLog?: (
    params: DeleteVerificationLogInput,
  ) => Promise<unknown>
  markReviewed?: (params: MarkReviewedInput) => Promise<unknown>
  unmarkReviewed?: (params: MarkReviewedInput) => Promise<unknown>
  createReviewNote?: (params: CreateReviewNoteInput) => Promise<unknown>
  updateReviewNote?: (params: UpdateReviewNoteInput) => Promise<unknown>
  deleteReviewNote?: (params: DeleteReviewNoteInput) => Promise<unknown>
}

export interface SubmissionReviewPageProps {
  competitionId: string
  eventId: string
  submissionId: string
  submission: ReviewSubmission
  /**
   * Organizer-only: sibling videos for the tabbed multi-video team UI.
   * Cohosts have no sibling-listing server fn; when omitted the page renders
   * the single submission's video.
   */
  siblings?: SiblingSubmission[]
  /**
   * Organizer-only: enables the video links editor, which calls the
   * organizer updateSubmissionVideoUrlFn directly.
   */
  videoLinksEditor?: {
    teamSize: number
    registrationId: string | null
    trackWorkoutId: string | null
  }
  verificationSubmission: SubmissionDetail | null
  event: EventDetails | null
  verificationLogs: VerificationLogEntry[]
  reviewNotes: SubmissionReviewNote[]
  workoutMovements: Array<{ id: string; name: string; type: string }>
  voteDetails: SubmissionVoteDetails | null
  /** App-relative deep-link override for the back button (organizer `back` search param). */
  backUrl?: string
  /** Cohost routes point the back link at the cohost submissions list. */
  submissionsListRoute?: string
  /**
   * Manual first-score entry uses the organizer enterSubmissionScoreFn;
   * cohosts have no equivalent fn and pass false to hide it (and the
   * event-load-failure placeholder). Default true.
   */
  enableManualScoreEntry?: boolean
  /** Cohost routes inject cohost-permissioned mutations. */
  overrides?: SubmissionReviewOverrides
}

// ============================================================================
// Community Votes Card
// ============================================================================

function CommunityVotesCard({
  voteDetails,
}: {
  voteDetails: SubmissionVoteDetails | null
}) {
  if (!voteDetails) return null

  const { upvotes, downvotes, reasonBreakdown, downvoteDetails } = voteDetails
  const totalVotes = upvotes + downvotes

  if (totalVotes === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4" />
            Community Votes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No community votes yet
          </p>
        </CardContent>
      </Card>
    )
  }

  const formatVoteDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThumbsUp className="h-4 w-4" />
          Community Votes
        </CardTitle>
        <CardDescription>{totalVotes} total votes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote totals */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <ThumbsUp className="h-4 w-4" />
            <span className="font-medium">{upvotes}</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <ThumbsDown className="h-4 w-4" />
            <span className="font-medium">{downvotes}</span>
          </div>
        </div>

        {/* Reason breakdown */}
        {reasonBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Downvote Reasons
            </p>
            <div className="space-y-1.5">
              {reasonBreakdown.map((r) => (
                <div
                  key={r.reason ?? "unknown"}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {r.reason
                      ? (DOWNVOTE_REASON_LABELS[r.reason as DownvoteReason] ??
                        r.reason)
                      : "Unknown"}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {r.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual downvote comments */}
        {downvoteDetails.some((d) => d.reasonDetail) && (
          <div className="space-y-2">
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Voter Comments
            </p>
            <div className="space-y-2">
              {downvoteDetails
                .filter((d) => d.reasonDetail)
                .map((detail, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-2 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {detail.reason
                          ? (DOWNVOTE_REASON_LABELS[
                              detail.reason as DownvoteReason
                            ] ?? detail.reason)
                          : "Other"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatVoteDate(detail.votedAt)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {detail.reasonDetail}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Page Component
// ============================================================================

export function SubmissionReviewPage({
  competitionId,
  eventId,
  submissionId,
  submission,
  siblings,
  videoLinksEditor,
  verificationSubmission,
  event,
  verificationLogs,
  reviewNotes,
  workoutMovements,
  voteDetails,
  backUrl,
  submissionsListRoute = "/compete/organizer/$competitionId/events/$eventId/submissions",
  enableManualScoreEntry = true,
  overrides,
}: SubmissionReviewPageProps) {
  const router = useRouter()

  const defaultMarkReviewed = useServerFn(markSubmissionReviewedFn)
  const defaultUnmarkReviewed = useServerFn(unmarkSubmissionReviewedFn)
  const markReviewed =
    overrides?.markReviewed ??
    (async (params: MarkReviewedInput) => defaultMarkReviewed({ data: params }))
  const unmarkReviewed =
    overrides?.unmarkReviewed ??
    (async (params: MarkReviewedInput) =>
      defaultUnmarkReviewed({ data: params }))

  // Cohorts without a sibling fn render the single submission's video.
  const siblingList: SiblingSubmission[] = siblings ?? [
    {
      id: submission.id,
      videoIndex: submission.videoIndex ?? 0,
      videoUrl: submission.videoUrl,
      notes: submission.notes,
      reviewedAt: submission.reviewedAt,
    },
  ]

  const [activeVideoIndex, setActiveVideoIndex] = useState(
    submission.videoIndex ?? 0,
  )
  // Optimistic review state: maps submissionId -> overridden reviewedAt
  const [optimisticReviews, setOptimisticReviews] = useState<
    Record<string, Date | null>
  >({})

  // Derive active sibling and per-tab notes
  const activeSubmission =
    siblingList.find((s) => s.videoIndex === activeVideoIndex) ?? siblingList[0]
  const activeTabNotes = activeSubmission
    ? reviewNotes.filter((n) => n.videoSubmissionId === activeSubmission.id)
    : reviewNotes
  const hasMultipleVideos = siblingList.length > 1

  const playerRef = useRef<VideoPlayerRef | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  const handlePlayerReady = useCallback((player: VideoPlayerRef) => {
    playerRef.current = player
  }, [])

  // Pull focus back from iframe so keyboard shortcuts work
  useEffect(() => {
    const handleBlur = () => {
      // When focus moves to the iframe, reclaim it after a tick
      setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") {
          window.focus()
        }
      }, 0)
    }
    window.addEventListener("blur", handleBlur)
    return () => window.removeEventListener("blur", handleBlur)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        if (playerRef.current) {
          playerRef.current.pauseVideo()
        }
        noteTextareaRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Resolve review state with optimistic overrides
  const getReviewedAt = (sub: { id: string; reviewedAt: Date | null }) =>
    sub.id in optimisticReviews ? optimisticReviews[sub.id] : sub.reviewedAt
  const activeReviewed = activeSubmission
    ? getReviewedAt(activeSubmission) != null
    : false
  const allReviewed = siblingList.every((s) => getReviewedAt(s) != null)
  const reviewedCount = siblingList.filter(
    (s) => getReviewedAt(s) != null,
  ).length
  const isReviewed = hasMultipleVideos ? allReviewed : activeReviewed
  const activeVideoUrl = activeSubmission?.videoUrl ?? submission.videoUrl
  const hasInteractivePlayer = supportsInteractivePlayer(activeVideoUrl)
  const platformName = getVideoPlatformName(activeVideoUrl)

  const handleToggleReview = async () => {
    if (!activeSubmission) return
    const wasReviewed = activeReviewed
    // Optimistically flip UI immediately
    setOptimisticReviews((prev) => ({
      ...prev,
      [activeSubmission.id]: wasReviewed ? null : new Date(),
    }))
    try {
      if (wasReviewed) {
        await unmarkReviewed({
          submissionId: activeSubmission.id,
          competitionId,
        })
      } else {
        await markReviewed({
          submissionId: activeSubmission.id,
          competitionId,
        })
      }
      // Await invalidation so loader data is fresh before clearing optimistic state
      await router.invalidate()
      setOptimisticReviews((prev) => {
        const next = { ...prev }
        delete next[activeSubmission.id]
        return next
      })
    } catch {
      // Revert on failure
      setOptimisticReviews((prev) => {
        const next = { ...prev }
        delete next[activeSubmission.id]
        return next
      })
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || ""
    const last = lastName?.[0] || ""
    return (first + last).toUpperCase() || "?"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            {backUrl ? (
              <a href={backUrl} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </a>
            ) : (
              <Link
                to={submissionsListRoute}
                params={{
                  competitionId,
                  eventId,
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Review Submission</h1>
            <p className="text-muted-foreground">
              {submission.athlete.firstName} {submission.athlete.lastName}
            </p>
          </div>
        </div>

        {/* Review action — applies to active tab's video */}
        {activeReviewed ? (
          <Button
            variant="outline"
            onClick={handleToggleReview}
            className="gap-2"
          >
            <Undo2 className="h-4 w-4" />
            Unmark Reviewed
          </Button>
        ) : (
          <Button
            onClick={handleToggleReview}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark as Reviewed
          </Button>
        )}
      </div>

      {/* Status banner */}
      {allReviewed ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {hasMultipleVideos
                ? `All ${siblingList.length} videos have been reviewed`
                : "This submission has been reviewed"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {hasMultipleVideos
                ? `${reviewedCount} of ${siblingList.length} videos reviewed`
                : "This submission is pending review"}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Video - takes 2 columns */}
        <div className="lg:col-span-2">
          {hasMultipleVideos ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Videos</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={String(activeVideoIndex)}
                  onValueChange={(v) => setActiveVideoIndex(Number(v))}
                >
                  <TabsList className="mb-4">
                    {siblingList.map((sib) => (
                      <TabsTrigger
                        key={sib.videoIndex}
                        value={String(sib.videoIndex)}
                        className="gap-1.5"
                      >
                        Video {sib.videoIndex + 1}
                        <span className="text-xs text-muted-foreground">
                          (
                          {sib.videoIndex === 0
                            ? "Captain"
                            : `Teammate ${sib.videoIndex}`}
                          )
                        </span>
                        {getReviewedAt(sib) != null && (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {siblingList.map((sib) => (
                    <TabsContent
                      key={sib.videoIndex}
                      value={String(sib.videoIndex)}
                    >
                      <VideoPlayerEmbed
                        url={sib.videoUrl}
                        title={`Video ${sib.videoIndex + 1}`}
                        onPlayerReady={
                          supportsInteractivePlayer(sib.videoUrl)
                            ? handlePlayerReady
                            : undefined
                        }
                      />
                      {getVideoPlatformName(sib.videoUrl) && (
                        <div className="mt-3">
                          <a
                            href={isSafeUrl(sib.videoUrl) ? sib.videoUrl : "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in {getVideoPlatformName(sib.videoUrl)}
                          </a>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Video</CardTitle>
              </CardHeader>
              <CardContent>
                <VideoPlayerEmbed
                  url={submission.videoUrl}
                  title="Submission video"
                  onPlayerReady={
                    hasInteractivePlayer ? handlePlayerReady : undefined
                  }
                />
                {platformName && (
                  <div className="mt-3">
                    <a
                      href={
                        isSafeUrl(submission.videoUrl)
                          ? submission.videoUrl
                          : "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in {platformName}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Athlete Notes — per-video */}
          {activeSubmission?.notes && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Athlete Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {activeSubmission.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Review note form — targets active video */}
          {activeSubmission && (
            <ReviewNoteForm
              key={activeSubmission.id}
              videoSubmissionId={activeSubmission.id}
              competitionId={competitionId}
              movements={workoutMovements}
              playerRef={playerRef}
              formTextareaRef={noteTextareaRef}
              onNoteCreated={() => router.invalidate()}
              onCreateNote={overrides?.createReviewNote}
            />
          )}

          {/* Review notes list — filtered to active video */}
          <ReviewNotesList
            notes={activeTabNotes}
            movements={workoutMovements}
            competitionId={competitionId}
            playerRef={playerRef}
            onNoteUpdated={() => router.invalidate()}
            onUpdateNote={overrides?.updateReviewNote}
            onDeleteNote={overrides?.deleteReviewNote}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Athlete info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Athlete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={submission.athlete.avatar ?? undefined}
                    alt={`${submission.athlete.firstName ?? ""} ${submission.athlete.lastName ?? ""}`}
                  />
                  <AvatarFallback>
                    {getInitials(
                      submission.athlete.firstName,
                      submission.athlete.lastName,
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {submission.athlete.firstName} {submission.athlete.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {submission.athlete.email}
                  </p>
                </div>
              </div>

              {submission.teamName && (
                <>
                  <Separator className="my-3" />
                  <p className="text-sm">
                    <span className="text-muted-foreground">Team: </span>
                    {submission.teamName}
                  </p>
                </>
              )}

              {submission.division && (
                <>
                  <Separator className="my-3" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Division: </span>
                    <Badge variant="outline" className="ml-1">
                      {submission.division.label}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Claimed score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Claimed Score
              </CardTitle>
              <CardDescription>Self-reported by athlete</CardDescription>
            </CardHeader>
            <CardContent>
              {submission.score?.displayScore ? (
                <div>
                  <p className="text-3xl font-mono font-bold">
                    {submission.score.displayScore}
                  </p>
                  {submission.score.status === "cap" && (
                    <Badge variant="secondary" className="mt-2">
                      Capped
                    </Badge>
                  )}
                  {submission.score.roundScores &&
                    submission.score.roundScores.length > 1 && (
                      <div className="mt-3 space-y-1">
                        {submission.score.roundScores.map((round) => (
                          <div
                            key={round.roundNumber}
                            className="flex items-center gap-2 text-sm text-muted-foreground font-mono"
                          >
                            <span className="text-xs uppercase tracking-wider w-8">
                              R{round.roundNumber}
                            </span>
                            <span>{round.displayScore ?? "—"}</span>
                            {round.status === "cap" && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4"
                              >
                                Cap
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-muted-foreground">No score submitted</p>
              )}
            </CardContent>
          </Card>

          {/* Submission metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Submission Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span>{formatDate(submission.submittedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                {isReviewed ? (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Reviewed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Community Votes */}
          <CommunityVotesCard voteDetails={voteDetails} />

          {/* Verification Controls */}
          {verificationSubmission && event ? (
            <VerificationControls
              submission={verificationSubmission}
              event={event}
              competitionId={competitionId}
              trackWorkoutId={eventId}
              logs={verificationLogs}
              roundScores={submission.score?.roundScores ?? null}
              submissionReviewerNotes={submission.reviewerNotes}
              onVerifyScore={overrides?.verifyScore}
              onDeleteVerificationLog={overrides?.deleteVerificationLog}
            />
          ) : enableManualScoreEntry ? (
            event ? (
              <EnterScoreForm
                videoSubmissionId={submissionId}
                competitionId={competitionId}
                trackWorkoutId={eventId}
                event={event}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Verification Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Could not load event details. Refresh and try again.
                  </p>
                </CardContent>
              </Card>
            )
          ) : null}

          {/* Video link editor — appears under Adjust Score for fixing broken links */}
          {videoLinksEditor && (
            <OrganizerVideoLinksEditor
              submissions={siblingList.map((s) => ({
                id: s.id,
                videoIndex: s.videoIndex,
                videoUrl: s.videoUrl,
              }))}
              competitionId={competitionId}
              teamSize={videoLinksEditor.teamSize}
              registrationId={videoLinksEditor.registrationId}
              trackWorkoutId={videoLinksEditor.trackWorkoutId}
            />
          )}

          {reviewNotes.length > 0 && <MovementTallyCard notes={reviewNotes} />}
        </div>
      </div>
    </div>
  )
}
