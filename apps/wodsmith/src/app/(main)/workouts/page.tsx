import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
import { PaginationWithUrl } from "@/components/ui/pagination"
import {
	getScheduledWorkoutsForTeam,
	type ScheduledWorkoutInstanceWithDetails,
} from "@/server/scheduling-service"
import { getWorkoutResultsForScheduledInstances } from "@/server/workout-results"
import { getActiveOrPersonalTeamId, requireVerifiedEmail } from "@/utils/auth"
import type { KVSession } from "@/utils/kv-session"
import WorkoutRowCard from "../../../components/WorkoutRowCard"
import { TeamWorkoutsDisplay } from "./_components/team-workouts-display"
import WorkoutControls from "./_components/WorkoutControls"

export const metadata: Metadata = {
	title: "Explore Workouts",
	description: "Browse and track your CrossFit workouts.",
	openGraph: {
		type: "website",
		title: "Explore Workouts",
		description: "Browse and track your CrossFit workouts.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Explore Workouts")}`,
				width: 1200,
				height: 630,
				alt: "Explore Workouts",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Explore Workouts",
		description: "Browse and track your CrossFit workouts.",
		images: [`/api/og?title=${encodeURIComponent("Explore Workouts")}`],
	},
}

export default async function WorkoutsPage({
	searchParams,
}: {
	searchParams?: Promise<{
		search?: string
		tag?: string
		movement?: string
		type?: string
		trackId?: string
		page?: string
	}>
}) {
	let session: KVSession | null = null
	try {
		session = await requireVerifiedEmail()
	} catch (_error) {
		console.log("[workouts/page] No user found")
		redirect("/sign-in")
	}

	if (!session?.user?.id) {
		console.log("[workouts/page] No user found")
		redirect("/sign-in")
	}

	// Get user's active team ID (or fallback to personal team)
	const activeTeamId = await getActiveOrPersonalTeamId(session.user.id)

	// Get active team info from session
	const activeTeam = session.teams?.find((team) => team.id === activeTeamId)
	const activeTeams = activeTeam ? [activeTeam] : []

	// Get all programming tracks the user has access to through their active team
	const { getUserProgrammingTracks } = await import("@/server/programming")
	const userProgrammingTracks = await getUserProgrammingTracks([activeTeamId])

	// Fetch initial scheduled workouts for a wider range to handle timezone differences
	// This ensures we capture "today" for all possible user timezones
	const now = new Date()
	// Get yesterday at start in UTC (covers users ahead of UTC)
	const startDate = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - 1,
			0,
			0,
			0,
			0,
		),
	)
	// Get tomorrow at end in UTC (covers users behind UTC)
	const endDate = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() + 1,
			23,
			59,
			59,
			999,
		),
	)

	const dateRange = {
		start: startDate,
		end: endDate,
	}

	const initialScheduledWorkouts: Record<
		string,
		ScheduledWorkoutInstanceWithDetails[]
	> = {}

	// Fetch scheduled workouts for the active team with error handling
	try {
		const scheduledWorkouts = await getScheduledWorkoutsForTeam(
			activeTeamId,
			dateRange,
		)

		// Prepare instances for result fetching
		const instances = scheduledWorkouts.map((workout) => ({
			id: workout.id,
			scheduledDate: workout.scheduledDate,
			workoutId:
				workout.trackWorkout?.workoutId || workout.trackWorkout?.workout?.id,
		}))

		// Fetch results for all instances
		const workoutResults = await getWorkoutResultsForScheduledInstances(
			instances,
			session.user.id,
		)

		// Attach results to scheduled workouts
		const workoutsWithResults = scheduledWorkouts.map((workout) => ({
			...workout,
			result: workout.id ? workoutResults[workout.id] || null : null,
		}))

		initialScheduledWorkouts[activeTeamId] = workoutsWithResults
	} catch (error) {
		console.error(`Failed to fetch workouts for team ${activeTeamId}:`, error)
		initialScheduledWorkouts[activeTeamId] = []
	}

	const mySearchParams = await searchParams
	const parsedPage = Number.parseInt(mySearchParams?.page || "1", 10)
	const currentPage =
		Number.isFinite(parsedPage) &&
		Number.isInteger(parsedPage) &&
		parsedPage >= 1
			? parsedPage
			: 1

	// Pass all filters to the server action
	const [result, error] = await getUserWorkoutsAction({
		teamId: [activeTeamId],
		page: currentPage,
		pageSize: 50,
		search: mySearchParams?.search,
		tag: mySearchParams?.tag,
		movement: mySearchParams?.movement,
		type: mySearchParams?.type as "all" | "original" | "remix" | undefined,
		trackId: mySearchParams?.trackId,
	})

	if (error || !result?.success) {
		return notFound()
	}

	const workouts = result.data
	const { totalCount } = result

	// Don't filter for "today" on server side since server runs in UTC
	// Pass all workouts and let client filter based on local timezone

	// Fetch all available tags and movements for filter dropdowns
	const { getAvailableWorkoutTags, getAvailableWorkoutMovements } =
		await import("@/server/workouts")
	const [allTags, allMovements] = await Promise.all([
		getAvailableWorkoutTags(activeTeamId), // Use active team ID for filter options
		getAvailableWorkoutMovements(activeTeamId), // Use active team ID for filter options
	])
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
				teams={activeTeams}
				initialScheduledWorkouts={initialScheduledWorkouts}
				userId={session.user.id}
			/>

			{/* Workout of the Day section removed - date filtering needs to happen client-side */}

			<WorkoutControls
				allTags={allTags}
				allMovements={allMovements}
				programmingTracks={userProgrammingTracks}
			/>
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

			{totalCount > 50 && (
				<PaginationWithUrl
					totalItems={totalCount}
					pageSize={50}
					className="mt-8"
				/>
			)}
		</div>
	)
}
