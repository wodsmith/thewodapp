import { PageHeader } from "@/components/page-header"
import { getDB } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getAllMovements } from "@/server/movements"
import {
	getProgrammingTrackById,
	getWorkoutsForTrack,
	hasTrackAccess,
} from "@/server/programming-tracks"
import { getAllTags } from "@/server/tags"
import { getUserWorkoutsWithTrackScheduling } from "@/server/workouts"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { TrackVisibilitySelector } from "./_components/track-visibility-selector"
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
	const db = getDB()

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
	const db = getDB()

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
	} catch (error) {
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
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2 font-mono tracking-tight">
							{track.name} - Workout Management
						</h1>
						<p className="text-muted-foreground font-mono">
							Manage workouts in the {track.name} track for {team.name}
						</p>
						{track.description && (
							<p className="text-sm text-muted-foreground mt-2 font-mono">
								{track.description}
							</p>
						)}
					</div>
					<div className="flex flex-col items-end space-y-2">
						<TrackVisibilitySelector teamId={team.id} track={track} />
					</div>
				</div>

				<div className="bg-card border-4 border-primary rounded-none p-6">
					<Suspense
						fallback={
							<div className="font-mono">Loading track workouts...</div>
						}
					>
						<TrackWorkoutManagement
							teamId={team.id}
							trackId={trackId}
							track={track}
							initialTrackWorkouts={trackWorkouts}
							userWorkouts={userWorkouts}
							movements={movements}
							tags={tags}
							userId={session.userId}
						/>
					</Suspense>
				</div>
			</div>
		</>
	)
}
