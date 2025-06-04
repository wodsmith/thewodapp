"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { WorkoutResultWithWorkoutName } from "@/types";
import Link from "next/link";

interface LogCalendarClientProps {
	logs: WorkoutResultWithWorkoutName[];
}

export default function LogCalendarClient({ logs }: LogCalendarClientProps) {
	const [date, setDate] = React.useState<Date | undefined>(new Date());
	const [selectedLog, setSelectedLog] = React.useState<WorkoutResultWithWorkoutName[] | null>(
		null,
	);

	const handleDateSelect = React.useCallback(
		(selectedDate: Date | undefined) => {
			setDate(selectedDate);
			if (selectedDate) {
				const logsForDay = logs.filter(
					(log) => new Date(log.date).toDateString() === selectedDate.toDateString(),
				);
				setSelectedLog(logsForDay.length > 0 ? logsForDay : null);
			} else {
				setSelectedLog(null);
			}
		},
		[logs],
	);

	React.useEffect(() => {
		handleDateSelect(date);
	}, [date, handleDateSelect]);

	const loggedDates = logs.map((log) => new Date(log.date));

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
				<div className="flex min-w-[358px] flex-col gap-4 rounded-md border p-4 md:w-1/3">
					{selectedLog.map((logEntry) => (
						<div key={logEntry.id} className="rounded-md border-2 border-black p-4">
							<h3 className="mb-2 font-bold text-lg">
								{logEntry.workoutName || "Workout Result"}
							</h3>
							<div className="mb-2 flex items-center justify-between">
								<p className="text-muted-foreground text-sm">
									{new Date(logEntry.date).toLocaleDateString()}
								</p>
								{logEntry.scale && (
									<span className="rounded-sm bg-gray-200 px-2 py-1 font-bold text-black text-xs uppercase">
										{logEntry.scale}
									</span>
								)}
							</div>
							{logEntry.wodScore && (
								<p className="mb-1 text-xl">{logEntry.wodScore}</p>
							)}
							{logEntry.time && <p className="mt-1">Duration: {logEntry.time}</p>}
							{logEntry.setCount && <p className="mt-1">Sets: {logEntry.setCount}</p>}
							{logEntry.notes && (
								<p className="mt-2 text-gray-600 text-sm">{logEntry.notes}</p>
							)}
							{logEntry.workoutId && (
								<Button
									asChild
									className="mt-4 w-full border border-black bg-white text-black"
								>
									<Link href={`/workouts/${logEntry.workoutId}`}>
										View Workout
									</Link>
								</Button>
							)}
						</div>
					))}
				</div>
			)}
			{(!selectedLog || selectedLog.length === 0) && date && (
				<div className="min-w-[358px] rounded-md border p-4 md:w-1/3">
					<h3 className="mb-2 font-bold text-sm">No workout logged for this day.</h3>
					<p className="text-muted-foreground text-sm">{date.toLocaleDateString()}</p>
				</div>
			)}
			{!date && (
				<div className="min-w-[358px] rounded-md border p-4 md:w-1/3">
					<h3 className="mb-2 w-fit text-balance font-bold text-sm">
						Select a date to view workout results.
					</h3>
				</div>
			)}
		</div>
	);
}
