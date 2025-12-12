import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "~/components/ui/badge"
import { Building2, Users } from "lucide-react"
import {
	getProgrammingTrackByIdFn,
	getTrackSubscribedTeamsFn,
} from "@/server-functions/programming"
import { PaginatedTrackWorkouts } from "~/components/programming/paginated-track-workouts"
import { EnhancedSubscribeButton } from "~/components/programming/enhanced-subscribe-button"
import { TrackDetailTeamSelector } from "~/components/programming/track-detail-team-selector"
import { getCurrentUserFn } from "~/server-functions/auth"

export const Route = createFileRoute("/_main/programming/$trackId")({
	loader: async ({ params }) => {
		const { session } = await getCurrentUserFn()
		const userTeamIds = session?.teams?.map((team) => team.id) || []

		if (!session?.teams?.[0]?.id) {
			throw new Error("Not authenticated or no team")
		}

		const trackResult = await getProgrammingTrackByIdFn({
			data: { trackId: params.trackId },
		})

		if (!trackResult.success || !trackResult.data) {
			throw new Error("Programming track not found")
		}

		const track = trackResult.data

		const subscribedTeamsResult = await getTrackSubscribedTeamsFn({
			data: { trackId: params.trackId, userTeamIds },
		})

		const subscribedTeams = subscribedTeamsResult.data || []
		const subscribedTeamIds = new Set(subscribedTeams.map((t) => t.teamId))
		const isOwned = userTeamIds.includes(track.ownerTeamId || "")
		const defaultTeamId = session.teams[0].id

		return {
			track,
			subscribedTeams,
			subscribedTeamIds,
			isOwned,
			defaultTeamId,
			userTeams: session.teams,
		}
	},
	component: ProgrammingTrackPage,
})

function ProgrammingTrackPage() {
	const {
		track,
		subscribedTeams,
		subscribedTeamIds,
		isOwned,
		defaultTeamId,
		userTeams,
	} = Route.useLoaderData()

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
								trackId={track.id}
								teamId={defaultTeamId}
								isSubscribed={subscribedTeamIds.has(defaultTeamId)}
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
					trackId={track.id}
					teamId={defaultTeamId}
					pageSize={12}
				/>
			</div>
		</div>
	)
}
