"use client"

import { format } from "date-fns"
import { Calendar, Clock, Dumbbell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"

interface ExpandedWorkoutViewProps {
	workout: ScheduledWorkoutWithTrackDetails | null
	isToday?: boolean
}

export function ExpandedWorkoutView({
	workout,
	isToday = false,
}: ExpandedWorkoutViewProps) {
	if (!workout) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Dumbbell className="h-5 w-5" />
						{isToday ? "Today's Workout" : "Selected Workout"}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<Calendar className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
						<h3 className="font-semibold text-lg mb-2">No Workout Planned</h3>
						<p className="text-muted-foreground">
							{isToday
								? "There is no workout scheduled for today."
								: "Select a workout from the calendar above to view details."}
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2">
							<Dumbbell className="h-5 w-5" />
							{isToday ? "Today's Workout" : "Selected Workout"}
						</CardTitle>
						<h2 className="text-2xl font-bold">
							{workout.trackWorkout.workout.name}
						</h2>
						<div className="flex items-center gap-4 text-sm text-muted-foreground">
							<div className="flex items-center gap-1">
								<Calendar className="h-4 w-4" />
								{format(new Date(workout.scheduledDate), "EEEE, MMMM d, yyyy")}
							</div>
							{workout.classTimes && (
								<div className="flex items-center gap-1">
									<Clock className="h-4 w-4" />
									{workout.classTimes}
								</div>
							)}
						</div>
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
			</CardHeader>
			<CardContent className="space-y-6">
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

				<div className="pt-4 border-t">
					<p className="text-xs text-muted-foreground">
						Track Type:{" "}
						{workout.trackWorkout.track.type.replace("_", " ").toLowerCase()}
					</p>
				</div>
			</CardContent>
		</Card>
	)
}
