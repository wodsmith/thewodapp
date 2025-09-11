import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { User, Clock, MapPin, Award } from "lucide-react"

interface ScheduleSlot {
	class: string
	coach: string | null
	status: string
}

interface SlotAssignmentDialogProps {
	isOpen: boolean
	onClose: () => void
	slotKey: string
	slot: ScheduleSlot
	onAssignCoach: (slotKey: string, coach: string) => void
}

const SlotAssignmentDialog = ({
	isOpen,
	onClose,
	slotKey,
	slot,
	onAssignCoach,
}: SlotAssignmentDialogProps) => {
	const [selectedCoach, setSelectedCoach] = useState(slot.coach || "")

	// Mock coach data - in a real app this would come from props or context
	const availableCoaches = [
		{ name: "Sarah Johnson", skills: ["CrossFit WOD", "Olympic Lifting"] },
		{
			name: "Mike Chen",
			skills: ["CrossFit WOD", "Olympic Lifting", "Kids Class"],
		},
		{ name: "Emma Davis", skills: ["Yoga Flow", "CrossFit WOD"] },
		{ name: "Alex Rodriguez", skills: ["Olympic Lifting", "CrossFit WOD"] },
	]

	const handleAssign = () => {
		if (selectedCoach) {
			onAssignCoach(slotKey, selectedCoach)
			onClose()
		}
	}

	const handleRemove = () => {
		onAssignCoach(slotKey, "")
		onClose()
	}

	// Parse slot details from key
	const [day, time, location] = slotKey.split("-")

	// Filter coaches who can teach this class type
	const qualifiedCoaches = availableCoaches.filter((coach) =>
		coach.skills.includes(slot.class),
	)

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center space-x-2">
						<User className="h-5 w-5" />
						<span>Assign Coach</span>
					</DialogTitle>
					<DialogDescription>
						Assign or change the coach for this class slot
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Class Details */}
					<div className="p-4 bg-slate-50 rounded-lg space-y-2">
						<div className="flex items-center space-x-2">
							<Award className="h-4 w-4 text-slate-600" />
							<span className="font-medium">{slot.class}</span>
						</div>
						<div className="flex items-center space-x-2">
							<Clock className="h-4 w-4 text-slate-600" />
							<span className="text-sm text-slate-600">
								{day} at {time}
							</span>
						</div>
						<div className="flex items-center space-x-2">
							<MapPin className="h-4 w-4 text-slate-600" />
							<span className="text-sm text-slate-600">{location}</span>
						</div>
					</div>

					{/* Current Assignment */}
					{slot.coach && (
						<div className="p-3 bg-blue-50 rounded-lg">
							<p className="text-sm text-blue-700">
								Currently assigned to: <strong>{slot.coach}</strong>
							</p>
						</div>
					)}

					{/* Coach Selection */}
					<div className="space-y-2">
						<label htmlFor="coach-select" className="text-sm font-medium">
							Select Coach
						</label>
						<Select value={selectedCoach} onValueChange={setSelectedCoach}>
							<SelectTrigger id="coach-select">
								<SelectValue placeholder="Choose a coach..." />
							</SelectTrigger>
							<SelectContent>
								{qualifiedCoaches.map((coach) => (
									<SelectItem key={coach.name} value={coach.name}>
										<div className="flex items-center space-x-2">
											<span>{coach.name}</span>
											<div className="flex space-x-1">
												{coach.skills.map((skill) => (
													<Badge
														key={skill}
														variant="secondary"
														className="text-xs"
													>
														{skill}
													</Badge>
												))}
											</div>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{qualifiedCoaches.length === 0 && (
						<div className="p-3 bg-orange-50 rounded-lg">
							<p className="text-sm text-orange-700">
								No qualified coaches available for {slot.class}
							</p>
						</div>
					)}
				</div>

				<DialogFooter className="flex justify-between">
					<div>
						{slot.coach && (
							<Button variant="destructive" onClick={handleRemove}>
								Remove Coach
							</Button>
						)}
					</div>
					<div className="flex space-x-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button
							onClick={handleAssign}
							disabled={!selectedCoach || qualifiedCoaches.length === 0}
						>
							Assign Coach
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default SlotAssignmentDialog
