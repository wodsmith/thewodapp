import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { TrackWorkout, Workout } from "@/db/schema"

interface TrackWorkoutCardProps {
	trackWorkout: TrackWorkout & {
		workout: Workout
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	}
}

export function TrackWorkoutCard({ trackWorkout }: TrackWorkoutCardProps) {
	const { workout, dayNumber, isScheduled, weekNumber } = trackWorkout

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<CardTitle className="text-lg leading-tight">
						{workout.name}
					</CardTitle>
					<div className="flex gap-2 ml-2">
						<Badge variant="outline" className="text-xs">
							Day {dayNumber}
						</Badge>
						{weekNumber && (
							<Badge variant="secondary" className="text-xs">
								Week {weekNumber}
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				{workout.description && (
					<p className="text-muted-foreground text-sm mb-3 line-clamp-3">
						{workout.description}
					</p>
				)}

				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<Badge
							variant={workout.scope === "public" ? "default" : "secondary"}
							className="text-xs"
						>
							{workout.scope}
						</Badge>
						<span className="capitalize">
							{workout.scheme.replace(/-/g, " ")}
						</span>
					</div>

					{isScheduled && (
						<Badge
							variant="outline"
							className="text-xs bg-green-50 text-green-700 border-green-200"
						>
							Scheduled
						</Badge>
					)}
				</div>

				{trackWorkout.notes && (
					<div className="mt-3 p-2 bg-muted rounded text-xs">
						<strong>Notes:</strong> {trackWorkout.notes}
					</div>
				)}
			</CardContent>
		</Card>
	)
}

export function TrackWorkoutCardSkeleton() {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<Skeleton className="h-6 w-3/4" />
					<div className="flex gap-2">
						<Skeleton className="h-5 w-12" />
						<Skeleton className="h-5 w-16" />
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<Skeleton className="h-4 w-full mb-2" />
				<Skeleton className="h-4 w-2/3 mb-3" />

				<div className="flex items-center justify-between">
					<div className="flex gap-2">
						<Skeleton className="h-4 w-12" />
						<Skeleton className="h-4 w-16" />
					</div>
					<Skeleton className="h-4 w-16" />
				</div>
			</CardContent>
		</Card>
	)
}
