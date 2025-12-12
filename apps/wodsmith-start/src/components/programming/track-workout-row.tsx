import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import type { TrackWorkout, Workout } from "~/db/schema"

interface TrackWorkoutRowProps {
	trackWorkout: TrackWorkout & {
		workout: Workout
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	}
}

export function TrackWorkoutRow({ trackWorkout }: TrackWorkoutRowProps) {
	const { workout, trackOrder, isScheduled } = trackWorkout

	return (
		<article
			className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
			aria-label={`Workout: ${workout.name}`}
		>
			{/* Main content row */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				{/* Left section: Title and badges */}
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
					<h3 className="font-semibold text-lg leading-tight truncate">
						{workout.name}
					</h3>
					<div className="flex items-center gap-2 flex-shrink-0">
						<Badge variant="outline" className="text-xs">
							#{trackOrder}
						</Badge>
						<Badge
							variant={workout.scope === "public" ? "default" : "secondary"}
							className="text-xs"
						>
							{workout.scope}
						</Badge>
						{isScheduled && (
							<Badge
								variant="outline"
								className="text-xs bg-green-50 text-green-700 border-green-200"
							>
								Scheduled
							</Badge>
						)}
					</div>
				</div>

				{/* Right section: Scheme */}
				<div className="flex-shrink-0">
					<span className="text-sm text-muted-foreground capitalize">
						{workout.scheme.replace(/-/g, " ")}
					</span>
				</div>
			</div>

			{/* Description row */}
			{(workout.description || trackWorkout.notes) && (
				<div className="mt-3 flex flex-col gap-2">
					{workout.description && (
						<p className="text-sm text-muted-foreground line-clamp-2">
							{workout.description}
						</p>
					)}
				</div>
			)}
		</article>
	)
}

export function TrackWorkoutRowSkeleton() {
	return (
		<div className="border rounded-lg p-4">
			{/* Main content row skeleton */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
					<Skeleton className="h-6 w-48" />
					<div className="flex gap-2">
						<Skeleton className="h-5 w-12" />
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-5 w-12" />
					</div>
				</div>
				<div className="flex-shrink-0">
					<Skeleton className="h-4 w-20" />
				</div>
			</div>

			{/* Description skeleton */}
			<div className="mt-3">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3 mt-1" />
			</div>
		</div>
	)
}
