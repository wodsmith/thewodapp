interface WorkoutLastScheduledProps {
	lastScheduled: {
		scheduledDate: Date
		teamName: string
	} | null
}

export function WorkoutLastScheduled({
	lastScheduled,
}: WorkoutLastScheduledProps) {
	if (!lastScheduled) {
		return null
	}

	return (
		<div className="rounded-lg border bg-muted/50 p-4">
			<div className="space-y-1">
				<p className="text-sm font-medium">Last Scheduled</p>
				<p className="text-sm text-muted-foreground">
					{lastScheduled.scheduledDate.toLocaleDateString()} for{" "}
					<span className="font-medium">{lastScheduled.teamName}</span>
				</p>
			</div>
		</div>
	)
}
