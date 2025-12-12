"use client"

import { Card, CardContent } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Plus, GripVertical, Calendar, Dumbbell } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/programming/[trackId]/_components/track-workout-management.tsx
// This is a stub component that displays track workouts
// Full component includes: drag-and-drop reordering, add workout dialog, scaling alignment, workout details

interface ProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
	isPublic: number
	ownerTeamId: string
	scalingGroupId: string | null
}

interface TrackWorkout {
	id: string
	trackId: string
	workoutId: string
	position: number
	isScheduled?: boolean
	lastScheduledAt?: Date | null
	workout?: {
		id: string
		title: string
		description: string | null
	}
}

interface Workout {
	id: string
	title: string
	description: string | null
	tags: { id: string; name: string }[]
	movements: { id: string; name: string }[]
	lastScheduledAt?: Date | null
}

interface Movement {
	id: string
	name: string
}

interface Tag {
	id: string
	name: string
}

interface TrackWorkoutManagementProps {
	teamId: string
	trackId: string
	_track: ProgrammingTrack
	initialTrackWorkouts: TrackWorkout[]
	userWorkouts: Workout[]
	movements: Movement[]
	tags: Tag[]
	userId: string
	isOwner: boolean
}

export function TrackWorkoutManagement({
	teamId,
	trackId,
	_track,
	initialTrackWorkouts,
	userWorkouts,
	movements,
	tags,
	userId,
	isOwner,
}: TrackWorkoutManagementProps) {
	return (
		<div className="space-y-6">
			{/* Add workout button */}
			{isOwner && (
				<div className="flex justify-end">
					<Button disabled>
						<Plus className="h-4 w-4 mr-2" />
						Add Workout
					</Button>
				</div>
			)}

			{/* Workout list */}
			{initialTrackWorkouts.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h3 className="text-lg font-semibold font-mono mb-2">No Workouts Yet</h3>
						<p className="text-muted-foreground font-mono max-w-md mx-auto">
							Add workouts to this track to build your training program.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-2">
					{initialTrackWorkouts
						.sort((a, b) => a.position - b.position)
						.map((trackWorkout, index) => (
							<Card key={trackWorkout.id} className="hover:border-primary/50 transition-colors">
								<CardContent className="py-3 px-4">
									<div className="flex items-center gap-4">
										{/* Drag handle */}
										{isOwner && (
											<GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
										)}

										{/* Position */}
										<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-mono text-sm">
											{index + 1}
										</div>

										{/* Workout info */}
										<div className="flex-1 min-w-0">
											<div className="font-mono font-medium truncate">
												{trackWorkout.workout?.title || `Workout ${trackWorkout.workoutId}`}
											</div>
											{trackWorkout.workout?.description && (
												<div className="text-sm text-muted-foreground font-mono truncate">
													{trackWorkout.workout.description}
												</div>
											)}
										</div>

										{/* Schedule status */}
										{trackWorkout.isScheduled && (
											<Badge variant="secondary" className="font-mono text-xs">
												<Calendar className="h-3 w-3 mr-1" />
												Scheduled
											</Badge>
										)}
									</div>
								</CardContent>
							</Card>
						))}
				</div>
			)}

			{/* Debug info */}
			<details className="text-xs text-muted-foreground">
				<summary>Debug: Data Summary</summary>
				<pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
					{JSON.stringify(
						{
							teamId,
							trackId,
							trackName: _track.name,
							trackWorkoutsCount: initialTrackWorkouts.length,
							userWorkoutsCount: userWorkouts.length,
							movementsCount: movements.length,
							tagsCount: tags.length,
							userId,
							isOwner,
						},
						null,
						2
					)}
				</pre>
			</details>
		</div>
	)
}
