"use client"

interface LogRowCardProps {
	log: {
		id: string
		date: string
		workoutName?: string
		score?: string
		notes?: string
	}
}

export function LogRowCard({ log }: LogRowCardProps) {
	return (
		<div className="p-4 border rounded">
			<div className="flex justify-between items-start">
				<div>
					<div className="font-medium">{log.workoutName || "Workout"}</div>
					<div className="text-sm text-muted-foreground">{log.date}</div>
				</div>
				{log.score && <div className="font-mono text-lg">{log.score}</div>}
			</div>
			{log.notes && (
				<p className="mt-2 text-sm text-muted-foreground">{log.notes}</p>
			)}
		</div>
	)
}
