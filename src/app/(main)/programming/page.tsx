import "server-only"
import {
	getPublicProgrammingTracks,
	getTeamProgrammingTracks,
} from "@/server/programming"
import { TrackList } from "@/components/programming/track-list"
import { getSessionFromCookie } from "@/utils/auth"

export default async function ProgrammingPage() {
	const session = await getSessionFromCookie()
	const currentTeamId = session?.teams?.[0]?.id

	const [allTracks, subscribedTracks] = await Promise.all([
		getPublicProgrammingTracks(),
		currentTeamId
			? getTeamProgrammingTracks(currentTeamId)
			: Promise.resolve([]),
	])

	// Filter out tracks owned by the current team and already subscribed tracks
	const subscribedTrackIds = new Set(subscribedTracks.map((track) => track.id))
	const availableTracks = allTracks.filter(
		(track) =>
			track.ownerTeamId !== currentTeamId && !subscribedTrackIds.has(track.id),
	)

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">
					Programming Tracks
				</h1>
				<p className="text-muted-foreground">
					Subscribe to public programming tracks created by other teams
				</p>
			</div>

			{subscribedTracks.length > 0 && (
				<div className="mb-12">
					<h2 className="text-2xl font-semibold mb-6">
						Your Subscribed Tracks
					</h2>
					<TrackList tracks={subscribedTracks} isSubscribed={true} />
				</div>
			)}

			<div>
				<h2 className="text-2xl font-semibold mb-6">Available Tracks</h2>
				<TrackList tracks={availableTracks} isSubscribed={false} />
			</div>
		</div>
	)
}
