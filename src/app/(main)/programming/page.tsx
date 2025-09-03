import "server-only"
import { getPublicProgrammingTracks } from "@/server/programming"
import { TrackList } from "@/components/programming/track-list"

export default async function ProgrammingPage() {
	const tracks = await getPublicProgrammingTracks()

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
			<TrackList tracks={tracks} />
		</div>
	)
}
