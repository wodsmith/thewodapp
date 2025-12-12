"use client"

import { Link } from "@tanstack/react-router"

interface Workout {
	id: string
	name: string
	type?: string
	createdAt?: string
}

interface WorkoutListProps {
	workouts?: Workout[]
}

export function WorkoutList({ workouts = [] }: WorkoutListProps) {
	if (workouts.length === 0) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				No workouts found
			</div>
		)
	}

	return (
		<div className="grid gap-2">
			{workouts.map((workout) => (
				<Link
					key={workout.id}
					to="/workouts/$workoutId"
					params={{ workoutId: workout.id }}
					className="p-4 border rounded hover:bg-muted transition-colors"
				>
					<div className="flex justify-between items-start">
						<div>
							<div className="font-medium">{workout.name}</div>
							{workout.type && (
								<div className="text-sm text-muted-foreground">
									{workout.type}
								</div>
							)}
						</div>
						<span className="text-muted-foreground">→</span>
					</div>
				</Link>
			))}
		</div>
	)
}
