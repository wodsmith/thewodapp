"use client"

import { Check } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
	subscribeToTrackAction,
	unsubscribeFromTrackAction,
} from "~/actions/programming-actions"
import { Button } from "~/components/ui/button"
import { TEAM_PERMISSIONS } from "~/db/schemas/teams"
import { useSessionStore } from "~/state/session"

interface EnhancedSubscribeButtonProps {
	trackId: string
	teamId: string
	isSubscribed: boolean
	hasManagePermission?: boolean
}

export function EnhancedSubscribeButton({
	trackId,
	teamId,
	isSubscribed: initialIsSubscribed,
	hasManagePermission,
}: EnhancedSubscribeButtonProps) {
	const hasTeamPermission = useSessionStore((state) => state.hasTeamPermission)
	const hasPermission =
		hasManagePermission ??
		hasTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Local state for optimistic updates
	const [isSubscribed, setIsSubscribed] = useState(initialIsSubscribed)
	const [isPending, startTransition] = useTransition()

	const handleToggle = () => {
		if (!hasPermission) {
			toast.error(
				"You don't have permission to manage programming for this team",
			)
			return
		}

		startTransition(async () => {
			try {
				// Optimistic update
				const prevSubscribed = isSubscribed
				setIsSubscribed(!isSubscribed)

				if (prevSubscribed) {
					const result = await unsubscribeFromTrackAction({ teamId, trackId })
					if (result instanceof Error || !result) {
						toast.error("Failed to unsubscribe from track")
						// Revert optimistic update
						setIsSubscribed(prevSubscribed)
						return
					}
					toast.success("Successfully unsubscribed from programming track")
				} else {
					const result = await subscribeToTrackAction({ teamId, trackId })
					if (result instanceof Error || !result) {
						toast.error("Failed to subscribe to track")
						// Revert optimistic update
						setIsSubscribed(prevSubscribed)
						return
					}
					toast.success("Successfully subscribed to programming track")
				}
			} catch (error) {
				toast.error("Failed to update subscription")
				console.error("Toggle error:", error)
				// Revert optimistic update
				setIsSubscribed(initialIsSubscribed)
			}
		})
	}

	const isLoading = isPending

	// If subscribed, show secondary button
	if (isSubscribed) {
		return (
			<Button
				size="sm"
				onClick={handleToggle}
				disabled={!hasPermission || isLoading}
				variant="secondary"
			>
				{isLoading ? (
					"Processing..."
				) : (
					<>
						<Check className="h-3 w-3 mr-1" />
						Subscribed
					</>
				)}
			</Button>
		)
	}

	// Not subscribed - check permission
	if (!hasPermission) {
		return (
			<Button size="sm" disabled variant="outline">
				No permission
			</Button>
		)
	}

	// Has permission and not subscribed
	return (
		<Button
			size="sm"
			onClick={handleToggle}
			disabled={isLoading}
			variant="default"
		>
			{isLoading ? "Processing..." : "Subscribe"}
		</Button>
	)
}
