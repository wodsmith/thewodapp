import { PageHeader } from "@/components/page-header"
import { getDB } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import {
	getProgrammingTrackById,
	getWorkoutsForTrack,
	hasTrackAccess,
} from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { TrackWorkoutManagement } from "./_components/track-workout-management"

interface TrackWorkoutPageProps {
	params: Promise<{
		teamSlug: string
		trackId: string
	}>
}

export async function generateMetadata({
	params,
}: TrackWorkoutPageProps): Promise<Metadata> {
	const { teamSlug, trackId } = await params
	const db = getDB()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
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
	const { teamSlug, trackId } = await params
	const db = getDB()

	console.log(
		`DEBUG: [TrackWorkout] Loading track workouts for track: ${trackId} in team: ${teamSlug}`,
	)

	// Get team by slug
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
	})

	if (!team) {
		notFound()
	}

	// Check if user has permission to manage programming tracks
	try {
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
		console.log(
			`INFO: [TeamAuth] User authorized for track workout management on teamId '${team.id}' trackId '${trackId}'`,
		)
	} catch (error) {
		console.error(
			`ERROR: [TeamAuth] Unauthorized access attempt for track workout management on teamId '${team.id}' trackId '${trackId}'`,
		)
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
		console.error(
			`ERROR: [TrackAccess] Team '${team.id}' does not have access to track '${trackId}'`,
		)
		notFound()
	}

	// Get track workouts
	const trackWorkouts = await getWorkoutsForTrack(trackId, team.id)

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${teamSlug}`, label: team.name },
					{
						href: `/admin/teams/${teamSlug}/programming`,
						label: "Programming",
					},
					{
						href: `/admin/teams/${teamSlug}/programming/${trackId}`,
						label: track.name,
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2">
							{track.name} - Workout Management
						</h1>
						<p className="text-muted-foreground">
							Manage workouts in the {track.name} track for {team.name}
						</p>
						{track.description && (
							<p className="text-sm text-muted-foreground mt-2">
								{track.description}
							</p>
						)}
					</div>
				</div>

				<div className="bg-card rounded-lg border p-6">
					<Suspense fallback={<div>Loading track workouts...</div>}>
						<TrackWorkoutManagement
							teamId={team.id}
							trackId={trackId}
							track={track}
							initialTrackWorkouts={trackWorkouts}
						/>
					</Suspense>
				</div>
			</div>
		</>
	)
}
