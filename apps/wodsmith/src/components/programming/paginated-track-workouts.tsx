"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { parseAsInteger, useQueryState } from "nuqs"
import { useServerAction } from "@repo/zsa-react"
import { getPaginatedTrackWorkoutsAction } from "@/actions/programming-track-workouts-actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PaginationWithUrl } from "@/components/ui/pagination"
import { TrackWorkoutRow, TrackWorkoutRowSkeleton } from "./track-workout-row"

interface PaginatedTrackWorkoutsProps {
	trackId: string
	teamId: string
	initialPage?: number
	pageSize?: number
}

export function PaginatedTrackWorkouts({
	trackId,
	teamId,
	initialPage = 1,
	pageSize = 10,
}: PaginatedTrackWorkoutsProps) {
	const [currentPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(initialPage),
	)

	const {
		execute,
		isPending,
		error,
		data: result,
	} = useServerAction(getPaginatedTrackWorkoutsAction)

	// Load workouts when component mounts or page changes
	useEffect(() => {
		execute({
			trackId,
			teamId,
			page: currentPage,
			pageSize,
		})
	}, [execute, trackId, teamId, currentPage, pageSize])

	// Loading state
	if (isPending && !result) {
		return (
			<div className="space-y-6">
				<div className="space-y-3">
					{Array.from({ length: pageSize }, () => (
						<TrackWorkoutRowSkeleton key={`skeleton-${crypto.randomUUID()}`} />
					))}
				</div>
			</div>
		)
	}

	// Error state
	if (error && !result) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					Failed to load workouts. Please try refreshing the page.
				</AlertDescription>
			</Alert>
		)
	}

	// No data state - should not happen if server action is working
	if (!result) {
		return (
			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>No workout data available.</AlertDescription>
			</Alert>
		)
	}

	const { workouts, pagination } = result

	// Empty state - track has no workouts
	if (workouts.length === 0 && pagination.page === 1) {
		return (
			<div className="text-center py-12">
				<div className="mx-auto max-w-md">
					<div className="bg-muted rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
						<AlertCircle className="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-semibold mb-2">No workouts yet</h3>
					<p className="text-muted-foreground text-sm">
						This programming track doesn't have any workouts scheduled yet.
						Check back later or contact the track owner.
					</p>
				</div>
			</div>
		)
	}

	// Empty state for subsequent pages (should not happen with proper pagination)
	if (workouts.length === 0 && pagination.page > 1) {
		return (
			<div className="text-center py-8">
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						No workouts found on this page. Please try a different page.
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Workout list with loading overlay during navigation */}
			<div className="relative">
				{isPending && (
					<div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
						<div className="text-sm text-muted-foreground">Loading...</div>
					</div>
				)}
				<div className="space-y-3">
					{workouts.map((trackWorkout) => (
						<TrackWorkoutRow
							key={trackWorkout.id}
							trackWorkout={trackWorkout}
						/>
					))}
				</div>
			</div>

			{/* Pagination controls */}
			{pagination.totalPages > 1 && (
				<div className="flex justify-center">
					<PaginationWithUrl
						totalItems={pagination.totalCount}
						pageSize={pagination.pageSize}
						showInfo={true}
						className="w-full"
					/>
				</div>
			)}
		</div>
	)
}
