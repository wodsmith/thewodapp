import { useState } from "react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Clock, MapPin, Plus, Trash2 } from "lucide-react"

interface TimeSlots {
	[key: string]: string[]
}

interface TimeSlotManagerProps {
	timeSlots: TimeSlots
	setTimeSlots: (timeSlots: TimeSlots) => void
	locations: string[]
	classTypes: string[]
}

const TimeSlotManager = ({
	timeSlots,
	setTimeSlots,
	locations,
	classTypes,
}: TimeSlotManagerProps) => {
	const [newTimeSlot, setNewTimeSlot] = useState({
		location: "",
		classType: "",
		time: "",
	})

	const addTimeSlot = () => {
		if (newTimeSlot.location && newTimeSlot.classType && newTimeSlot.time) {
			const key = `${newTimeSlot.location}-${newTimeSlot.classType}`
			const currentSlots = timeSlots[key] || []
			if (!currentSlots.includes(newTimeSlot.time)) {
				setTimeSlots({
					...timeSlots,
					[key]: [...currentSlots, newTimeSlot.time].sort(),
				})
			}
			setNewTimeSlot({ location: "", classType: "", time: "" })
		}
	}

	const removeTimeSlot = (
		location: string,
		classType: string,
		time: string,
	) => {
		const key = `${location}-${classType}`
		const currentSlots = timeSlots[key] || []
		setTimeSlots({
			...timeSlots,
			[key]: currentSlots.filter((slot) => slot !== time),
		})
	}

	return (
		<Card className="bg-white/60 backdrop-blur-sm border-white/20 mb-6">
			<CardHeader>
				<CardTitle className="flex items-center space-x-2">
					<Clock className="h-5 w-5" />
					<span>Time Slot Manager</span>
				</CardTitle>
				<CardDescription>
					Configure custom time slots for each location and class type
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Add New Time Slot */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
					<div>
						<Label htmlFor="location">Location</Label>
						<Select
							value={newTimeSlot.location}
							onValueChange={(value) =>
								setNewTimeSlot({ ...newTimeSlot, location: value })
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select location" />
							</SelectTrigger>
							<SelectContent>
								{locations.map((location) => (
									<SelectItem key={location} value={location}>
										{location}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="classType">Class Type</Label>
						<Select
							value={newTimeSlot.classType}
							onValueChange={(value) =>
								setNewTimeSlot({ ...newTimeSlot, classType: value })
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select class" />
							</SelectTrigger>
							<SelectContent>
								{classTypes.map((classType) => (
									<SelectItem key={classType} value={classType}>
										{classType}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="time">Time</Label>
						<Input
							id="time"
							placeholder="e.g., 5:15 AM"
							value={newTimeSlot.time}
							onChange={(e) =>
								setNewTimeSlot({ ...newTimeSlot, time: e.target.value })
							}
						/>
					</div>
					<div className="flex items-end">
						<Button onClick={addTimeSlot} className="w-full">
							<Plus className="h-4 w-4 mr-2" />
							Add Time
						</Button>
					</div>
				</div>

				{/* Existing Time Slots */}
				<div className="space-y-4">
					{Object.entries(timeSlots).map(([key, slots]) => {
						const [location, classType] = key.split("-")
						return (
							<div key={key} className="p-4 bg-white rounded-lg border">
								<div className="flex items-center space-x-2 mb-3">
									<MapPin className="h-4 w-4 text-slate-600" />
									<span className="font-medium">{location}</span>
									<span className="text-slate-500">•</span>
									<span className="text-slate-600">{classType}</span>
								</div>
								<div className="flex flex-wrap gap-2">
									{slots.map((time) => (
										<Badge
											key={time}
											variant="secondary"
											className="flex items-center space-x-1"
										>
											<span>{time}</span>
											<Button
												variant="ghost"
												size="icon"
												onClick={() =>
													removeTimeSlot(location, classType, time)
												}
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</Badge>
									))}
								</div>
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}

export default TimeSlotManager
