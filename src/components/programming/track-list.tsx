"use client"

import { TrackCard } from "./track-card"

interface PublicProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
	ownerTeam: {
		id: string
		name: string
	} | null
}

interface TrackListProps {
	tracks: PublicProgrammingTrack[]
}

export function TrackList({ tracks }: TrackListProps) {
	if (tracks.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">
					No public programming tracks available.
				</p>
			</div>
		)
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{tracks.map((track) => (
				<TrackCard key={track.id} track={track} />
			))}
		</div>
	)
}
