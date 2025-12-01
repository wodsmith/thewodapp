"use client"

import { addDays, format, startOfWeek } from "date-fns"
import {
	AlertTriangle,
	Calendar,
	Grid,
	List,
	MapPin,
	User,
	Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	checkExistingScheduleAction,
	generateScheduleAction,
	getAvailableCoachesForClassAction,
	updateScheduledClassAction,
} from "@/actions/generate-schedule-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

interface ScheduleGeneratorProps {
	teamId: string
	templateId?: string
	locationId?: string
}

interface ScheduledClass {
	id: string
	scheduleId: string
	classCatalogId: string
	locationId: string
	coachId: string | null
	startTime: Date
	endTime: Date
	classCatalog: {
		id: string
		name: string
		description: string | null
		teamId: string
		durationMinutes: number
		maxParticipants: number
	}
	location: {
		id: string
		name: string
	}
	coach: {
		id: string
		userId: string
		user: {
			firstName: string | null
			lastName: string | null
			email: string | null
		}
	} | null
}

export function ScheduleGenerator({
	teamId,
	templateId,
	locationId,
}: ScheduleGeneratorProps) {
	const [isGenerating, setIsGenerating] = useState(false)
	const [currentWeek, _setCurrentWeek] = useState(new Date())
	const [_showTimeSlotManager, _setShowTimeSlotManager] = useState(false)
	const [viewMode, setViewMode] = useState<"grid" | "master">("grid")
	const [selectedSlot, setSelectedSlot] = useState<ScheduledClass | null>(null)
	const [availableCoaches, setAvailableCoaches] = useState<any[]>([])
	const [unavailableCoaches, setUnavailableCoaches] = useState<any[]>([])
	const [selectedCoachId, setSelectedCoachId] = useState<string>("")
	const [schedule, setSchedule] = useState<{
		schedule?: any
		scheduledClasses: ScheduledClass[]
		unstaffedClassesCount: number
		totalClassesCount: number
		staffedClassesCount: number
	} | null>(null)

	// Server actions
	const { execute: generateSchedule } = useServerAction(
		generateScheduleAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to generate schedule")
				setIsGenerating(false)
			},
			onSuccess: (result) => {
				toast.success("Schedule generated successfully!")
				setSchedule(result.data)
				setIsGenerating(false)
			},
		},
	)

	const { execute: checkExistingSchedule } = useServerAction(
		checkExistingScheduleAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to check existing schedule")
			},
			onSuccess: (result) => {
				if (result.data.exists && result.data.schedule) {
					// Transform the schedule data to match our expected format
					const transformedSchedule = {
						schedule: result.data.schedule,
						scheduledClasses: result.data.schedule.scheduledClasses || [],
						unstaffedClassesCount:
							result.data.schedule.scheduledClasses?.filter(
								(c: any) => !c.coachId,
							).length || 0,
						totalClassesCount:
							result.data.schedule.scheduledClasses?.length || 0,
						staffedClassesCount:
							result.data.schedule.scheduledClasses?.filter(
								(c: any) => c.coachId,
							).length || 0,
					}
					setSchedule(transformedSchedule)
				}
			},
		},
	)

	const { execute: updateScheduledClass } = useServerAction(
		updateScheduledClassAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to update class")
			},
			onSuccess: (result) => {
				toast.success("Class updated successfully!")
				// Update the local schedule state
				if (schedule && result.data) {
					const updatedClasses = schedule.scheduledClasses.map((c) =>
						c.id === result.data.id ? result.data : c,
					) as ScheduledClass[]
					const unstaffedCount = updatedClasses.filter((c) => !c.coachId).length
					setSchedule({
						...schedule,
						scheduledClasses: updatedClasses,
						unstaffedClassesCount: unstaffedCount,
						staffedClassesCount: updatedClasses.length - unstaffedCount,
					})
				}
				setSelectedSlot(null)
				setSelectedCoachId("")
			},
		},
	)

	const { execute: getAvailableCoaches } = useServerAction(
		getAvailableCoachesForClassAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to get available coaches")
			},
			onSuccess: (result) => {
				setAvailableCoaches(result.data.availableCoaches)
				setUnavailableCoaches(result.data.unavailableCoaches)
			},
		},
	)

	// Check for existing schedule on mount and when week changes
	useEffect(() => {
		if (teamId) {
			checkExistingSchedule({
				teamId,
				weekStartDate: startOfWeek(currentWeek, { weekStartsOn: 1 }),
			})
		}
	}, [teamId, currentWeek, checkExistingSchedule])

	const handleGenerateSchedule = async () => {
		if (!templateId) {
			toast.error("Please select a schedule template first")
			return
		}

		if (!locationId) {
			toast.error("Location ID is required for schedule generation")
			return
		}

		setIsGenerating(true)
		await generateSchedule({
			templateId,
			locationId,
			weekStartDate: startOfWeek(currentWeek, { weekStartsOn: 1 }),
			teamId,
		})
	}

	const handleSlotClick = (slot: ScheduledClass) => {
		setSelectedSlot(slot)
		setSelectedCoachId(slot.coachId || "")
		// Get available coaches for this class
		getAvailableCoaches({
			classId: slot.id,
			teamId,
		})
	}

	const handleAssignCoach = async () => {
		if (!selectedSlot) return

		await updateScheduledClass({
			classId: selectedSlot.id,
			teamId,
			coachId: selectedCoachId || null,
		})
	}

	const formatWeekRange = (date: Date) => {
		const start = startOfWeek(date, { weekStartsOn: 1 })
		const end = addDays(start, 6)
		return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`
	}

	const days = [
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
		"Sunday",
	]

	// Group scheduled classes by location and time
	const getScheduleGrid = () => {
		if (!schedule?.scheduledClasses) return {}

		const grid: { [key: string]: { [key: string]: ScheduledClass[] } } = {}

		schedule.scheduledClasses.forEach((scheduledClass) => {
			const dayIndex = scheduledClass.startTime.getDay()
			const day = days[dayIndex === 0 ? 6 : dayIndex - 1] // Adjust for Sunday = 0
			const time = format(scheduledClass.startTime, "h:mm a")
			const location = scheduledClass.location.name

			if (!grid[location]) grid[location] = {}
			const locationGrid = grid[location]
			if (locationGrid) {
				if (!locationGrid[`${day}-${time}`]) locationGrid[`${day}-${time}`] = []

				locationGrid[`${day}-${time}`]?.push(scheduledClass)
			}
		})

		return grid
	}

	// Get unique time slots from scheduled classes
	const getUniqueTimeSlots = () => {
		if (!schedule?.scheduledClasses) return []

		const timeSlots = new Set<string>()
		schedule.scheduledClasses.forEach((scheduledClass) => {
			timeSlots.add(format(scheduledClass.startTime, "h:mm a"))
		})

		return Array.from(timeSlots).sort((a, b) => {
			const timeA = new Date(`2000/01/01 ${a}`)
			const timeB = new Date(`2000/01/01 ${b}`)
			return timeA.getTime() - timeB.getTime()
		})
	}

	// Get unique locations
	const getUniqueLocations = () => {
		if (!schedule?.scheduledClasses) return []

		const locations = new Set<string>()
		schedule.scheduledClasses.forEach((scheduledClass) => {
			locations.add(scheduledClass.location.name)
		})

		return Array.from(locations).sort()
	}

	const scheduleGrid = getScheduleGrid()
	const timeSlots = getUniqueTimeSlots()
	const locations = getUniqueLocations()

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
			<header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="bg-gradient-to-br from-orange-500 to-pink-600 p-2 rounded-xl">
								<Calendar className="h-6 w-6 text-white" />
							</div>
							<div>
								<h1 className="text-2xl font-bold text-slate-800">
									Schedule Generator
								</h1>
								<p className="text-sm text-slate-600">
									AI-powered weekly class scheduling
								</p>
							</div>
						</div>
						<div className="flex space-x-2">
							<Button
								onClick={() =>
									setViewMode(viewMode === "grid" ? "master" : "grid")
								}
								variant="outline"
								className="border-slate-300"
							>
								{viewMode === "grid" ? (
									<>
										<List className="h-4 w-4 mr-2" />
										Master View
									</>
								) : (
									<>
										<Grid className="h-4 w-4 mr-2" />
										Grid View
									</>
								)}
							</Button>
							<Button
								onClick={handleGenerateSchedule}
								disabled={isGenerating || !templateId}
								className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700"
							>
								{isGenerating ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
										Generating...
									</>
								) : (
									<>
										<Zap className="h-4 w-4 mr-2" />
										Generate Schedule
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				{/* Schedule Stats */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					<Card className="bg-white/60 backdrop-blur-sm border-white/20">
						<CardContent className="p-4 text-center">
							<div className="text-2xl font-bold text-blue-600">
								{formatWeekRange(currentWeek)}
							</div>
							<div className="text-sm text-slate-600">Current Week</div>
						</CardContent>
					</Card>
					<Card className="bg-white/60 backdrop-blur-sm border-white/20">
						<CardContent className="p-4 text-center">
							<div className="text-2xl font-bold text-green-600">
								{schedule?.staffedClassesCount || 0}
							</div>
							<div className="text-sm text-slate-600">Classes Scheduled</div>
						</CardContent>
					</Card>
					<Card className="bg-white/60 backdrop-blur-sm border-white/20">
						<CardContent className="p-4 text-center">
							<div className="text-2xl font-bold text-orange-600">
								{schedule?.unstaffedClassesCount || 0}
							</div>
							<div className="text-sm text-slate-600">Need Attention</div>
						</CardContent>
					</Card>
				</div>

				{/* Alert for unscheduled classes */}
				{schedule && schedule.unstaffedClassesCount > 0 && (
					<Card className="bg-orange-50 border-orange-200 mb-6">
						<CardContent className="p-4">
							<div className="flex items-center space-x-2">
								<AlertTriangle className="h-5 w-5 text-orange-600" />
								<div>
									<h3 className="font-medium text-orange-800">
										{schedule.unstaffedClassesCount} classes need manual
										assignment
									</h3>
									<p className="text-sm text-orange-700">
										These classes couldn't be automatically assigned due to
										constraints. Please review and assign coaches manually.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Schedule Grid View */}
				{viewMode === "grid" && schedule && (
					<Card className="bg-white/60 backdrop-blur-sm border-white/20">
						<CardContent className="p-6">
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr>
											<th className="text-left p-2 font-medium text-slate-700">
												Location / Time
											</th>
											{days.map((day) => (
												<th
													key={day}
													className="text-center p-2 font-medium text-slate-700 min-w-[120px]"
												>
													{day}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{locations.map((location) => (
											<>
												<tr key={location}>
													<td
														colSpan={8}
														className="pt-4 pb-2 font-semibold text-slate-800 bg-slate-50"
													>
														<div className="flex items-center space-x-2 px-2">
															<MapPin className="h-4 w-4" />
															<span>{location}</span>
														</div>
													</td>
												</tr>
												{timeSlots.map((time) => (
													<tr key={`${location}-${time}`}>
														<td className="p-2 text-sm text-slate-600">
															{time}
														</td>
														{days.map((day) => {
															const classes =
																scheduleGrid[location]?.[`${day}-${time}`] || []

															return (
																<td
																	key={`${location}-${day}-${time}`}
																	className="p-2"
																>
																	{classes.map((scheduledClass) => (
																		<Button
																			key={scheduledClass.id}
																			variant="ghost"
																			className={`w-full h-16 border rounded p-2 text-xs cursor-pointer hover:shadow-md transition-shadow ${
																				!scheduledClass.coachId
																					? "border-orange-300 bg-orange-50 hover:bg-orange-100"
																					: "border-slate-200 bg-white hover:bg-slate-50"
																			}`}
																			onClick={() =>
																				handleSlotClick(scheduledClass)
																			}
																		>
																			<div className="flex flex-col items-start w-full">
																				<div className="font-medium text-slate-800 truncate w-full text-left">
																					{scheduledClass.classCatalog &&
																					typeof scheduledClass.classCatalog ===
																						"object" &&
																					"name" in scheduledClass.classCatalog
																						? scheduledClass.classCatalog.name
																						: "Class"}
																				</div>
																				{scheduledClass.coach &&
																				typeof scheduledClass.coach ===
																					"object" &&
																				"user" in scheduledClass.coach ? (
																					<div className="text-slate-600 truncate w-full text-left">
																						{scheduledClass.coach.user &&
																						typeof scheduledClass.coach.user ===
																							"object" &&
																						"firstName" in
																							scheduledClass.coach.user
																							? `${scheduledClass.coach.user.firstName} ${scheduledClass.coach.user.lastName}`
																							: "Unknown"}
																					</div>
																				) : (
																					<div className="text-orange-600 flex items-center">
																						<AlertTriangle className="h-3 w-3 mr-1" />
																						Unassigned
																					</div>
																				)}
																			</div>
																		</Button>
																	))}
																</td>
															)
														})}
													</tr>
												))}
											</>
										))}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Master Schedule View */}
				{viewMode === "master" && schedule && (
					<Card className="bg-white/60 backdrop-blur-sm border-white/20">
						<CardContent className="p-6">
							<div className="space-y-4">
								{days.map((day) => {
									const dayClasses = schedule.scheduledClasses
										.filter((c) => {
											const classDay = c.startTime.getDay()
											return days[classDay === 0 ? 6 : classDay - 1] === day
										})
										.sort(
											(a, b) => a.startTime.getTime() - b.startTime.getTime(),
										)

									if (dayClasses.length === 0) return null

									return (
										<div key={day}>
											<h3 className="font-semibold text-lg text-slate-800 mb-2">
												{day}
											</h3>
											<div className="space-y-2">
												{dayClasses.map((scheduledClass) => (
													<div
														key={scheduledClass.id}
														className={`flex items-center justify-between p-3 rounded-lg border ${
															!scheduledClass.coachId
																? "bg-orange-50 border-orange-200"
																: "bg-white border-slate-200"
														}`}
													>
														<div className="flex items-center space-x-4">
															<div className="text-sm font-medium text-slate-600">
																{format(scheduledClass.startTime, "h:mm a")}
															</div>
															<div>
																<div className="font-medium">
																	{scheduledClass.classCatalog.name}
																</div>
																<div className="text-sm text-slate-600">
																	{scheduledClass.location.name}
																</div>
															</div>
														</div>
														<div className="flex items-center space-x-2">
															{scheduledClass.coach ? (
																<Badge variant="secondary">
																	{scheduledClass.coach.user.firstName}{" "}
																	{scheduledClass.coach.user.lastName}
																</Badge>
															) : (
																<Badge variant="destructive">Unassigned</Badge>
															)}
															<Button
																size="sm"
																variant="ghost"
																onClick={() => handleSlotClick(scheduledClass)}
															>
																<User className="h-4 w-4" />
															</Button>
														</div>
													</div>
												))}
											</div>
										</div>
									)
								})}
							</div>
						</CardContent>
					</Card>
				)}
			</main>

			{/* Slot Assignment Dialog */}
			<Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Assign Coach</DialogTitle>
						<DialogDescription>
							{selectedSlot && (
								<>
									Assign a coach to {selectedSlot.classCatalog.name} on{" "}
									{format(selectedSlot.startTime, "EEEE, MMM d 'at' h:mm a")}
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="coach">Available Coaches</Label>
							<Select
								value={selectedCoachId}
								onValueChange={setSelectedCoachId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a coach" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">Unassigned</SelectItem>
									{availableCoaches.map((coach) => (
										<SelectItem key={coach.id} value={coach.id}>
											{coach.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{unavailableCoaches.length > 0 && (
							<div>
								<Label>Unavailable Coaches</Label>
								<div className="space-y-2 mt-2">
									{unavailableCoaches.map((coach) => (
										<div
											key={coach.id}
											className="text-sm text-slate-600 flex items-center justify-between"
										>
											<span>{coach.name}</span>
											<span className="text-xs text-red-600">
												{coach.unavailabilityReason}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setSelectedSlot(null)}>
							Cancel
						</Button>
						<Button onClick={handleAssignCoach}>
							{selectedCoachId ? "Assign Coach" : "Remove Assignment"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
