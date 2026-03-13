"use client"

import { useServerFn } from "@tanstack/react-start"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/utils/cn"
import { castVideoVoteFn } from "@/server-fns/video-vote-fns"
import type { DownvoteReason } from "@/db/schemas/video-votes"

const DOWNVOTE_REASON_LABELS: Record<DownvoteReason, string> = {
  suspected_no_rep: "Suspected no-rep",
  video_quality: "Video quality issues",
  wrong_movement: "Wrong movement standard",
  incomplete_workout: "Incomplete workout",
  other: "Other",
}

interface VideoVoteButtonsProps {
  videoSubmissionId: string
  userVote: "upvote" | "downvote" | null
  onVoteChange?: (newState: {
    userVote: "upvote" | "downvote" | null
  }) => void
}

export function VideoVoteButtons({
  videoSubmissionId,
  userVote: initialUserVote,
  onVoteChange,
}: VideoVoteButtonsProps) {
  const [userVote, setUserVote] = useState(initialUserVote)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [downvoteOpen, setDownvoteOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState<DownvoteReason | "">("")
  const [reasonDetail, setReasonDetail] = useState("")

  const castVote = useServerFn(castVideoVoteFn)

  const hasVoted = userVote !== null

  const handleUpvote = async () => {
    if (isSubmitting || hasVoted) return
    setIsSubmitting(true)

    try {
      await castVote({
        data: { videoSubmissionId, voteType: "upvote" },
      })
      setUserVote("upvote")
      onVoteChange?.({ userVote: "upvote" })
    } catch (error) {
      console.error("Failed to vote:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownvoteSubmit = async () => {
    if (isSubmitting || hasVoted || !selectedReason) return
    setIsSubmitting(true)

    try {
      await castVote({
        data: {
          videoSubmissionId,
          voteType: "downvote",
          reason: selectedReason as DownvoteReason,
          reasonDetail: reasonDetail.trim() || undefined,
        },
      })
      setUserVote("downvote")
      onVoteChange?.({ userVote: "downvote" })
      setDownvoteOpen(false)
      setSelectedReason("")
      setReasonDetail("")
    } catch (error) {
      console.error("Failed to downvote:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {/* Upvote button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 gap-1 px-2 text-xs",
          userVote === "upvote" && "text-green-600 dark:text-green-400",
        )}
        onClick={handleUpvote}
        disabled={isSubmitting || hasVoted}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>

      {/* Downvote button — opens reason popover if not yet voted */}
      {userVote === "downvote" ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-red-600 dark:text-red-400"
          disabled
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Popover open={downvoteOpen} onOpenChange={hasVoted ? undefined : setDownvoteOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={isSubmitting || hasVoted}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-3">
              <p className="text-sm font-medium">Why are you downvoting?</p>
              <RadioGroup
                value={selectedReason}
                onValueChange={(v) => setSelectedReason(v as DownvoteReason)}
              >
                {(
                  Object.entries(DOWNVOTE_REASON_LABELS) as Array<
                    [DownvoteReason, string]
                  >
                ).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem value={value} id={`reason-${value}`} />
                    <Label
                      htmlFor={`reason-${value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Textarea
                placeholder="Additional details (optional)"
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                className="h-16 text-sm resize-none"
                maxLength={500}
              />
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                disabled={!selectedReason || isSubmitting}
                onClick={handleDownvoteSubmit}
              >
                Submit
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
