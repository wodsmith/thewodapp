"use client"

import { useState } from "react"
import { useServerAction } from "zsa-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Team {
	id: string
	name: string
}

interface SubscribeButtonProps {
	trackId: string
	isSubscribed?: boolean
	userTeams?: Team[]
	className?: string
	subscribeAction: (input: { trackId: string; teamId?: string }) => Promise<any>
	unsubscribeAction: (input: {
		trackId: string
		teamId?: string
	}) => Promise<any>
}

export function SubscribeButton({
	trackId,
	isSubscribed = false,
	userTeams = [],
	className,
	subscribeAction,
	unsubscribeAction,
}: SubscribeButtonProps) {
	const { execute: subscribe, isPending: isSubscribing } = useServerAction(
		subscribeAction,
		{
			onSuccess: () => {
				toast.success("Successfully subscribed to track")
			},
			onError: ({ err }) => {
				toast.error(err.message)
			},
		},
	)

	const { execute: unsubscribe, isPending: isUnsubscribing } = useServerAction(
		unsubscribeAction,
		{
			onSuccess: () => {
				toast.success("Successfully unsubscribed from track")
			},
			onError: ({ err }) => {
				toast.error(err.message)
			},
		},
	)

	const handleSubscribe = async (teamId?: string) => {
		console.log("UI: subscribe clicked track", trackId)
		await subscribe({ trackId, teamId })
	}

	const handleUnsubscribe = async (teamId?: string) => {
		console.log("UI: unsubscribe clicked track", trackId)
		await unsubscribe({ trackId, teamId })
	}

	const handleClick = async () => {
		if (isSubscribed) {
			// For unsubscribe, use personal team by default
			await handleUnsubscribe()
			return
		}

		// If only one team (personal), subscribe directly
		if (userTeams.length <= 1) {
			await handleSubscribe(userTeams[0]?.id)
			return
		}

		// If multiple teams, the dropdown will handle the selection
	}

	const isPending = isSubscribing || isUnsubscribing

	if (isSubscribed) {
		return (
			<Button
				onClick={handleClick}
				disabled={isPending}
				variant="outline"
				className={className}
			>
				{isPending ? "Unsubscribing..." : "Subscribed"}
			</Button>
		)
	}

	// If we have multiple teams, show dropdown
	if (userTeams.length > 1) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button disabled={isPending} className={className}>
						{isPending ? "Subscribing..." : "Subscribe"}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{userTeams.map((team) => (
						<DropdownMenuItem
							key={team.id}
							onClick={() => handleSubscribe(team.id)}
						>
							Subscribe with {team.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		)
	}

	// Default subscribe button
	return (
		<Button onClick={handleClick} disabled={isPending} className={className}>
			{isPending ? "Subscribing..." : "Subscribe"}
		</Button>
	)
}
