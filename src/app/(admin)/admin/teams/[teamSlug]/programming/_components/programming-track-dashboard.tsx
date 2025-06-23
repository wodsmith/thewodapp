"use client"

import type { ProgrammingTrack } from "@/db/schema"

interface ProgrammingTrackDashboardProps {
	teamId: string
	initialTracks: ProgrammingTrack[]
}

export function ProgrammingTrackDashboard({
	teamId,
	initialTracks,
}: ProgrammingTrackDashboardProps) {
	return (
		<div>
			<h2 className="text-lg font-semibold mb-4">Programming Tracks</h2>
			{initialTracks.length === 0 ? (
				<p className="text-muted-foreground">No programming tracks found.</p>
			) : (
				<div className="space-y-4">
					{initialTracks.map((track) => (
						<div key={track.id} className="p-4 border rounded-lg">
							<h3 className="font-medium">{track.name}</h3>
							{track.description && (
								<p className="text-sm text-muted-foreground mt-1">
									{track.description}
								</p>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
