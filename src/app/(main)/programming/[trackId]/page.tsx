import "server-only"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { getSessionFromCookie } from "@/utils/auth"
import {
	getProgrammingTrackById,
	isTeamSubscribedToProgrammingTrack,
} from "@/server/programming"
import { PaginatedTrackWorkouts } from "@/components/programming/paginated-track-workouts"
import { SubscribeButton } from "@/components/programming/subscribe-button"

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

	const teamId = session.teams[0].id

	// Check if any of the user's teams are subscribed to this track
	const isSubscribed = await isTeamSubscribedToProgrammingTrack(teamId, trackId)

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<div className="flex items-start justify-between mb-4">
					<div className="flex items-center gap-4">
						<h1 className="text-3xl font-bold tracking-tight">{track.name}</h1>
						<Badge variant="secondary">{track.type.replace(/_/g, " ")}</Badge>
					</div>
					<SubscribeButton trackId={trackId} isSubscribed={isSubscribed} />
				</div>

				{track.description && (
					<p className="text-muted-foreground text-lg">{track.description}</p>
				)}

				{track.ownerTeam && (
					<div className="mt-4">
						<span className="text-sm text-muted-foreground">
							Created by <strong>{track.ownerTeam.name}</strong>
						</span>
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
					teamId={teamId}
					pageSize={12}
				/>
			</div>
		</div>
	)
}
