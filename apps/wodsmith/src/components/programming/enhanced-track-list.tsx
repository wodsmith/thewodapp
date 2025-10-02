"use client"

import { EnhancedTrackRow } from "./enhanced-track-row"
import type { ProgrammingTrackWithTeamSubscriptions } from "@/server/programming-multi-team"

interface Team {
	id: string
	name: string
}

interface EnhancedTrackListProps {
	tracks: ProgrammingTrackWithTeamSubscriptions[]
	userTeams: Team[]
	showTeamBadges?: boolean
	isOwned?: boolean
}

export function EnhancedTrackList({
	tracks,
	userTeams,
	showTeamBadges = false,
	isOwned = false,
}: EnhancedTrackListProps) {
	if (tracks.length === 0) {
		return (
			<div className="text-center py-12 border rounded-lg bg-muted/20">
				<p className="text-muted-foreground">
					{isOwned
						? "Your teams haven't created any public programming tracks yet."
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
					userTeams={userTeams}
					showTeamBadges={showTeamBadges}
					isOwned={isOwned}
				/>
			))}
		</div>
	)
}
