"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, Video } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  VideoUrlInput,
  type VideoUrlValidationState,
} from "@/components/ui/video-url-input"
import { parseVideoUrl } from "@/schemas/video-url"
import { updateSubmissionVideoUrlFn } from "@/server-fns/video-submission-fns"
import { isSafeUrl } from "@/utils/url"

interface OrganizerVideoLinksEditorSubmission {
  id: string
  videoIndex: number
  videoUrl: string
}

interface OrganizerVideoLinksEditorProps {
  submissions: OrganizerVideoLinksEditorSubmission[]
  competitionId: string
  /** Number of partner slots for this division — drives how many inputs render */
  teamSize: number
  /** Registration id used to create new rows for unfilled slots */
  registrationId: string | null
  /** Track workout id used to create new rows for unfilled slots */
  trackWorkoutId: string | null
  /**
   * Optional render-prop for per-slot trailing actions (e.g. a Delete button
   * that only makes sense once a submission exists). Returned node renders
   * next to the slot's Save button. Non-breaking when omitted.
   */
  renderSlotActions?: (slot: {
    submissionId: string | null
    videoIndex: number
  }) => React.ReactNode
  /**
   * Compact mode drops the outer Card + header and tightens the per-slot
   * layout (label/badges inline, actions on the right of the input row, no
   * standalone "open current link" affordance). For embedding inside another
   * card surface like the athlete detail page. Default: false.
   */
  compact?: boolean
}

interface SlotState {
  /** Existing submission id when the slot already has one */
  submissionId: string | null
  /** Original URL at render time — used to compute dirty state */
  originalUrl: string
  url: string
  validation: VideoUrlValidationState
  isSaving: boolean
  error: string | null
}

function roleLabel(index: number, teamSize: number): string {
  if (teamSize <= 1) return "Video URL"
  return index === 0 ? "Captain" : `Teammate ${index}`
}

function makeSlot(
  submission: OrganizerVideoLinksEditorSubmission | undefined,
): SlotState {
  const url = submission?.videoUrl ?? ""
  return {
    submissionId: submission?.id ?? null,
    originalUrl: url,
    url,
    validation: {
      isValid: !!url,
      isPending: false,
      error: null,
      parsedUrl: url ? parseVideoUrl(url) : null,
    },
    isSaving: false,
    error: null,
  }
}

/**
 * Sidebar editor on the review detail pages that lets an organizer or volunteer
 * update (or fill in) an athlete's submitted video URL for each partner slot.
 * Mirrors the Partner 1 / Partner 2 layout from `video-submission-form.tsx` so
 * the editing model matches the submission model — renders `teamSize` slots,
 * including blanks for indexes the captain never filled in.
 */
