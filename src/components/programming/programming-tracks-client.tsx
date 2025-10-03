"use client"

import { useMemo } from "react"
import { EnhancedTrackList } from "./enhanced-track-list"
import type { ProgrammingTrackWithTeamSubscriptions } from "@/server/programming-multi-team"

interface ProgrammingTracksClientProps {
	allTracks: ProgrammingTrackWithTeamSubscriptions[]
	teamId: string
	teamName: string
	hasManagePermission?: boolean
}

export function ProgrammingTracksClient({
	allTracks,
	teamId,
	teamName,
	hasManagePermission = false,
}: ProgrammingTracksClientProps) {
	// Filter tracks based on team context
	const filteredTracks = useMemo(() => {
		const subscribedTracks = allTracks.filter((track) =>
			track.subscribedTeams.some((team) => team.teamId === teamId),
		)

		const ownedTracks = allTracks.filter((track) => track.ownerTeamId === teamId)

		const availableTracks = allTracks.filter(
			(track) =>
				!track.subscribedTeams.some((team) => team.teamId === teamId) &&
				track.ownerTeamId !== teamId,
		)

		return {
			subscribedTracks,
			ownedTracks,
			availableTracks,
		}
	}, [allTracks, teamId])

	return (
		<div className="space-y-12">
			{filteredTracks.subscribedTracks.length > 0 && (
				<div>
					<h2 className="text-2xl font-semibold mb-6">Subscribed Tracks</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Programming tracks you are subscribed to. These workouts are
						available to schedule for your team.
					</p>
					<EnhancedTrackList
						tracks={filteredTracks.subscribedTracks}
						teamId={teamId}
						hasManagePermission={hasManagePermission}
					/>
				</div>
			)}

			{filteredTracks.ownedTracks.length > 0 && (
				<div>
					<h2 className="text-2xl font-semibold mb-6">Your Tracks</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Programming tracks created by {teamName}
					</p>
					<EnhancedTrackList
						tracks={filteredTracks.ownedTracks}
						teamId={teamId}
						isOwned={true}
						hasManagePermission={hasManagePermission}
					/>
				</div>
			)}

			{filteredTracks.availableTracks.length > 0 && (
				<div>
					<h2 className="text-2xl font-semibold mb-6">Available Tracks</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Public tracks you can subscribe to
					</p>
					<EnhancedTrackList
						tracks={filteredTracks.availableTracks}
						teamId={teamId}
						hasManagePermission={hasManagePermission}
					/>
				</div>
			)}

			{filteredTracks.subscribedTracks.length === 0 &&
				filteredTracks.ownedTracks.length === 0 &&
				filteredTracks.availableTracks.length === 0 && (
					<div className="text-center py-12 border rounded-lg bg-muted/20">
						<p className="text-muted-foreground">
							No programming tracks available.
						</p>
					</div>
				)}
		</div>
	)
}
