"use client"

import { TrackRow } from "./track-row"

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
	isSubscribed?: boolean
}

export function TrackList({ tracks, isSubscribed = false }: TrackListProps) {
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
		<div className="space-y-3">
			{tracks.map((track) => (
				<TrackRow key={track.id} track={track} isSubscribed={isSubscribed} />
			))}
		</div>
	)
}
