import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import React from "react"
import { type ProgrammingTrack, STANDALONE_TRACK_ID } from "./types"

interface TrackSelectionProps {
	tracks: ProgrammingTrack[]
	selectedTrack: ProgrammingTrack | null
	onTrackSelect: (track: ProgrammingTrack) => void
	isLoading: boolean
}

export function TrackSelection({
	tracks,
	selectedTrack,
	onTrackSelect,
	isLoading,
}: TrackSelectionProps) {
	const handleTrackSelect = (track: ProgrammingTrack) => {
		if (process.env.LOG_LEVEL === "debug") {
			console.log(
				`DEBUG: [TrackSelection] Track selected: ${track.id} (${track.name})`,
			)
		}
		onTrackSelect(track)
	}

	return (
		<section className="max-w-sm">
			<h3 className="text-lg font-semibold">Select Programming Track</h3>
			{isLoading ? (
				<div className="text-center text-muted-foreground">
					Loading tracks...
				</div>
			) : (
				<div className="space-y-2">
					{/* Standalone Workouts Option */}
					<Card
						data-testid="track-card"
						className={`cursor-pointer transition-colors p-4 ${
							selectedTrack?.id === STANDALONE_TRACK_ID
								? "border-primary bg-primary/10"
								: "hover:bg-muted/50"
						}`}
						onClick={() =>
							handleTrackSelect({
								id: STANDALONE_TRACK_ID,
								name: "All Available Workouts",
								description: "Workouts not assigned to any programming track",
								type: "standalone",
							})
						}
					>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm">All Available Workouts</CardTitle>
							<CardDescription className="text-xs">
								Workouts not assigned to any programming track
							</CardDescription>
						</CardHeader>
					</Card>

					{/* Programming Tracks */}
					{tracks.map((track) => (
						<Card
							key={track.id}
							data-testid="track-card"
							className={`cursor-pointer transition-colors p-4 ${
								selectedTrack?.id === track.id
									? "border-primary bg-primary/10"
									: "hover:bg-muted/50"
							}`}
							onClick={() => handleTrackSelect(track)}
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm">{track.name}</CardTitle>
								{track.description && (
									<CardDescription className="text-xs">
										{track.description}
									</CardDescription>
								)}
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</section>
	)
}
