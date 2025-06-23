"use client"

import { Button } from "@/components/ui/button"
import type { ProgrammingTrack } from "@/db/schema"
import { Plus } from "lucide-react"
import { useOptimistic, useState } from "react"
import { ProgrammingTrackCard } from "./programming-track-card"
import { ProgrammingTrackCreateDialog } from "./programming-track-create-dialog"

interface ProgrammingTrackDashboardProps {
	teamId: string
	initialTracks: ProgrammingTrack[]
}

export function ProgrammingTrackDashboard({
	teamId,
	initialTracks,
}: ProgrammingTrackDashboardProps) {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [optimisticTracks, setOptimisticTracks] = useOptimistic(
		initialTracks,
		(
			state,
			action: {
				type: "add" | "delete"
				track?: ProgrammingTrack
				trackId?: string
			},
		) => {
			switch (action.type) {
				case "add":
					return action.track ? [...state, action.track] : state
				case "delete":
					return state.filter((track) => track.id !== action.trackId)
				default:
					return state
			}
		},
	)

	const handleTrackCreated = (track: ProgrammingTrack) => {
		setOptimisticTracks({ type: "add", track })
		setIsCreateDialogOpen(false)
	}

	const handleTrackDeleted = (trackId: string) => {
		setOptimisticTracks({ type: "delete", trackId })
	}

	console.log(
		"DEBUG: [UI] Programming track dashboard rendered with tracks:",
		optimisticTracks.length,
	)

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-lg font-semibold">Programming Tracks</h2>
				<ProgrammingTrackCreateDialog
					teamId={teamId}
					trigger={
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							Create Track
						</Button>
					}
					onTrackCreated={handleTrackCreated}
					open={isCreateDialogOpen}
					onOpenChange={setIsCreateDialogOpen}
				/>
			</div>

			{optimisticTracks.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-muted-foreground mb-4">
						No programming tracks found.
					</p>
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Create your first track
					</Button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{optimisticTracks.map((track) => (
						<ProgrammingTrackCard
							key={track.id}
							track={track}
							teamId={teamId}
							onDeletedAction={() => handleTrackDeleted(track.id)}
						/>
					))}
				</div>
			)}
		</div>
	)
}
