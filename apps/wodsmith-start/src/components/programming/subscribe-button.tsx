"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import {
	subscribeToTrackAction,
	unsubscribeFromTrackAction,
} from "@/actions/programming-actions"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { useSessionStore } from "@/state/session"
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
	const eligibleTeams = useMemo(
		() =>
			session?.teams?.filter((team) =>
				hasTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
			) || [],
		[session?.teams, hasTeamPermission],
	)

	// State for selected team
	const [selectedTeamId, setSelectedTeamId] = useState<string>("")

	// Auto-select first eligible team if only one or none selected
	useEffect(() => {
		if (eligibleTeams.length === 0) {
			setSelectedTeamId("")
		} else if (
			!selectedTeamId ||
			!eligibleTeams.some((team) => team.id === selectedTeamId)
		) {
			const firstTeam = eligibleTeams[0]
			if (firstTeam) {
				setSelectedTeamId(firstTeam.id)
			}
		}
		// Otherwise do nothing - selectedTeamId is valid
	}, [eligibleTeams, selectedTeamId])

	const canManageProgramming =
		selectedTeamId &&
		hasTeamPermission(selectedTeamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	const [isPending, startTransition] = useTransition()

	const handleClick = () => {
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

		startTransition(async () => {
			try {
				if (isSubscribed) {
					const result = await unsubscribeFromTrackAction({
						teamId: selectedTeamId,
						trackId,
					})
					if (result instanceof Error || !result) {
						toast.error("Failed to unsubscribe from track")
						return
					}
					toast.success("Successfully unsubscribed from programming track")
					onSubscriptionChange?.(false)
				} else {
					const result = await subscribeToTrackAction({
						teamId: selectedTeamId,
						trackId,
					})
					if (result instanceof Error || !result) {
						toast.error("Failed to subscribe to track")
						return
					}
					console.info(
						`INFO: Track subscription UI action initiated for track: ${trackId} by team: ${selectedTeamId}`,
					)
					toast.success("Successfully subscribed to programming track")
					onSubscriptionChange?.(true)
				}
			} catch (error) {
				toast.error("Failed to update subscription")
				console.error("Subscription error:", error)
			}
		})
	}

	const isLoading = isPending
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
