"use client"

import { ClockIcon, PencilIcon } from "@heroicons/react/24/outline"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { TrackWorkout, Workout } from "@/db/schema"
import { decodeScore } from "@/lib/scoring"
import type { WorkoutResult } from "@/types"

type WorkoutWithMovements = Workout & {
	movements?: Array<{ id: string; name: string; type: string }>
}

interface WorkoutInstance {
	id: string
	result?: WorkoutResult & { displayScore?: string }
	classTimes?: string | null
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
}

interface DailyWorkoutCardProps {
	instance: WorkoutInstance
	workout: WorkoutWithMovements
	trackWorkout?: TrackWorkout | null
	index: number
}

export function DailyWorkoutCard({
	instance,
	workout,
	trackWorkout,
	index,
}: DailyWorkoutCardProps) {
	const result = instance.result

	// Decode score if displayScore is not already present
	// Include units for load/distance schemes so users see "225 lbs" not just "225"
	const displayScore =
		result?.displayScore ??
		(result?.scoreValue !== null && result?.scoreValue !== undefined && result?.scheme
			? decodeScore(result.scoreValue, result.scheme, { includeUnit: true })
			: undefined)

	return (
		<div
			key={instance.id || index}
			className="border-2 border-black dark:border-dark-border p-6 bg-background/10 dark:bg-white/10 flex flex-col items-start rounded"
		>
			<div className="flex flex-col w-full h-full items-start">
				<div className="flex-1 text-left">
					<Link href={`/workouts/${workout.id}`}>
						<h4 className="font-bold hover:underline text-left text-2xl mb-3 leading-tight">
							{workout.name}
						</h4>
					</Link>

					{instance.classTimes && (
						<div className="flex items-center gap-2 text-muted-foreground mb-4 text-base">
							<ClockIcon className="h-4 w-4" />
							<span>{instance.classTimes}</span>
						</div>
					)}

					{workout.scheme && (
						<div className="mb-4 flex justify-start rounded">
							<div className="inline-block bg-black dark:bg-primary text-primary-foreground px-3 py-2">
								<p className="font-bold text-sm uppercase tracking-wide">
									{workout.scheme}
								</p>
							</div>
						</div>
					)}

					{workout.description && (
						<p className="text-muted-foreground mb-3 text-left text-base whitespace-pre-wrap line-clamp-[12]">
							{workout.description}
						</p>
					)}

					{workout.movements && workout.movements.length > 0 && (
						<div className="mb-4">
							<p className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground text-left">
								Movements
							</p>
							<div className="flex flex-wrap gap-2 justify-start">
								{workout.movements.map(
									(movement) =>
										movement?.name && (
											<span
												key={movement.id}
												className="inline-block bg-secondary text-secondary-foreground px-3 py-1 text-sm font-medium"
											>
												{movement.name}
											</span>
										),
								)}
							</div>
						</div>
					)}

					{instance.teamSpecificNotes && (
						<div className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 pl-4 py-3 mb-4">
							<p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1 text-left">
								Team Notes
							</p>
							<p className="text-base text-left">
								{instance.teamSpecificNotes}
							</p>
						</div>
					)}

					{instance.scalingGuidanceForDay && (
						<div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 pl-4 py-3 mb-4">
							<p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1 text-left">
								Scaling Options
							</p>
							<p className="text-base text-left">
								{instance.scalingGuidanceForDay}
							</p>
						</div>
					)}
				</div>

				<div className="w-full mt-6 pt-4 border-t border-black/10 dark:border-white/10 flex flex-col items-start">
					{result ? (
						<div className="space-y-3 w-full">
							<div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 p-4 w-full">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
									<div className="text-left">
										<p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
											Result Logged
										</p>
										<p className="text-lg font-bold">
											{displayScore || "Completed"}
										</p>
										{result.asRx && (
											<span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-green-600 text-white">
												RX
											</span>
										)}
									</div>
									<Button
										asChild
										variant="outline"
										size="sm"
										className="flex items-center gap-2 self-start sm:self-auto"
									>
										<Link
											href={{
												pathname: `/log/${result.id}/edit`,
												query: {
													redirectUrl: "/workouts",
												},
											}}
										>
											<PencilIcon className="h-4 w-4" />
											Edit
										</Link>
									</Button>
								</div>
								{result.notes && (
									<p className="mt-2 text-sm text-muted-foreground text-left">
										{result.notes}
									</p>
								)}
							</div>
							<Button
								asChild
								variant="default"
								size="default"
								className="w-full sm:w-auto sm:self-start"
							>
								<Link
									href={{
										pathname: "/log/new",
										query: {
											workoutId: workout.id,
											scheduledInstanceId: instance.id,
											programmingTrackId: trackWorkout?.trackId,
											redirectUrl: "/workouts",
										},
									}}
								>
									Log Another Result
								</Link>
							</Button>
						</div>
					) : (
						<Button
							asChild
							variant="default"
							size="default"
							className="w-full sm:w-auto"
						>
							<Link
								href={{
									pathname: "/log/new",
									query: {
										workoutId: workout.id,
										scheduledInstanceId: instance.id,
										programmingTrackId: trackWorkout?.trackId,
										redirectUrl: "/workouts",
									},
								}}
							>
								Log Result
							</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
