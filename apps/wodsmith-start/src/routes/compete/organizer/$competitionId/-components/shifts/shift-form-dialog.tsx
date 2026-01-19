"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { VolunteerShift } from "@/db/schemas/volunteers"
import {
	createShiftFn,
	updateShiftFn,
} from "@/server-fns/volunteer-shift-fns"
import { cn } from "@/utils/cn"

// Shift role type enum values (excluding equipment per VS-011 requirements)
const shiftRoleTypeEnum = z.enum([
	"judge",
	"head_judge",
	"medical",
	"check_in",
	"staff",
	"scorekeeper",
	"emcee",
	"floor_manager",
	"media",
	"general",
])

type ShiftRoleType = z.infer<typeof shiftRoleTypeEnum>

// Role type options for the select dropdown
const SHIFT_ROLE_TYPES: { value: ShiftRoleType; label: string }[] = [
	{ value: "judge", label: "Judge" },
	{ value: "head_judge", label: "Head Judge" },
	{ value: "medical", label: "Medical" },
	{ value: "check_in", label: "Check-In" },
	{ value: "staff", label: "Staff" },
	{ value: "scorekeeper", label: "Scorekeeper" },
	{ value: "emcee", label: "Emcee" },
	{ value: "floor_manager", label: "Floor Manager" },
	{ value: "media", label: "Media" },
	{ value: "general", label: "General" },
]

// Form validation schema
const shiftFormSchema = z
	.object({
		name: z.string().min(1, "Name is required").max(200, "Name is too long"),
		roleType: shiftRoleTypeEnum,
		date: z.date(),
		startTime: z
			.string()
			.min(1, "Start time is required")
			.regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
		endTime: z
			.string()
			.min(1, "End time is required")
			.regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
		location: z.string().max(200, "Location is too long").optional(),
		capacity: z.number().int().min(1, "Capacity must be at least 1"),
		notes: z.string().max(1000, "Notes are too long").optional(),
	})
	.refine(
		(data) => {
			// Validate startTime is before endTime on the same day
			const [startHours, startMins] = data.startTime.split(":").map(Number)
			const [endHours, endMins] = data.endTime.split(":").map(Number)
			const startMinutes = (startHours ?? 0) * 60 + (startMins ?? 0)
			const endMinutes = (endHours ?? 0) * 60 + (endMins ?? 0)
			return startMinutes < endMinutes
		},
		{
			message: "Start time must be before end time",
			path: ["endTime"],
		},
	)

type ShiftFormValues = z.infer<typeof shiftFormSchema>

interface ShiftFormDialogProps {
	competitionId: string
	open: boolean
	onOpenChange: (open: boolean) => void
	/** The shift to edit, or undefined for create mode */
	shift?: VolunteerShift
	/** Callback when the form is successfully submitted */
	onSuccess?: () => void
}

/**
 * Helper to format a time from a Date object to HH:MM string
 */
function formatTimeFromDate(date: Date): string {
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	return `${hours}:${minutes}`
}

/**
 * Combine a date and time string into a Date object
 */
function combineDateAndTime(date: Date, timeString: string): Date {
	const [hours, minutes] = timeString.split(":").map(Number)
	const result = new Date(date)
	result.setHours(hours, minutes, 0, 0)
	return result
}

