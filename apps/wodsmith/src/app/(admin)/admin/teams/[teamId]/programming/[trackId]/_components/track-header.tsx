"use client"

import { Edit } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { ProgrammingTrack } from "@/db/schema"
import { ProgrammingTrackEditDialog } from "../../_components/programming-track-edit-dialog"
import { TrackVisibilitySelector } from "./track-visibility-selector"

interface TrackHeaderProps {
	teamId: string
	teamName: string
	track: ProgrammingTrack
	scalingGroupName?: string | null
	isOwner: boolean
}

export function TrackHeader({
	teamId,
	teamName,
	track,
	scalingGroupName,
	isOwner,
}: TrackHeaderProps) {
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
	const [currentTrack, setCurrentTrack] = useState(track)
	const router = useRouter()

	const handleTrackUpdated = (updatedTrack: ProgrammingTrack) => {
		setCurrentTrack(updatedTrack)
		setIsEditDialogOpen(false)
		router.refresh()
	}

	return (
		<div className="flex justify-between items-start mb-8">
			<div>
				<h1 className="text-3xl font-bold mb-2 font-mono tracking-tight">
					{currentTrack.name} - Workout Management
				</h1>
				<p className="text-muted-foreground font-mono">
					Manage workouts in the {currentTrack.name} track for {teamName}
				</p>
				{currentTrack.description && (
					<p className="text-sm text-muted-foreground mt-2 font-mono">
						{currentTrack.description}
					</p>
				)}
				{scalingGroupName && (
					<p className="text-sm text-muted-foreground mt-1 font-mono">
						Scaling Group:{" "}
						<span className="font-semibold">{scalingGroupName}</span>
					</p>
				)}
			</div>
			{isOwner && (
				<div className="flex flex-col items-end space-y-2">
					<div className="flex gap-2">
						<ProgrammingTrackEditDialog
							teamId={teamId}
							track={currentTrack}
							trigger={
								<Button
									className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono"
									size="sm"
								>
									<Edit className="h-4 w-4 mr-2" />
									Edit Track
								</Button>
							}
							onTrackUpdated={handleTrackUpdated}
							open={isEditDialogOpen}
							onOpenChange={setIsEditDialogOpen}
						/>
						<TrackVisibilitySelector teamId={teamId} track={currentTrack} />
					</div>
				</div>
			)}
		</div>
	)
}
