import "server-only"

import { ClockIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface PendingOrganizerBannerProps {
	variant: "page-container" | "sidebar-inset"
}

export function PendingOrganizerBanner({ variant }: PendingOrganizerBannerProps) {
	return (
		<div className="border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
			<div
				className={cn(
					"flex items-center gap-3 py-3",
					variant === "page-container" && "container mx-auto px-4",
					variant === "sidebar-inset" && "px-6",
				)}
			>
				<ClockIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
				<p className="text-sm text-amber-800 dark:text-amber-200">
					<strong>Application pending:</strong> You can create draft competitions
					while your application is being reviewed. Drafts won't be visible until
					published after approval.
				</p>
			</div>
		</div>
	)
}


