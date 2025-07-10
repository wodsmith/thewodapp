import React from "react"
import { notFound } from "next/navigation"
import {
	getProgrammingTrackById,
	getWorkoutsForTrack,
} from "@/server/programming-tracks"
import { SubscribeButton } from "@/components/programming/subscribe-button"
import {
	subscribeTrackAction,
	unsubscribeTrackAction,
	getTrackSubscriptionStatusAction,
} from "@/actions/subscribe-track.action"
import { getUserTeamsAction } from "@/actions/team-actions"

interface PageProps {
	params: Promise<{
		trackId: string
	}>
}

export default async function ProgrammingTrackDetailPage({
	params,
}: PageProps) {
	const { trackId } = await params

	const track = await getProgrammingTrackById(trackId)
	if (!track) {
		notFound()
	}

	// Fetch data in parallel
	const [workouts, subscriptionResult, userTeamsResult] = await Promise.all([
		getWorkoutsForTrack(trackId),
		getTrackSubscriptionStatusAction({ trackId }).catch(() => [null, null]),
		getUserTeamsAction().catch(() => [null, null]),
	])

	// Extract data from server action results
	const subscriptionStatus = subscriptionResult?.[0]?.success
		? subscriptionResult[0].data
		: { isSubscribed: false, teamId: null }

	const userTeams = userTeamsResult?.[0]?.success ? userTeamsResult[0].data : []

	return (
		<div className="container mx-auto py-8 space-y-6">
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{track.name}</h1>
					{track.description && (
						<p className="text-muted-foreground mt-2">{track.description}</p>
					)}
				</div>
				<SubscribeButton
					trackId={track.id}
					isSubscribed={subscriptionStatus.isSubscribed}
					userTeams={userTeams}
					subscribeAction={subscribeTrackAction}
					unsubscribeAction={unsubscribeTrackAction}
				/>
			</div>

			<div className="border rounded-md divide-y">
				{workouts.length === 0 ? (
					<p className="p-4 text-sm text-muted-foreground">
						This track does not contain any workouts yet.
					</p>
				) : (
					workouts.map((tw) => (
						<div key={tw.id} className="p-4 flex gap-4">
							<span className="w-20 text-xs font-mono text-muted-foreground">
								Day {tw.dayNumber}
							</span>
							<div className="flex-1 space-y-1">
								<p className="font-medium leading-none">
									{tw.workout?.name ?? "Unnamed workout"}
								</p>
								{tw.workout?.description && (
									<p className="text-xs text-muted-foreground">
										{tw.workout.description}
									</p>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	)
}
