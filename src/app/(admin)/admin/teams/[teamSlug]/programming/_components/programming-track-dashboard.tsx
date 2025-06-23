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
		<div className="space-y-8">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold font-mono tracking-tight">
						Programming Tracks
					</h2>
					<p className="text-muted-foreground mt-1 font-mono">
						Manage and organize your team's training programs
					</p>
				</div>
				<ProgrammingTrackCreateDialog
					teamId={teamId}
					trigger={
						<Button className="border-4 border-primary shadow-[6px_6px_0px_0px] shadow-primary hover:shadow-[4px_4px_0px_0px] transition-all font-mono">
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
				<div className="text-center py-16 border-4 border-dashed border-primary bg-surface rounded-none">
					<p className="text-muted-foreground mb-6 font-mono text-lg">
						No programming tracks found.
					</p>
					<Button
						onClick={() => setIsCreateDialogOpen(true)}
						className="border-4 border-primary shadow-[6px_6px_0px_0px] shadow-primary hover:shadow-[4px_4px_0px_0px] transition-all font-mono"
					>
						<Plus className="h-4 w-4 mr-2" />
						Create your first track
					</Button>
				</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
