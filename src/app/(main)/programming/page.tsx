import React from "react"
import { getPublicProgrammingTracks } from "@/server/programming-tracks"
import { TrackRow } from "./_components/track-row"
import { TrackSearchInput } from "./_components/track-search-input"
import {
	subscribeTrackAction,
	unsubscribeTrackAction,
	getTrackSubscriptionStatusAction,
} from "@/actions/subscribe-track.action"
import { getUserTeamsAction } from "@/actions/team-actions"

interface PageProps {
	searchParams?: Promise<{
		q?: string
	}>
}

export default async function ProgrammingTracksPage({
	searchParams,
}: PageProps) {
	const resolvedSearchParams = await searchParams
	const search = resolvedSearchParams?.q ?? ""
	const tracks = await getPublicProgrammingTracks(search)

	console.log(`PAGE: /programming rendered ${tracks.length} tracks`)

	// Fetch user teams (this will be the same for all tracks)
	const userTeamsResult = await getUserTeamsAction().catch(() => [null, null])
	const userTeams = userTeamsResult?.[0]?.success ? userTeamsResult[0].data : []

	// Fetch subscription status for each track
	const subscriptionPromises = tracks.map((track) =>
		getTrackSubscriptionStatusAction({ trackId: track.id }).catch(() => [
			null,
			null,
		]),
	)
	const subscriptionResults = await Promise.all(subscriptionPromises)

	// Create a map of trackId to subscription status
	const subscriptionMap = new Map<string, boolean>()
	subscriptionResults.forEach((result, index) => {
		const trackId = tracks[index].id
		const isSubscribed = result?.[0]?.success
			? result[0].data.isSubscribed
			: false
		subscriptionMap.set(trackId, isSubscribed)
	})

	return (
		<div className="container mx-auto py-8 space-y-8">
			<h1 className="text-2xl font-bold tracking-tight">Programming Tracks</h1>
			<TrackSearchInput />
			<div className="border rounded-md divide-y">
				{tracks.map((track) => (
					<TrackRow
						key={track.id}
						track={track}
						isSubscribed={subscriptionMap.get(track.id) || false}
						userTeams={userTeams}
						subscribeAction={subscribeTrackAction}
						unsubscribeAction={unsubscribeTrackAction}
					/>
				))}
			</div>
		</div>
	)
}
