"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useServerAction } from "zsa-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useSessionStore } from "@/state/session"
import { useTeamContext } from "@/state/team-context"
import {
	subscribeToTrackAction,
	unsubscribeFromTrackAction,
} from "@/actions/programming-actions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { Building2, Check, ChevronDown } from "lucide-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Team {
	id: string
	name: string
}

interface EnhancedSubscribeButtonProps {
	trackId: string
	userTeams: Team[]
	subscribedTeamIds: Set<string>
}

export function EnhancedSubscribeButton({
	trackId,
	userTeams,
	subscribedTeamIds,
}: EnhancedSubscribeButtonProps) {
	const hasTeamPermission = useSessionStore((state) => state.hasTeamPermission)
	const { currentTeamId } = useTeamContext()

	// Filter teams where user has MANAGE_PROGRAMMING permission
	const eligibleTeams = useMemo(
		() =>
			userTeams.filter((team) =>
				hasTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
			),
		[userTeams, hasTeamPermission],
	)

	// If there's a current team filter, only work with that team
	const teamsToWorkWith = useMemo(() => {
		if (currentTeamId) {
			return eligibleTeams.filter((team) => team.id === currentTeamId)
		}
		return eligibleTeams
	}, [currentTeamId, eligibleTeams])

	// Local state to track subscriptions (optimistic updates)
	const [localSubscriptions, setLocalSubscriptions] =
		useState<Set<string>>(subscribedTeamIds)

	// Update local subscriptions when props change
	useEffect(() => {
		setLocalSubscriptions(subscribedTeamIds)
	}, [subscribedTeamIds])

	const { execute: subscribe, isPending: isSubscribing } = useServerAction(
		subscribeToTrackAction,
		{
			onSuccess: () => {
				toast.success("Successfully subscribed to programming track")
				// Subscription state will be updated through props
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
				// Subscription state will be updated through props
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to unsubscribe from track")
			},
		},
	)

	const handleSubscribe = async (teamId: string) => {
		if (localSubscriptions.has(teamId)) {
			// Optimistic update
			setLocalSubscriptions((prev) => {
				const next = new Set(prev)
				next.delete(teamId)
				return next
			})
			await unsubscribe({ teamId, trackId })
		} else {
			// Optimistic update
			setLocalSubscriptions((prev) => new Set([...prev, teamId]))
			await subscribe({ teamId, trackId })
		}
	}

	const isLoading = isSubscribing || isUnsubscribing

	// If no eligible teams, show message
	if (teamsToWorkWith.length === 0) {
		return (
			<Button size="sm" disabled variant="outline">
				{currentTeamId ? "No permission for this team" : "No teams with access"}
			</Button>
		)
	}

	// When filtered to a specific team OR only one eligible team - simple button
	if (currentTeamId || teamsToWorkWith.length === 1) {
		const team = teamsToWorkWith[0]
		const isSubscribed = localSubscriptions.has(team.id)

		return (
			<Button
				size="sm"
				onClick={() => handleSubscribe(team.id)}
				disabled={isLoading}
				variant={isSubscribed ? "secondary" : "default"}
			>
				{isLoading ? (
					"Loading..."
				) : isSubscribed ? (
					<>
						<Check className="h-3 w-3 mr-1" />
						Subscribed
					</>
				) : (
					"Subscribe"
				)}
			</Button>
		)
	}

	// Multiple teams and no filter - show dropdown
	const allSubscribed = teamsToWorkWith.every((t) =>
		localSubscriptions.has(t.id),
	)
	const someSubscribed = teamsToWorkWith.some((t) =>
		localSubscriptions.has(t.id),
	)

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant={
						allSubscribed ? "secondary" : someSubscribed ? "outline" : "default"
					}
					disabled={isLoading}
				>
					{allSubscribed ? (
						<>
							<Check className="h-3 w-3 mr-1" />
							All Subscribed
						</>
					) : someSubscribed ? (
						<>Partial Subscription</>
					) : (
						<>Subscribe</>
					)}
					<ChevronDown className="h-3 w-3 ml-1" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[250px]">
				<DropdownMenuLabel>Manage Subscriptions</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{teamsToWorkWith.map((team) => {
					const isSubscribed = localSubscriptions.has(team.id)
					return (
						<DropdownMenuItem
							key={team.id}
							onSelect={() => handleSubscribe(team.id)}
							className="flex items-center justify-between cursor-pointer"
						>
							<div className="flex items-center gap-2">
								<Building2 className="h-3 w-3" />
								<span className="text-sm">{team.name}</span>
							</div>
							{isSubscribed ? (
								<Badge variant="secondary" className="text-xs">
									<Check className="h-3 w-3 mr-1" />
									Subscribed
								</Badge>
							) : (
								<Badge variant="outline" className="text-xs">
									Subscribe
								</Badge>
							)}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
