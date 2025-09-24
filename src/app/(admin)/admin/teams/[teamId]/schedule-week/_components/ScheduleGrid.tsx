import { Fragment, useState, useMemo } from "react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Calendar, MapPin, AlertTriangle, User } from "lucide-react"
import SlotAssignmentDialog from "./SlotAssignmentDialog"
import { Button } from "@/components/ui/button"
import type { ScheduleTemplate, Location } from "@/db/schemas/scheduling"
import type { getCoachesByTeam } from "@/actions/coach-actions"
import type { getScheduledClassesForDisplay } from "@/server/ai/scheduler"

// Type for coaches with relations - extract from ZSA response success case
type CoachWithRelations = NonNullable<
	NonNullable<Awaited<ReturnType<typeof getCoachesByTeam>>[0]>["data"]
>[number]

// Type for coach skills with populated skill relation
type CoachSkillWithRelation = {
	coachId: string
	skillId: string
	skill: {
		id: string
		name: string
		teamId: string
		createdAt: Date
		updatedAt: Date
		updateCounter: number | null
	}
}

// Type for ScheduledClass with relationships populated - use actual return type from server function
type ScheduledClassWithRelations = Awaited<
	ReturnType<typeof getScheduledClassesForDisplay>
>[number]
import { format } from "date-fns"

interface ScheduleGridProps {
	scheduledClasses: ScheduledClassWithRelations[]
	templates: ScheduleTemplate[]
	locations: Location[]
	coaches: CoachWithRelations[]
	currentWeek: string
	scheduleId: string
	teamId: string
	onScheduleUpdate: () => void
}

