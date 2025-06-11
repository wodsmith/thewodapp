import "server-only"
import type { ProgrammingTrack } from "@/db/schema" // Added import

interface Props {
	trackId: string
	initialTrack?: ProgrammingTrack // Added optional initialTrack prop
}

export function TrackDetailsView({ trackId, initialTrack }: Props) {
	// TODO: Fetch track details if initialTrack is not provided
	// For now, we assume initialTrack will be passed if available.
	const trackName = initialTrack?.name ?? "Loading..."
	const trackDescription = initialTrack?.description ?? ""

	return (
		<section className="space-y-2">
			<h2 className="text-2xl font-semibold">{trackName}</h2>
			{trackDescription && <p className="text-gray-600">{trackDescription}</p>}
			<p className="text-sm text-gray-500">Track ID: {trackId}</p>
			{/* Display other track details as needed */}
		</section>
	)
}
