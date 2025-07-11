"use client"

import { format } from "date-fns"
import { Calendar, Clock, Dumbbell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"

interface ExpandedWorkoutViewProps {
	workouts: ScheduledWorkoutWithTrackDetails[]
	selectedDate: Date | null
	isToday?: boolean
}

export function ExpandedWorkoutView({
	workouts,
	selectedDate,
	isToday = false,
}: ExpandedWorkoutViewProps) {
	if (!selectedDate) {
		return null
	}

	if (workouts.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Dumbbell className="h-5 w-5" />
						{isToday
							? "Today's Workouts"
							: format(selectedDate, "EEEE, MMMM d")}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<Calendar className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
						<h3 className="font-semibold text-lg mb-2">No Workouts Planned</h3>
						<p className="text-muted-foreground">
							There are no workouts scheduled for{" "}
							{isToday ? "today" : "this day"}.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Dumbbell className="h-5 w-5" />
					{isToday ? "Today's Workouts" : format(selectedDate, "EEEE, MMMM d")}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{workouts.map((workout, index) => (
					<div key={workout.id}>
						{index > 0 && <Separator className="my-6" />}

						<div className="space-y-4">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<h2 className="text-xl font-bold">
										{workout.trackWorkout.workout.name}
									</h2>
									{workout.classTimes && (
										<div className="flex items-center gap-1 text-sm text-muted-foreground">
											<Clock className="h-4 w-4" />
											{workout.classTimes}
										</div>
									)}
								</div>
								<div className="flex flex-col items-end gap-2">
									<Badge variant="outline" className="text-sm">
										{workout.trackWorkout.track.name}
									</Badge>
									{workout.trackWorkout.dayNumber && (
										<Badge variant="secondary">
											Day {workout.trackWorkout.dayNumber}
											{workout.trackWorkout.weekNumber &&
												` • Week ${workout.trackWorkout.weekNumber}`}
										</Badge>
									)}
								</div>
							</div>

							{workout.trackWorkout.workout.description && (
								<div>
									<h3 className="font-semibold mb-2">Workout Description</h3>
									<p className="text-muted-foreground whitespace-pre-wrap">
										{workout.trackWorkout.workout.description}
									</p>
								</div>
							)}

							{workout.trackWorkout.workout.scheme && (
								<div>
									<h3 className="font-semibold mb-2">Scheme</h3>
									<Badge variant="outline" className="text-sm">
										{workout.trackWorkout.workout.scheme.toUpperCase()}
									</Badge>
								</div>
							)}

							{workout.scalingGuidanceForDay && (
								<div>
									<h3 className="font-semibold mb-2">Scaling Guidance</h3>
									<p className="text-muted-foreground whitespace-pre-wrap">
										{workout.scalingGuidanceForDay}
									</p>
								</div>
							)}

							{workout.teamSpecificNotes && (
								<div>
									<h3 className="font-semibold mb-2">Team Notes</h3>
									<p className="text-muted-foreground whitespace-pre-wrap">
										{workout.teamSpecificNotes}
									</p>
								</div>
							)}

							{workout.trackWorkout.notes && (
								<div>
									<h3 className="font-semibold mb-2">Track Notes</h3>
									<p className="text-muted-foreground whitespace-pre-wrap">
										{workout.trackWorkout.notes}
									</p>
								</div>
							)}

							<div className="pt-2">
								<p className="text-xs text-muted-foreground">
									Track Type:{" "}
									{workout.trackWorkout.track.type
										.replace("_", " ")
										.toLowerCase()}
								</p>
							</div>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}
