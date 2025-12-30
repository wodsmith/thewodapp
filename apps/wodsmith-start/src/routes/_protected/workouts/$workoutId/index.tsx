import { createFileRoute, Link } from "@tanstack/react-router"
import { format } from "date-fns"
import {
	ArrowLeft,
	Calendar,
	CalendarDays,
	Clock,
	Edit,
	ListChecks,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WorkoutRemixInfo } from "@/components/workout-remix-info"
import { getWorkoutScoresFn, type WorkoutScore } from "@/server-fns/log-fns"
import {
	getWorkoutByIdFn,
	getWorkoutScheduledInstancesFn,
	type WorkoutScheduledInstance,
} from "@/server-fns/workout-fns"
import { getWorkoutRemixInfoFn } from "@/server-fns/workout-remix-fns"

export const Route = createFileRoute("/_protected/workouts/$workoutId/")({
	component: WorkoutDetailPage,
	loader: async ({ params, context }) => {
		const session = context.session
		const teamId = session?.teams?.[0]?.id

		// Fetch workout and remix info in parallel
		const [result, remixInfoResult] = await Promise.all([
			getWorkoutByIdFn({ data: { id: params.workoutId } }),
			getWorkoutRemixInfoFn({ data: { workoutId: params.workoutId } }),
		])

		// Fetch scores and scheduled instances if we have a team
		let scores: WorkoutScore[] = []
		let scheduledInstances: WorkoutScheduledInstance[] = []

		if (teamId && result.workout) {
			const [scoresResult, instancesResult] = await Promise.all([
				getWorkoutScoresFn({
					data: { workoutId: params.workoutId, teamId },
				}),
				getWorkoutScheduledInstancesFn({
					data: { workoutId: params.workoutId, teamId },
				}),
			])
			scores = scoresResult.scores
			scheduledInstances = instancesResult.instances
		}

		return {
			workout: result.workout,
			scores,
			scheduledInstances,
			teamId,
			sourceWorkout: remixInfoResult.sourceWorkout,
			remixCount: remixInfoResult.remixCount,
		}
	},
})

