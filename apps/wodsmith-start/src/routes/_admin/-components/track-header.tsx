"use client"

import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Edit, Users, Lock } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/programming/[trackId]/_components/track-header.tsx
// This is a stub component that displays track header
// Full component includes: edit dialog, visibility selector

interface ProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
	isPublic: number
	ownerTeamId: string
	scalingGroupId: string | null
}

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
	return (
		<div className="flex justify-between items-start mb-8">
			<div>
				<div className="flex items-center gap-3 mb-2">
					<h1 className="text-3xl font-bold font-mono tracking-tight">
						{track.name}
					</h1>
					<div className="flex gap-2">
						{track.isPublic === 1 ? (
							<Badge variant="secondary" className="font-mono">
								<Users className="h-3 w-3 mr-1" />
								Public
							</Badge>
						) : (
							<Badge variant="outline" className="font-mono">
								<Lock className="h-3 w-3 mr-1" />
								Private
							</Badge>
						)}
						<Badge variant="outline" className="font-mono">
							{track.type}
						</Badge>
					</div>
				</div>
				<p className="text-muted-foreground font-mono">
					Manage workouts in the {track.name} track for {teamName}
				</p>
				{track.description && (
					<p className="text-sm text-muted-foreground mt-2 font-mono">
						{track.description}
					</p>
				)}
				{scalingGroupName && (
					<p className="text-sm text-muted-foreground mt-1 font-mono">
						Scaling Group: <span className="font-semibold">{scalingGroupName}</span>
					</p>
				)}
			</div>
			{isOwner && (
				<div className="flex gap-2">
					<Button variant="outline" size="sm" disabled>
						<Edit className="h-4 w-4 mr-2" />
						Edit Track
					</Button>
				</div>
			)}
		</div>
	)
}
