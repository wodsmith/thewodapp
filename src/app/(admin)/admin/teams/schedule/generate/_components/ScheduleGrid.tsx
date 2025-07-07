import { Fragment, useState } from "react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Calendar, MapPin, AlertTriangle } from "lucide-react"
import SlotAssignmentDialog from "./SlotAssignmentDialog"
import { Button } from "@/components/ui/button"

interface ScheduleSlot {
	class: string
	coach: string | null
	status: string
}

interface Schedule {
	[key: string]: ScheduleSlot
}

interface TimeSlots {
	[key: string]: string[]
}

interface ScheduleGridProps {
	schedule: Schedule
	setSchedule: (schedule: Schedule) => void
	timeSlots: TimeSlots
	locations: string[]
	currentWeek: string
}

const ScheduleGrid = ({
	schedule,
	setSchedule,
	timeSlots,
	locations,
	currentWeek,
}: ScheduleGridProps) => {
	const [selectedSlot, setSelectedSlot] = useState<{
		key: string
		slot: ScheduleSlot
	} | null>(null)
	const days = [
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
		"Sunday",
	]

	const getSlotKey = (day: string, time: string, location: string) => {
		return `${day}-${time}-${location}`
	}

	const handleSlotClick = (slotKey: string, slot: ScheduleSlot) => {
		setSelectedSlot({ key: slotKey, slot })
	}

	const handleAssignCoach = (slotKey: string, coach: string) => {
		setSchedule({
			...schedule,
			[slotKey]: {
				...schedule[slotKey],
				coach: coach || null,
				status: coach ? "scheduled" : "unscheduled",
			},
		})
	}

	const renderScheduleSlot = (day: string, time: string, location: string) => {
		const slotKey = getSlotKey(day, time, location)
		const slot = schedule[slotKey]

		if (!slot) {
			return (
				<div className="h-16 border border-slate-200 rounded bg-white/50"></div>
			)
		}

		return (
			<Button
				variant="ghost"
				className={`h-16 border rounded p-2 text-xs cursor-pointer hover:shadow-md transition-shadow ${
					slot.status === "unscheduled"
						? "border-orange-300 bg-orange-50 hover:bg-orange-100"
						: "border-slate-200 bg-white hover:bg-slate-50"
				}`}
				onClick={() => handleSlotClick(slotKey, slot)}
			>
				<div className="flex items-center justify-between h-full">
					<div className="flex-1 min-w-0">
						<div className="font-medium text-slate-800 truncate">
							{slot.class}
						</div>
						{slot.coach ? (
							<div className="text-slate-600 truncate">{slot.coach}</div>
						) : (
							<div className="text-orange-600 font-medium">Click to assign</div>
						)}
					</div>
					{slot.status === "unscheduled" && (
						<AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0 ml-1" />
					)}
				</div>
			</Button>
		)
	}

	const getAllTimeSlotsForLocation = (location: string) => {
		const allSlots = new Set<string>()
		Object.entries(timeSlots).forEach(([key, slots]) => {
			if (key.startsWith(`${location}-`)) {
				slots.forEach((slot) => allSlots.add(slot))
			}
		})
		return Array.from(allSlots).sort()
	}

	return (
		<>
			<Card className="bg-white/60 backdrop-blur-sm border-white/20">
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Calendar className="h-5 w-5" />
						<span>Weekly Schedule</span>
					</CardTitle>
					<CardDescription>
						Current schedule for {currentWeek} - Click on any slot to assign or
						change coaches
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						{locations.map((location) => {
							const locationTimeSlots = getAllTimeSlotsForLocation(location)
							if (locationTimeSlots.length === 0) return null

							return (
								<div key={location} className="mb-8">
									<div className="flex items-center space-x-2 mb-4 p-3 bg-gradient-to-r from-slate-100 to-blue-100 rounded-lg">
										<MapPin className="h-4 w-4 text-slate-600" />
										<h3 className="font-semibold text-slate-800">{location}</h3>
									</div>

									<div className="grid grid-cols-8 gap-2 min-w-[800px]">
										{/* Header row */}
										<div className="font-medium text-slate-600 text-sm p-2">
											Time
										</div>
										{days.map((day) => (
											<div
												key={day}
												className="font-medium text-slate-600 text-sm p-2 text-center"
											>
												{day}
											</div>
										))}

										{/* Schedule rows */}
										{locationTimeSlots.map((time) => (
											<Fragment key={`${location}-${time}`}>
												<div className="text-xs text-slate-500 p-2 flex items-center">
													{time}
												</div>
												{days.map((day) => (
													<div key={`${location}-${time}-${day}`}>
														{renderScheduleSlot(day, time, location)}
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

			{selectedSlot && (
				<SlotAssignmentDialog
					isOpen={true}
					onClose={() => setSelectedSlot(null)}
					slotKey={selectedSlot.key}
					slot={selectedSlot.slot}
					onAssignCoach={handleAssignCoach}
				/>
			)}
		</>
	)
}

export default ScheduleGrid
