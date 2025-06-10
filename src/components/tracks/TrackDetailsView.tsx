import "server-only"

interface Props {
	trackId: string
}

export function TrackDetailsView({ trackId }: Props) {
	return (
		<section>
			<h2 className="text-xl font-semibold">Track Details</h2>
			<p>Track ID: {trackId}</p>
		</section>
	)
}
