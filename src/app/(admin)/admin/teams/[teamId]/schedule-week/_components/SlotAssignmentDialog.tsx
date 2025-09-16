import { useState, useEffect, useCallback } from "react"
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
import {
	User,
	Clock,
	MapPin,
	Award,
	AlertCircle,
	CheckCircle,
	XCircle,
} from "lucide-react"
import {
	getAvailableCoachesForClassAction,
	updateScheduledClassAction,
} from "@/actions/generate-schedule-actions"
import { toast } from "sonner"
import { format } from "date-fns"
import type { getScheduledClassesForDisplay } from "@/server/ai/scheduler"

// Type for ScheduledClass with relationships populated - use actual server function return type
type ScheduledClassWithRelations = Awaited<
	ReturnType<typeof getScheduledClassesForDisplay>
>[number]

type CoachData = {
	id: string
	userId: string
	name: string
	email: string | null
	schedulingPreference?: string | null
	schedulingNotes?: string | null
	skills: Array<{
		id: string
		name: string
		description?: string | null
		teamId: string
		createdAt: Date
		updatedAt: Date
	}>
}

interface SlotAssignmentDialogProps {
	isOpen: boolean
	onClose: () => void
	scheduledClass: ScheduledClassWithRelations
	coaches: CoachData[]
	teamId: string
	onScheduleUpdate: () => void
}

interface AvailableCoach {
	coach: CoachData
	isAvailable: boolean
	reasons: string[]
}