function WorkoutDetailPage() {
	const {
		workout,
		scores,
		scheduledInstances,
		teamId,
		sourceWorkout,
		remixCount,
	} = Route.useLoaderData()

	if (!workout) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">Workout Not Found</h1>
					<p className="text-muted-foreground mb-6">
						The workout you're looking for doesn't exist or has been removed.
					</p>
					<Button asChild>
						<Link to="/workouts" search={{ view: "row", q: "" }}>
							Back to Workouts
						</Link>
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header with back button and actions */}
			<div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Button variant="outline" size="icon" asChild>
						<Link to="/workouts" search={{ view: "row", q: "" }}>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1 className="text-3xl font-bold">{workout.name}</h1>
				</div>
				<div className="flex flex-col sm:flex-row gap-2">
					<Button variant="outline" asChild>
						<Link
							to="/workouts/$workoutId/edit"
							params={{ workoutId: workout.id }}
						>
							<Edit className="h-4 w-4 mr-2" />
							Edit
						</Link>
					</Button>
					<Button asChild>
						<Link
							to="/workouts/$workoutId/schedule"
							params={{ workoutId: workout.id }}
						>
							<Calendar className="h-4 w-4 mr-2" />
							Schedule
						</Link>
					</Button>
				</div>
			</div>

			{/* Workout Details Card */}
			<div className="border-2 border-border rounded-lg">
				{/* Description Section */}
				<div className="border-b-2 border-border p-6">
					<h2 className="text-lg font-semibold mb-4">DESCRIPTION</h2>
					{workout.description ? (
						<p className="whitespace-pre-wrap text-foreground">
							{workout.description}
						</p>
					) : (
						<p className="text-muted-foreground italic">
							No description provided
						</p>
					)}
				</div>

				{/* Metadata Section */}
				<div className="p-6">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{/* Scheme */}
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Clock className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium text-muted-foreground">
									SCHEME
								</span>
							</div>
							<Badge variant="outline" className="text-base">
								{workout.scheme.toUpperCase()}
							</Badge>
						</div>

						{/* Scope */}
						<div>
							<div className="flex items-center gap-2 mb-2">
								<span className="text-sm font-medium text-muted-foreground">
									SCOPE
								</span>
							</div>
							<Badge
								variant={workout.scope === "public" ? "default" : "secondary"}
								className="text-base"
							>
								{workout.scope}
							</Badge>
						</div>

						{/* Score Type */}
						{workout.scoreType && (
							<div>
								<div className="flex items-center gap-2 mb-2">
									<span className="text-sm font-medium text-muted-foreground">
										SCORE TYPE
									</span>
								</div>
								<Badge variant="outline" className="text-base">
									{workout.scoreType}
								</Badge>
							</div>
						)}

						{/* Time Cap */}
						{workout.timeCap && (
							<div>
								<div className="flex items-center gap-2 mb-2">
									<span className="text-sm font-medium text-muted-foreground">
										TIME CAP
									</span>
								</div>
								<Badge variant="outline" className="text-base">
									{workout.timeCap} min
								</Badge>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Remix Info Section */}
			<div className="mt-8">
				<WorkoutRemixInfo
					workoutId={workout.id}
					teamId={teamId}
					sourceWorkout={sourceWorkout}
					remixCount={remixCount}
				/>
			</div>

			{/* Scheduled Instances Section */}
			{scheduledInstances.length > 0 && (
				<div className="mt-8 border-2 border-border rounded-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<CalendarDays className="h-5 w-5" />
							<h2 className="text-lg font-semibold">SCHEDULED DATES</h2>
						</div>
						<Button asChild variant="outline">
							<Link
								to="/workouts/$workoutId/schedule"
								params={{ workoutId: workout.id }}
							>
								<Calendar className="h-4 w-4 mr-2" />
								Schedule Again
							</Link>
						</Button>
					</div>
					<div className="flex flex-wrap gap-2">
						{scheduledInstances.map((instance) => {
							const instanceDate = new Date(instance.scheduledDate)
							const isUpcoming = instanceDate >= new Date()
							const isPast = instanceDate < new Date()

							return (
								<Badge
									key={instance.id}
									variant={isUpcoming ? "default" : "secondary"}
									className="text-sm py-1.5 px-3"
								>
									<Calendar className="h-3.5 w-3.5 mr-1.5" />
									{format(instanceDate, "EEE, MMM d, yyyy")}
									{isPast && (
										<span className="ml-1.5 text-xs opacity-70">(past)</span>
									)}
								</Badge>
							)
						})}
					</div>
				</div>
			)}

			{/* Results Section */}
			<div className="mt-8 border-2 border-border rounded-lg p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<ListChecks className="h-5 w-5" />
						<h2 className="text-lg font-semibold">WORKOUT RESULTS</h2>
					</div>
					<Button asChild>
						<Link to="/log/new" search={{ workoutId: workout.id }}>
							Log Result
						</Link>
					</Button>
				</div>

				{scores.length > 0 ? (
					<div className="space-y-3">
						{scores.map((score) => (
							<ScoreCard key={score.id} score={score} />
						))}
					</div>
				) : (
					<div className="text-center py-8">
						<p className="text-muted-foreground">
							No results logged yet for this workout.
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

function ScoreCard({ score }: { score: WorkoutScore }) {
	const initials = score.userName ? score.userName.charAt(0).toUpperCase() : "U"

	const formattedDate = new Date(score.recordedAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

	return (
		<div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
			{/* User Avatar */}
			<Avatar className="h-10 w-10">
				{score.userAvatar ? (
					<AvatarImage src={score.userAvatar} alt={score.userName || "User"} />
				) : null}
				<AvatarFallback>{initials}</AvatarFallback>
			</Avatar>

			{/* User Name and Date */}
			<div className="flex-1 min-w-0">
				<p className="font-medium truncate">{score.userName || "Anonymous"}</p>
				<p className="text-sm text-muted-foreground">{formattedDate}</p>
			</div>

			{/* Score and Scaling */}
			<div className="text-right">
				<p className="text-lg font-bold font-mono">
					{score.displayScore || "-"}
				</p>
				<div className="flex items-center gap-2 justify-end">
					{score.scalingLabel && (
						<Badge
							variant={score.asRx ? "default" : "secondary"}
							className="text-xs"
						>
							{score.scalingLabel}
						</Badge>
					)}
				</div>
			</div>

			{/* Edit Button */}
			<Button variant="ghost" size="icon" asChild>
				<Link to="/log/$id/edit" params={{ id: score.id }}>
					<Edit className="h-4 w-4" />
					<span className="sr-only">Edit result</span>
				</Link>
			</Button>
		</div>
	)
}
