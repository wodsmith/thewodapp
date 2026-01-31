"use client"

import type {
	DateSelectArg,
	EventClickArg,
	EventDropArg,
} from "@fullcalendar/core"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import type { ScheduledWorkoutEvent } from "@/server-fns/admin-team-fns"
import { getScheduledWorkoutsForAdminFn } from "@/server-fns/admin-team-fns"
import "./team-scheduling-calendar.css"

interface TeamSchedulingCalendarProps {
	teamId: string
}

// Calendar Skeleton Component
function CalendarSkeleton() {
	// Fixed pattern for events to avoid random re-renders
	const eventPattern = [
		false,
		false,
		true,
		false,
		false,
		true,
		false, // Week 1
		true,
		false,
		false,
		true,
		false,
		false,
		true, // Week 2
		false,
		true,
		false,
		false,
		true,
		false,
		false, // Week 3
		false,
		false,
		true,
		false,
		false,
		true,
		true, // Week 4
		true,
		false,
		false,
		false,
		true,
		false,
		false, // Week 5
		false,
		true,
		false,
		true,
		false,
		false,
		false, // Week 6
	]

	return (
		<div className="space-y-4">
			{/* Header toolbar skeleton - matching the brutalist styling */}
			<div className="border-4 border-border bg-background p-2 rounded-none mb-4">
				<div className="flex items-center justify-between">
					{/* Month/Year title */}
					<Skeleton className="h-8 w-48 rounded-none" />
					<div className="flex items-center space-x-2">
						{/* View buttons */}
						<Skeleton className="h-10 w-20 rounded-none" />
						<Skeleton className="h-10 w-16 rounded-none" />
						<Skeleton className="h-10 w-12 rounded-none" />
					</div>
				</div>
			</div>

			{/* Calendar grid skeleton - matching the brutalist styling */}
			<div className="border-4 border-border rounded-none">
				{/* Days of week header */}
				<div className="grid grid-cols-7 bg-muted border-b-4 border-border">
					{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
						<div
							key={day}
							className="border-r-2 border-border last:border-r-0 p-3"
						>
							<Skeleton className="h-4 w-8 mx-auto rounded-none" />
						</div>
					))}
				</div>

				{/* Calendar days grid - 6 weeks */}
				<div className="grid grid-cols-7">
					{Array.from({ length: 42 }).map((_, i) => {
						const hasEvent = eventPattern[i]
						const hasMultipleEvents = hasEvent && (i % 7 === 2 || i % 7 === 5)
						const isToday = i === 15

						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array, items never reorder
							<div
								key={`skeleton-day-${i}`}
								className={`min-h-[100px] border-r-2 border-b-2 border-border last:border-r-0 p-2 space-y-2 ${
									isToday ? "bg-orange/10" : "bg-background"
								}`}
							>
								{/* Day number */}
								<Skeleton
									className={`h-5 w-6 rounded-none ${
										isToday ? "bg-orange/30" : ""
									}`}
								/>

								{/* Event skeletons - mimicking workout events */}
								{hasEvent && (
									<div className="space-y-1">
										<Skeleton className="h-6 w-full rounded-none bg-primary/30 border-2 border-foreground/20" />
										{hasMultipleEvents && (
											<Skeleton className="h-6 w-4/5 rounded-none bg-primary/30 border-2 border-foreground/20" />
										)}
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

// Pure Calendar Component
function CalendarDisplay({
	events,
	onDateSelect,
	onEventClick,
	onEventDrop,
}: {
	events: ScheduledWorkoutEvent[]
	onDateSelect?: (selectInfo: DateSelectArg) => void
	onEventClick?: (clickInfo: EventClickArg) => void
	onEventDrop?: (dropInfo: EventDropArg) => void
}) {
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkIsMobile = () => {
			setIsMobile(window.innerWidth < 640)
		}

		checkIsMobile()
		window.addEventListener("resize", checkIsMobile)
		return () => window.removeEventListener("resize", checkIsMobile)
	}, [])

	return (
		<div className="team-scheduling-calendar">
			<FullCalendar
				plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
				headerToolbar={{
					left: "prev,next today",
					center: "title",
					right: "dayGridMonth,timeGridWeek,timeGridDay",
				}}
				initialView="dayGridMonth"
				editable={true}
				selectable={true}
				selectMirror={true}
				dayMaxEvents={true}
				weekends={true}
				events={events}
				select={onDateSelect}
				eventClick={onEventClick}
				eventDrop={onEventDrop}
				height="auto"
				aspectRatio={isMobile ? 1 : 1.35}
			/>
		</div>
	)
}

// Main Container Component
export function TeamSchedulingCalendar({
	teamId,
}: TeamSchedulingCalendarProps) {
	const [events, setEvents] = useState<ScheduledWorkoutEvent[]>([])
	const [isInitialLoading, setIsInitialLoading] = useState(true)

	const getScheduledWorkouts = useServerFn(getScheduledWorkoutsForAdminFn)

	const MIN_SKELETON_DISPLAY_MS = 800

	const loadScheduledWorkouts = useCallback(async () => {
		const now = new Date()
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

		const startTime = Date.now()

		try {
			const result = await getScheduledWorkouts({
				data: {
					teamId,
					startDate: startOfMonth.toISOString(),
					endDate: endOfMonth.toISOString(),
				},
			})

			// Ensure minimum loading time for better UX
			const elapsedTime = Date.now() - startTime
			if (elapsedTime < MIN_SKELETON_DISPLAY_MS) {
				await new Promise((resolve) =>
					setTimeout(resolve, MIN_SKELETON_DISPLAY_MS - elapsedTime),
				)
			}

			if (result?.success && result.events) {
				setEvents(result.events)
			} else {
				toast.error("Failed to load scheduled workouts")
			}
		} catch (error) {
			console.error("Error loading scheduled workouts:", error)
			toast.error("Failed to load scheduled workouts")
		} finally {
			setIsInitialLoading(false)
		}
	}, [teamId, getScheduledWorkouts])

	useEffect(() => {
		loadScheduledWorkouts()
	}, [loadScheduledWorkouts])

	const handleDateSelect = (_selectInfo: DateSelectArg) => {
		// Admin view - for now just show a toast
		// In a full implementation, this would open a scheduling modal
		toast.info(
			"Date selection - scheduling modal will be added in future update",
		)
	}

	const handleEventClick = (clickInfo: EventClickArg) => {
		const { event } = clickInfo
		const extendedProps =
			event.extendedProps as ScheduledWorkoutEvent["extendedProps"]

		// Show event details in a toast for now
		// In a full implementation, this would open an edit drawer
		toast.info(
			`Workout: ${extendedProps.workoutName}${extendedProps.notes ? ` - Notes: ${extendedProps.notes}` : ""}`,
		)
	}

	const handleEventDrop = async (dropInfo: EventDropArg) => {
		// For now, just revert the drop since we need to implement the reschedule logic
		dropInfo.revert()
		toast.info(
			"Drag-and-drop rescheduling will be implemented in a future update",
		)
	}

	if (isInitialLoading) {
		return <CalendarSkeleton />
	}

	return (
		<div className="space-y-4">
			<CalendarDisplay
				events={events}
				onDateSelect={handleDateSelect}
				onEventClick={handleEventClick}
				onEventDrop={handleEventDrop}
			/>
		</div>
	)
}
