"use client"

import { Badge } from "@/components/ui/badge"
import type { Workout } from "@/db/schema"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

interface TrackWorkoutRowProps {
	teamId: string
	trackId: string
	trackWorkout: {
		id: string
		isScheduled?: boolean
		lastScheduled?: Date
	}
	workoutDetails?: Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
	}
}

export function TrackWorkoutRow({
	teamId,
	trackId,
	trackWorkout,
	workoutDetails,
}: TrackWorkoutRowProps) {
	if (!workoutDetails) {
		return null // Or a loading/placeholder state
	}
	return (
		<Link
			href={`/workouts/${workoutDetails.id}?redirectUrl=/admin/teams/${teamId}/programming/${trackId}`}
			className="block bg-surface rounded-none border-4 hover:border-primary border-transparent transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-2"
		>
			<div className="flex items-center justify-between gap-4">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow items-center">
					{/* Column 1: Name and Scheme */}
					<div className="md:col-span-1">
						<h3 className="text-lg font-mono tracking-tight font-bold">
							{workoutDetails.name}
						</h3>
						<p className="text-sm text-muted-foreground font-mono">
							{workoutDetails.scheme}
						</p>
					</div>

					{/* Column 2: Description */}
					<div className="md:col-span-1">
						{workoutDetails.description && (
							<p className="text-sm text-muted-foreground font-mono line-clamp-2">
								{workoutDetails.description}
							</p>
						)}
					</div>

					{/* Column 3: Status */}
					<div className="md:col-span-1 flex items-center justify-start md:justify-end">
						{trackWorkout.isScheduled && (
							<Badge className="bg-green-500 text-white border-2 border-green-700 font-mono">
								Scheduled
							</Badge>
						)}
					</div>
				</div>

				{/* Arrow Icon */}
				<div className="flex-shrink-0">
					<ChevronRight className="h-6 w-6 text-primary" />
				</div>
			</div>
		</Link>
	)
}
