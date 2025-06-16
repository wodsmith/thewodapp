"use client"

import { useState, useEffect } from "react"
import { TeamSchedulingCalendar } from "./team-scheduling-calendar"
import { getScheduledWorkoutsAction, scheduleWorkoutAction } from "../_actions/scheduling-actions"
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core"
import { useServerAction } from "zsa-react"
import { toast } from "sonner"

interface TeamSchedulingContainerProps {
	teamId: string
}

export function TeamSchedulingContainer({ teamId }: TeamSchedulingContainerProps) {
	const [events, setEvents] = useState<any[]>([])
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)

	const { execute: getScheduledWorkouts, isPending: isLoadingWorkouts } = 
		useServerAction(getScheduledWorkoutsAction)
	
	const { execute: scheduleWorkout, isPending: isScheduling } = 
		useServerAction(scheduleWorkoutAction)

	// Load scheduled workouts for the current month
	const loadScheduledWorkouts = async () => {
		const now = new Date()
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

		const [result] = await getScheduledWorkouts({
			teamId,
			startDate: startOfMonth.toISOString(),
			endDate: endOfMonth.toISOString(),
		})

		if (result?.success && result.data) {
			const calendarEvents = result.data.map((workout: any) => ({
				id: workout.id,
				title: workout.trackWorkout?.workoutName || "Scheduled Workout",
				start: workout.scheduledDate,
				allDay: true,
				extendedProps: {
					workoutName: workout.trackWorkout?.workoutName || "Unknown",
					notes: workout.teamSpecificNotes,
					classTimes: workout.classTimes,
				},
			}))
			
			setEvents(calendarEvents)
		} else {
			toast.error("Failed to load scheduled workouts")
		}
	}

	useEffect(() => {
		loadScheduledWorkouts()
	}, [teamId])

	const handleDateSelect = (selectInfo: DateSelectArg) => {
		setSelectedDate(new Date(selectInfo.start))
		// For now, just show the selected date
		// In Commit 5, we'll implement the workout selection modal
		toast.info(`Selected date: ${selectInfo.start.toDateString()}. Workout selection modal will be implemented in the next commit.`)
	}

	const handleEventClick = (clickInfo: EventClickArg) => {
		const { event } = clickInfo
		const props = event.extendedProps

		toast.info(`Workout: ${props.workoutName}${props.notes ? `\nNotes: ${props.notes}` : ""}`)
	}

	const handleEventDrop = async (dropInfo: any) => {
		const { event } = dropInfo
		const newDate = event.start

		// For now, just revert the drop since we need to implement the reschedule logic
		dropInfo.revert()
		toast.info("Drag-and-drop rescheduling will be implemented in the next commit")
	}

	return (
		<div className="space-y-4">
			{isLoadingWorkouts && (
				<div className="text-center text-muted-foreground">
					Loading scheduled workouts...
				</div>
			)}
			
			<TeamSchedulingCalendar
				teamId={teamId}
				events={events}
				onDateSelect={handleDateSelect}
				onEventClick={handleEventClick}
				onEventDrop={handleEventDrop}
			/>
		</div>
	)
}
