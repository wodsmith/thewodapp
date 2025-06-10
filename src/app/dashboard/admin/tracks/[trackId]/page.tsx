import { TrackDetailsView } from "@/components/tracks/TrackDetailsView"
import { TrackWorkoutManager } from "@/components/tracks/TrackWorkoutManager"

interface PageProps {
	params: { trackId: string }
}

export default function Page({ params }: PageProps) {
	const { trackId } = params
	return (
		<main className="container mx-auto p-4 space-y-4">
			<TrackDetailsView trackId={trackId} />
			<TrackWorkoutManager trackId={trackId} />
		</main>
	)
}
