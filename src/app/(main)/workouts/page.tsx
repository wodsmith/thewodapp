import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getUserWorkoutsAction } from "@/actions/workout-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireVerifiedEmail } from "@/utils/auth"
import WorkoutRowCard from "../../../components/WorkoutRowCard"
import WorkoutControls from "./_components/WorkoutControls"

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
		redirect("/login")
	}

	const mySearchParams = await searchParams
	const [result, error] = await getUserWorkoutsAction({
		userId: session.user.id,
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

	// Get today's date for filtering
	const today = new Date()
	today.setHours(0, 0, 0, 0) // Normalize to start of day for comparison

	const todaysWorkouts = allWorkouts.filter((workout) => {
		if (!workout.createdAt) return false
		const workoutDate = new Date(workout.createdAt)
		workoutDate.setHours(0, 0, 0, 0) // Normalize to start of day
		return workoutDate.getTime() === today.getTime()
	})

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
				<h1 className="mb-4">WORKOUTS</h1>
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

			{todaysWorkouts.length > 0 && (
				<div className="mb-12">
					<h2 className="mb-4 border-b pb-2 text-center font-bold text-2xl sm:text-left">
						Workout{todaysWorkouts.length > 1 ? "s" : ""} of the Day
					</h2>
					<div className="space-y-6">
						{todaysWorkouts.map((workout) => (
							<div key={workout.id} className="card p-6">
								<div className="flex flex-col items-start justify-between sm:flex-row">
									<Link href={`/workouts/${workout.id}`}>
										<h3 className="mb-2 font-semibold text-xl underline">
											{workout.name}
										</h3>
									</Link>
									<Button asChild variant="secondary">
										<Link
											href={{
												pathname: "/log/new",
												query: {
													workoutId: workout.id,
													redirectUrl: "/workouts",
												},
											}}
											className="btn btn-primary btn-sm mb-2"
										>
											Log Result
										</Link>
									</Button>
								</div>
								<p className="mb-1 text-muted-foreground text-sm">
									Created:{" "}
									{workout.createdAt
										? workout.createdAt.toLocaleDateString()
										: "N/A"}
								</p>
								{workout.description && (
									<p className="mb-4 whitespace-pre-wrap text-md">
										{workout.description}
									</p>
								)}
								{workout.movements && workout.movements.length > 0 && (
									<div className="mb-4">
										<h4 className="mb-1 font-semibold">Movements:</h4>
										<div className="flex flex-wrap gap-2">
											{workout.movements.map((movement) => (
												<Badge
													key={movement?.id || movement?.name}
													variant="secondary"
													clickable
												>
													<Link href={`/movements/${movement?.id}`}>
														{movement?.name}
													</Link>
												</Badge>
											))}
										</div>
									</div>
								)}

								{/* Display Today's Results if any */}
								{workout.resultsToday && workout.resultsToday.length > 0 && (
									<div className="mt-4 border-gray-200 border-t pt-4">
										<h4 className="mb-2 font-semibold text-secondary-foreground text-sm uppercase">
											Your Logged Result
											{workout.resultsToday.length > 1 ? "s" : ""} for Today:
										</h4>
										<div className="space-y-3">
											{workout.resultsToday.map((result) => (
												<div
													key={result.id}
													className="w-fit border border-card-foreground bg-card p-3"
												>
													<div className="flex items-center justify-between gap-4">
														<p className="font-bold text-foreground text-lg">
															{result.wodScore}
														</p>
														{result.scale && (
															<Badge variant={result.scale}>
																{result.scale.toUpperCase()}
															</Badge>
														)}
													</div>
													{result.notes && (
														<p className="mt-1 text-secondary-foreground text-sm italic">
															Notes: {result.notes}
														</p>
													)}
													{/* Consider adding a link to view/edit the specific log entry if needed */}
												</div>
											))}
										</div>
									</div>
								)}
								{/* Optionally, add more details like tags if needed */}
							</div>
						))}
					</div>
				</div>
			)}

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
