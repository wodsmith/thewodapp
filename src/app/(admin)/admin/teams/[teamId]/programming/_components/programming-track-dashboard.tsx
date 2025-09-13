"use client"

import { Plus } from "lucide-react"
import { startTransition, useOptimistic, useState } from "react"
import { Button } from "@/components/ui/button"
import type { ProgrammingTrack } from "@/db/schema"
import { ProgrammingTrackCreateDialog } from "./programming-track-create-dialog"
import { ProgrammingTrackRow } from "./programming-track-row"

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
				type: "add"
				track?: ProgrammingTrack
			},
		) => {
			switch (action.type) {
				case "add":
					return action.track ? [...state, action.track] : state
				default:
					return state
			}
		},
	)

	const handleTrackCreated = (track: ProgrammingTrack) => {
		startTransition(() => {
			setOptimisticTracks({ type: "add", track })
		})
		setIsCreateDialogOpen(false)
	}

	console.log(
		"DEBUG: [UI] Programming track dashboard rendered with tracks:",
		optimisticTracks.length,
		"initialTracks:",
		initialTracks.length,
		"tracks data:",
		optimisticTracks.map((t) => ({
			id: t.id,
			name: t.name,
			type: t.type,
			ownerTeamId: t.ownerTeamId,
		})),
	)

	return (
		<div className="space-y-8">
			<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
				<div className="flex-1 min-w-0">
					<h2 className="text-2xl font-bold font-mono tracking-tight">
						Programming Tracks
					</h2>
					<p className="text-muted-foreground mt-1 font-mono">
						Manage and organize your team's training programs
					</p>
				</div>
				<div className="shrink-0">
					<ProgrammingTrackCreateDialog
						teamId={teamId}
						trigger={
							<Button className="border-4 border-primary transition-all font-mono w-full sm:w-auto">
								<Plus className="h-4 w-4 mr-2" />
								Create Track
							</Button>
						}
						onTrackCreated={handleTrackCreated}
						open={isCreateDialogOpen}
						onOpenChange={setIsCreateDialogOpen}
					/>
				</div>
			</div>

			{optimisticTracks.length === 0 ? (
				<div className="text-center py-16 border-4 border-dashed border-primary bg-surface rounded-none">
					<p className="text-muted-foreground mb-6 font-mono text-lg">
						No programming tracks found.
					</p>
					<Button
						onClick={() => setIsCreateDialogOpen(true)}
						className="border-4 border-primary transition-all font-mono"
					>
						<Plus className="h-4 w-4 mr-2" />
						Create your first track
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					{optimisticTracks.map((track) => (
						<ProgrammingTrackRow key={track.id} track={track} teamId={teamId} />
					))}
				</div>
			)}
		</div>
	)
}
