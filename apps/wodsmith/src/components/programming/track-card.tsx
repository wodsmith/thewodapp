"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface TrackCardProps {
	track: PublicProgrammingTrack
	isSubscribed?: boolean
}

export function TrackCard({ track, isSubscribed = false }: TrackCardProps) {
	return (
		<Card className="group relative transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
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

			<CardHeader>
				<div className="flex items-start justify-between">
					<CardTitle className="text-lg group-hover:text-primary transition-colors">
						{track.name}
					</CardTitle>
					<Badge variant="secondary" className="ml-2 relative z-20">
						{track.type.replace(/_/g, " ")}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{track.description && (
					<p className="text-muted-foreground text-sm mb-4 line-clamp-3">
						{track.description}
					</p>
				)}
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						by {track.ownerTeam?.name || "Unknown"}
					</div>
					<div className="relative z-20">
						{!isSubscribed && <SubscribeButton trackId={track.id} />}
						{isSubscribed && (
							<Badge variant="default" className="pointer-events-none">
								Subscribed
							</Badge>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
