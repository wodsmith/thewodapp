"use client"
import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
	Calendar,
	Zap,
	Settings,
	AlertTriangle,
	List,
	Grid,
	ChevronLeft,
	ChevronRight,
	MapPin,
} from "lucide-react"
import ScheduleStats from "./ScheduleStats"
import ScheduleGrid from "./ScheduleGrid"
import MasterSchedule from "./MasterSchedule"
import CreateScheduleDialog from "./CreateScheduleDialog"
import type {
	GeneratedSchedule,
	ScheduleTemplate,
	Location,
} from "@/db/schemas/scheduling"
import type { getCoachesByTeam } from "@/actions/coach-actions"
import type { getScheduledClassesForDisplay } from "@/server/ai/scheduler"
import { getScheduledClassesAction } from "@/actions/generate-schedule-actions"
import { format, startOfWeek, addWeeks, isSameWeek } from "date-fns"
import { toast } from "sonner"

// Type for coaches with relations - extract from ZSA response success case
type CoachWithRelations = NonNullable<
	NonNullable<Awaited<ReturnType<typeof getCoachesByTeam>>[0]>["data"]
>[number]

// Type for scheduled classes with relations
type ScheduledClassWithRelations = Awaited<
	ReturnType<typeof getScheduledClassesForDisplay>
>[number]

interface ScheduleProps {
	schedules: GeneratedSchedule[]
	templates: ScheduleTemplate[]
	locations: Location[]
	coaches: CoachWithRelations[]
	teamId: string
}

