"use client"

import { Dumbbell, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { ProgrammingTrack, ScalingGroup, Team } from "@/db/schema"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"

interface ProgrammingTrackRowProps {
	track: ProgrammingTrack
	teamId: Team["id"]
	scalingGroup?: ScalingGroup | null
}

export function ProgrammingTrackRow({
	track,
	teamId,
	scalingGroup,
}: ProgrammingTrackRowProps) {
	const getTypeColor = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "bg-green-500 text-white border-2 border-green-700 font-mono"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "bg-blue-500 text-white border-2 border-blue-700 font-mono"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "bg-purple-500 text-white border-2 border-purple-700 font-mono"
			default:
				return "bg-gray-500 text-white border-2 border-gray-700 font-mono"
		}
	}

	const getTypeLabel = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "Self-programmed"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "Team-owned"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "3rd Party"
			default:
				return type
		}
	}

	return (
		<Link
			href={`/admin/teams/programming/${track.id}`}
			className="block border-4 hover:border-primary border-transparent bg-surface rounded-none p-4 transition-all"
		>
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
				<div className="flex-1 min-w-0">
					<h3 className="text-lg font-mono tracking-tight truncate">
						{track.name}
					</h3>
					{track.description && (
						<p className="text-sm text-muted-foreground font-mono mt-1 line-clamp-2 sm:hidden">
							{track.description}
						</p>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
					<Badge
						className={`${getTypeColor(track.type)} text-xs whitespace-nowrap`}
					>
						{getTypeLabel(track.type)}
					</Badge>
					{track.isPublic ? (
						<Badge className="bg-orange-500 text-white border-2 border-orange-700 font-mono text-xs whitespace-nowrap">
							<Users className="h-3 w-3 mr-1" />
							Public
						</Badge>
					) : (
						<Badge className="bg-gray-500 text-white border-2 border-gray-700 font-mono text-xs whitespace-nowrap">
							Private
						</Badge>
					)}
					{scalingGroup && (
						<Badge className="bg-purple-500 text-white border-2 border-purple-700 font-mono text-xs whitespace-nowrap">
							<Dumbbell className="h-3 w-3 mr-1" />
							{scalingGroup.title}
						</Badge>
					)}
				</div>
				{track.description && (
					<p className="text-sm text-muted-foreground font-mono hidden sm:block sm:max-w-xs truncate">
						{track.description}
					</p>
				)}
			</div>
		</Link>
	)
}
