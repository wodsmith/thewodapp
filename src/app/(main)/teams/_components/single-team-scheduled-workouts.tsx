"use client"

import { format } from "date-fns"
import { Calendar, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"

interface SingleTeamScheduledWorkoutsProps {
	scheduledWorkouts: ScheduledWorkoutWithTrackDetails[]
	teamName: string
	isLoading?: boolean
}

export function SingleTeamScheduledWorkouts({
	scheduledWorkouts,
	teamName,
	isLoading = false,
}: SingleTeamScheduledWorkoutsProps) {
	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="h-8 w-48 bg-muted animate-pulse rounded" />
				</div>
				<div className="grid gap-4">
					{[1, 2, 3].map((id) => (
						<Card key={`loading-${id}`} className="animate-pulse">
							<CardHeader>
								<div className="h-6 w-3/4 bg-muted rounded" />
								<div className="h-4 w-1/2 bg-muted rounded" />
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="h-4 w-full bg-muted rounded" />
									<div className="h-4 w-2/3 bg-muted rounded" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		)
	}

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [SingleTeamScheduledWorkouts] Displaying ${scheduledWorkouts.length} scheduled workouts for team: ${teamName}`,
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-xl">Scheduled Workouts</h2>
				<Badge variant="secondary">
					{scheduledWorkouts.length} workout
					{scheduledWorkouts.length !== 1 ? "s" : ""}
				</Badge>
			</div>

			{/* Scheduled Workouts Display */}
			{scheduledWorkouts.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-muted-foreground">
							<Calendar className="mx-auto h-12 w-12 mb-4" />
							<h3 className="font-semibold text-lg mb-2">
								No Scheduled Workouts
							</h3>
							<p>
								{teamName} doesn't have any scheduled workouts at this time.
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4">
					{scheduledWorkouts
						.sort(
							(a, b) =>
								new Date(a.scheduledDate).getTime() -
								new Date(b.scheduledDate).getTime(),
						)
						.map((scheduledWorkout) => (
							<Card
								key={scheduledWorkout.id}
								className="hover:shadow-md transition-shadow"
							>
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className="space-y-1">
											<CardTitle className="text-lg">
												{scheduledWorkout.trackWorkout.workout.name}
											</CardTitle>
											<div className="flex items-center gap-4 text-sm text-muted-foreground">
												<div className="flex items-center gap-1">
													<Calendar className="h-4 w-4" />
													{format(
														new Date(scheduledWorkout.scheduledDate),
														"PPP",
													)}
												</div>
												{scheduledWorkout.classTimes && (
													<div className="flex items-center gap-1">
														<Clock className="h-4 w-4" />
														{scheduledWorkout.classTimes}
													</div>
												)}
											</div>
										</div>
										<div className="flex flex-col items-end gap-2">
											<Badge variant="outline">
												{scheduledWorkout.trackWorkout.track.name}
											</Badge>
											{scheduledWorkout.trackWorkout.dayNumber && (
												<Badge variant="secondary">
													Day {scheduledWorkout.trackWorkout.dayNumber}
													{scheduledWorkout.trackWorkout.weekNumber &&
														` • Week ${scheduledWorkout.trackWorkout.weekNumber}`}
												</Badge>
											)}
										</div>
									</div>
								</CardHeader>
								<CardContent>
									{scheduledWorkout.trackWorkout.workout.description && (
										<div className="mb-4">
											<h4 className="font-medium mb-2">Workout Description</h4>
											<p className="text-sm text-muted-foreground whitespace-pre-wrap">
												{scheduledWorkout.trackWorkout.workout.description}
											</p>
										</div>
									)}

									{scheduledWorkout.trackWorkout.workout.scheme && (
										<div className="mb-4">
											<div className="flex items-center gap-2">
												<span className="font-medium text-sm">Scheme:</span>
												<Badge variant="outline">
													{scheduledWorkout.trackWorkout.workout.scheme.toUpperCase()}
												</Badge>
											</div>
										</div>
									)}

									{scheduledWorkout.scalingGuidanceForDay && (
										<div className="mb-4">
											<h4 className="font-medium mb-2">Scaling Guidance</h4>
											<p className="text-sm text-muted-foreground whitespace-pre-wrap">
												{scheduledWorkout.scalingGuidanceForDay}
											</p>
										</div>
									)}

									{scheduledWorkout.teamSpecificNotes && (
										<div className="mb-4">
											<h4 className="font-medium mb-2">Team Notes</h4>
											<p className="text-sm text-muted-foreground whitespace-pre-wrap">
												{scheduledWorkout.teamSpecificNotes}
											</p>
										</div>
									)}

									{scheduledWorkout.trackWorkout.notes && (
										<div className="mb-4">
											<h4 className="font-medium mb-2">Track Notes</h4>
											<p className="text-sm text-muted-foreground whitespace-pre-wrap">
												{scheduledWorkout.trackWorkout.notes}
											</p>
										</div>
									)}

									<div className="flex items-center justify-between pt-4 border-t">
										<div className="text-xs text-muted-foreground">
											Track:{" "}
											{scheduledWorkout.trackWorkout.track.type.replace(
												"_",
												" ",
											)}
										</div>
										<Button variant="outline" size="sm">
											View Details
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
				</div>
			)}
		</div>
	)
}
