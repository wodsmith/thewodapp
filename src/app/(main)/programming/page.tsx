import "server-only"
import {
	getPublicProgrammingTracks,
	getTeamProgrammingTracks,
} from "@/server/programming"
import { TrackList } from "@/components/programming/track-list"
import { getSessionFromCookie } from "@/utils/auth"

export default async function ProgrammingPage() {
	const session = await getSessionFromCookie()
	const userTeamIds = session?.teams?.map((team) => team.id) || []

	// Get subscribed tracks from all teams user is part of
	const allTracksPromise = getPublicProgrammingTracks()
	const subscribedTracksPromises = userTeamIds.map((teamId) =>
		getTeamProgrammingTracks(teamId),
	)

	const [allTracks, ...subscribedTracksByTeam] = await Promise.all([
		allTracksPromise,
		...subscribedTracksPromises,
	])

	// Combine subscribed tracks from all teams (deduplicate by track ID)
	const subscribedTracksMap = new Map()
	for (const teamTracks of subscribedTracksByTeam) {
		for (const track of teamTracks) {
			subscribedTracksMap.set(track.id, track)
		}
	}
	const subscribedTracks = Array.from(subscribedTracksMap.values())

	// Filter out tracks owned by any of user's teams and already subscribed tracks
	const subscribedTrackIds = new Set(subscribedTracks.map((track) => track.id))
	const availableTracks = allTracks.filter(
		(track) =>
			!userTeamIds.includes(track.ownerTeamId || "") &&
			!subscribedTrackIds.has(track.id),
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