const SlotAssignmentDialog = ({
	isOpen,
	onClose,
	scheduledClass,
	coaches,
	teamId,
	onScheduleUpdate,
}: SlotAssignmentDialogProps) => {
	const [selectedCoachId, setSelectedCoachId] = useState(
		scheduledClass.coachId || "",
	)
	const [availableCoaches, setAvailableCoaches] = useState<AvailableCoach[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isUpdating, setIsUpdating] = useState(false)
	const [showWarning, setShowWarning] = useState(false)
	const [warningMessage, setWarningMessage] = useState("")

	const loadAvailableCoaches = useCallback(async () => {
		setIsLoading(true)
		try {
			const [result] = await getAvailableCoachesForClassAction({
				classId: scheduledClass.id,
				teamId,
			})
			if (result) {
				// Transform the data to match the expected format
				const transformedCoaches: AvailableCoach[] = []

				// Add available coaches
				result.availableCoaches?.forEach((coach) => {
					transformedCoaches.push({
						coach,
						isAvailable: true,
						reasons: [],
					})
				})

				// Add unavailable coaches
				result.unavailableCoaches?.forEach((coach) => {
					transformedCoaches.push({
						coach,
						isAvailable: false,
						reasons: [coach.unavailabilityReason],
					})
				})

				setAvailableCoaches(transformedCoaches)
			}
		} catch (error) {
			console.error("Failed to load available coaches:", error)
			toast.error("Failed to load available coaches")
		} finally {
			setIsLoading(false)
		}
	}, [scheduledClass.id, teamId])

	useEffect(() => {
		if (scheduledClass.id) {
			loadAvailableCoaches()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scheduledClass.id, loadAvailableCoaches])

	const handleAssign = async () => {
		if (!selectedCoachId) return

		setIsUpdating(true)
		try {
			const [result] = await updateScheduledClassAction({
				classId: scheduledClass.id,
				teamId,
				coachId: selectedCoachId || null,
			})

			if (result) {
				toast.success("Coach assigned successfully")
				onScheduleUpdate()
				onClose()
			}
		} catch (error) {
			console.error("Failed to assign coach:", error)
			toast.error("Failed to assign coach")
		} finally {
			setIsUpdating(false)
		}
	}

	const handleRemove = async () => {
		setIsUpdating(true)
		try {
			const [result] = await updateScheduledClassAction({
				classId: scheduledClass.id,
				teamId,
				coachId: null,
			})

			if (result) {
				toast.success("Coach removed successfully")
				onScheduleUpdate()
				onClose()
			}
		} catch (error) {
			console.error("Failed to remove coach:", error)
			toast.error("Failed to remove coach")
		} finally {
			setIsUpdating(false)
		}
	}

	// Format class date and time
	const classDate = new Date(scheduledClass.startTime)
	const dayName = format(classDate, "EEEE")
	const time = format(classDate, "h:mm a")
	const location = scheduledClass.location

	// Find current coach info
	const currentCoach = coaches.find((c) => c.id === scheduledClass.coachId)
	const currentCoachName = currentCoach?.name || currentCoach?.email

	// Separate available and unavailable coaches
	const qualifiedCoaches = availableCoaches.filter((ac) => ac.isAvailable)
	const unavailableCoaches = availableCoaches.filter((ac) => !ac.isAvailable)

	// Handle coach selection
	const handleCoachSelect = (coachId: string) => {
		setSelectedCoachId(coachId)

		// Check if the selected coach is unavailable
		const selectedCoach = availableCoaches.find((ac) => ac.coach.id === coachId)
		if (selectedCoach && !selectedCoach.isAvailable) {
			setShowWarning(true)
			setWarningMessage(`Warning: ${selectedCoach.reasons.join(". ")}`)
		} else {
			setShowWarning(false)
			setWarningMessage("")
		}
	}

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
							<span className="font-medium">
								{scheduledClass.classCatalog?.name || "Class"}
							</span>
						</div>
						<div className="flex items-center space-x-2">
							<Clock className="h-4 w-4 text-slate-600" />
							<span className="text-sm text-slate-600">
								{dayName} at {time}
							</span>
						</div>
						<div className="flex items-center space-x-2">
							<MapPin className="h-4 w-4 text-slate-600" />
							<span className="text-sm text-slate-600">
								{location?.name || "Location"}
							</span>
						</div>
					</div>

					{/* Current Assignment */}
					{currentCoachName && (
						<div className="p-3 bg-blue-50 rounded-lg">
							<p className="text-sm text-blue-700">
								Currently assigned to: <strong>{currentCoachName}</strong>
							</p>
						</div>
					)}

					{/* Coach Selection */}
					{isLoading ? (
						<div className="p-4 text-center text-slate-600">
							Loading available coaches...
						</div>
					) : (
						<div className="space-y-2">
							<label htmlFor="coach-select" className="text-sm font-medium">
								Select Coach
							</label>
							<Select
								value={selectedCoachId}
								onValueChange={handleCoachSelect}
								disabled={isUpdating}
							>
								<SelectTrigger>
									<SelectValue placeholder="Choose a coach..." />
								</SelectTrigger>
								<SelectContent>
									{qualifiedCoaches.length > 0 && (
										<>
											<div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
												Available Coaches
											</div>
											{qualifiedCoaches.map(({ coach }) => (
												<SelectItem key={coach.id} value={coach.id}>
													<div className="flex items-center space-x-2">
														<CheckCircle className="h-3 w-3 text-green-500" />
														<span>{coach.name}</span>
														<div className="flex space-x-1">
															{coach.skills?.map((skill) => (
																<Badge
																	key={skill.id}
																	variant="secondary"
																	className="text-xs"
																>
																	{skill.name}
																</Badge>
															))}
														</div>
													</div>
												</SelectItem>
											))}
										</>
									)}

									{unavailableCoaches.length > 0 && (
										<>
											<div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
												Unavailable Coaches
											</div>
											{unavailableCoaches.map(({ coach, reasons }) => (
												<SelectItem key={coach.id} value={coach.id}>
													<div className="flex items-center justify-between w-full">
														<div className="flex items-center space-x-2">
															<XCircle className="h-3 w-3 text-orange-500" />
															<span>{coach.name}</span>
														</div>
														<div className="text-xs text-orange-600">
															{reasons.join(", ")}
														</div>
													</div>
												</SelectItem>
											))}
										</>
									)}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Warning when selecting unavailable coach */}
					{showWarning && (
						<div className="p-3 bg-orange-50 rounded-lg flex items-start space-x-2">
							<AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
							<div>
								<p className="text-sm text-orange-700 font-medium">
									Admin Override Warning
								</p>
								<p className="text-xs text-orange-600 mt-1">{warningMessage}</p>
								<p className="text-xs text-orange-600 mt-1">
									As an admin, you can still assign this coach, but please be
									aware of the constraints.
								</p>
							</div>
						</div>
					)}

					{qualifiedCoaches.length === 0 &&
						unavailableCoaches.length === 0 &&
						!isLoading && (
							<div className="p-3 bg-red-50 rounded-lg flex items-start space-x-2">
								<AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
								<div>
									<p className="text-sm text-red-700 font-medium">
										No coaches found
									</p>
									<p className="text-xs text-red-600 mt-1">
										There are no coaches available for this team.
									</p>
								</div>
							</div>
						)}
				</div>

				<DialogFooter className="flex justify-between">
					<div>
						{currentCoach && (
							<Button
								variant="destructive"
								onClick={handleRemove}
								disabled={isUpdating}
							>
								Remove Coach
							</Button>
						)}
					</div>
					<div className="flex space-x-2">
						<Button variant="outline" onClick={onClose} disabled={isUpdating}>
							Cancel
						</Button>
						<Button
							onClick={handleAssign}
							disabled={!selectedCoachId || isUpdating}
							variant={showWarning ? "destructive" : "default"}
						>
							{isUpdating
								? "Updating..."
								: showWarning
									? "Assign Anyway"
									: "Assign Coach"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default SlotAssignmentDialog
