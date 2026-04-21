"use client"

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import { cn } from "@/lib/utils"

/**
 * Configuration for each review status including label, description, icon, and styling.
 */
interface StatusConfig {
  label: string
  description: string
  icon: LucideIcon
  className: string
  iconClassName: string
}

// Palette is organized as a progression rather than six unrelated hues.
// Positive path (under_review → verified) shares the emerald family with
// increasing lightness so "Reviewed" reads as "close to verified" at a glance.
// Slate (pending) and zinc (invalid) are intentionally different neutrals so
// a waiting cell and a rejected cell don't collide when sitting side-by-side.
const statusConfig: Record<ReviewStatus, StatusConfig> = {
  pending: {
    label: "Pending Review",
    description:
      "Your submission has been received and is awaiting review by an organizer.",
    icon: Clock,
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconClassName: "text-slate-500 dark:text-slate-400",
  },
  under_review: {
    label: "Reviewed",
    description: "An organizer has marked this submission as reviewed.",
    icon: Eye,
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    iconClassName: "text-emerald-500 dark:text-emerald-400",
  },
  verified: {
    label: "Verified",
    description:
      "Your score has been reviewed and confirmed as correct. No changes were made.",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800",
    iconClassName: "text-emerald-600 dark:text-emerald-300",
  },
  adjusted: {
    label: "Score Adjusted",
    description:
      "Your score was modified during review. The official score may differ from your claimed score.",
    icon: Edit3,
    className:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  penalized: {
    label: "Penalized",
    description:
      "Penalties were applied to your submission. This may affect your final score or ranking.",
    icon: AlertTriangle,
    className:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  invalid: {
    label: "Invalid",
    description:
      "This submission has been marked as invalid. The workout score has been zeroed, but other competition scores are unaffected.",
    icon: Ban,
    className:
      "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
    iconClassName: "text-zinc-500 dark:text-zinc-400",
  },
}

interface SubmissionStatusBadgeProps {
  status: ReviewStatus
  /** Optional timestamp for when the status was last updated */
  statusUpdatedAt?: Date | null
  /** Optional notes from the reviewer */
  reviewerNotes?: string | null
  /** Whether to show the tooltip (default: true) */
  showTooltip?: boolean
  /** Additional className for the badge */
  className?: string
  /** Size variant */
  size?: "sm" | "default"
}

function formatStatusDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d)
}

export function SubmissionStatusBadge({
  status,
  statusUpdatedAt,
  reviewerNotes,
  showTooltip = true,
  className,
  size = "default",
}: SubmissionStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        config.className,
        size === "sm" && "px-2 py-0.5 text-[10px]",
        className,
      )}
    >
      <Icon
        className={cn(
          config.iconClassName,
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
      />
      {config.label}
    </Badge>
  )

  if (!showTooltip) {
    return (
      <div className="space-y-1.5">
        {badge}
        {reviewerNotes && (
          <p className="text-xs italic text-muted-foreground">
            Organizer note: {reviewerNotes}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-2">
            <p>{config.description}</p>
            {statusUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Updated: {formatStatusDate(statusUpdatedAt)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {reviewerNotes && (
        <p className="text-xs italic text-muted-foreground">
          Organizer note: {reviewerNotes}
        </p>
      )}
    </div>
  )
}

/**
 * Returns the status configuration for a given status.
 * Useful for displaying status info in other contexts.
 */
export function getStatusConfig(status: ReviewStatus): StatusConfig {
  return statusConfig[status]
}

/**
 * All available review statuses in order of workflow progression.
 */
export const reviewStatusOrder: ReviewStatus[] = [
  "pending",
  "under_review",
  "verified",
  "adjusted",
  "penalized",
  "invalid",
]