const ScheduleGrid = ({
	scheduledClasses,
	locations,
	coaches,
	currentWeek,
	teamId,
	onScheduleUpdate,
}: ScheduleGridProps) => {
	const [selectedClass, setSelectedClass] =
		useState<ScheduledClassWithRelations | null>(null)

	const days = [
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
		"Sunday",
	]

	// Group scheduled classes by location and day/time
	const scheduleByLocation = useMemo(() => {
		const grouped: Record<
			string,
			Record<string, ScheduledClassWithRelations>
		> = {}

		scheduledClasses.forEach((scheduledClass) => {
			const locationId = scheduledClass.locationId
			const classDate = new Date(scheduledClass.startTime)
			const dayIndex = classDate.getDay() === 0 ? 6 : classDate.getDay() - 1 // Convert to Mon=0, Sun=6
			const dayName = days[dayIndex]
			const timeKey = format(classDate, "h:mm a")
			const key = `${dayName}-${timeKey}`

			if (!grouped[locationId]) {
				grouped[locationId] = {}
			}
			grouped[locationId][key] = scheduledClass
		})

		return grouped
	}, [scheduledClasses])

	// Get all unique time slots for a location
	const getTimeSlotsForLocation = (locationId: string) => {
		const timeSlots = new Set<string>()

		// Get time slots from scheduled classes
		Object.keys(scheduleByLocation[locationId] || {}).forEach((key) => {
			const [_, time] = key.split("-")
			timeSlots.add(time)
		})

		// Templates are now location-agnostic, so we use scheduled classes as the source of truth

		return Array.from(timeSlots).sort((a, b) => {
			const timeA = new Date(`2000/01/01 ${a}`).getTime()
			const timeB = new Date(`2000/01/01 ${b}`).getTime()
			return timeA - timeB
		})
	}

	const handleSlotClick = (scheduledClass: ScheduledClassWithRelations) => {
		setSelectedClass(scheduledClass)
	}

	// Transform coaches data to match CoachData interface expected by SlotAssignmentDialog
	const transformedCoaches = useMemo(() => {
		return coaches.map((coach) => {
			const firstName = coach.user?.firstName
			const lastName = coach.user?.lastName
			const name =
				firstName && lastName
					? `${firstName} ${lastName}`
					: firstName || lastName
			return {
				id: coach.id,
				userId: coach.userId,
				name: name || coach.user?.email || "Unknown Coach",
				email: coach.user?.email || null,
				schedulingPreference: coach.schedulingPreference,
				schedulingNotes: coach.schedulingNotes,
				skills:
					coach.skills?.map(
						(skillRel: CoachSkillWithRelation) => skillRel.skill,
					) || [],
			}
		})
	}, [coaches])

	const renderScheduleSlot = (
		location: Location,
		day: string,
		time: string,
	) => {
		const key = `${day}-${time}`
		const scheduledClass = scheduleByLocation[location.id]?.[key]

		if (!scheduledClass) {
			return <div className="h-16 border rounded bg-muted/30"></div>
		}

		// Find the coach info
		const coach = coaches.find((c) => c.id === scheduledClass.coachId)
		const coachUser = coach?.user

		return (
			<Button
				variant="ghost"
				className={`h-16 border rounded p-2 text-xs cursor-pointer hover:shadow-md transition-shadow ${
					!scheduledClass.coachId
						? "border-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:border-orange-800 dark:hover:bg-orange-900"
						: "border-border bg-background hover:bg-muted"
				}`}
				onClick={() => handleSlotClick(scheduledClass)}
			>
				<div className="flex items-center justify-between h-full w-full">
					<div className="flex-1 min-w-0">
						<div className="font-medium truncate">
							{scheduledClass.classCatalog?.name || "Class"}
						</div>
						{coachUser ? (
							<div className="text-muted-foreground truncate flex items-center gap-1">
								<User className="h-3 w-3" />
								{(() => {
									const firstName = coachUser.firstName
									const lastName = coachUser.lastName
									const name =
										firstName && lastName
											? `${firstName} ${lastName}`
											: firstName || lastName
									return name || coachUser.email
								})()}
							</div>
						) : (
							<div className="text-orange-600 dark:text-orange-400 font-medium">
								Click to assign
							</div>
						)}
					</div>
					{!scheduledClass.coachId && (
						<AlertTriangle className="h-3 w-3 text-orange-500 dark:text-orange-400 flex-shrink-0 ml-1" />
					)}
				</div>
			</Button>
		)
	}
	console.log(locations)

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Calendar className="h-5 w-5" />
						<span>Weekly Schedule</span>
					</CardTitle>
					<CardDescription>
						{currentWeek} - Click on any slot to assign or change coaches
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						{locations.map((location) => {
							const locationTimeSlots = getTimeSlotsForLocation(location.id)
							console.log(locationTimeSlots)
							if (locationTimeSlots.length === 0) return null

							return (
								<div key={location.id} className="mb-8">
									<div className="flex items-center space-x-2 mb-4 p-3 bg-muted rounded-lg">
										<MapPin className="h-4 w-4" />
										<h3 className="font-semibold">{location.name}</h3>
									</div>

									<div className="grid grid-cols-8 gap-2 min-w-[800px]">
										{/* Header row */}
										<div className="font-medium text-muted-foreground text-sm p-2">
											Time
										</div>
										{days.map((day) => (
											<div
												key={day}
												className="font-medium text-muted-foreground text-sm p-2 text-center"
											>
												{day}
											</div>
										))}

										{/* Schedule rows */}
										{locationTimeSlots.map((time) => (
											<Fragment key={`${location.id}-${time}`}>
												<div className="text-xs text-muted-foreground p-2 flex items-center">
													{time}
												</div>
												{days.map((day) => (
													<div key={`${location.id}-${time}-${day}`}>
														{renderScheduleSlot(location, day, time)}
													</div>
												))}
											</Fragment>
										))}
									</div>
								</div>
							)
						})}
					</div>
				</CardContent>
			</Card>

			{selectedClass && (
				<SlotAssignmentDialog
					isOpen={true}
					onClose={() => setSelectedClass(null)}
					scheduledClass={selectedClass}
					coaches={transformedCoaches}
					teamId={teamId}
					onScheduleUpdate={() => {
						setSelectedClass(null)
						onScheduleUpdate()
					}}
				/>
			)}
		</>
	)
}

export default ScheduleGrid
