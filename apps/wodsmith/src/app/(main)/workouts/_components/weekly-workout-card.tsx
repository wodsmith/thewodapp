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

interface WeeklyWorkoutCardProps {
	instance: WorkoutInstance
	workout: WorkoutWithMovements
	trackWorkout?: TrackWorkout | null
	index: number
}

export function WeeklyWorkoutCard({
	instance,
	workout,
	trackWorkout,
	index,
}: WeeklyWorkoutCardProps) {
	const result = instance.result

	// Decode score if displayScore is not already present
	// Include units for load/distance schemes so users see "225 lbs" not just "225"
	const displayScore =
		result?.displayScore ??
		(result?.scoreValue !== null &&
		result?.scoreValue !== undefined &&
		result?.scheme
			? decodeScore(result.scoreValue, result.scheme, { includeUnit: true })
			: undefined)

	return (
		<div
			key={instance.id || index}
			className="border-l-4 border-primary pl-4 ml-2"
		>
			<div className="flex flex-col w-full sm:items-start sm:justify-between items-start">
				<div className="flex-1 text-left">
					<Link href={`/workouts/${workout.id}`}>
						<h4 className="font-bold hover:underline text-left text-lg mb-2 min-w-[45ch] max-w-[75ch]">
							{workout.name}
						</h4>
					</Link>

					{instance.classTimes && (
						<div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
							<ClockIcon className="h-3 w-3" />
							<span>{instance.classTimes}</span>
						</div>
					)}

					{workout.description && (
						<p className="text-muted-foreground mb-3 text-left text-sm line-clamp-3 whitespace-pre-wrap">
							{workout.description}
						</p>
					)}

					{instance.teamSpecificNotes && (
						<div className="bg-muted p-2 mb-2">
							<p className="text-sm">
								<strong>Team Notes:</strong> {instance.teamSpecificNotes}
							</p>
						</div>
					)}

					{instance.scalingGuidanceForDay && (
						<div className="bg-muted p-2 mb-2">
							<p className="text-sm">
								<strong>Scaling:</strong> {instance.scalingGuidanceForDay}
							</p>
						</div>
					)}
				</div>

				<div className="w-full mt-2">
					{result ? (
						<div className="space-y-2">
							<div className="flex items-center gap-2 w-fit">
								<div className="flex-1 bg-green-50 dark:bg-green-950/20 border border-green-500 px-3 py-2">
									<div className="flex items-center">
										<div className="flex items-center gap-2">
											<span className="text-sm font-semibold text-green-700 dark:text-green-300">
												✓ {displayScore || "Completed"}
											</span>
											{result.asRx && (
												<span className="px-1.5 py-0.5 text-xs font-medium bg-green-600 text-white w-fit">
													RX
												</span>
											)}
										</div>
									</div>
								</div>
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="h-8 w-8 p-0"
									title="Edit Result"
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
									</Link>
								</Button>
							</div>
							<Button
								asChild
								variant="secondary"
								size="sm"
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
									Log Another Result
								</Link>
							</Button>
						</div>
					) : (
						<Button asChild variant="secondary" size="sm">
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