export function OrganizerVideoLinksEditor({
  submissions,
  competitionId,
  teamSize,
  registrationId,
  trackWorkoutId,
  renderSlotActions,
  compact = false,
}: OrganizerVideoLinksEditorProps) {
  const router = useRouter()
  const updateFn = useServerFn(updateSubmissionVideoUrlFn)

  // Team size defaults to 1; index existing submissions by videoIndex so
  // unfilled slots render as blank inputs rather than going missing entirely.
  const slotCount = Math.max(teamSize, submissions.length || 1, 1)
  const byIndex = new Map(submissions.map((s) => [s.videoIndex, s]))
  const initialSlots = Array.from({ length: slotCount }, (_, i) =>
    makeSlot(byIndex.get(i)),
  )

  const [slots, setSlots] = useState<SlotState[]>(initialSlots)

  const setSlot = (index: number, patch: Partial<SlotState>) =>
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    )

  const handleSave = async (index: number) => {
    const slot = slots[index]
    if (!slot) return
    const trimmed = slot.url.trim()
    if (!trimmed) {
      setSlot(index, { error: "Video URL is required" })
      return
    }
    if (!slot.validation.isValid) {
      setSlot(index, {
        error: slot.validation.error ?? "Please enter a valid video URL",
      })
      return
    }
    let payload:
      | {
          competitionId: string
          videoUrl: string
          submissionId: string
        }
      | {
          competitionId: string
          videoUrl: string
          registrationId: string
          trackWorkoutId: string
          videoIndex: number
        }
    if (slot.submissionId) {
      payload = {
        competitionId,
        videoUrl: trimmed,
        submissionId: slot.submissionId,
      }
    } else if (registrationId && trackWorkoutId) {
      payload = {
        competitionId,
        videoUrl: trimmed,
        registrationId,
        trackWorkoutId,
        videoIndex: index,
      }
    } else {
      setSlot(index, {
        error: "Missing registration context — refresh and try again",
      })
      return
    }

    setSlot(index, { isSaving: true, error: null })
    try {
      const result = await updateFn({ data: payload })
      setSlot(index, {
        originalUrl: trimmed,
        submissionId: result.submissionId ?? slot.submissionId,
      })
      await router.invalidate()
    } catch (err) {
      setSlot(index, {
        error: err instanceof Error ? err.message : "Failed to save",
      })
    } finally {
      setSlot(index, { isSaving: false })
    }
  }

  const slotsBody = (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      {slots.map((slot, index) => {
        const isDirty = slot.url !== slot.originalUrl
        const isMissing = !slot.submissionId
        return (
          <div
            key={`${slot.submissionId ?? "new"}-${index}`}
            className={compact ? "space-y-1.5" : "space-y-2"}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`video-url-${index}`}
                  className={
                    compact
                      ? "text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      : "text-sm font-medium"
                  }
                >
                  {roleLabel(index, teamSize)}
                </Label>
                {isMissing && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500 text-amber-600 dark:text-amber-400 px-1.5 py-0 h-4"
                  >
                    Not submitted
                  </Badge>
                )}
                {!compact && teamSize > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    Video {index + 1}
                  </Badge>
                )}
              </div>
              {compact && slot.originalUrl && isSafeUrl(slot.originalUrl) && (
                <a
                  href={slot.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  title="Open current link in a new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
              )}
            </div>
            <div
              className={
                compact
                  ? "flex flex-col sm:flex-row sm:items-start gap-2"
                  : undefined
              }
            >
              <div className={compact ? "flex-1 min-w-0" : undefined}>
                <VideoUrlInput
                  id={`video-url-${index}`}
                  value={slot.url}
                  onChange={(url) => setSlot(index, { url, error: null })}
                  onValidationChange={(validation) =>
                    setSlot(index, { validation })
                  }
                  required
                  disabled={slot.isSaving}
                  showPlatformBadge={!compact}
                  showPreviewLink={!compact}
                />
              </div>
              {compact && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={slot.isSaving || !isDirty || !slot.url.trim()}
                    onClick={() => handleSave(index)}
                    className="h-9"
                  >
                    {slot.isSaving ? "Saving..." : isMissing ? "Add" : "Save"}
                  </Button>
                  {renderSlotActions?.({
                    submissionId: slot.submissionId,
                    videoIndex: index,
                  })}
                </div>
              )}
            </div>
            {!compact && slot.originalUrl && isSafeUrl(slot.originalUrl) && (
              <a
                href={slot.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Open current link
              </a>
            )}
            {slot.error && (
              <p className="text-xs text-destructive">{slot.error}</p>
            )}
            {!compact && (
              <div className="flex items-center justify-end gap-1.5">
                {renderSlotActions?.({
                  submissionId: slot.submissionId,
                  videoIndex: index,
                })}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={slot.isSaving || !isDirty || !slot.url.trim()}
                  onClick={() => handleSave(index)}
                >
                  {slot.isSaving
                    ? "Saving..."
                    : isMissing
                      ? "Add link"
                      : "Save"}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  if (compact) {
    return slotsBody
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-4 w-4" />
          Video Links
        </CardTitle>
        <CardDescription>
          {teamSize > 1
            ? "Update or add a link for each partner on the athlete's behalf"
            : "Update a broken or incorrect link on the athlete's behalf"}
        </CardDescription>
      </CardHeader>
      <CardContent>{slotsBody}</CardContent>
    </Card>
  )
}
