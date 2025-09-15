import { CalendarIcon } from "@heroicons/react/24/outline"

interface EmptyWorkoutsProps {
	viewMode: "daily" | "weekly"
}

export function EmptyWorkouts({ viewMode }: EmptyWorkoutsProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
			<h4 className="text-base font-medium text-foreground mb-2">
				{viewMode === "daily"
					? "No workouts scheduled for today"
					: "No workouts scheduled this week"}
			</h4>
			<p className="text-sm text-muted-foreground max-w-sm">
				{viewMode === "daily"
					? "Check back tomorrow or switch to the weekly view to see upcoming workouts."
					: "New workouts will appear here when they're scheduled for your team."}
			</p>
		</div>
	)
}
