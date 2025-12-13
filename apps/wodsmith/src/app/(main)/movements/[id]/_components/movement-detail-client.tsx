"use client"

import { ListChecks } from "lucide-react"
import WorkoutRowCard from "@/components/WorkoutRowCard"
import type {
	Movement,
	WorkoutResult,
	WorkoutWithTagsAndMovements,
} from "@/types"

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
							const mostRecentResult =
								resultsForWorkout.length > 0
									? resultsForWorkout
											.filter((result) => result.recordedAt)
											.sort(
												(a, b) =>
													new Date(b.recordedAt).getTime() -
													new Date(a.recordedAt).getTime(),
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
