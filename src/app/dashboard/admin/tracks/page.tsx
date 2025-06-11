import TrackList from "@/components/tracks/TrackList"

export default function Page() {
	return (
		<main className="container mx-auto p-4">
			<h1 className="text-2xl font-semibold mb-4">Programming Tracks</h1>
			<TrackList />
		</main>
	)
}
