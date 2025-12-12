import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import {
	teamTable,
	scalingGroupsTable,
	TEAM_PERMISSIONS,
} from "~/db/schema.server"
import { requireTeamPermission } from "~/utils/team-auth.server"
import { getSessionFromCookie } from "~/utils/auth.server"
import {
	getProgrammingTrackById,
	getWorkoutsForTrack,
	hasTrackAccess,
	isTrackOwner,
} from "~/server/programming-tracks.server"
import { getAllMovements } from "~/server/movements.server"
import { getAllTags } from "~/server/tags.server"
import { getUserWorkoutsWithTrackScheduling } from "~/server/workouts.server"
import { PageHeader } from "~/components/page-header"
import { TrackHeader } from "./_components/track-header"
import { TrackWorkoutManagement } from "./_components/track-workout-management"
import { Suspense } from "react"

const getTrackWorkoutPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string, trackId: string) => {
		const db = getDb()

		// Get team by ID
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Check if user has permission to manage programming tracks
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Get track details
		const track = await getProgrammingTrackById(trackId)
		if (!track) {
			throw new Error("Track not found")
		}

		// Check if team has access to this track
		const trackAccess = await hasTrackAccess(team.id, trackId)
		if (!trackAccess) {
			throw new Error("Team does not have access to this track")
		}

		// Check if team owns this track (for edit permissions)
		const isOwner = await isTrackOwner(team.id, trackId)

		// Get track workouts
		const trackWorkouts = await getWorkoutsForTrack(trackId, team.id)

		// Get user's available workouts for adding to track
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const userWorkouts = await getUserWorkoutsWithTrackScheduling({
			trackId,
			teamId: team.id,
		})

		// Get movements and tags for workout creation
		const movements = await getAllMovements()
		const tags = await getAllTags()

		// Get scaling group name if the track has one
		let scalingGroupName: string | null = null
		if (track.scalingGroupId) {
			const scalingGroup = await db.query.scalingGroupsTable.findFirst({
				where: eq(scalingGroupsTable.id, track.scalingGroupId),
			})
			scalingGroupName = scalingGroup?.title ?? null
		}

		return {
			team,
			track,
			trackWorkouts,
			userWorkouts,
			movements,
			tags,
			scalingGroupName,
			isOwner,
			userId: session.userId,
		}
	}
)

export const Route = createFileRoute(
	"/_admin/admin/teams/$teamId/programming/$trackId"
)({
	loader: async ({ params }) => {
		return getTrackWorkoutPageData(params.teamId, params.trackId)
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
