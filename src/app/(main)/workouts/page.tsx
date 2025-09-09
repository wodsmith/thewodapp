import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
import { requireVerifiedEmail } from "@/utils/auth"
import { getUserTeams } from "@/server/teams"
import { getWorkoutResultsForScheduledInstances } from "@/server/workout-results"
import WorkoutRowCard from "../../../components/WorkoutRowCard"
import WorkoutControls from "./_components/WorkoutControls"
import { TeamWorkoutsDisplay } from "./_components/team-workouts-display"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "Spicy Wod | Explore Workouts",
	description: "Track your spicy workouts and progress.",
	openGraph: {
		title: "Spicy Wod | Explore Workouts", // Default title for layout
		description: "Track your spicy workouts and progress.", // Default description
		images: [
			{
				url: `/api/og?title=${encodeURIComponent(
					"Spicy Wod | Explore Workouts",
				)}`,
				width: 1200,
				height: 630,
				alt: "Spicy Wod | Explore Workouts",
			},
		],
	},
}

export default async function WorkoutsPage({
	searchParams,
}: {
	searchParams?: Promise<{ search?: string; tag?: string; movement?: string }>
}) {
	const session = await requireVerifiedEmail()

	if (!session || !session?.user?.id) {
		console.log("[workouts/page] No user found")
		redirect("/sign-in")
	}

	// Get user's personal team ID
	const { getUserPersonalTeamId } = await import("@/server/user")
	const teamId = await getUserPersonalTeamId(session.user.id)

	// Get user's teams for team workouts display
	const userTeams = await getUserTeams()

	// Get scheduled workouts for today
	// Note: Server runs in UTC, so we need to fetch a wider range and filter on client
	const { getScheduledWorkoutsForTeam } = await import(
		"@/server/scheduling-service"
	)
	// Fetch 2 days worth of data to account for timezone differences
	// Client will filter to actual local date
	const now = new Date()
	const todayDate = new Date(now)
	todayDate.setUTCHours(0, 0, 0, 0)
	todayDate.setUTCDate(todayDate.getUTCDate() - 1) // Start from yesterday UTC
	const tomorrowDate = new Date(now)
	tomorrowDate.setUTCHours(23, 59, 59, 999)
	tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1) // End at tomorrow UTC

	const scheduledWorkoutsPromises = userTeams.map(async (team) => ({
		teamId: team.id,
		workouts: await getScheduledWorkoutsForTeam(team.id, {
			start: todayDate,
			end: tomorrowDate,
		}),
	}))

	const allScheduledWorkouts = await Promise.all(scheduledWorkoutsPromises)

	// Fetch workout results for all scheduled instances
	const allInstances: Array<{
		id: string
		scheduledDate: Date
		workoutId?: string
	}> = []
	for (const { workouts } of allScheduledWorkouts) {
		for (const workout of workouts) {
			if (workout.id && workout.scheduledDate) {
				allInstances.push({
					id: workout.id,
					scheduledDate: workout.scheduledDate,
					workoutId:
						workout.trackWorkout?.workoutId ||
						workout.trackWorkout?.workout?.id,
				})
			}
		}
	}

	const workoutResults = await getWorkoutResultsForScheduledInstances(
		allInstances,
		session.user.id,
	)

	// Attach results to scheduled workouts
	const scheduledWorkoutsMap = allScheduledWorkouts.reduce(
		(acc, { teamId, workouts }) => {
			acc[teamId] = workouts.map((workout) => ({
				...workout,
				result: workout.id ? workoutResults[workout.id] || null : null,
			}))
			return acc
		},
		{} as Record<string, any[]>,
	)

	const mySearchParams = await searchParams
	const [result, error] = await getUserWorkoutsAction({
		teamId,
	})

	if (error || !result?.success) {
		return notFound()
	}

	const allWorkouts = result.data
	const searchTerm = mySearchParams?.search?.toLowerCase() || ""
	const selectedTag = mySearchParams?.tag || ""
	const selectedMovement = mySearchParams?.movement || ""
	const workouts = allWorkouts.filter((workout) => {
		const nameMatch = workout.name.toLowerCase().includes(searchTerm)
		const descriptionMatch = workout.description
			?.toLowerCase()
			.includes(searchTerm)
		const movementSearchMatch = workout.movements.some((movement) =>
			movement?.name?.toLowerCase().includes(searchTerm),
		)
		const tagSearchMatch = workout.tags.some((tag) =>
			tag.name.toLowerCase().includes(searchTerm),
		)
		const searchFilterPassed = searchTerm
			? nameMatch || descriptionMatch || movementSearchMatch || tagSearchMatch
			: true
		const tagFilterPassed = selectedTag
			? workout.tags.some((tag) => tag.name === selectedTag)
			: true
		const movementFilterPassed = selectedMovement
			? workout.movements.some(
					(movement) => movement?.name === selectedMovement,
				)
			: true
		return searchFilterPassed && tagFilterPassed && movementFilterPassed
	})

	// Don't filter for "today" on server side since server runs in UTC
	// Pass all workouts and let client filter based on local timezone

	// Extract unique tags and movements for filter dropdowns
	const allTags = [
		...new Set(
			allWorkouts.flatMap((workout) => workout.tags.map((tag) => tag.name)),
		),
	].sort() as string[]
	const allMovements = [
		...new Set(
			allWorkouts.flatMap((workout) =>
				workout.movements.map((m) => m?.name).filter(Boolean),
			),
		),
	].sort() as string[]
	return (
		<div>
			<div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
				<h1 className="text-4xl font-bold mb-6 tracking-tight">WORKOUTS</h1>
				<Button asChild>
					<Link
						href="/workouts/new"
						className="btn flex w-fit items-center gap-2"
					>
						<Plus className="h-5 w-5" />
						Create Workout
					</Link>
				</Button>
			</div>

			{/* Team Workouts Section */}
			<TeamWorkoutsDisplay
				className="mb-12"
				teams={userTeams}
				initialScheduledWorkouts={scheduledWorkoutsMap}
			/>

			{/* Workout of the Day section removed - date filtering needs to happen client-side */}

			<WorkoutControls allTags={allTags} allMovements={allMovements} />
			<ul className="space-y-4">
				{workouts.map((workout) => (
					<WorkoutRowCard
						key={workout.id}
						workout={workout}
						movements={workout.movements}
						tags={workout.tags}
						result={workout.resultsToday?.[0]}
					/>
				))}
			</ul>
		</div>
	)
}
