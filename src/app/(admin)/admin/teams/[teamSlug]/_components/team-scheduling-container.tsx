"use client"

import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service"
import type {
	DateSelectArg,
	EventClickArg,
	EventDropArg,
} from "@fullcalendar/core"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { getScheduledWorkoutsAction } from "../_actions/scheduling-actions"
import { CalendarSkeleton } from "./calendar-skeleton"
import { TeamSchedulingCalendar } from "./team-scheduling-calendar"
import { WorkoutSelectionModal } from "./workout-selection-modal-refactored"

interface CalendarEvent {
	id: string
	title: string
	start: string
	allDay?: boolean
	extendedProps?: {
		workoutName: string
		notes?: string
		classTimes?: string
	}
}

interface TeamSchedulingContainerProps {
	teamId: string
}

export function TeamSchedulingContainer({
	teamId,
}: TeamSchedulingContainerProps) {
	const [events, setEvents] = useState<CalendarEvent[]>([])
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [isInitialLoading, setIsInitialLoading] = useState(true)

	const { execute: getScheduledWorkouts, isPending: isLoadingWorkouts } =
		useServerAction(getScheduledWorkoutsAction)

	// Load scheduled workouts for the current month
	const MIN_SKELETON_DISPLAY_MS = 800

	const loadScheduledWorkouts = useCallback(async () => {
		const now = new Date()
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

		// Add minimum loading time for better UX (remove in production if needed)
		const startTime = Date.now()

		const [result] = await getScheduledWorkouts({
			teamId,
			startDate: startOfMonth.toISOString(),
			endDate: endOfMonth.toISOString(),
		})

		// Ensure minimum loading time for better UX
		const elapsedTime = Date.now() - startTime
		if (elapsedTime < MIN_SKELETON_DISPLAY_MS) {
			await new Promise((resolve) =>
				setTimeout(resolve, MIN_SKELETON_DISPLAY_MS - elapsedTime),
			)
		}

		if (result?.success && result.data) {
			const calendarEvents = result.data.map(
				(workout: ScheduledWorkoutInstanceWithDetails): CalendarEvent => ({
					id: workout.id,
					title: workout.trackWorkout?.workout?.name || "Unknown Workout",
					start: new Date(workout.scheduledDate).toISOString(),
					allDay: true,
					extendedProps: {
						workoutName:
							workout.trackWorkout?.workout?.name || "Unknown Workout",
						notes: workout.teamSpecificNotes || undefined,
						classTimes: workout.classTimes || undefined,
					},
				}),
			)

			setEvents(calendarEvents)
		} else {
			toast.error("Failed to load scheduled workouts")
		}

		setIsInitialLoading(false)
	}, [teamId, getScheduledWorkouts])

	useEffect(() => {
		loadScheduledWorkouts()
	}, [loadScheduledWorkouts])

	const handleDateSelect = (selectInfo: DateSelectArg) => {
		setSelectedDate(new Date(selectInfo.start))
		setIsModalOpen(true)
	}

	const handleEventClick = (clickInfo: EventClickArg) => {
		const { event } = clickInfo
		const props = event.extendedProps

		toast.info(
			`Workout: ${props.workoutName || "Unknown"}${
				props.notes ? `\nNotes: ${props.notes}` : ""
			}`,
		)
	}

	const handleEventDrop = async (dropInfo: EventDropArg) => {
		const { event } = dropInfo
		const newDate = event.start

		// For now, just revert the drop since we need to implement the reschedule logic
		dropInfo.revert()
		toast.info(
			"Drag-and-drop rescheduling will be implemented in the next commit",
		)
	}

	const handleWorkoutScheduled = () => {
		// Show loading state while reloading calendar events
		setIsInitialLoading(true)
		loadScheduledWorkouts()
	}

	return (
		<div className="space-y-4">
			{isLoadingWorkouts || isInitialLoading ? (
				<CalendarSkeleton />
			) : (
				<TeamSchedulingCalendar
					teamId={teamId}
					events={events}
					onDateSelect={handleDateSelect}
					onEventClick={handleEventClick}
					onEventDrop={handleEventDrop}
				/>
			)}

			<WorkoutSelectionModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				selectedDate={selectedDate}
				teamId={teamId}
				onWorkoutScheduledAction={handleWorkoutScheduled}
			/>
		</div>
	)
}
