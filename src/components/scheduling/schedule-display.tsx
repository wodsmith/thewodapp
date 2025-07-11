"use client"

import { format } from "date-fns"

// Type definition for scheduled class with relations
type ScheduledClassWithRelations = {
	id: string
	scheduleId: string
	coachId: string | null
	classCatalogId: string
	locationId: string
	startTime: Date
	endTime: Date
	coach: {
		id: string
		userId: string
		teamId: string
		user: {
			id: string
			firstName: string | null
			lastName: string | null
			email: string | null
		}
	} | null
	classCatalog: {
		id: string
		teamId: string
		name: string
		description: string | null
	}
	location: {
		id: string
		teamId: string
		name: string
	}
}

interface ScheduleDisplayProps {
	scheduledClasses: ScheduledClassWithRelations[]
	weekStartDate: Date
}

const dayNames = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
]

export function ScheduleDisplay({
	scheduledClasses,
	weekStartDate,
}: ScheduleDisplayProps) {
	// Group classes by day of the week
	const classesByDay = scheduledClasses.reduce(
		(acc, scheduledClass) => {
			const classDate = new Date(scheduledClass.startTime)
			const dayOfWeek = classDate.getDay() // 0 = Sunday, 1 = Monday, etc.

			if (!acc[dayOfWeek]) {
				acc[dayOfWeek] = []
			}
			acc[dayOfWeek].push(scheduledClass)

			return acc
		},
		{} as Record<number, ScheduledClassWithRelations[]>,
	)

	// Sort classes within each day by start time
	Object.keys(classesByDay).forEach((dayKey) => {
		const day = parseInt(dayKey)
		classesByDay[day].sort(
			(a, b) =>
				new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
		)
	})

	const formatTime = (date: Date) => {
		return format(date, "h:mm a")
	}

	const formatTimeRange = (startTime: Date, endTime: Date) => {
		return `${formatTime(startTime)} - ${formatTime(endTime)}`
	}

	const getCoachName = (coach: ScheduledClassWithRelations["coach"]) => {
		if (!coach?.user) return "Unassigned"
		const { firstName, lastName } = coach.user
		return `${firstName || ""} ${lastName || ""}`.trim() || "Unassigned"
	}

	const getDateForDay = (dayOfWeek: number) => {
		const date = new Date(weekStartDate)
		date.setDate(weekStartDate.getDate() + dayOfWeek)
		return format(date, "MMM d")
	}

	return (
		<div className="mx-auto space-y-4 sm:space-y-6">
			<h2 className="text-xl sm:text-2xl font-bold">Class Schedule</h2>
			<p className="text-sm sm:text-base text-muted-foreground">
				{scheduledClasses[0].location.name} -{" "}
				{scheduledClasses[0].classCatalog.name}
			</p>
			<p className="text-sm sm:text-base text-muted-foreground">
				Week of {format(weekStartDate, "MMMM d, yyyy")}
			</p>

			<div className="grid gap-2 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
				{dayNames.map((dayName, dayIndex) => {
					const dayClasses = classesByDay[dayIndex] || []

					return (
						<div key={dayName} className="rounded-lg border p-2 sm:p-3">
							<div className="mb-2 flex items-center justify-between">
								<h3 className="text-sm sm:text-base font-semibold">
									{dayName}
								</h3>
								<span className="text-xs sm:text-sm text-muted-foreground">
									{getDateForDay(dayIndex)}
								</span>
							</div>

							{dayClasses.length === 0 ? (
								<p className="text-xs sm:text-sm text-muted-foreground">
									No classes
								</p>
							) : (
								<div className="space-y-1 sm:space-y-2">
									{dayClasses.map((scheduledClass) => (
										<div
											key={scheduledClass.id}
											className="flex flex-col rounded-md bg-muted/50 p-1.5 sm:p-2"
										>
											<div className="text-xs sm:text-sm text-muted-foreground">
												{getCoachName(scheduledClass.coach)}
											</div>
											<div className="text-xs sm:text-sm font-medium mt-0.5">
												{formatTimeRange(
													new Date(scheduledClass.startTime),
													new Date(scheduledClass.endTime),
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
