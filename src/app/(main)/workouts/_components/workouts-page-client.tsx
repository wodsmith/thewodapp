"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import Link from "next/link"
import { isSameDay } from "date-fns"
import { Button } from "@/components/ui/button"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"
import { TeamWeeklyWorkouts } from "@/app/(main)/teams/[id]/_components/team-weekly-workouts"
import { ExpandedWorkoutView } from "./expanded-workout-view-with-teams"
import WorkoutControls from "./WorkoutControls"
import WorkoutRowCard from "@/components/WorkoutRowCard"
import type { Movement, Tag, Workout, WorkoutResult } from "@/types"

interface ScheduledWorkoutWithTeam extends ScheduledWorkoutWithTrackDetails {
	teamId: string
	teamName: string
	teamSlug: string
}

interface WorkoutWithDetails extends Workout {
	movements: Movement[]
	tags: Tag[]
	resultsToday?: WorkoutResult[]
}

interface WorkoutsPageClientProps {
	scheduledWorkouts: ScheduledWorkoutWithTeam[]
	personalWorkouts: WorkoutWithDetails[]
	allTags: string[]
	allMovements: string[]
	searchParams?: {
		search?: string
		tag?: string
		movement?: string
	}
}

export function WorkoutsPageClient({
	scheduledWorkouts,
	personalWorkouts,
	allTags,
	allMovements,
	searchParams,
}: WorkoutsPageClientProps) {
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)

	// Set default to today on mount
	useEffect(() => {
		setSelectedDate(new Date())
	}, [])

	const handleDateSelect = (date: Date) => {
		setSelectedDate(date)
	}

	// Get workouts for the selected date
	const selectedDateWorkouts = selectedDate
		? scheduledWorkouts.filter((workout) =>
				isSameDay(new Date(workout.scheduledDate), selectedDate),
			)
		: []

	const isToday = selectedDate ? isSameDay(selectedDate, new Date()) : false

	// Filter personal workouts based on search params
	const searchTerm = searchParams?.search?.toLowerCase() || ""
	const selectedTag = searchParams?.tag || ""
	const selectedMovement = searchParams?.movement || ""

	const filteredWorkouts = personalWorkouts.filter((workout) => {
		const nameMatch = workout.name.toLowerCase().includes(searchTerm)
		const descriptionMatch = workout.description
			?.toLowerCase()
			.includes(searchTerm)
		const movementSearchMatch = workout.movements.some((movement) =>
			movement?.name?.toLowerCase().includes(searchTerm),
		)
		const tagSearchMatch = workout.tags.some((tag) =>
			tag.name.toLowerCase().includes(searchTerm),
		)
		const searchFilterPassed = searchTerm
			? nameMatch || descriptionMatch || movementSearchMatch || tagSearchMatch
			: true
		const tagFilterPassed = selectedTag
			? workout.tags.some((tag) => tag.name === selectedTag)
			: true
		const movementFilterPassed = selectedMovement
			? workout.movements.some(
					(movement) => movement?.name === selectedMovement,
				)
			: true
		return searchFilterPassed && tagFilterPassed && movementFilterPassed
	})

	return (
		<div>
			<div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
				<h1 className="mb-4">WORKOUTS</h1>
				<Button asChild>
					<Link
						href="/workouts/new"
						className="btn flex w-fit items-center gap-2"
					>
						<Plus className="h-5 w-5" />
						Create Workout
					</Link>
				</Button>
			</div>

			{/* Scheduled Workouts Section */}
			<div className="mb-12 space-y-6">
				<h2 className="border-b pb-2 font-bold text-2xl">Scheduled Workouts</h2>

				<TeamWeeklyWorkouts
					scheduledWorkouts={scheduledWorkouts}
					teamName="All Teams"
					selectedDate={selectedDate}
					onDateSelect={handleDateSelect}
				/>

				<ExpandedWorkoutView
					workouts={selectedDateWorkouts}
					selectedDate={selectedDate}
					isToday={isToday}
				/>
			</div>

			{/* Personal Workout Library */}
			<div>
				<h2 className="mb-4 border-b pb-2 font-bold text-2xl">
					Personal Workout Library
				</h2>
				<WorkoutControls allTags={allTags} allMovements={allMovements} />
				<ul className="space-y-4">
					{filteredWorkouts.map((workout) => (
						<WorkoutRowCard
							key={workout.id}
							workout={workout}
							movements={workout.movements}
							tags={workout.tags}
							result={workout.resultsToday?.[0]}
						/>
					))}
				</ul>
			</div>
		</div>
	)
}
