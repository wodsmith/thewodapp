import "server-only"

interface Track {
	id: string
	name: string
}

export default async function TrackList() {
	const tracks: Track[] = []

	if (!tracks.length) {
		return <p>No tracks yet.</p>
	}

	return (
		<ul className="space-y-2">
			{tracks.map((track) => (
				<li key={track.id}>
					<a
						href={`/dashboard/admin/tracks/${track.id}`}
						className="text-blue-600 underline"
					>
						{track.name}
					</a>
				</li>
			))}
		</ul>
	)
}
