"use client"

interface LogCalendarClientProps {
	logs?: Array<{
		id: string
		date: string
		workoutName?: string
	}>
}

export function LogCalendarClient({ logs = [] }: LogCalendarClientProps) {
	return (
		<div className="p-4">
			<h2 className="text-lg font-semibold mb-4">Workout Log Calendar</h2>
			{logs.length === 0 ? (
				<p className="text-muted-foreground">No workout logs yet</p>
			) : (
				<div className="grid gap-2">
					{logs.map((log) => (
						<div key={log.id} className="p-2 border rounded">
							<div className="text-sm text-muted-foreground">{log.date}</div>
							<div>{log.workoutName || "Workout"}</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
