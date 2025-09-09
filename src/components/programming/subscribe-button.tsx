"use client"

import React, { useState } from "react"
import { useServerAction } from "zsa-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useSessionStore } from "@/state/session"
import {
	subscribeToTrackAction,
	unsubscribeFromTrackAction,
} from "@/actions/programming-actions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"

interface SubscribeButtonProps {
	trackId: string
	isSubscribed?: boolean
	onSubscriptionChange?: (subscribed: boolean) => void
}

export function SubscribeButton({
	trackId,
	isSubscribed = false,
	onSubscriptionChange,
}: SubscribeButtonProps) {
	const session = useSessionStore((state) => state.session)
	const hasTeamPermission = useSessionStore((state) => state.hasTeamPermission)

	// Get the current team from session or URL params
	const currentTeam = session?.teams?.[0] // Simplified for now
	const teamId = currentTeam?.id

	const canManageProgramming =
		teamId && hasTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const { execute: subscribe, isPending: isSubscribing } = useServerAction(
		subscribeToTrackAction,
		{
			onSuccess: () => {
				console.info(
					`INFO: Track subscription UI action initiated for track: ${trackId} by team: ${teamId}`,
				)
				toast.success("Successfully subscribed to programming track")
				onSubscriptionChange?.(true)
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to subscribe to track")
			},
		},
	)

	const { execute: unsubscribe, isPending: isUnsubscribing } = useServerAction(
		unsubscribeFromTrackAction,
		{
			onSuccess: () => {
				toast.success("Successfully unsubscribed from programming track")
				onSubscriptionChange?.(false)
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to unsubscribe from track")
			},
		},
	)

	const handleClick = async () => {
		if (!teamId) {
			toast.error("No team selected")
			return
		}

		if (!canManageProgramming) {
			toast.error(
				"You don't have permission to manage programming for this team",
			)
			return
		}

		if (isSubscribed) {
			await unsubscribe({ teamId, trackId })
		} else {
			await subscribe({ teamId, trackId })
		}
	}

	const isLoading = isSubscribing || isUnsubscribing
	const disabled = !canManageProgramming || isLoading

	return (
		<Button
			size="sm"
			onClick={handleClick}
			disabled={disabled}
			variant={isSubscribed ? "outline" : "default"}
		>
			{isLoading
				? isSubscribed
					? "Unsubscribing..."
					: "Subscribing..."
				: isSubscribed
					? "Unsubscribe"
					: "Subscribe"}
		</Button>
	)
}
