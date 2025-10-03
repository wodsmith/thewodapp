import "server-only"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { getSessionFromCookie } from "@/utils/auth"
import { getProgrammingTrackById } from "@/server/programming"
import { getTrackSubscribedTeams } from "@/server/programming-multi-team"
import { PaginatedTrackWorkouts } from "@/components/programming/paginated-track-workouts"
import { EnhancedSubscribeButton } from "@/components/programming/enhanced-subscribe-button"
import { Building2, Users } from "lucide-react"
import { TrackDetailTeamSelector } from "@/components/programming/track-detail-team-selector"

interface ProgrammingTrackPageProps {
	params: Promise<{
		trackId: string
	}>
}

export default async function ProgrammingTrackPage({
	params,
}: ProgrammingTrackPageProps) {
	const { trackId } = await params
	const session = await getSessionFromCookie()

	if (!session?.teams?.[0]?.id) {
		notFound()
	}

	const track = await getProgrammingTrackById(trackId)

	if (!track) {
		notFound()
	}

	const userTeamIds = session.teams.map((t) => t.id)
	const userTeams = session.teams

	// Get which of the user's teams are subscribed to this track
	const subscribedTeams = await getTrackSubscribedTeams(trackId, userTeamIds)
	const subscribedTeamIds = new Set(subscribedTeams.map((t) => t.teamId))

	// Check if user owns this track
	const isOwned = userTeamIds.includes(track.ownerTeamId || "")

	// Default to first team for workouts display (will be replaced by team selector)
	const defaultTeamId = session.teams[0].id

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1">
						<div className="flex items-center gap-4 mb-2">
							<h1 className="text-3xl font-bold tracking-tight">
								{track.name}
							</h1>
							<Badge variant="secondary">{track.type.replace(/_/g, " ")}</Badge>
						</div>
						{track.description && (
							<p className="text-muted-foreground text-lg mb-4">
								{track.description}
							</p>
						)}
						<div className="flex items-center gap-4 text-sm text-muted-foreground">
							{track.ownerTeam && (
								<div className="flex items-center gap-1">
									<Building2 className="h-3 w-3" />
									<span>
										Created by <strong>{track.ownerTeam.name}</strong>
									</span>
								</div>
							)}
							{subscribedTeams.length > 0 && (
								<div className="flex items-center gap-1">
									<Users className="h-3 w-3" />
									<span>
										{subscribedTeams.length}{" "}
										{subscribedTeams.length === 1
											? "of your teams subscribed"
											: "of your teams subscribed"}
									</span>
								</div>
							)}
						</div>
					</div>
					<div className="flex flex-col gap-2 items-end">
						{isOwned ? (
							<Badge variant="outline" className="pointer-events-none">
								Your Team's Track
							</Badge>
						) : (
							<EnhancedSubscribeButton
								trackId={trackId}
								userTeams={userTeams}
								subscribedTeamIds={subscribedTeamIds}
							/>
						)}
						{userTeams.length > 1 && (
							<TrackDetailTeamSelector teams={userTeams} />
						)}
					</div>
				</div>

				{/* Show which teams are subscribed */}
				{subscribedTeams.length > 0 && (
					<div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
						<span className="text-sm text-muted-foreground">
							Your subscribed teams:
						</span>
						{subscribedTeams.map((team) => (
							<Badge key={team.teamId} variant="secondary" className="text-xs">
								{team.teamName}
							</Badge>
						))}
					</div>
				)}
			</div>

			{/* Paginated workout listings */}
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold tracking-tight">Workouts</h2>
					<p className="text-sm text-muted-foreground">
						Programming track workouts
					</p>
				</div>
				<PaginatedTrackWorkouts
					trackId={trackId}
					teamId={defaultTeamId}
					pageSize={12}
				/>
			</div>
		</div>
	)
}
