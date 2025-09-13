"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { EnhancedSubscribeButton } from "./enhanced-subscribe-button"
import type { ProgrammingTrackWithTeamSubscriptions } from "@/server/programming-multi-team"
import { Building2, Users } from "lucide-react"

interface Team {
	id: string
	name: string
}

interface EnhancedTrackRowProps {
	track: ProgrammingTrackWithTeamSubscriptions
	userTeams: Team[]
	showTeamBadges?: boolean
	isOwned?: boolean
}

export function EnhancedTrackRow({
	track,
	userTeams,
	showTeamBadges = false,
	isOwned = false,
}: EnhancedTrackRowProps) {
	const subscribedTeamIds = new Set(track.subscribedTeams.map((t) => t.teamId))

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

			<div className="space-y-3">
				{/* Main content row */}
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
					{/* Left section: Title, type badge, and owner */}
					<div className="flex flex-col gap-2 min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="font-semibold text-lg leading-tight truncate group-hover:text-primary transition-colors">
								{track.name}
							</h3>
							<Badge variant="secondary" className="text-xs relative z-20">
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
					<div className="flex-shrink-0 relative z-20">
						{isOwned ? (
							<Badge variant="outline" className="pointer-events-none">
								Your Team's Track
							</Badge>
						) : (
							<EnhancedSubscribeButton
								trackId={track.id}
								userTeams={userTeams}
								subscribedTeamIds={subscribedTeamIds}
							/>
						)}
					</div>
				</div>

				{/* Team subscription badges */}
				{showTeamBadges && track.subscribedTeams.length > 0 && (
					<div className="flex flex-wrap items-center gap-2 pt-2 border-t">
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<Users className="h-3 w-3" />
							<span>Subscribed by:</span>
						</div>
						{track.subscribedTeams.map((team) => (
							<Badge
								key={team.teamId}
								variant="secondary"
								className="text-xs relative z-20"
							>
								{team.teamName}
							</Badge>
						))}
					</div>
				)}
			</div>
		</article>
	)
}
