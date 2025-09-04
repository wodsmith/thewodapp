import "server-only"
import { getPublicProgrammingTracks } from "@/server/programming"
import { TrackList } from "@/components/programming/track-list"
import { getSessionFromCookie } from "@/utils/auth"

export default async function ProgrammingPage() {
	const session = await getSessionFromCookie()
	const currentTeamId = session?.teams?.[0]?.id

	const tracks = await getPublicProgrammingTracks()

	// Filter out tracks owned by the current team
	const otherTeamsTracks = tracks.filter(
		(track) => track.ownerTeamId !== currentTeamId,
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
			<TrackList tracks={otherTeamsTracks} />
		</div>
	)
}
