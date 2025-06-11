import { TrackDetailsView } from "@/components/tracks/TrackDetailsView"
import { TrackWorkoutManager } from "@/components/tracks/TrackWorkoutManager"
import type { ProgrammingTrack, Workout } from "@/db/schema" // Added ProgrammingTrack
import {
	type TrackWorkoutWithDetails,
	getTrackWorkoutsWithDetails,
} from "@/server/programming-tracks"
import { getTrackById } from "@/server/tracks"
import { getTeamWorkoutsNotInTrackSorted } from "@/server/workouts"
import { notFound } from "next/navigation"

interface PageProps {
	params: Promise<{ trackId: string }>
}

export default async function Page({ params }: PageProps) {
	const { trackId } = await params

	const track: ProgrammingTrack | null = await getTrackById(trackId) // Explicitly type track
	if (!track) {
		notFound()
	}

	let suggestedWorkouts: Workout[] = []
	if (track.ownerTeamId) {
		suggestedWorkouts = await getTeamWorkoutsNotInTrackSorted(
			trackId,
			track.ownerTeamId,
		)
	} else {
		console.log(
			`[TrackPage] Track ${trackId} has no ownerTeamId, skipping suggested workouts.`,
		)
	}

	const currentTrackWorkouts: TrackWorkoutWithDetails[] =
		await getTrackWorkoutsWithDetails(trackId)

	return (
		<main className="container mx-auto p-4 space-y-4">
			<TrackDetailsView trackId={trackId} initialTrack={track} />
			<TrackWorkoutManager
				trackId={trackId}
				suggestedWorkouts={suggestedWorkouts}
				currentTrackWorkouts={currentTrackWorkouts} // Pass current workouts
			/>
		</main>
	)
}
