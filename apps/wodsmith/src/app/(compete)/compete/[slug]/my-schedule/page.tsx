import "server-only"

import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getDb } from "@/db"
import { getCompetition } from "@/server/competitions"
import { getRotationsForJudge } from "@/server/judge-rotations"
import { getSessionFromCookie } from "@/utils/auth"
import { ScheduleView } from "./_components/schedule-view"

type Props = {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `My Schedule - ${competition.name}`,
		description: `View your judging assignments for ${competition.name}`,
	}
}

/**
 * Volunteer-facing schedule page showing their judge assignments
 * Protected route - requires session and competition team membership
 */
export default async function MySchedulePage({ params }: Props) {
	const { slug } = await params

	// Get session - redirect to login if not authenticated
	const session = await getSessionFromCookie()
	if (!session) {
		redirect(`/login?callbackUrl=/compete/${slug}/my-schedule`)
	}

	const competition = await getCompetition(slug)
	if (!competition) {
		notFound()
	}

	// Check if competition has team
	if (!competition.competitionTeamId) {
		return (
			<div className="mx-auto max-w-2xl py-8">
				<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
					<h1 className="text-2xl font-bold mb-2">Schedule Not Available</h1>
					<p>The schedule is not available for this competition.</p>
				</div>
			</div>
		)
	}

	const db = getDb()

	// Get user's membership in the competition team
	const membership = await db.query.teamMembershipTable.findFirst({
		where: (teamMembershipTable, { and, eq }) =>
			and(
				eq(teamMembershipTable.teamId, competition.competitionTeamId),
				eq(teamMembershipTable.userId, session.userId),
			),
	})

	if (!membership) {
		return (
			<div className="mx-auto max-w-2xl py-8">
				<div className="bg-muted rounded-lg border p-6">
					<h1 className="text-2xl font-bold mb-2">Not Registered</h1>
					<p>
						You must be registered for this competition to view your judging
						schedule.
					</p>
				</div>
			</div>
		)
	}

	// Get rotations for this judge
	const rotations = await getRotationsForJudge(
		db,
		membership.id,
		competition.id,
	)

	// Enrich rotations with event name and time information
	const enrichedRotations = await Promise.all(
		rotations.map(async (rotation) => {
			// Fetch track workout
			const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
				where: (trackWorkoutsTable, { eq }) =>
					eq(trackWorkoutsTable.id, rotation.trackWorkoutId),
			})

			if (!trackWorkout) {
				return null
			}

			// Fetch workout separately
			const workout = await db.query.workouts.findFirst({
				where: (workouts, { eq }) => eq(workouts.id, trackWorkout.workoutId),
			})

			if (!workout) {
				return null
			}

			// Fetch heats for time calculation
			const heats = await db.query.competitionHeatsTable.findMany({
				where: (competitionHeatsTable, { eq }) =>
					eq(competitionHeatsTable.trackWorkoutId, rotation.trackWorkoutId),
				orderBy: (competitionHeatsTable, { asc }) => [
					asc(competitionHeatsTable.heatNumber),
				],
			})

			// Calculate time window
			let timeWindow: string | null = null
			const startHeat = heats.find(
				(h) => h.heatNumber === rotation.startingHeat,
			)
			const endHeatNumber = rotation.startingHeat + rotation.heatsCount - 1
			const endHeat = heats.find((h) => h.heatNumber === endHeatNumber)

			if (startHeat?.scheduledTime && endHeat?.durationMinutes) {
				const startTime = new Date(startHeat.scheduledTime)
				const endTime = new Date(
					startTime.getTime() + endHeat.durationMinutes * 60000,
				)
				timeWindow = `${formatTime(startTime)} - ${formatTime(endTime)}`
			}

			// Check if upcoming
			const isUpcoming = startHeat?.scheduledTime
				? new Date(startHeat.scheduledTime) > new Date()
				: false

			return {
				rotation,
				eventName: workout.name,
				timeWindow,
				isUpcoming,
			}
		}),
	)

	// Filter out any null entries (shouldn't happen but type safety)
	const validRotations = enrichedRotations.filter(
		(r): r is NonNullable<typeof r> => r !== null,
	)

	return (
		<div className="mx-auto max-w-4xl py-8 px-4">
			<ScheduleView
				rotations={validRotations}
				competitionName={competition.name}
			/>
		</div>
	)
}

/**
 * Format time in 12-hour format (e.g., "2:00 PM")
 */
function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}
