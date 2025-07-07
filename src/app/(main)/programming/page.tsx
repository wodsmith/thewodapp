import React from "react"
import { getPublicProgrammingTracks } from "@/server/programming-tracks"
import { TrackRow } from "./_components/track-row"
import { TrackSearchInput } from "./_components/track-search-input"

interface PageProps {
	searchParams?: {
		q?: string
	}
}

export default async function ProgrammingTracksPage({
	searchParams,
}: PageProps) {
	const search = searchParams?.q ?? ""
	const tracks = await getPublicProgrammingTracks(search)

	console.log(`PAGE: /programming rendered ${tracks.length} tracks`)

	return (
		<div className="container mx-auto py-8 space-y-8">
			<h1 className="text-2xl font-bold tracking-tight">Programming Tracks</h1>
			<TrackSearchInput />
			<div className="border rounded-md divide-y">
				{tracks.map((track) => (
					<TrackRow key={track.id} track={track} />
				))}
			</div>
		</div>
	)
}
