import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { getDb } from "@/db"
import { scalingGroupsTable, TEAM_PERMISSIONS } from "@/db/schema"
import { getAllMovements } from "@/server/movements"
import {
	getProgrammingTrackById,
	getWorkoutsForTrack,
	hasTrackAccess,
	isTrackOwner,
} from "@/server/programming-tracks"
import { getAllTags } from "@/server/tags"
import { getUserWorkoutsWithTrackScheduling } from "@/server/workouts"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../_utils/get-team-context"
import { TrackHeader } from "../../[teamId]/programming/[trackId]/_components/track-header"
import { TrackWorkoutManagement } from "../../[teamId]/programming/[trackId]/_components/track-workout-management"

interface TrackWorkoutPageProps {
	params: Promise<{
		trackId: string
	}>
}

export async function generateMetadata({
	params,
}: TrackWorkoutPageProps): Promise<Metadata> {
	const { team } = await getAdminTeamContext()
	const { trackId } = await params

	const track = await getProgrammingTrackById(trackId)

	if (!track) {
		return {
			title: "Track Not Found",
		}
	}

	return {
		title: `${team.name} - ${track.name} - Track Workouts`,
		description: `Manage workouts for ${track.name} track in ${team.name}`,
	}
}

export default async function TrackWorkoutPage({
	params,
}: TrackWorkoutPageProps) {
	const { teamId, team, session } = await getAdminTeamContext()
	const { trackId } = await params
	const db = getDb()

	// Check if user has permission to manage programming tracks
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get track details
	const track = await getProgrammingTrackById(trackId)
	if (!track) {
		notFound()
	}

	// Check if team has access to this track
	const trackAccess = await hasTrackAccess(team.id, trackId)
	if (!trackAccess) {
		notFound()
	}

	// Check if team owns this track (for edit permissions)
	const isOwner = await isTrackOwner(team.id, trackId)

	// Get track workouts
	const trackWorkouts = await getWorkoutsForTrack(trackId, team.id)

	// Get user's available workouts for adding to track
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

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: team.name },
					{
						href: "/admin/teams/programming",
						label: "Programming",
					},
					{
						href: `/admin/teams/programming/${trackId}`,
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
							trackId={trackId}
							_track={track}
							initialTrackWorkouts={trackWorkouts}
							userWorkouts={userWorkouts}
							movements={movements}
							tags={tags}
							userId={session.userId}
							isOwner={isOwner}
						/>
					</Suspense>
				</div>
			</div>
		</>
	)
}
