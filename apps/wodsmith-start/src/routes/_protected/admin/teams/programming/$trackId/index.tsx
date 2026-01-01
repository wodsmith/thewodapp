/**
 * Admin Teams Programming Track Detail Page
 * Port of apps/wodsmith/src/app/(admin)/admin/teams/programming/[trackId]/page.tsx
 */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { AddWorkoutToTrackDialog } from "@/components/add-workout-to-track-dialog"
import { TrackHeader } from "@/components/track-header"
import { TrackWorkoutList } from "@/components/track-workout-list"
import { Button } from "@/components/ui/button"
import {
	getProgrammingTrackByIdFn,
	getTrackWorkoutsFn,
} from "@/server-fns/programming-fns"

export const Route = createFileRoute(
	"/_protected/admin/teams/programming/$trackId/",
)({
	component: AdminTrackDetailPage,
	loader: async ({ params, context }) => {
		const session = context.session
		const teamId = session?.teams?.[0]?.id
		const team = session?.teams?.find((t) => t.id === teamId)

		const trackResult = await getProgrammingTrackByIdFn({
			data: { trackId: params.trackId },
		})

		const workoutsResult = await getTrackWorkoutsFn({
			data: { trackId: params.trackId },
		})

		return {
			track: trackResult.track,
			trackWorkouts: workoutsResult.workouts,
			teamId,
			teamName: team?.name ?? "Team",
		}
	},
})

function AdminTrackDetailPage() {
	const { track, trackWorkouts, teamId, teamName } = Route.useLoaderData()
	const router = useRouter()

	const handleRefresh = () => {
		router.invalidate()
	}

	const handleWorkoutRemoved = () => {
		router.invalidate()
	}

	if (!track) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">Track Not Found</h1>
					<p className="text-muted-foreground mb-6">
						The programming track you're looking for doesn't exist or has been
						removed.
					</p>
					<Button asChild>
						<Link to="/admin/teams/programming">Back to Programming</Link>
					</Button>
				</div>
			</div>
		)
	}

	// Determine if the current team owns this track
	const isOwner = track.ownerTeamId === teamId

	return (
		<>
			{/* Breadcrumb */}
			<div className="px-4 sm:px-5 py-4 border-b">
				<nav className="flex items-center gap-2 text-sm font-mono">
					<Link
						to="/admin"
						className="text-muted-foreground hover:text-foreground"
					>
						Admin
					</Link>
					<span className="text-muted-foreground">/</span>
					<Link
						to="/admin/teams"
						className="text-muted-foreground hover:text-foreground"
					>
						{teamName}
					</Link>
					<span className="text-muted-foreground">/</span>
					<Link
						to="/admin/teams/programming"
						className="text-muted-foreground hover:text-foreground"
					>
						Programming
					</Link>
					<span className="text-muted-foreground">/</span>
					<span className="text-foreground">{track.name}</span>
				</nav>
			</div>

			<div className="container mx-auto px-5 pb-12">
				{/* Back button */}
				<div className="mb-6 mt-6 flex items-center gap-3">
					<Button variant="outline" size="icon" asChild>
						<Link to="/admin/teams/programming">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
				</div>

				{/* Track Header Component */}
				<TrackHeader track={track} onSuccess={handleRefresh} />

				{/* Track Workouts Section */}
				<div className="mt-8 bg-card border-4 border-primary rounded-none p-6">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold font-mono">TRACK WORKOUTS</h2>
						<div className="flex items-center gap-3">
							<p className="text-sm text-muted-foreground font-mono">
								{trackWorkouts.length} workout(s)
							</p>
							{isOwner && track.ownerTeamId && (
								<AddWorkoutToTrackDialog
									trackId={track.id}
									teamId={track.ownerTeamId}
									onSuccess={handleRefresh}
								/>
							)}
						</div>
					</div>
					<TrackWorkoutList
						trackWorkouts={trackWorkouts}
						onWorkoutRemoved={handleWorkoutRemoved}
					/>
				</div>
			</div>
		</>
	)
}
