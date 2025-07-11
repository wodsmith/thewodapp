"use client"

import { format, startOfWeek, addDays, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"

export interface WeeklyCalendarEvent {
	id: string
	title: string
	date: Date
	time?: string
	description?: string
	metadata?: Record<string, unknown>
}

interface WeeklyCalendarProps {
	events: WeeklyCalendarEvent[]
	currentDate?: Date
	onEventClick?: (event: WeeklyCalendarEvent) => void
	className?: string
}

export function WeeklyCalendar({
	events,
	currentDate = new Date(),
	onEventClick,
	className,
}: WeeklyCalendarProps) {
	const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

	const getEventsForDay = (day: Date) => {
		return events.filter((event) => isSameDay(event.date, day))
	}

	return (
		<div className={cn("w-full", className)}>
			<div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
				{weekDays.map((day) => {
					const dayEvents = getEventsForDay(day)
					const isToday = isSameDay(day, new Date())

					return (
						<div
							key={`day-${day.toISOString()}`}
							className={cn(
								"bg-background min-h-[120px] p-2",
								isToday && "bg-muted/50",
							)}
						>
							<div className="mb-2">
								<div className="text-xs font-medium text-muted-foreground">
									{format(day, "EEE")}
								</div>
								<div
									className={cn(
										"text-sm font-semibold",
										isToday && "text-primary",
									)}
								>
									{format(day, "d")}
								</div>
							</div>

							<div className="space-y-1">
								{dayEvents.map((event) => (
									<button
										key={event.id}
										type="button"
										onClick={() => onEventClick?.(event)}
										className={cn(
											"w-full text-left p-1.5 rounded text-xs",
											"bg-primary/10 hover:bg-primary/20 transition-colors",
											"border border-primary/20",
										)}
									>
										<div className="font-medium truncate">{event.title}</div>
										{event.time && (
											<div className="text-muted-foreground">{event.time}</div>
										)}
									</button>
								))}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
