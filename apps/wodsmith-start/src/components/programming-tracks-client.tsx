"use client"

import { useRouter } from "@tanstack/react-router"
import { Building2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProgrammingTrackWithTeamSubscriptions } from "@/server-fns/programming-fns"
import {
	subscribeToTrackFn,
	unsubscribeFromTrackFn,
} from "@/server-fns/programming-fns"

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

		const ownedTracks = allTracks.filter(
			(track) => track.ownerTeamId === teamId,
		)

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
					<h3 className="text-xl font-semibold mb-4 font-mono">
						Subscribed Tracks
					</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Programming tracks you are subscribed to. These workouts are
						available to schedule for your team.
					</p>
					<TrackList
						tracks={filteredTracks.subscribedTracks}
						teamId={teamId}
						hasManagePermission={hasManagePermission}
					/>
				</div>
			)}

			{filteredTracks.ownedTracks.length > 0 && (
				<div>
					<h3 className="text-xl font-semibold mb-4 font-mono">Your Tracks</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Programming tracks created by {teamName}
					</p>
					<TrackList
						tracks={filteredTracks.ownedTracks}
						teamId={teamId}
						isOwned={true}
						hasManagePermission={hasManagePermission}
					/>
				</div>
			)}

			{filteredTracks.availableTracks.length > 0 && (
				<div>
					<h3 className="text-xl font-semibold mb-4 font-mono">
						Available Tracks
					</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Public tracks you can subscribe to
					</p>
					<TrackList
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

interface TrackListProps {
	tracks: ProgrammingTrackWithTeamSubscriptions[]
	teamId: string
	isOwned?: boolean
	hasManagePermission?: boolean
}

function TrackList({
	tracks,
	teamId,
	isOwned = false,
	hasManagePermission = false,
}: TrackListProps) {
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
				<TrackRow
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

interface TrackRowProps {
	track: ProgrammingTrackWithTeamSubscriptions
	teamId: string
	isOwned?: boolean
	hasManagePermission?: boolean
}

function TrackRow({
	track,
	teamId,
	isOwned = false,
	hasManagePermission = false,
}: TrackRowProps) {
	const router = useRouter()
	const isSubscribed = track.subscribedTeams.some((t) => t.teamId === teamId)
	const [isLoading, setIsLoading] = useState(false)

	const handleSubscribeToggle = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		if (!hasManagePermission) {
			toast.error("You don't have permission to manage programming tracks")
			return
		}

		setIsLoading(true)
		try {
			if (isSubscribed) {
				await unsubscribeFromTrackFn({ data: { teamId, trackId: track.id } })
				toast.success(`Unsubscribed from ${track.name}`)
			} else {
				await subscribeToTrackFn({ data: { teamId, trackId: track.id } })
				toast.success(`Subscribed to ${track.name}`)
			}
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${isSubscribed ? "unsubscribe from" : "subscribe to"} track`,
			)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<article
			className="border rounded-lg p-4 hover:bg-muted/50 transition-colors relative group"
			aria-label={`Programming track: ${track.name}`}
		>
			<div className="space-y-3">
				{/* Main content row */}
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
					{/* Left section: Title, type badge, and owner */}
					<div className="flex flex-col gap-2 min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h4 className="font-semibold text-lg leading-tight truncate group-hover:text-primary transition-colors">
								{track.name}
							</h4>
							<Badge variant="secondary" className="text-xs">
								{track.type.replace(/_/g, " ")}
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Building2 className="h-3 w-3" />
							<span>by {track.ownerTeam?.name || "Unknown"}</span>
						</div>

						{track.description && (
							<p className="text-sm text-muted-foreground line-clamp-2">
								{track.description}
							</p>
						)}
					</div>

					{/* Right section: Subscribe button or ownership badge */}
					<div className="flex-shrink-0">
						{isOwned ? (
							<Badge variant="outline" className="pointer-events-none">
								Your Team's Track
							</Badge>
						) : (
							<Button
								variant={isSubscribed ? "outline" : "default"}
								size="sm"
								onClick={handleSubscribeToggle}
								disabled={isLoading || !hasManagePermission}
							>
								{isLoading ? "..." : isSubscribed ? "Unsubscribe" : "Subscribe"}
							</Button>
						)}
					</div>
				</div>
			</div>
		</article>
	)
}
