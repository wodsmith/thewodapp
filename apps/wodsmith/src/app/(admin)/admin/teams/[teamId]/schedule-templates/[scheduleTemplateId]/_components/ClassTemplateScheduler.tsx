"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import {
	deleteAllScheduleTemplateClassesForTemplate,
	bulkCreateScheduleTemplateClassesSimple,
	type getScheduleTemplateById,
} from "@/actions/schedule-template-actions"
import type { inferServerActionReturnData } from "zsa"

interface TimeSlot {
	id: string
	dayOfWeek: number
	startTime: string
	endTime: string
}

interface ClassTemplate {
	templateId: string
	timeSlots: TimeSlot[]
}

const DAYS = [
	{ value: 0, label: "Monday" },
	{ value: 1, label: "Tuesday" },
	{ value: 2, label: "Wednesday" },
	{ value: 3, label: "Thursday" },
	{ value: 4, label: "Friday" },
	{ value: 5, label: "Saturday" },
	{ value: 6, label: "Sunday" },
]

export default function ClassTemplateScheduler({
	template,
}: {
	template: inferServerActionReturnData<typeof getScheduleTemplateById>
}) {
	const [classTemplate, setClassTemplate] = useState<ClassTemplate>({
		templateId: template.id,
		timeSlots: template.templateClasses.map((c) => ({
			id: c.id,
			dayOfWeek: c.dayOfWeek,
			startTime: c.startTime,
			endTime: c.endTime,
		})),
	})

	const { execute: deleteAll } = useServerAction(
		deleteAllScheduleTemplateClassesForTemplate,
	)
	const { execute: bulkCreate } = useServerAction(
		bulkCreateScheduleTemplateClassesSimple,
	)

	useEffect(() => {
		if (!template?.templateClasses || template.templateClasses.length === 0)
			return

		setClassTemplate({
			templateId: template.id,
			timeSlots: template.templateClasses.map((c) => ({
				id: c.id,
				dayOfWeek: c.dayOfWeek,
				startTime: c.startTime,
				endTime: c.endTime,
			})),
		})
	}, [template])

	const generateId = () => Math.random().toString(36).substr(2, 9)

	const addTimeSlot = (dayOfWeek: number) => {
		const existingSlots = getTimeSlotsForDay(dayOfWeek)
		let startTime = "06:00"
		let endTime = "07:00"

		if (existingSlots.length > 0) {
			// Find the latest end time from existing slots
			const latestEndTime = existingSlots.reduce((latest, slot) => {
				return slot.endTime > latest ? slot.endTime : latest
			}, "00:00")

			startTime = latestEndTime
			// Add 1 hour to the start time for the end time
			const [hours, minutes] = latestEndTime.split(":").map(Number)
			const endHours = hours + 1
			endTime = `${endHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
		}

		const newSlot: TimeSlot = {
			id: generateId(),
			dayOfWeek,
			startTime,
			endTime,
		}
		setClassTemplate((prev) => ({
			...prev,
			timeSlots: [...prev.timeSlots, newSlot],
		}))
	}

	const updateTimeSlot = (
		id: string,
		field: keyof TimeSlot,
		value: string | number,
	) => {
		setClassTemplate((prev) => ({
			...prev,
			timeSlots: prev.timeSlots.map((slot) =>
				slot.id === id ? { ...slot, [field]: value } : slot,
			),
		}))
	}

	const removeTimeSlot = (id: string) => {
		setClassTemplate((prev) => ({
			...prev,
			timeSlots: prev.timeSlots.filter((slot) => slot.id !== id),
		}))
	}

	const copyDay = (fromDay: number, toDay: number) => {
		const slotsFromDay = classTemplate.timeSlots.filter(
			(slot) => slot.dayOfWeek === fromDay,
		)
		const slotsToKeep = classTemplate.timeSlots.filter(
			(slot) => slot.dayOfWeek !== toDay,
		)

		const copiedSlots = slotsFromDay.map((slot) => ({
			...slot,
			id: generateId(),
			dayOfWeek: toDay,
		}))

		setClassTemplate((prev) => ({
			...prev,
			timeSlots: [...slotsToKeep, ...copiedSlots],
		}))

		toast.success(
			`${DAYS[fromDay].label} schedule copied to ${DAYS[toDay].label}`,
		)
	}

	const copyMondayToWeekdays = () => {
		const mondaySlots = classTemplate.timeSlots.filter(
			(slot) => slot.dayOfWeek === 0,
		)
		const weekendSlots = classTemplate.timeSlots.filter(
			(slot) => slot.dayOfWeek >= 5,
		)

		const copiedSlots: TimeSlot[] = []
		for (let day = 1; day <= 4; day++) {
			const daySlots = mondaySlots.map((slot) => ({
				...slot,
				id: generateId(),
				dayOfWeek: day,
			}))
			copiedSlots.push(...daySlots)
		}

		setClassTemplate((prev) => ({
			...prev,
			timeSlots: [...mondaySlots, ...copiedSlots, ...weekendSlots],
		}))

		toast.success("Monday copied to weekdays")
	}

	const validateTimeSlot = (slot: TimeSlot) => {
		const startTime = new Date(`1970-01-01T${slot.startTime}:00`)
		const endTime = new Date(`1970-01-01T${slot.endTime}:00`)
		const duration = endTime.getTime() - startTime.getTime()
		const minimumDuration = 30 * 60 * 1000 // 30 minutes

		return duration >= minimumDuration
	}

	const hasTimeConflict = (slot: TimeSlot) => {
		return classTemplate.timeSlots.some(
			(otherSlot) =>
				otherSlot.id !== slot.id &&
				otherSlot.dayOfWeek === slot.dayOfWeek &&
				((slot.startTime >= otherSlot.startTime &&
					slot.startTime < otherSlot.endTime) ||
					(slot.endTime > otherSlot.startTime &&
						slot.endTime <= otherSlot.endTime) ||
					(slot.startTime <= otherSlot.startTime &&
						slot.endTime >= otherSlot.endTime)),
		)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Validate all time slots
		const invalidSlots = classTemplate.timeSlots.filter(
			(slot) => !validateTimeSlot(slot),
		)
		if (invalidSlots.length > 0) {
			toast.error("Some classes are less than 30 minutes")
			return
		}

		const conflictingSlots = classTemplate.timeSlots.filter((slot) =>
			hasTimeConflict(slot),
		)
		if (conflictingSlots.length > 0) {
			toast.error("There are time conflicts in the schedule")
			return
		}

		// Clear existing
		const [_delRes, delErr] = await deleteAll({ templateId: template.id })
		if (delErr) {
			toast.error("Failed to clear existing schedule")
			return
		}

		// Create new
		const timeSlotsData = classTemplate.timeSlots.map((slot) => ({
			dayOfWeek: slot.dayOfWeek,
			startTime: slot.startTime,
			endTime: slot.endTime,
		}))

		const [newClasses, createErr] = await bulkCreate({
			templateId: template.id,
			timeSlots: timeSlotsData,
			requiredCoaches: 1,
		})
		if (createErr) {
			toast.error("Failed to save template")
			return
		}

		// Update local state with new IDs
		setClassTemplate((prev) => ({
			...prev,
			timeSlots: newClasses.map((cls) => ({
				id: cls.id,
				dayOfWeek: cls.dayOfWeek,
				startTime: cls.startTime,
				endTime: cls.endTime,
			})),
		}))

		toast.success("Template saved")
	}

	const getTimeSlotsForDay = (dayOfWeek: number) => {
		return classTemplate.timeSlots
			.filter((slot) => slot.dayOfWeek === dayOfWeek)
			.sort((a, b) => a.startTime.localeCompare(b.startTime))
	}

	return (
		<div className="max-w-full mx-auto p-4 space-y-4">
			<Card>
				<CardHeader className="pb-4">
					<CardTitle>{template.name}</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Quick Actions */}
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={copyMondayToWeekdays}
								disabled={getTimeSlotsForDay(0).length === 0}
							>
								<Copy className="w-3 h-3 mr-2" />
								Copy Monday to Weekdays
							</Button>
						</div>

						{/* Weekly Schedule Grid */}
						<div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
							{DAYS.map((day) => (
								<Card key={day.value} className="min-h-80">
									<CardHeader className="pb-2 px-3 pt-3">
										<div className="flex justify-between items-center">
											<CardTitle className="text-xs font-medium">
												{day.label}
											</CardTitle>
											<div className="flex gap-1">
												{day.value > 0 && (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => copyDay(day.value - 1, day.value)}
														disabled={
															getTimeSlotsForDay(day.value - 1).length === 0
														}
														className="h-6 w-6 p-0"
													>
														<Copy className="w-3 h-3" />
													</Button>
												)}
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => addTimeSlot(day.value)}
													className="h-6 w-6 p-0"
												>
													<Plus className="w-3 h-3" />
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent className="space-y-2 px-3 pb-3">
										{getTimeSlotsForDay(day.value).map((slot) => (
											<div
												key={slot.id}
												className="space-y-1 p-2 border rounded-sm"
											>
												<div className="flex justify-between items-start gap-2">
													<div className="flex-1 space-y-1">
														<div>
															<Label className="text-xs text-muted-foreground">
																Start
															</Label>
															<Input
																type="time"
																value={slot.startTime}
																onChange={(e) =>
																	updateTimeSlot(
																		slot.id,
																		"startTime",
																		e.target.value,
																	)
																}
																className="text-xs h-7"
															/>
														</div>
														<div>
															<Label className="text-xs text-muted-foreground">
																End
															</Label>
															<Input
																type="time"
																value={slot.endTime}
																onChange={(e) =>
																	updateTimeSlot(
																		slot.id,
																		"endTime",
																		e.target.value,
																	)
																}
																className="text-xs h-7"
															/>
														</div>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => removeTimeSlot(slot.id)}
														className="h-6 w-6 p-0 mt-4"
													>
														<Trash2 className="w-3 h-3" />
													</Button>
												</div>
												{(!validateTimeSlot(slot) || hasTimeConflict(slot)) && (
													<div className="text-xs text-destructive">
														{!validateTimeSlot(slot) && "Min 30 min required"}
														{hasTimeConflict(slot) && "Time conflict"}
													</div>
												)}
											</div>
										))}
									</CardContent>
								</Card>
							))}
						</div>

						{/* Submit Button */}
						<div className="flex justify-end">
							<Button type="submit" size="lg">
								Save Template
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
