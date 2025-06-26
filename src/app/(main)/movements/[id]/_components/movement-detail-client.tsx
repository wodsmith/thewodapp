"use client"

import WorkoutRowCard from "@/components/WorkoutRowCard"
import type {
	Movement,
	WorkoutResult,
	WorkoutWithTagsAndMovements,
} from "@/types"
import { ListChecks } from "lucide-react"

interface MovementDetailClientProps {
	movement: Movement
	workouts: WorkoutWithTagsAndMovements[]
	workoutResults: { [key: string]: WorkoutResult[] }
}

export default function MovementDetailClient({
	movement,
	workouts,
	workoutResults,
}: MovementDetailClientProps) {
	return (
		<div>
			<h1 className="mb-6 font-bold text-3xl">{movement.name.toUpperCase()}</h1>

			<section>
				<div className="mb-4 flex items-center gap-2">
					<ListChecks className="h-6 w-6" />
					<h2 className="font-semibold text-2xl">Workout Results</h2>
				</div>

				{workouts.length > 0 ? (
					<div className="space-y-4">
						{workouts.map((workout) => {
							const resultsForWorkout = workoutResults[workout.id] || []
							// Get the most recent result for display in the card
							const mostRecentResult =
								resultsForWorkout.length > 0
									? resultsForWorkout.sort(
											(a, b) =>
												new Date(b.date || 0).getTime() -
												new Date(a.date || 0).getTime(),
										)[0]
									: undefined

							return (
								<WorkoutRowCard
									key={workout.id}
									workout={workout}
									movements={workout.movements}
									tags={workout.tags}
									result={mostRecentResult}
								/>
							)
						})}
					</div>
				) : (
					<p className="text-gray-500">
						No workouts associated with this movement to show results for.
					</p>
				)}
			</section>
		</div>
	)
}
