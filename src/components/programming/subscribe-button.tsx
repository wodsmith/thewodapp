"use client"

import React, { useState, useEffect } from "react"
import { useServerAction } from "zsa-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useSessionStore } from "@/state/session"
import {
	subscribeToTrackAction,
	unsubscribeFromTrackAction,
} from "@/actions/programming-actions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { TeamProgrammingSelector } from "./team-programming-selector"

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

	// Filter teams where user has MANAGE_PROGRAMMING permission
	const eligibleTeams =
		session?.teams?.filter((team) =>
			hasTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
		) || []

	// State for selected team
	const [selectedTeamId, setSelectedTeamId] = useState<string>("")

	// Auto-select first eligible team if only one or none selected
	useEffect(() => {
		if (eligibleTeams.length > 0 && !selectedTeamId) {
			setSelectedTeamId(eligibleTeams[0].id)
		}
	}, [eligibleTeams, selectedTeamId])

	const canManageProgramming =
		selectedTeamId &&
		hasTeamPermission(selectedTeamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const { execute: subscribe, isPending: isSubscribing } = useServerAction(
		subscribeToTrackAction,
		{
			onSuccess: () => {
				console.info(
					`INFO: Track subscription UI action initiated for track: ${trackId} by team: ${selectedTeamId}`,
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
		if (!selectedTeamId) {
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
			await unsubscribe({ teamId: selectedTeamId, trackId })
		} else {
			await subscribe({ teamId: selectedTeamId, trackId })
		}
	}

	const isLoading = isSubscribing || isUnsubscribing
	const disabled = !canManageProgramming || isLoading || !selectedTeamId

	// If no eligible teams, show message
	if (eligibleTeams.length === 0) {
		return (
			<Button size="sm" disabled variant="outline">
				No teams with programming access
			</Button>
		)
	}

	return (
		<div className="flex items-center gap-2">
			<TeamProgrammingSelector
				selectedTeamId={selectedTeamId}
				onTeamSelect={setSelectedTeamId}
				disabled={isLoading}
			/>
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
		</div>
	)
}