const Schedule = ({
	schedules,
	templates,
	locations,
	coaches,
	teamId,
}: ScheduleProps) => {
	const [currentWeekDate, setCurrentWeekDate] = useState(() =>
		startOfWeek(new Date(), { weekStartsOn: 1 }),
	)
	const [showTimeSlotManager, setShowTimeSlotManager] = useState(false)
	const [viewMode, setViewMode] = useState<"grid" | "master">("grid")
	const [scheduledClasses, setScheduledClasses] = useState<
		ScheduledClassWithRelations[]
	>([])
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
		null,
	)

	// Find all schedules for the current week (one per location)
	const currentSchedules = useMemo(() => {
		return schedules.filter((schedule) =>
			isSameWeek(new Date(schedule.weekStartDate), currentWeekDate, {
				weekStartsOn: 1,
			}),
		)
	}, [schedules, currentWeekDate])

	const loadAllScheduledClasses = useCallback(
		async (schedules: GeneratedSchedule[]) => {
			try {
				const allClasses: ScheduledClassWithRelations[] = []

				// Load classes for each schedule (one per location)
				for (const schedule of schedules) {
					const [result] = await getScheduledClassesAction({
						scheduleId: schedule.id,
						teamId,
					})
					if (result?.success && result.data) {
						allClasses.push(...result.data)
					}
				}

				setScheduledClasses(allClasses)
			} catch (error) {
				console.error("Failed to load scheduled classes:", error)
				toast.error("Failed to load scheduled classes")
			}
		},
		[teamId],
	)

	// Load scheduled classes when current schedules change
	useEffect(() => {
		if (currentSchedules.length > 0) {
			loadAllScheduledClasses(currentSchedules)
		} else {
			// Clear scheduled classes if no schedules exist
			setScheduledClasses([])
		}
	}, [currentSchedules, loadAllScheduledClasses])

	// Count locations without schedules as needing attention
	const locationsWithoutSchedules = locations.filter(
		(location) =>
			!currentSchedules.some((schedule) => schedule.locationId === location.id),
	).length

	const unscheduledCount =
		scheduledClasses.filter((cls) => !cls.coachId).length +
		locationsWithoutSchedules
	const totalScheduled = scheduledClasses.filter((cls) => cls.coachId).length

	const formatWeekRange = (date: Date) => {
		const endDate = addWeeks(date, 1)
		return `${format(date, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`
	}

	const handleWeekChange = (direction: "prev" | "next") => {
		setCurrentWeekDate((prev) =>
			direction === "next" ? addWeeks(prev, 1) : addWeeks(prev, -1),
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-3">
					<div className="rounded-xl bg-primary/10 p-2 text-primary">
						<Calendar className="h-6 w-6" />
					</div>
					<div>
						<h1 className="text-2xl font-bold">Weekly Schedule</h1>
						<p className="text-sm text-muted-foreground">
							Assign coaches to scheduled classes
						</p>
					</div>
				</div>
				<div className="flex items-center space-x-4">
					{/* Week Navigation */}
					<div className="flex items-center space-x-2">
						<Button
							variant="outline"
							size="icon"
							onClick={() => handleWeekChange("prev")}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="text-sm font-medium min-w-[150px] text-center">
							{formatWeekRange(currentWeekDate)}
						</span>
						<Button
							variant="outline"
							size="icon"
							onClick={() => handleWeekChange("next")}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex space-x-2">
						<Button
							onClick={() =>
								setViewMode(viewMode === "grid" ? "master" : "grid")
							}
							variant="outline"
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
							onClick={() => setShowTimeSlotManager(!showTimeSlotManager)}
							variant="outline"
						>
							<Settings className="h-4 w-4 mr-2" />
							Time Slots
						</Button>
					</div>
				</div>
			</div>
			<ScheduleStats
				currentWeek={formatWeekRange(currentWeekDate)}
				totalScheduled={totalScheduled}
				unscheduledCount={unscheduledCount}
			/>

			{/* Alert for unscheduled classes */}
			{currentSchedules.length > 0 && unscheduledCount > 0 && (
				<Card className="border border-primary/20 bg-primary/10">
					<CardContent className="p-4">
						<div className="flex items-center space-x-2">
							<AlertTriangle className="h-5 w-5 text-primary" />
							<div>
								<h3 className="font-medium text-primary">
									{unscheduledCount} classes need manual assignment
								</h3>
								<p className="text-sm text-primary/80">
									Click on any class to assign a coach.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{viewMode === "grid" ? (
				<div className="space-y-6">
					{locations.map((location) => {
						// Find schedule for this location
						const locationSchedule = currentSchedules.find(
							(s) => s.locationId === location.id,
						)

						// Filter scheduled classes for this location
						const locationClasses = scheduledClasses.filter(
							(cls) => cls.locationId === location.id,
						)

						if (locationSchedule) {
							// Location has a schedule - show the grid
							return (
								<ScheduleGrid
									key={location.id}
									scheduledClasses={locationClasses}
									templates={templates}
									locations={[location]} // Pass only this location
									coaches={coaches}
									currentWeek={formatWeekRange(currentWeekDate)}
									scheduleId={locationSchedule.id}
									teamId={teamId}
									onScheduleUpdate={() =>
										loadAllScheduledClasses(currentSchedules)
									}
								/>
							)
						} else {
							// Location doesn't have a schedule - show create button
							return (
								<Card key={location.id}>
									<CardContent className="p-8">
										<div className="flex items-center justify-between">
											<div className="flex items-center space-x-4">
												<div className="rounded-xl bg-muted p-3 text-muted-foreground">
													<MapPin className="h-6 w-6" />
												</div>
												<div>
													<h3 className="text-lg font-semibold">
														{location.name}
													</h3>
													<p className="text-sm text-muted-foreground">
														No schedule exists for this week
													</p>
												</div>
											</div>
											<Button
												onClick={() => {
													setSelectedLocationId(location.id)
													setShowCreateDialog(true)
												}}
											>
												<Zap className="mr-2 h-4 w-4" />
												Create Schedule
											</Button>
										</div>
									</CardContent>
								</Card>
							)
						}
					})}
				</div>
			) : (
				<MasterSchedule
					scheduledClasses={scheduledClasses}
					currentWeek={formatWeekRange(currentWeekDate)}
					coaches={coaches}
					locations={locations}
				/>
			)}

			{/* Create Schedule Dialog */}
			<CreateScheduleDialog
				isOpen={showCreateDialog}
				onClose={() => {
					setShowCreateDialog(false)
					setSelectedLocationId(null)
				}}
				teamId={teamId}
				weekStartDate={currentWeekDate}
				locations={
					selectedLocationId
						? locations.filter((l) => l.id === selectedLocationId)
						: locations
				}
				onScheduleCreated={() => {
					// Reload the page to fetch the new schedule
					window.location.reload()
				}}
			/>
		</div>
	)
}

export default Schedule
