"use client"

import {
	AlertTriangle,
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
		label: "Under Review",
		description:
			"An organizer is currently reviewing your video submission and verifying your score.",
		icon: Eye,
		className:
			"bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800",
		iconClassName: "text-blue-500 dark:text-blue-400",
	},
	verified: {
		label: "Verified",
		description:
			"Your score has been reviewed and confirmed as correct. No changes were made.",
		icon: CheckCircle2,
		className:
			"bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800",
		iconClassName: "text-green-500 dark:text-green-400",
	},
	adjusted: {
		label: "Score Adjusted",
		description:
			"Your score was modified during review. The official score may differ from your claimed score.",
		icon: Edit3,
		className:
			"bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-800",
		iconClassName: "text-amber-500 dark:text-amber-400",
	},
	penalized: {
		label: "Penalized",
		description:
			"Penalties were applied to your submission. This may affect your final score or ranking.",
		icon: AlertTriangle,
		className:
			"bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800",
		iconClassName: "text-red-500 dark:text-red-400",
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

function formatStatusDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date)
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
		return badge
	}

	return (
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
					{reviewerNotes && (
						<p className="text-xs italic border-t pt-2 mt-2">
							Reviewer note: {reviewerNotes}
						</p>
					)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
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
]
