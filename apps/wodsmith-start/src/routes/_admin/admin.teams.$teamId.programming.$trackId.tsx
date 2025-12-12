import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable, programmingTracksTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import { TrackHeader } from "./-components/track-header"
import { TrackWorkoutManagement } from "./-components/track-workout-management"
import { Suspense } from "react"

// TODO: Implement full data fetching with permissions
// Need to create: programming-tracks.server, movements.server, tags.server, workouts.server

const getTrackWorkoutPageData = createServerFn({ method: "GET" }).handler(
	async ({ data }: { data: { teamId: string; trackId: string } }) => {
		const db = getDb()
		const { teamId, trackId } = data

		// Get team by ID
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Get track details
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.id, trackId),
		})

		if (!track) {
			throw new Error("Track not found")
		}

		// Placeholder data
		return {
			team,
			track,
			trackWorkouts: [],
			userWorkouts: [],
			movements: [],
			tags: [],
			scalingGroupName: null,
			isOwner: true,
			userId: "placeholder",
		}
	}
)

export const Route = createFileRoute(
	"/_admin/admin/teams/$teamId/programming/$trackId"
)({
	loader: async ({ params }) => {
		return getTrackWorkoutPageData({
			data: { teamId: params.teamId, trackId: params.trackId },
		})
	},
	component: TrackWorkoutPage,
})

function TrackWorkoutPage() {
	const {
		team,
		track,
		trackWorkouts,
		userWorkouts,
		movements,
		tags,
		scalingGroupName,
		isOwner,
		userId,
	} = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/programming`,
						label: "Programming",
					},
					{
						href: `/admin/teams/${team.id}/programming/${track.id}`,
						label: track.name,
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<TrackHeader
					teamId={team.id}
					teamName={team.name}
					track={track}
					scalingGroupName={scalingGroupName}
					isOwner={isOwner}
				/>

				<div className="bg-card border-4 border-primary rounded-none p-6">
					<Suspense
						fallback={
							<div className="font-mono">Loading track workouts...</div>
						}
					>
						<TrackWorkoutManagement
							teamId={team.id}
							trackId={track.id}
							_track={track}
							initialTrackWorkouts={trackWorkouts}
							userWorkouts={userWorkouts}
							movements={movements}
							tags={tags}
							userId={userId}
							isOwner={isOwner}
						/>
					</Suspense>
				</div>
			</div>
		</>
	)
}
