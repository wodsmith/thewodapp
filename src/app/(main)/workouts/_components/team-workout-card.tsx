"use client"

import { ClockIcon, PencilIcon } from "@heroicons/react/24/outline"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { TrackWorkout, Workout } from "@/db/schema"

type ViewMode = "daily" | "weekly"

interface TeamWorkoutCardProps {
	instance: any
	workout: Workout
	trackWorkout?: TrackWorkout | null
	viewMode: ViewMode
	index: number
}

export function TeamWorkoutCard({
	instance,
	workout,
	trackWorkout,
	viewMode,
	index,
}: TeamWorkoutCardProps) {
	const result = instance.result

	return (
		<div
			key={instance.id || index}
			className={`${
				viewMode === "daily"
					? "border-2 border-black dark:border-dark-border p-6  bg-background/10 dark:bg-white/10 flex flex-col"
					: "border-l-4 border-primary pl-4 ml-2"
			}`}
		>
			<div
				className={`${
					viewMode === "daily"
						? "flex flex-col h-full"
						: "flex flex-col sm:flex-row sm:items-start sm:justify-between"
				}`}
			>
				<div className="flex-1">
					<Link href={`/workouts/${workout.id}`}>
						<h4
							className={`font-bold hover:underline ${
								viewMode === "daily"
									? "text-2xl mb-3 leading-tight"
									: "text-lg mb-2"
							}`}
						>
							{workout.name}
						</h4>
					</Link>

					{/* Only show class times, not date */}
					{instance.classTimes && (
						<div
							className={`flex items-center gap-2 text-muted-foreground ${
								viewMode === "daily" ? "mb-4 text-base" : "mb-2 text-sm"
							}`}
						>
							<ClockIcon
								className={`${viewMode === "daily" ? "h-4 w-4" : "h-3 w-3"}`}
							/>
							<span>{instance.classTimes}</span>
						</div>
					)}

					{/* Scheme Display - Only for Today view */}
					{viewMode === "daily" && workout.scheme && (
						<div className="mb-4">
							<div className="inline-block bg-primary text-primary-foreground px-3 py-2 ">
								<p className="font-bold text-sm uppercase tracking-wide">
									{workout.scheme}
								</p>
							</div>
						</div>
					)}

					{workout.description && (
						<p
							className={`text-muted-foreground mb-3 ${
								viewMode === "daily"
									? "text-base whitespace-pre-wrap line-clamp-[12]"
									: "text-sm line-clamp-2"
							}`}
						>
							{workout.description}
						</p>
					)}

					{/* Movements Display - Enhanced for Today view */}
					{viewMode === "daily" &&
						(workout as any).movements &&
						(workout as any).movements.length > 0 && (
							<div className="mb-4">
								<p className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
									Movements
								</p>
								<div className="flex flex-wrap gap-2">
									{(workout as any).movements.map((movement: any) => (
										<span
											key={movement.id}
											className="inline-block bg-secondary text-secondary-foreground px-3 py-1 text-sm font-medium "
										>
											{movement.name}
										</span>
									))}
								</div>
							</div>
						)}

					{instance.teamSpecificNotes && (
						<div
							className={
								viewMode === "daily"
									? "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 pl-4 py-3 mb-4 "
									: "bg-muted  p-2 mb-2"
							}
						>
							{viewMode === "daily" ? (
								<>
									<p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">
										Team Notes
									</p>
									<p className="text-base">{instance.teamSpecificNotes}</p>
								</>
							) : (
								<p className="text-sm">
									<strong>Team Notes:</strong> {instance.teamSpecificNotes}
								</p>
							)}
						</div>
					)}

					{instance.scalingGuidanceForDay && (
						<div
							className={
								viewMode === "daily"
									? "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 pl-4 py-3 mb-4 "
									: "bg-muted  p-2 mb-2"
							}
						>
							{viewMode === "daily" ? (
								<>
									<p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
										Scaling Options
									</p>
									<p className="text-base">{instance.scalingGuidanceForDay}</p>
								</>
							) : (
								<p className="text-sm">
									<strong>Scaling:</strong> {instance.scalingGuidanceForDay}
								</p>
							)}
						</div>
					)}
				</div>

				<div
					className={
						viewMode === "daily"
							? "mt-6 pt-4 border-t border-black/10 dark:border-white/10"
							: "mt-2"
					}
				>
					{result ? (
						viewMode === "daily" ? (
							// Daily view - full result display
							<div className="space-y-3">
								<div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500  p-4">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
												Result Logged
											</p>
											<p className="text-lg font-bold">
												{result.wodScore || "Completed"}
											</p>
											{result.scale && (
												<span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-green-600 text-white ">
													{result.scale.toUpperCase()}
												</span>
											)}
										</div>
										<Button
											asChild
											variant="outline"
											size="sm"
											className="flex items-center gap-2"
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
										<p className="mt-2 text-sm text-muted-foreground">
											{result.notes}
										</p>
									)}
								</div>
							</div>
						) : (
							// Weekly view - compact result display
							<div className="flex items-center gap-2">
								<div className="flex-1 bg-green-50 dark:bg-green-950/20 border border-green-500  px-3 py-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="text-sm font-semibold text-green-700 dark:text-green-300">
												✓ {result.wodScore || "Completed"}
											</span>
											{result.scale && (
												<span className="px-1.5 py-0.5 text-xs font-medium bg-green-600 text-white ">
													{result.scale.toUpperCase()}
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
						)
					) : (
						<Button
							asChild
							variant={viewMode === "daily" ? "default" : "secondary"}
							size={viewMode === "daily" ? "default" : "sm"}
							className={viewMode === "daily" ? "w-full" : ""}
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
