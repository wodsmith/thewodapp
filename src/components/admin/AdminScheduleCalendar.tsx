"use client"

import {
	deleteScheduledWorkoutAction,
	scheduleWorkoutAction,
	updateScheduledWorkoutAction,
} from "@/app/actions/schedulingActions"
import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service"
import {
	addDays,
	addMonths,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns"
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	Edit,
	Plus,
	Trash2,
} from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useState } from "react"

interface Props {
	teamId: string
	onWorkoutScheduled?: () => void
	onWorkoutUpdated?: () => void
	onWorkoutDeleted?: () => void
}

interface DragState {
	isDragging: boolean
	draggedWorkout: ScheduledWorkoutInstanceWithDetails | null
	dragOverDate: Date | null
}

type ViewMode = "month" | "week" | "day"

export default function AdminScheduleCalendar({
	teamId,
	onWorkoutScheduled,
	onWorkoutUpdated,
	onWorkoutDeleted,
}: Props) {
	const [currentDate, setCurrentDate] = useState(new Date())
	const [viewMode, setViewMode] = useState<ViewMode>("month")
	const [workouts, setWorkouts] = useState<
		ScheduledWorkoutInstanceWithDetails[]
	>([])
	const [loading, setLoading] = useState(true)
	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		draggedWorkout: null,
		dragOverDate: null,
	})
	const [selectedWorkout, setSelectedWorkout] =
		useState<ScheduledWorkoutInstanceWithDetails | null>(null)
	const [showQuickEditModal, setShowQuickEditModal] = useState(false)

	// Development logging
	const logAction = useCallback(
		(action: string, data: Record<string, unknown>) => {
			if (process.env.NODE_ENV === "development") {
				console.log(`[AdminScheduleCalendar] ${action}`, data)
			}
		},
		[],
	)

	// Fetch scheduled workouts for the current view
	const fetchWorkouts = useCallback(async () => {
		try {
			setLoading(true)
			logAction("Fetching workouts", {
				teamId,
				currentDate: format(currentDate, "yyyy-MM-dd"),
				viewMode,
			})

			// TODO: Replace with actual API call to schedulingService.getScheduledWorkoutsForTeam
			// For now, using mock data
			const mockWorkouts: ScheduledWorkoutInstanceWithDetails[] = [
				{
					id: "swi_1",
					teamId,
					trackWorkoutId: "trwk_1",
					scheduledDate: new Date(),
					teamSpecificNotes: "Mock workout 1",
					scalingGuidanceForDay: null,
					classTimes: "9:00 AM, 6:00 PM",
					createdAt: new Date(),
					updatedAt: new Date(),
					trackWorkout: {
						id: "trwk_1",
						trackId: "track_1",
						workoutId: "workout_1",
						dayNumber: 1,
						weekNumber: 1,
						notes: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						updateCounter: 0,
					},
				},
			]

			setWorkouts(mockWorkouts)
			logAction("Fetched workouts", { count: mockWorkouts.length })
		} catch (error) {
			console.error("[AdminScheduleCalendar] Error fetching workouts:", error)
		} finally {
			setLoading(false)
		}
	}, [teamId, currentDate, viewMode, logAction])

	useEffect(() => {
		fetchWorkouts()
	}, [fetchWorkouts])

	// Calendar navigation
	const navigateMonth = (direction: "prev" | "next") => {
		const newDate =
			direction === "prev"
				? subMonths(currentDate, 1)
				: addMonths(currentDate, 1)
		setCurrentDate(newDate)
		logAction("Navigate month", {
			direction,
			newDate: format(newDate, "yyyy-MM-dd"),
		})
	}

	// Drag and drop handlers
	const handleDragStart = (
		e: React.DragEvent,
		workout: ScheduledWorkoutInstanceWithDetails,
	) => {
		setDragState({
			isDragging: true,
			draggedWorkout: workout,
			dragOverDate: null,
		})
		logAction("Drag start", {
			workoutId: workout.id,
			originalDate: format(workout.scheduledDate, "yyyy-MM-dd"),
		})
	}

	const handleDragOver = (e: React.DragEvent, date: Date) => {
		e.preventDefault()
		setDragState((prev) => ({ ...prev, dragOverDate: date }))
	}

	const handleDragLeave = () => {
		setDragState((prev) => ({ ...prev, dragOverDate: null }))
	}

	const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
		e.preventDefault()

		if (!dragState.draggedWorkout) return

		const originalDate = dragState.draggedWorkout.scheduledDate
		if (isSameDay(originalDate, targetDate)) {
			setDragState({
				isDragging: false,
				draggedWorkout: null,
				dragOverDate: null,
			})
			return
		}

		logAction("Drag-and-drop scheduling", {
			workoutId: dragState.draggedWorkout.id,
			trackWorkoutId: dragState.draggedWorkout.trackWorkoutId,
			fromDate: format(originalDate, "yyyy-MM-dd"),
			toDate: format(targetDate, "yyyy-MM-dd"),
			teamId,
		})

		// TODO: Implement actual drag-and-drop scheduling
		// const formData = new FormData()
		// formData.append('workoutId', dragState.draggedWorkout.trackWorkoutId)
		// formData.append('scheduledDate', format(targetDate, 'yyyy-MM-dd'))
		// formData.append('teamId', teamId)
		// await scheduleWorkoutAction(formData)

		// Update local state optimistically
		setWorkouts((prev) =>
			prev.map((w) =>
				w.id === dragState.draggedWorkout?.id
					? { ...w, scheduledDate: targetDate, updatedAt: new Date() }
					: w,
			),
		)

		setDragState({
			isDragging: false,
			draggedWorkout: null,
			dragOverDate: null,
		})
		onWorkoutScheduled?.()
	}

	// Quick edit modal handlers
	const openQuickEdit = (workout: ScheduledWorkoutInstanceWithDetails) => {
		setSelectedWorkout(workout)
		setShowQuickEditModal(true)
		logAction("Open quick edit", { workoutId: workout.id })
	}

	const handleQuickEdit = async (data: {
		notes?: string
		scalingGuidance?: string
		classTimes?: string
	}) => {
		if (!selectedWorkout) return

		logAction("Quick edit workout", {
			workoutId: selectedWorkout.id,
			changes: data,
		})

		// TODO: Implement actual update
		// await updateScheduledWorkoutAction(selectedWorkout.id, formData)

		// Update local state optimistically
		setWorkouts((prev) =>
			prev.map((w) =>
				w.id === selectedWorkout.id
					? {
							...w,
							teamSpecificNotes: data.notes ?? w.teamSpecificNotes,
							scalingGuidanceForDay:
								data.scalingGuidance ?? w.scalingGuidanceForDay,
							classTimes: data.classTimes ?? w.classTimes,
							updatedAt: new Date(),
						}
					: w,
			),
		)

		setShowQuickEditModal(false)
		setSelectedWorkout(null)
		onWorkoutUpdated?.()
	}

	const handleDeleteWorkout = async (workoutId: string) => {
		if (!confirm("Are you sure you want to delete this scheduled workout?"))
			return

		logAction("Delete workout", { workoutId, teamId })

		// TODO: Implement actual deletion
		// await deleteScheduledWorkoutAction(workoutId)

		setWorkouts((prev) => prev.filter((w) => w.id !== workoutId))
		onWorkoutDeleted?.()
	}

	// Calendar grid generation
	const generateCalendarDays = () => {
		const start = startOfWeek(startOfMonth(currentDate))
		const end = endOfWeek(endOfMonth(currentDate))
		const days = []
		let day = start

		while (day <= end) {
			days.push(day)
			day = addDays(day, 1)
		}

		return days
	}

	const getWorkoutsForDate = (date: Date) => {
		return workouts.filter((workout) =>
			isSameDay(new Date(workout.scheduledDate), date),
		)
	}

	const calendarDays = generateCalendarDays()

	if (loading) {
		return (
			<div className="flex items-center justify-center h-96">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
				<span className="ml-2 text-gray-600">Loading calendar...</span>
			</div>
		)
	}

	return (
		<div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
			{/* Calendar Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center space-x-4">
					<h2 className="text-xl font-semibold text-gray-900">
						{format(currentDate, "MMMM yyyy")}
					</h2>
					<div className="flex space-x-1">
						<button
							type="button"
							onClick={() => navigateMonth("prev")}
							className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
							aria-label="Previous month"
						>
							<ChevronLeft className="h-5 w-5" />
						</button>
						<button
							type="button"
							onClick={() => navigateMonth("next")}
							className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
							aria-label="Next month"
						>
							<ChevronRight className="h-5 w-5" />
						</button>
					</div>
				</div>

				<div className="flex items-center space-x-2">
					<div className="flex rounded-lg border">
						{(["month", "week", "day"] as ViewMode[]).map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => setViewMode(mode)}
								className={`px-3 py-1 text-sm capitalize transition-colors ${
									viewMode === mode
										? "bg-blue-600 text-white"
										: "text-gray-600 hover:bg-gray-100"
								}`}
							>
								{mode}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Calendar Grid */}
			<div className="flex-1 p-4">
				{/* Days of week header */}
				<div className="grid grid-cols-7 gap-px mb-2">
					{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
						<div
							key={day}
							className="p-2 text-center text-sm font-medium text-gray-500"
						>
							{day}
						</div>
					))}
				</div>

				{/* Calendar days */}
				<div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden flex-1">
					{calendarDays.map((day) => {
						const dayWorkouts = getWorkoutsForDate(day)
						const isCurrentMonth = isSameMonth(day, currentDate)
						const isToday = isSameDay(day, new Date())
						const isDragOver =
							dragState.dragOverDate && isSameDay(dragState.dragOverDate, day)

						return (
							<div
								key={day.toISOString()}
								className={`bg-white p-2 min-h-[120px] flex flex-col transition-colors ${
									!isCurrentMonth ? "bg-gray-50 text-gray-400" : ""
								} ${isToday ? "bg-blue-50" : ""} ${
									isDragOver
										? "bg-blue-100 border-2 border-blue-300 border-dashed"
										: ""
								}`}
								onDragOver={(e) => handleDragOver(e, day)}
								onDragLeave={handleDragLeave}
								onDrop={(e) => handleDrop(e, day)}
							>
								<div className="flex items-center justify-between">
									<span
										className={`text-sm ${
											isToday ? "font-bold text-blue-600" : ""
										}`}
									>
										{format(day, "d")}
									</span>
									{isCurrentMonth && (
										<button
											type="button"
											className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
											title="Quick schedule"
										>
											<Plus className="h-3 w-3" />
										</button>
									)}
								</div>

								{/* Scheduled workouts */}
								<div className="flex-1 mt-1 space-y-1">
									{dayWorkouts.map((workout) => (
										<div
											key={workout.id}
											draggable
											onDragStart={(e) => handleDragStart(e, workout)}
											className="bg-blue-600 text-white text-xs p-1 rounded cursor-move hover:bg-blue-700 transition-colors group"
											title={workout.teamSpecificNotes || "Scheduled workout"}
										>
											<div className="flex items-center justify-between">
												<span className="truncate">
													{workout.trackWorkout?.id || "Workout"}
												</span>
												<div className="flex space-x-1 opacity-0 group-hover:opacity-100">
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation()
															openQuickEdit(workout)
														}}
														className="hover:bg-blue-800 p-0.5 rounded"
													>
														<Edit className="h-3 w-3" />
													</button>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation()
															handleDeleteWorkout(workout.id)
														}}
														className="hover:bg-red-600 p-0.5 rounded"
													>
														<Trash2 className="h-3 w-3" />
													</button>
												</div>
											</div>
											{workout.classTimes && (
												<div className="text-xs opacity-75 mt-0.5">
													{workout.classTimes}
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						)
					})}
				</div>
			</div>

			{/* Quick Edit Modal */}
			{showQuickEditModal && selectedWorkout && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 w-full max-w-md">
						<h3 className="text-lg font-semibold mb-4">Quick Edit Workout</h3>
						<form
							onSubmit={(e) => {
								e.preventDefault()
								const formData = new FormData(e.currentTarget)
								handleQuickEdit({
									notes: formData.get("notes") as string,
									scalingGuidance: formData.get("scalingGuidance") as string,
									classTimes: formData.get("classTimes") as string,
								})
							}}
						>
							<div className="space-y-4">
								<div>
									<label
										htmlFor="notes"
										className="block text-sm font-medium text-gray-700"
									>
										Team Notes
									</label>
									<textarea
										id="notes"
										name="notes"
										rows={3}
										defaultValue={selectedWorkout.teamSpecificNotes || ""}
										className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
									/>
								</div>
								<div>
									<label
										htmlFor="scalingGuidance"
										className="block text-sm font-medium text-gray-700"
									>
										Scaling Guidance
									</label>
									<textarea
										id="scalingGuidance"
										name="scalingGuidance"
										rows={2}
										defaultValue={selectedWorkout.scalingGuidanceForDay || ""}
										className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
									/>
								</div>
								<div>
									<label
										htmlFor="classTimes"
										className="block text-sm font-medium text-gray-700"
									>
										Class Times
									</label>
									<input
										type="text"
										id="classTimes"
										name="classTimes"
										defaultValue={selectedWorkout.classTimes || ""}
										placeholder="e.g., 9:00 AM, 6:00 PM"
										className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
									/>
								</div>
							</div>
							<div className="flex justify-end space-x-3 mt-6">
								<button
									type="button"
									onClick={() => {
										setShowQuickEditModal(false)
										setSelectedWorkout(null)
									}}
									className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
								>
									Save Changes
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}
