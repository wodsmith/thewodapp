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
	onDayClick?: (date: Date) => void
	selectedDate?: Date | null
	className?: string
}

export function WeeklyCalendar({
	events,
	currentDate = new Date(),
	onDayClick,
	selectedDate,
	className,
}: WeeklyCalendarProps) {
	const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

	const getEventsForDay = (day: Date) => {
		return events.filter((event) => isSameDay(event.date, day))
	}

	const handleDayClick = (day: Date) => {
		onDayClick?.(day)
	}

	return (
		<div className={cn("w-full", className)}>
			<div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
				{weekDays.map((day) => {
					const dayEvents = getEventsForDay(day)
					const isToday = isSameDay(day, new Date())
					const isSelected = selectedDate && isSameDay(day, selectedDate)

					return (
						<button
							key={`day-${day.toISOString()}`}
							type="button"
							onClick={() => handleDayClick(day)}
							className={cn(
								"bg-background min-h-[120px] p-2 text-left transition-colors",
								"hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50",
								isToday && "bg-muted/50",
								isSelected && "ring-2 ring-primary bg-primary/5",
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
										isSelected && "text-primary",
									)}
								>
									{format(day, "d")}
								</div>
							</div>

							<div className="space-y-1">
								{dayEvents.map((event) => (
									<div
										key={event.id}
										className={cn(
											"w-full text-left p-1.5 rounded text-xs",
											"bg-primary/10 transition-colors",
											"border border-primary/20",
										)}
									>
										<div className="font-medium truncate">{event.title}</div>
										{event.time && (
											<div className="text-muted-foreground">{event.time}</div>
										)}
									</div>
								))}
							</div>
						</button>
					)
				})}
			</div>
		</div>
	)
}
