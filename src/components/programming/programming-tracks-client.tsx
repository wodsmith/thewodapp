"use client"

import { useEffect, useState } from "react"
import { useTeamContext } from "@/state/team-context"
import { EnhancedTrackList } from "./enhanced-track-list"
import { TeamContextIndicator } from "./team-context-indicator"
import type { ProgrammingTrackWithTeamSubscriptions } from "@/server/programming-multi-team"

interface Team {
	id: string
	name: string
}

interface ProgrammingTracksClientProps {
	allTracks: ProgrammingTrackWithTeamSubscriptions[]
	userTeams: Team[]
	userTeamIds: string[]
}

export function ProgrammingTracksClient({
	allTracks,
	userTeams,
	userTeamIds,
}: ProgrammingTracksClientProps) {
	const { currentTeamId } = useTeamContext()
	const [filteredTracks, setFilteredTracks] = useState<{
		subscribedTracks: ProgrammingTrackWithTeamSubscriptions[]
		ownedTracks: ProgrammingTrackWithTeamSubscriptions[]
		availableTracks: ProgrammingTrackWithTeamSubscriptions[]
	}>({
		subscribedTracks: [],
		ownedTracks: [],
		availableTracks: [],
	})

	// Don't auto-select - let user choose or stay in "All Teams" view

	// Filter tracks based on current team context
	useEffect(() => {
		// When "All Teams" is selected or no team selected
		if (!currentTeamId || currentTeamId === "") {
			// Show all tracks with any team subscriptions
			const subscribedTracks = allTracks.filter(
				(track) => track.subscribedTeams.length > 0,
			)
			// Show tracks owned by any of user's teams
			const ownedTracks = allTracks.filter((track) =>
				userTeamIds.includes(track.ownerTeamId || ""),
			)
			// Show tracks that no user's teams are subscribed to and not owned
			const availableTracks = allTracks.filter(
				(track) =>
					track.subscribedTeams.length === 0 &&
					!userTeamIds.includes(track.ownerTeamId || ""),
			)

			setFilteredTracks({
				subscribedTracks,
				ownedTracks,
				availableTracks,
			})
		} else {
			// Filter based on selected team
			const subscribedTracks = allTracks.filter((track) =>
				track.subscribedTeams.some((team) => team.teamId === currentTeamId),
			)

			const ownedTracks = allTracks.filter(
				(track) => track.ownerTeamId === currentTeamId,
			)

			const availableTracks = allTracks.filter(
				(track) =>
					!track.subscribedTeams.some(
						(team) => team.teamId === currentTeamId,
					) && track.ownerTeamId !== currentTeamId,
			)

			setFilteredTracks({
				subscribedTracks,
				ownedTracks,
				availableTracks,
			})
		}
	}, [currentTeamId, allTracks, userTeamIds])

	const currentTeam = userTeams.find((t) => t.id === currentTeamId)

	return (
		<div>
			<div className="mb-8">
				<div className="flex items-start justify-between mb-4">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Programming Tracks
						</h1>
						<p className="text-muted-foreground">
							{currentTeam
								? `Viewing programming tracks for ${currentTeam.name}`
								: "Subscribe to public programming tracks created by other teams"}
						</p>
					</div>
					{userTeams.length > 1 && <TeamContextIndicator teams={userTeams} />}
				</div>
			</div>

			{filteredTracks.subscribedTracks.length > 0 && (
				<div className="mb-12">
					<h2 className="text-2xl font-semibold mb-6">
						{currentTeam
							? `${currentTeam.name}'s Subscribed Tracks`
							: "Subscribed Tracks"}
					</h2>
					<p className="text-sm text-muted-foreground mb-4">
						{currentTeam
							? `Tracks that ${currentTeam.name} is subscribed to`
							: "Tracks your teams are subscribed to. Badges show which teams have subscribed."}
					</p>
					<EnhancedTrackList
						tracks={filteredTracks.subscribedTracks}
						userTeams={userTeams}
						showTeamBadges={!currentTeamId}
					/>
				</div>
			)}

			{filteredTracks.ownedTracks.length > 0 && (
				<div className="mb-12">
					<h2 className="text-2xl font-semibold mb-6">
						{currentTeam
							? `${currentTeam.name}'s Tracks`
							: "Your Teams' Tracks"}
					</h2>
					<p className="text-sm text-muted-foreground mb-4">
						{currentTeam
							? `Tracks created by ${currentTeam.name}`
							: "Tracks created by teams you belong to"}
					</p>
					<EnhancedTrackList
						tracks={filteredTracks.ownedTracks}
						userTeams={userTeams}
						showTeamBadges={false}
						isOwned={true}
					/>
				</div>
			)}

			{filteredTracks.availableTracks.length > 0 && (
				<div>
					<h2 className="text-2xl font-semibold mb-6">Available Tracks</h2>
					<p className="text-sm text-muted-foreground mb-4">
						{currentTeam
							? `Public tracks ${currentTeam.name} can subscribe to`
							: "Public tracks you can subscribe to with any of your teams"}
					</p>
					<EnhancedTrackList
						tracks={filteredTracks.availableTracks}
						userTeams={userTeams}
						showTeamBadges={false}
					/>
				</div>
			)}

			{filteredTracks.subscribedTracks.length === 0 &&
				filteredTracks.ownedTracks.length === 0 &&
				filteredTracks.availableTracks.length === 0 && (
					<div className="text-center py-12 border rounded-lg bg-muted/20">
						<p className="text-muted-foreground">
							No programming tracks available for{" "}
							{currentTeam?.name || "this team"}.
						</p>
					</div>
				)}
		</div>
	)
}
