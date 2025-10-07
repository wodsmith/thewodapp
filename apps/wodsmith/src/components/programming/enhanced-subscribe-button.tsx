"use client"

import { useState, useEffect, useMemo } from "react"
import { useServerAction } from "@repo/zsa-react"
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
	const [localSubscriptions, setLocalSubscriptions] = useState<Set<string>>(
		new Set([...subscribedTeamIds]),
	)

	// Track per-team in-flight operations for safe concurrent handling
	const [processingTeamIds, setProcessingTeamIds] = useState<Set<string>>(
		new Set(),
	)

	// Update local subscriptions when props change
	useEffect(() => {
		setLocalSubscriptions(new Set([...subscribedTeamIds]))
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
		// Prevent concurrent operations on the same team
		if (processingTeamIds.has(teamId)) {
			return
		}

		// Mark team as processing
		setProcessingTeamIds((prev) => new Set([...prev, teamId]))

		try {
			if (localSubscriptions.has(teamId)) {
				// Optimistic update for unsubscribe
				setLocalSubscriptions((prev) => {
					const next = new Set([...prev])
					next.delete(teamId)
					return next
				})
				await unsubscribe({ teamId, trackId })
			} else {
				// Optimistic update for subscribe
				setLocalSubscriptions((prev) => new Set([...prev, teamId]))
				await subscribe({ teamId, trackId })
			}
		} catch (_error) {
			// Revert optimistic update on error
			setLocalSubscriptions(new Set([...subscribedTeamIds]))
		} finally {
			// Remove team from processing
			setProcessingTeamIds((prev) => {
				const next = new Set([...prev])
				next.delete(teamId)
				return next
			})
		}
	}

	const isLoading = isSubscribing || isUnsubscribing

	// Helper function to check if a specific team is processing
	const isTeamProcessing = (teamId: string) => processingTeamIds.has(teamId)

	// When filtered to a specific team, check if that team is already subscribed
	if (currentTeamId) {
		const isSubscribed = localSubscriptions.has(currentTeamId)
		const hasPermission = teamsToWorkWith.length > 0

		// If already subscribed, show subscribed state regardless of permission
		if (isSubscribed) {
			const isCurrentTeamProcessing = isTeamProcessing(currentTeamId)
			return (
				<Button
					size="sm"
					onClick={() =>
						hasPermission && !isCurrentTeamProcessing
							? handleSubscribe(currentTeamId)
							: undefined
					}
					disabled={!hasPermission || isLoading || isCurrentTeamProcessing}
					variant="secondary"
				>
					<Check className="h-3 w-3 mr-1" />
					{isCurrentTeamProcessing ? "Processing..." : "Subscribed"}
				</Button>
			)
		}

		// Not subscribed - check permission
		if (!hasPermission) {
			return (
				<Button size="sm" disabled variant="outline">
					No permission for this team
				</Button>
			)
		}

		// Has permission and not subscribed
		const isCurrentTeamProcessing = isTeamProcessing(currentTeamId)
		return (
			<Button
				size="sm"
				onClick={() =>
					!isCurrentTeamProcessing ? handleSubscribe(currentTeamId) : undefined
				}
				disabled={isLoading || isCurrentTeamProcessing}
				variant="default"
			>
				{isCurrentTeamProcessing
					? "Processing..."
					: isLoading
						? "Loading..."
						: "Subscribe"}
			</Button>
		)
	}

	// No team filter - check subscription status for all user teams
	// Check subscription status across ALL teams, not just eligible ones
	const allTeamsSubscribed = userTeams.every((t) =>
		localSubscriptions.has(t.id),
	)
	const someTeamsSubscribed = userTeams.some((t) =>
		localSubscriptions.has(t.id),
	)

	// If no teams have permission to manage subscriptions
	if (teamsToWorkWith.length === 0) {
		// But some teams are subscribed, show read-only subscription status
		if (allTeamsSubscribed) {
			return (
				<Button size="sm" disabled variant="secondary">
					<Check className="h-3 w-3 mr-1" />
					Subscribed
				</Button>
			)
		}
		if (someTeamsSubscribed) {
			return (
				<Button size="sm" disabled variant="secondary">
					<Check className="h-3 w-3 mr-1" />
					Partial Subscription
				</Button>
			)
		}
		// No teams are subscribed and no teams have permission
		return (
			<Button size="sm" disabled variant="outline">
				No teams with access
			</Button>
		)
	}

	// Single eligible team (no filter active)
	if (teamsToWorkWith.length === 1) {
		const team = teamsToWorkWith[0]
		if (!team) return null
		const isSubscribed = localSubscriptions.has(team.id)
		const isCurrentTeamProcessing = isTeamProcessing(team.id)

		return (
			<Button
				size="sm"
				onClick={() =>
					!isCurrentTeamProcessing ? handleSubscribe(team.id) : undefined
				}
				disabled={isLoading || isCurrentTeamProcessing}
				variant={isSubscribed ? "secondary" : "default"}
			>
				{isCurrentTeamProcessing ? (
					"Processing..."
				) : isLoading ? (
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
	const anyTeamProcessing = teamsToWorkWith.some((t) => isTeamProcessing(t.id))

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant={
						allSubscribed ? "secondary" : someSubscribed ? "outline" : "default"
					}
					disabled={isLoading || anyTeamProcessing}
				>
					{anyTeamProcessing ? (
						"Processing..."
					) : allSubscribed ? (
						<>
							<Check className="h-3 w-3 mr-1" />
							All Subscribed
						</>
					) : someSubscribed ? (
						"Partial Subscription"
					) : (
						"Subscribe"
					)}
					<ChevronDown className="h-3 w-3 ml-1" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[250px]">
				<DropdownMenuLabel>Manage Subscriptions</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{teamsToWorkWith.map((team) => {
					const isSubscribed = localSubscriptions.has(team.id)
					const isCurrentTeamProcessing = isTeamProcessing(team.id)
					return (
						<DropdownMenuItem
							key={team.id}
							onSelect={() =>
								!isCurrentTeamProcessing ? handleSubscribe(team.id) : undefined
							}
							className="flex items-center justify-between cursor-pointer"
							disabled={isCurrentTeamProcessing}
						>
							<div className="flex items-center gap-2">
								<Building2 className="h-3 w-3" />
								<span className="text-sm">{team.name}</span>
							</div>
							{isCurrentTeamProcessing ? (
								<Badge variant="outline" className="text-xs">
									Processing...
								</Badge>
							) : isSubscribed ? (
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
