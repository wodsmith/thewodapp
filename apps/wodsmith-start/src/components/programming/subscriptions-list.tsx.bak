"use client"

import posthog from "posthog-js"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	setDefaultTrackAction,
	unsubscribeFromTrackAction,
} from "@/actions/programming-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { useSessionStore } from "@/state/session"

interface Subscription {
	id: string
	name: string
	description: string | null
	type: string
	ownerTeam: {
		id: string
		name: string
	} | null
	subscribedAt: Date
}

interface SubscriptionsListProps {
	subscriptions: Subscription[]
	teamId: string
}

export function SubscriptionsList({
	subscriptions,
	teamId,
}: SubscriptionsListProps) {
	const hasTeamPermission = useSessionStore((state) => state.hasTeamPermission)
	const canManageProgramming = hasTeamPermission(
		teamId,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	const { execute: setDefaultTrack, isPending: isSettingDefault } =
		useServerAction(setDefaultTrackAction, {
			onSuccess: () => {
				console.info(`INFO: Default track updated for team ${teamId}`)
				toast.success("Successfully set as default track")
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to set default track")
			},
		})

	// Track which subscription is being unsubscribed (for PostHog tracking)
	const [unsubscribingTrack, setUnsubscribingTrack] = useState<{
		id: string
		name: string
	} | null>(null)

	const { execute: unsubscribe, isPending: isUnsubscribing } = useServerAction(
		unsubscribeFromTrackAction,
		{
			onSuccess: () => {
				toast.success("Successfully unsubscribed from track")
				if (unsubscribingTrack) {
					posthog.capture("track_subscription_changed", {
						action: "unsubscribed",
						team_id: teamId,
						track_id: unsubscribingTrack.id,
						track_name: unsubscribingTrack.name,
					})
				}
				// Optionally trigger a page refresh or update the list
				window.location.reload()
			},
			onError: (error) => {
				toast.error(error.err.message || "Failed to unsubscribe from track")
				setUnsubscribingTrack(null)
			},
		},
	)

	const handleSetDefault = async (trackId: string) => {
		if (!canManageProgramming) {
			toast.error(
				"You don't have permission to manage programming for this team",
			)
			return
		}

		await setDefaultTrack({ teamId, trackId })
	}

	const handleUnsubscribe = async (trackId: string, trackName: string) => {
		if (!canManageProgramming) {
			toast.error(
				"You don't have permission to manage programming for this team",
			)
			return
		}

		setUnsubscribingTrack({ id: trackId, name: trackName })
		await unsubscribe({ teamId, trackId })
	}

	if (subscriptions.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground mb-4">
					No active programming track subscriptions.
				</p>
				<Button asChild>
					<a href="/admin/teams/programming">Browse Programming Tracks</a>
				</Button>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{subscriptions.map((subscription) => (
				<Card key={subscription.id}>
					<CardHeader>
						<div className="flex items-start justify-between">
							<CardTitle className="text-lg">{subscription.name}</CardTitle>
							<Badge variant="secondary">
								{subscription.type.replace(/_/g, " ")}
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						{subscription.description && (
							<p className="text-muted-foreground text-sm mb-4">
								{subscription.description}
							</p>
						)}
						<div className="space-y-3">
							<div className="text-sm text-muted-foreground">
								by {subscription.ownerTeam?.name || "Unknown"}
							</div>
							<div className="text-sm text-muted-foreground">
								Subscribed: {subscription.subscribedAt.toLocaleDateString()}
							</div>
							{canManageProgramming && (
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() => handleSetDefault(subscription.id)}
										disabled={isSettingDefault}
									>
										{isSettingDefault ? "Setting..." : "Set as Default"}
									</Button>
									<Button
										size="sm"
										variant="destructive"
										onClick={() =>
											handleUnsubscribe(subscription.id, subscription.name)
										}
										disabled={isUnsubscribing}
									>
										{isUnsubscribing ? "Unsubscribing..." : "Unsubscribe"}
									</Button>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
