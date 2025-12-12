"use client"

import type { ProgrammingTrackWithTeamSubscriptions } from "@/server/programming-multi-team"
import { EnhancedTrackRow } from "./enhanced-track-row"

interface EnhancedTrackListProps {
	tracks: ProgrammingTrackWithTeamSubscriptions[]
	teamId: string
	isOwned?: boolean
	hasManagePermission?: boolean
}

export function EnhancedTrackList({
	tracks,
	teamId,
	isOwned = false,
	hasManagePermission = false,
}: EnhancedTrackListProps) {
	if (tracks.length === 0) {
		return (
			<div className="text-center py-12 border rounded-lg bg-muted/20">
				<p className="text-muted-foreground">
					{isOwned
						? "Your team hasn't created any public programming tracks yet."
						: "No programming tracks available."}
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			{tracks.map((track) => (
				<EnhancedTrackRow
					key={track.id}
					track={track}
					teamId={teamId}
					isOwned={isOwned}
					hasManagePermission={hasManagePermission}
				/>
			))}
		</div>
	)
}
