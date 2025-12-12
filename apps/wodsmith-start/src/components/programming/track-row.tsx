"use client"

import { Link } from "@tanstack/react-router"
import { Badge } from "~/components/ui/badge"
import { SubscribeButton } from "./subscribe-button"

interface PublicProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
	ownerTeam: {
		id: string
		name: string
	} | null
}

interface TrackRowProps {
	track: PublicProgrammingTrack
	isSubscribed?: boolean
}

export function TrackRow({ track, isSubscribed = false }: TrackRowProps) {
	return (
		<article
			className="border rounded-lg p-4 hover:bg-muted/50 transition-colors relative group"
			aria-label={`Programming track: ${track.name}`}
		>
			{/* Main clickable area */}
			<Link
				href={`/programming/${track.id}`}
				className="absolute inset-0 z-10 block"
				aria-label={`View details for ${track.name} programming track`}
			>
				<span className="sr-only">
					View {track.name} programming track by{" "}
					{track.ownerTeam?.name || "Unknown"}
				</span>
			</Link>

			{/* Main content row */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				{/* Left section: Title, type badge, and owner */}
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
					<h3 className="font-semibold text-lg leading-tight truncate group-hover:text-primary transition-colors">
						{track.name}
					</h3>
					<div className="flex items-center gap-2 flex-shrink-0">
						<Badge variant="secondary" className="text-xs relative z-20">
							{track.type.replace(/_/g, " ")}
						</Badge>
						<span className="text-sm text-muted-foreground">
							by {track.ownerTeam?.name || "Unknown"}
						</span>
					</div>
				</div>

				{/* Right section: Subscribe button or status */}
				<div className="flex-shrink-0 relative z-20">
					{!isSubscribed && <SubscribeButton trackId={track.id} />}
					{isSubscribed && (
						<Badge variant="default" className="pointer-events-none">
							Subscribed
						</Badge>
					)}
				</div>
			</div>

			{/* Description row */}
			{track.description && (
				<div className="mt-3">
					<p className="text-sm text-muted-foreground line-clamp-2">
						{track.description}
					</p>
				</div>
			)}
		</article>
	)
}
