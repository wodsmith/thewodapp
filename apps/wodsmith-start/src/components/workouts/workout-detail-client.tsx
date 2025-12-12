"use client"

interface WorkoutDetailClientProps {
	workout?: {
		id: string
		name: string
		description?: string
		type?: string
		movements?: Array<{
			name: string
			reps?: number
		}>
	}
}

export function WorkoutDetailClient({ workout }: WorkoutDetailClientProps) {
	if (!workout) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				Workout not found
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-bold">{workout.name}</h1>
				{workout.type && (
					<div className="inline-block mt-2 px-2 py-1 bg-muted rounded text-sm">
						{workout.type}
					</div>
				)}
			</div>
			{workout.description && (
				<p className="whitespace-pre-wrap">{workout.description}</p>
			)}
			{workout.movements && workout.movements.length > 0 && (
				<div className="space-y-2">
					<h2 className="font-semibold">Movements</h2>
					<ul className="list-disc list-inside">
						{workout.movements.map((movement, idx) => (
							<li key={idx}>
								{movement.reps && `${movement.reps}x `}
								{movement.name}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
