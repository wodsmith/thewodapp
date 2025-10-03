"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"
import type { WorkoutResultWithWorkoutName } from "@/types"
import { LogRowCard } from "./log-row-card"

interface LogCalendarClientProps {
	logs: WorkoutResultWithWorkoutName[]
}

export default function LogCalendarClient({ logs }: LogCalendarClientProps) {
	const [date, setDate] = React.useState<Date | undefined>(new Date())
	const [selectedLog, setSelectedLog] = React.useState<
		WorkoutResultWithWorkoutName[] | null
	>(null)

	const handleDateSelect = React.useCallback(
		(selectedDate: Date | undefined) => {
			setDate(selectedDate)
			if (selectedDate) {
				const logsForDay = logs.filter(
					(log) =>
						new Date(log.date).toDateString() === selectedDate.toDateString(),
				)
				setSelectedLog(logsForDay.length > 0 ? logsForDay : null)
			} else {
				setSelectedLog(null)
			}
		},
		[logs],
	)

	React.useEffect(() => {
		handleDateSelect(date)
	}, [date, handleDateSelect])

	const loggedDates = logs.map((log) => new Date(log.date))

	return (
		<div className="flex flex-col gap-4">
			<Calendar
				mode="single"
				selected={date}
				onSelect={handleDateSelect}
				className=" h-fit border"
				modifiers={{
					logged: loggedDates,
				}}
				modifiersStyles={{
					logged: {
						fontWeight: "bold",
						textDecoration: "underline",
						textDecorationColor: "hsl(var(--primary))",
						textDecorationThickness: "2px",
						textUnderlineOffset: "0.2em",
					},
				}}
			/>
			{selectedLog && selectedLog.length > 0 && (
				<div className="flex flex-col gap-4 border p-4">
					<ul className="space-y-2">
						{selectedLog.map((logEntry) => (
							<LogRowCard key={logEntry.id} logEntry={logEntry} />
						))}
					</ul>
				</div>
			)}
			{(!selectedLog || selectedLog.length === 0) && date && (
				<div className="min-w-[358px]   border p-4 md:w-1/3">
					<h3 className="mb-2 font-bold text-sm">
						No workout logged for this day.
					</h3>
					<p className="text-muted-foreground text-sm">
						{date.toLocaleDateString()}
					</p>
				</div>
			)}
			{!date && (
				<div className="min-w-[358px]   border p-4 md:w-1/3">
					<h3 className="mb-2 w-fit text-balance font-bold text-sm">
						Select a date to view workout results.
					</h3>
				</div>
			)}
		</div>
	)
}