export function ShiftFormDialog({
	competitionId,
	open,
	onOpenChange,
	shift,
	onSuccess,
}: ShiftFormDialogProps) {
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)

	const createShift = useServerFn(createShiftFn)
	const updateShift = useServerFn(updateShiftFn)

	const isEditing = !!shift

	// Initialize form with default values
	const form = useForm<ShiftFormValues>({
		resolver: standardSchemaResolver(shiftFormSchema),
		defaultValues: {
			name: "",
			roleType: undefined,
			date: new Date(),
			startTime: "09:00",
			endTime: "12:00",
			location: "",
			capacity: 1,
			notes: "",
		},
	})

	// Reset form when dialog opens or shift changes
	useEffect(() => {
		if (open) {
			if (shift) {
				// Edit mode - pre-fill with shift values
				const startDate = new Date(shift.startTime)
				const endDate = new Date(shift.endTime)
				form.reset({
					name: shift.name,
					roleType: shift.roleType as ShiftFormValues["roleType"],
					date: startDate,
					startTime: formatTimeFromDate(startDate),
					endTime: formatTimeFromDate(endDate),
					location: shift.location ?? "",
					capacity: shift.capacity,
					notes: shift.notes ?? "",
				})
			} else {
				// Create mode - reset to defaults
				form.reset({
					name: "",
					roleType: undefined,
					date: new Date(),
					startTime: "09:00",
					endTime: "12:00",
					location: "",
					capacity: 1,
					notes: "",
				})
			}
		}
	}, [open, shift, form])

	const handleSubmit = async (values: ShiftFormValues) => {
		setIsSubmitting(true)

		try {
			// Combine date and time into full timestamps
			const startTime = combineDateAndTime(values.date, values.startTime)
			const endTime = combineDateAndTime(values.date, values.endTime)

			if (isEditing && shift) {
				// Update existing shift
				await updateShift({
					data: {
						shiftId: shift.id,
						name: values.name,
						roleType: values.roleType,
						startTime,
						endTime,
						location: values.location || undefined,
						capacity: values.capacity,
						notes: values.notes || undefined,
					},
				})
				toast.success("Shift updated successfully")
			} else {
				// Create new shift
				await createShift({
					data: {
						competitionId,
						name: values.name,
						roleType: values.roleType,
						startTime,
						endTime,
						location: values.location || undefined,
						capacity: values.capacity,
						notes: values.notes || undefined,
					},
				})
				toast.success("Shift created successfully")
			}

			onOpenChange(false)
			router.invalidate()
			onSuccess?.()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: isEditing
						? "Failed to update shift"
						: "Failed to create shift",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEditing ? "Edit Shift" : "Add Shift"}</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update the volunteer shift details."
							: "Create a new volunteer shift for this competition."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4"
					>
						{/* Shift Name */}
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Shift Name</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Morning Check-In"
											disabled={isSubmitting}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Role Type */}
						<FormField
							control={form.control}
							name="roleType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Role Type</FormLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
										disabled={isSubmitting}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a role type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{SHIFT_ROLE_TYPES.map((role) => (
												<SelectItem key={role.value} value={role.value}>
													{role.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Date */}
						<FormField
							control={form.control}
							name="date"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Date</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant="outline"
													disabled={isSubmitting}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, "PPP")
													) : (
														<span>Pick a date</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												selected={field.value}
												onSelect={field.onChange}
												disabled={(date) =>
													date < new Date(new Date().setHours(0, 0, 0, 0))
												}
												autoFocus
											/>
										</PopoverContent>
									</Popover>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Time Range */}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="startTime"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Start Time</FormLabel>
										<FormControl>
											<Input
												type="time"
												disabled={isSubmitting}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="endTime"
								render={({ field }) => (
									<FormItem>
										<FormLabel>End Time</FormLabel>
										<FormControl>
											<Input
												type="time"
												disabled={isSubmitting}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Location (optional) */}
						<FormField
							control={form.control}
							name="location"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Location (optional)</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Main Entrance"
											disabled={isSubmitting}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Where this shift takes place
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Capacity */}
						<FormField
							control={form.control}
							name="capacity"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Capacity</FormLabel>
									<FormControl>
										<Input
											type="number"
											min={1}
											disabled={isSubmitting}
											value={field.value}
											onChange={(e) => field.onChange(Number(e.target.value) || 1)}
											onBlur={field.onBlur}
											name={field.name}
											ref={field.ref}
										/>
									</FormControl>
									<FormDescription>
										Maximum number of volunteers for this shift
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Notes (optional) */}
						<FormField
							control={form.control}
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Notes (optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Additional instructions or notes for this shift..."
											className="resize-none"
											disabled={isSubmitting}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter className="pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting
									? isEditing
										? "Saving..."
										: "Creating..."
									: isEditing
										? "Save Changes"
										: "Create Shift"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
