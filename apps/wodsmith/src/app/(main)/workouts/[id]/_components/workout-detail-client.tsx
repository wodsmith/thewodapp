"use client"

import {
	ArrowLeft,
	Calendar,
	Clock,
	Dumbbell,
	Edit,
	FolderPlus,
	ListChecks,
	PencilIcon,
	Shuffle,
	Tag as TagIcon,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { Suspense, useEffect, useRef } from "react"
import { MovementsList } from "@/components/movements-list"
import { WorkoutScalingDisplay } from "@/components/scaling/workout-scaling-display"
import { Badge } from "@/components/ui/badge"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import type {
	ResultSet,
	WorkoutResult,
	WorkoutWithTagsAndMovements,
} from "@/types"
import { SetDetails } from "./set-details"
import { WorkoutScheduleHistory } from "./workout-schedule-history"

// Define a new type for scores with their rounds and scaling labels
export type WorkoutResultWithSets = WorkoutResult & {
	sets: ResultSet[] | null
	scalingLevelLabel?: string
	scalingLevelPosition?: number
	/** Decoded score for display */
	displayScore?: string
}

export default function WorkoutDetailClient({
	canEdit,
	sourceWorkout,
	workout,
	workoutId,
	resultsWithSets, // Changed from results and resultSetDetails
	remixedWorkouts = [],
	scheduleHistory = [],
}: {
	canEdit: boolean
	sourceWorkout?: {
		id: string
		name: string
		teamName?: string
	} | null
	workout: WorkoutWithTagsAndMovements
	workoutId: string
	resultsWithSets: WorkoutResultWithSets[] // Use the new type
	remixedWorkouts?: Array<{
		id: string
		name: string
		description: string
		scheme: string
		scope: string
		createdAt: Date
		teamId: string | null
		teamName: string
	}>
	scheduleHistory?: Array<{
		id: string
		scheduledDate: Date
		teamId: string
		teamName: string
		workoutId: string
		workoutName: string
		isRemix: boolean
	}>
}) {
	const searchParams = useSearchParams()
	const redirectUrl = searchParams.get("redirectUrl")
	const hasTrackedView = useRef(false)

	// Track workout view on mount (only once per component lifecycle)
	useEffect(() => {
		if (workout && !hasTrackedView.current) {
			hasTrackedView.current = true
			posthog.capture("workout_viewed", {
				workout_id: workoutId,
				workout_name: workout.name,
				workout_scheme: workout.scheme,
				is_remixed: !!sourceWorkout,
			})
		}
	}, [workout, workoutId, sourceWorkout])

	if (!workout) return <div>Loading...</div>

	// Helper to format date
	const formatDate = (timestamp: number | Date | null) => {
		if (!timestamp) return "N/A"
		return new Date(timestamp).toLocaleDateString()
	}

	// Helper to format score type
	const formatScoreType = (scoreType: string | null | undefined) => {
		if (!scoreType) return null
		switch (scoreType) {
			case "min":
				return "Min"
			case "max":
				return "Max"
			case "sum":
				return "Sum"
			case "average":
				return "Average"
			case "first":
				return "First"
			case "last":
				return "Last"
			default:
				return scoreType
		}
	}

	// Helper to parse breadcrumb items from redirect URL
	const getBreadcrumbItems = () => {
		if (!redirectUrl) return null

		// Parse URL pattern: /admin/teams/programming/{trackId}
		const urlMatch = redirectUrl.match(/\/admin\/teams\/programming\/([^/]+)/)
		if (urlMatch) {
			const [, trackId] = urlMatch
			return {
				trackId,
				redirectUrl: redirectUrl as string,
			}
		}
		return null
	}

	const breadcrumbData = getBreadcrumbItems()

	return (
		<div>
			{breadcrumbData && (
				<div className="mb-6">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link href="/admin">Admin</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link href="/admin/teams">Team</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link href={breadcrumbData.redirectUrl as Route}>
										Programming Track
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>{workout.name}</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			)}

			<div className="mb-6 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<Link
						href={(breadcrumbData?.redirectUrl as Route) || "/workouts"}
						className="btn-outline sm:p-2 dark:border-dark-border dark:text-dark-foreground dark:hover:bg-dark-accent dark:hover:text-dark-accent-foreground"
					>
						<ArrowLeft className="h-5 w-5" />
					</Link>
					<h1>{workout.name}</h1>
				</div>
				<div className="flex flex-col sm:flex-row gap-2">
					{canEdit && (
						<Link
							href={`/workouts/${workoutId}/edit`}
							className="btn flex items-center gap-2 dark:border-dark-border dark:bg-dark-primary dark:text-dark-primary-foreground dark:hover:bg-dark-primary/90"
						>
							<Edit className="h-5 w-5" />
							Edit Workout
						</Link>
					)}
					<Link
						href={`/workouts/${workoutId}/schedule`}
						className="btn flex items-center gap-2 dark:border-dark-border dark:bg-dark-primary dark:text-dark-primary-foreground dark:hover:bg-dark-primary/90"
					>
						<Calendar className="h-5 w-5" />
						Schedule
					</Link>
					<Link
						href={`/workouts/${workoutId}/add-to-track`}
						className="btn flex items-center gap-2 dark:border-dark-border dark:bg-dark-primary dark:text-dark-primary-foreground dark:hover:bg-dark-primary/90"
					>
						<FolderPlus className="h-5 w-5" />
						Add to Track
					</Link>
					{/* Always show remix button so users can create remixes of their own workouts */}
					<Link
						href={`/workouts/${workoutId}/edit?remix=true`}
						className="btn flex items-center gap-2 dark:border-dark-border dark:bg-dark-secondary dark:text-dark-secondary-foreground dark:hover:bg-dark-secondary/90"
					>
						<Shuffle className="h-5 w-5" />
						Create Remix
					</Link>
				</div>
			</div>

			{/* Source Workout Information */}
			{sourceWorkout && (
				<div className="mb-6 border-2 border-orange-500 bg-orange-50 p-4 dark:border-orange-600 dark:bg-orange-950">
					<div className="flex items-center gap-2 mb-2">
						<Shuffle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
						<h3 className="font-bold text-orange-800 text-lg dark:text-orange-200">
							This is a remix
						</h3>
					</div>
					<p className="text-orange-700 dark:text-orange-300">
						This workout is based on{" "}
						<Link
							href={`/workouts/${sourceWorkout.id}`}
							className="font-semibold underline hover:no-underline"
						>
							"{sourceWorkout.name}"
						</Link>
						{sourceWorkout.teamName && (
							<span> by {sourceWorkout.teamName}</span>
						)}
					</p>
				</div>
			)}

			<div className="mt-4 mb-6 border-2 border-black dark:border-dark-border rounded">
				{/* Workout Details Section */}
				<div className="border-black border-b-2 p-6 dark:border-dark-border">
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<h2 className="mb-4">DESCRIPTION</h2>
							<WorkoutScalingDisplay
								workoutDescription={workout.description || ""}
								scalingLevels={workout.scalingLevels}
								scalingDescriptions={workout.scalingDescriptions}
								showToggle={
									!!workout.scalingLevels && workout.scalingLevels.length > 0
								}
								className="mb-6"
							/>
						</div>

						<div className="">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="my-4 flex items-center gap-2">
										<Clock className="h-5 w-5" />
										<h3>SCHEME</h3>
									</div>
									<Badge variant="outline" className="text-lg">
										{workout.scheme}
									</Badge>
								</div>
								{canEdit && workout.scoreType && (
									<div>
										<div className="my-4 flex items-center gap-2">
											<ListChecks className="h-5 w-5" />
											<h3>SCORE TYPE</h3>
										</div>
										<Badge variant="outline" className="text-lg">
											{formatScoreType(workout.scoreType)}
										</Badge>
									</div>
								)}
							</div>
							{workout.tags && workout.tags.length > 0 && (
								<>
									<div className="my-4 flex items-center gap-2">
										<TagIcon className="h-5 w-5" />
										<h3>TAGS</h3>
									</div>
									<div className="mb-6 flex flex-wrap gap-2">
										{(workout.tags || []).map((tag) => (
											<Badge key={tag.id} variant="outline" className="text-lg">
												{tag.name}
											</Badge>
										))}
									</div>
								</>
							)}
							<div className="my-4 flex items-center gap-2">
								<Dumbbell className="h-5 w-5" />
								<h3>MOVEMENTS</h3>
							</div>
							<MovementsList
								movements={workout.movements || []}
								mode="display"
								variant="badge"
								showLabel={false}
							/>
						</div>
					</div>
				</div>

				{/* Results Section */}
				<div className="p-6">
					<div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
						<div className="flex items-center gap-2">
							<ListChecks className="h-5 w-5" />
							<h2>WORKOUT RESULTS</h2>
						</div>
						<Button
							asChild
							variant="default"
							size="default"
							className="w-full sm:w-auto"
						>
							<Link
								href={`/log/new?workoutId=${workoutId}&redirectUrl=/workouts/${workoutId}`}
							>
								Log Result
							</Link>
						</Button>
					</div>
					{resultsWithSets && resultsWithSets.length > 0 ? (
						<div className="space-y-4">
							{resultsWithSets.map((result) => (
								<div
									key={result.id}
									className="border-2 border-black dark:border-dark-border"
								>
									<div className="p-4">
										<div className="mb-2 flex items-center justify-between">
											<div>
												<p className="font-bold text-foreground text-lg dark:text-dark-foreground">
													{formatDate(result.recordedAt)}
												</p>
												{result.displayScore && (
													<p className="mb-1 text-foreground text-xl dark:text-dark-foreground">
														{result.displayScore}
													</p>
												)}
											</div>
											<div className="flex items-center gap-2">
												{/* Display scaling label with Rx indicator */}
												{result.scalingLevelLabel ? (
													<span className="bg-gray-200 px-2 py-1 font-bold text-black text-xs uppercase dark:bg-dark-muted dark:text-dark-foreground">
														{result.scalingLevelLabel}
														{result.asRx ? " (Rx)" : " (Scaled)"}
													</span>
												) : result.asRx ? (
													<span className="bg-gray-200 px-2 py-1 font-bold text-black text-xs uppercase dark:bg-dark-muted dark:text-dark-foreground">
														Rx
													</span>
												) : null}
												<Button
													asChild
													variant="outline"
													size="sm"
													className="flex items-center gap-2"
												>
													<Link
														href={{
															pathname: `/log/${result.id}/edit`,
															query: {
																redirectUrl: `/workouts/${workoutId}`,
															},
														}}
													>
														<PencilIcon className="h-4 w-4" />
														Edit
													</Link>
												</Button>
											</div>
										</div>
										{result.notes && (
											<p className="text-gray-600 text-sm dark:text-dark-muted-foreground">
												Notes: {result.notes}
											</p>
										)}
									</div>
									{workout.roundsToScore &&
										workout.roundsToScore > 1 &&
										result.sets && (
											<Suspense
												fallback={
													<div className="text-foreground dark:text-dark-foreground">
														Loading sets...
													</div>
												}
											>
												<SetDetails sets={result.sets} />
											</Suspense>
										)}
								</div>
							))}
						</div>
					) : (
						<div className="text-gray-500 dark:text-dark-muted-foreground">
							No results logged yet.
						</div>
					)}
				</div>
			</div>

			{/* Remixed Workouts Section */}
			{remixedWorkouts.length > 0 && (
				<div className="mt-8 border-2 border-black dark:border-dark-border">
					<div className="border-black border-b-2 p-6 dark:border-dark-border">
						<div className="flex items-center gap-2 mb-4">
							<Shuffle className="h-5 w-5" />
							<h2>REMIXED WORKOUTS</h2>
						</div>
						<p className="text-gray-600 dark:text-dark-muted-foreground mb-4">
							Workouts based on this original workout:
						</p>

						<div className="space-y-4">
							{remixedWorkouts.map((remix) => (
								<div
									key={remix.id}
									className="border-2 border-black dark:border-dark-border p-4"
								>
									<div className="flex items-center justify-between mb-2">
										<div>
											<Link
												href={`/workouts/${remix.id}`}
												className="font-bold text-foreground text-lg underline-offset-4 hover:underline dark:text-dark-foreground"
											>
												{remix.name}
											</Link>
											<div className="flex items-center gap-2 mt-1">
												<span className="text-sm text-gray-600 dark:text-dark-muted-foreground">
													by {remix.teamName}
												</span>
												{remix.scope === "public" && (
													<span className="bg-green-100 text-green-800 px-2 py-1 text-xs font-bold uppercase dark:bg-green-900 dark:text-green-200">
														Public
													</span>
												)}
											</div>
										</div>
										<div className="text-right">
											<p className="text-sm text-gray-500 dark:text-dark-muted-foreground">
												{formatDate(remix.createdAt)}
											</p>
											<span className="bg-black px-2 py-1 font-bold text-white text-xs uppercase dark:bg-dark-foreground dark:text-dark-background">
												{remix.scheme}
											</span>
										</div>
									</div>
									{remix.description && (
										<p className="text-gray-600 dark:text-dark-muted-foreground text-sm whitespace-pre-wrap line-clamp-3">
											{remix.description}
										</p>
									)}
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Schedule History Section - moved to bottom */}
			<WorkoutScheduleHistory scheduleHistory={scheduleHistory} />
		</div>
	)
}
