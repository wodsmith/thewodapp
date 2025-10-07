"use client"

import { Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	subscribeToTrackAction,
	unsubscribeFromTrackAction,
} from "@/actions/programming-actions"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { useSessionStore } from "@/state/session"

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

	const { execute: subscribe, isPending: isSubscribing } = useServerAction(
		subscribeToTrackAction,
		{
			onSuccess: () => {
				toast.success("Successfully subscribed to programming track")
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to subscribe to track")
				// Revert optimistic update
				setIsSubscribed(!isSubscribed)
			},
		},
	)

	const { execute: unsubscribe, isPending: isUnsubscribing } = useServerAction(
		unsubscribeFromTrackAction,
		{
			onSuccess: () => {
				toast.success("Successfully unsubscribed from programming track")
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to unsubscribe from track")
				// Revert optimistic update
				setIsSubscribed(!isSubscribed)
			},
		},
	)

	const handleToggle = async () => {
		if (!hasPermission) {
			toast.error(
				"You don't have permission to manage programming for this team",
			)
			return
		}

		// Optimistic update
		setIsSubscribed(!isSubscribed)

		if (isSubscribed) {
			await unsubscribe({ teamId, trackId })
		} else {
			await subscribe({ teamId, trackId })
		}
	}

	const isLoading = isSubscribing || isUnsubscribing

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
