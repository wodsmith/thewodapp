import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { getDd } from "@/db"
import { scalingGroupsTable, TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getAllMovements } from "@/server/movements"
import {
	getProgrammingTrackById,
	getWorkoutsForTrack,
	hasTrackAccess,
	isTrackOwner,
} from "@/server/programming-tracks"
import { getAllTags } from "@/server/tags"
import { getUserWorkoutsWithTrackScheduling } from "@/server/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import { TrackHeader } from "./_components/track-header"
import { TrackWorkoutManagement } from "./_components/track-workout-management"

interface TrackWorkoutPageProps {
	params: Promise<{
		teamId: string
		trackId: string
	}>
}

export async function generateMetadata({
	params,
}: TrackWorkoutPageProps): Promise<Metadata> {
	const { teamId, trackId } = await params
	const db = getDd()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	const track = await getProgrammingTrackById(trackId)

	if (!team || !track) {
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
	const { teamId, trackId } = await params
	const db = getDd()

	// Get team by slug
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		notFound()
	}

	// Check if user has permission to manage programming tracks
	try {
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
	} catch (_error) {
		notFound()
	}

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
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		notFound()
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

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${teamId}`, label: team.name },
					{
						href: `/admin/teams/${teamId}/programming`,
						label: "Programming",
					},
					{
						href: `/admin/teams/${teamId}/programming/${trackId}`,
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
