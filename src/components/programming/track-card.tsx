"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<CardTitle className="text-lg">{track.name}</CardTitle>
					<Badge variant="secondary" className="ml-2">
						{track.type.replace(/_/g, " ")}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{track.description && (
					<p className="text-muted-foreground text-sm mb-4">
						{track.description}
					</p>
				)}
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						by {track.ownerTeam?.name || "Unknown"}
					</div>
					{!isSubscribed && <SubscribeButton trackId={track.id} />}
					{isSubscribed && <Badge variant="default">Subscribed</Badge>}
				</div>
			</CardContent>
		</Card>
	)
}
