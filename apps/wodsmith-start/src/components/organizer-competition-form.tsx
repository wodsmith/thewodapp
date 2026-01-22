"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Competition, CompetitionGroup } from "@/db/schemas/competitions"
import {
	createCompetitionFn,
	updateCompetitionFn,
} from "@/server-fns/competition-fns"
import {
	COMMON_US_TIMEZONES,
	DEFAULT_TIMEZONE,
} from "@/utils/timezone-utils"

const formSchema = z
	.object({
		teamId: z.string().min(1, "Team is required"),
		name: z
			.string()
			.min(1, "Competition name is required")
			.max(255, "Name is too long"),
		slug: z
			.string()
			.min(2, "Slug must be at least 2 characters")
			.max(255, "Slug is too long")
			.regex(
				/^[a-z0-9-]+$/,
				"Slug must be lowercase letters, numbers, and hyphens only",
			),
		competitionType: z.enum(["in-person", "online"]),
		isMultiDay: z.boolean(),
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().optional(),
		description: z.string().max(2000, "Description is too long").optional(),
		registrationOpensAt: z.string().optional(),
		registrationClosesAt: z.string().optional(),
		groupId: z.string().optional(),
		visibility: z.enum(["public", "private"]).optional(),
		status: z.enum(["draft", "published"]).optional(),
		timezone: z.string().min(1, "Timezone is required"),
	})
	.refine(
		(data) => {
			// For single-day competitions, endDate is optional (will be set to startDate on submit)
			if (!data.isMultiDay) return true
			// For multi-day competitions, endDate is required
			if (!data.endDate) return false
			return true
		},
		{
			message: "End date is required for multi-day competitions",
			path: ["endDate"],
		},
	)
	.refine(
		(data) => {
			if (!data.startDate) return true
			// For single-day competitions, no endDate validation needed
			if (!data.isMultiDay) return true
			// For multi-day competitions, endDate must be after startDate
			if (!data.endDate) return true // Already handled by previous refine
			return new Date(data.startDate) < new Date(data.endDate)
		},
		{
			message: "End date must be after start date for multi-day competitions",
			path: ["endDate"],
		},
	)
	.refine(
		(data) => {
			if (!data.registrationOpensAt || !data.registrationClosesAt) return true
			return (
				new Date(data.registrationOpensAt) < new Date(data.registrationClosesAt)
			)
		},
		{
			message: "Registration opening must be before closing",
			path: ["registrationClosesAt"],
		},
	)

type FormValues = z.infer<typeof formSchema>

// Minimal team type for the form - only needs id, name, type
interface TeamForForm {
	id: string
	name: string
	type: string
}

interface OrganizerCompetitionFormProps {
	teams: TeamForForm[]
	selectedTeamId: string
	groups?: CompetitionGroup[]
	competition?: Competition
	onSuccess?: (competitionId: string) => void
	onCancel?: () => void
}

export function OrganizerCompetitionForm({
	teams,
	selectedTeamId,
	groups = [],
	competition,
	onSuccess,
	onCancel,
}: OrganizerCompetitionFormProps) {
	const navigate = useNavigate()
	const router = useRouter()
	const isEditMode = !!competition

	// Determine if existing competition is multi-day (start and end dates differ)
	const existingIsMultiDay = competition
		? formatDateForInput(competition.startDate) !==
			formatDateForInput(competition.endDate)
		: false

	const form = useForm<FormValues>({
		resolver: standardSchemaResolver(formSchema),
		defaultValues: {
			teamId: competition?.organizingTeamId ?? selectedTeamId,
			name: competition?.name ?? "",
			slug: competition?.slug ?? "",
			competitionType: competition?.competitionType ?? "in-person",
			isMultiDay: existingIsMultiDay,
			startDate: competition?.startDate
				? formatDateForInput(competition.startDate)
				: "",
			endDate: competition?.endDate
				? formatDateForInput(competition.endDate)
				: "",
			description: competition?.description ?? "",
			registrationOpensAt: competition?.registrationOpensAt
				? formatDateForInput(competition.registrationOpensAt)
				: "",
			registrationClosesAt: competition?.registrationClosesAt
				? formatDateForInput(competition.registrationClosesAt)
				: "",
			groupId: competition?.groupId ?? "",
			visibility: competition?.visibility ?? "public",
			status: competition?.status ?? "draft",
			timezone: competition?.timezone ?? DEFAULT_TIMEZONE,
		},
	})

	const isMultiDay = form.watch("isMultiDay")

	// Auto-generate slug from name
	const handleNameChange = (name: string) => {
		// Only auto-generate slug if we're not in edit mode or the slug hasn't been manually edited
		if (!isEditMode || !form.formState.dirtyFields.slug) {
			const slug = name
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.trim()

			form.setValue("slug", slug)
		}
	}

	async function onSubmit(data: FormValues) {
		// For single-day competitions, endDate = startDate
		const effectiveEndDate =
			data.isMultiDay && data.endDate ? data.endDate : data.startDate

		try {
			if (isEditMode && competition) {
				// Update existing competition
				const result = await updateCompetitionFn({
					data: {
						competitionId: competition.id,
						name: data.name,
						slug: data.slug,
						startDate: data.startDate,
						endDate: effectiveEndDate,
						description: data.description || null,
						registrationOpensAt: data.registrationOpensAt || null,
						registrationClosesAt: data.registrationClosesAt || null,
						groupId: data.groupId || null,
						visibility: data.visibility,
						status: data.status,
						timezone: data.timezone,
					},
				})

				if (result.competition) {
					toast.success("Competition updated successfully")
					await router.invalidate()
					onSuccess?.(result.competition.id)
				}
			} else {
				// Create new competition
				const result = await createCompetitionFn({
					data: {
						organizingTeamId: data.teamId,
						name: data.name,
						slug: data.slug,
						startDate: data.startDate,
						endDate: effectiveEndDate,
						description: data.description,
						registrationOpensAt: data.registrationOpensAt || undefined,
						registrationClosesAt: data.registrationClosesAt || undefined,
						groupId: data.groupId || undefined,
						timezone: data.timezone,
						competitionType: data.competitionType,
					},
				})

				if (result.competitionId) {
					toast.success("Competition created successfully")
					await router.invalidate()
					onSuccess?.(result.competitionId)
				}
			}
		} catch (error) {
			console.error("Failed to save competition:", error)
			const message =
				error instanceof Error ? error.message : "An error occurred"
			toast.error(
				isEditMode
					? `Failed to update competition: ${message}`
					: `Failed to create competition: ${message}`,
			)
		}
	}

	const handleCancel = () => {
		if (onCancel) {
			onCancel()
		} else {
			navigate({ to: "/compete/organizer" })
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Team selector */}
				<FormField
					control={form.control}
					name="teamId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Organizing Team</FormLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
								disabled={isEditMode}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select team" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{teams
										.filter((team) => team.type === "gym")
										.map((team) => (
											<SelectItem key={team.id} value={team.id}>
												{team.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
							<FormDescription>
								The team that will organize this competition
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Competition Name */}
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Competition Name</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., Summer Throwdown 2026"
									{...field}
									onChange={(e) => {
										field.onChange(e)
										handleNameChange(e.target.value)
									}}
								/>
							</FormControl>
							<FormDescription>
								A descriptive name for your competition
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Slug */}
				<FormField
					control={form.control}
					name="slug"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Slug</FormLabel>
							<FormControl>
								<Input placeholder="e.g., summer-throwdown-2026" {...field} />
							</FormControl>
							<FormDescription>
								URL-friendly identifier (globally unique, lowercase, hyphens
								only)
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Competition Type */}
				<FormField
					control={form.control}
					name="competitionType"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Competition Type</FormLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
								disabled={isEditMode}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select competition type" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="in-person">
										In-Person - Traditional venue-based competition
									</SelectItem>
									<SelectItem value="online">
										Online - Virtual competition with video submissions
									</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>
								{field.value === "online"
									? "Athletes submit video recordings of their workouts"
									: "Athletes compete at a physical venue"}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Series/Group Selector */}
				{groups.length > 0 && (
					<FormField
						control={form.control}
						name="groupId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Series (Optional)</FormLabel>
								<Select
									onValueChange={(value) =>
										field.onChange(value === "none" ? undefined : value)
									}
									value={field.value || "none"}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="No series" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="none">No series</SelectItem>
										{groups.map((group) => (
											<SelectItem key={group.id} value={group.id}>
												{group.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormDescription>
									Optionally assign this competition to a series
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				{/* Competition Date */}
				<FormField
					control={form.control}
					name="startDate"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{isMultiDay ? "Start Date" : "Competition Date"}
							</FormLabel>
							<FormControl>
								<Input type="date" {...field} />
							</FormControl>
							<FormDescription>
								{isMultiDay
									? "When the competition begins"
									: "The date of the competition"}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Multi-day toggle */}
				<FormField
					control={form.control}
					name="isMultiDay"
					render={({ field }) => (
						<FormItem className="flex flex-row items-start space-x-3 space-y-0">
							<FormControl>
								<Checkbox
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
							<div className="space-y-1 leading-none">
								<FormLabel>Multi-day competition</FormLabel>
								<FormDescription>
									Enable this if your competition spans multiple days
								</FormDescription>
							</div>
						</FormItem>
					)}
				/>

				{/* End Date (only shown for multi-day) */}
				{isMultiDay && (
					<FormField
						control={form.control}
						name="endDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>End Date</FormLabel>
								<FormControl>
									<Input type="date" {...field} value={field.value || ""} />
								</FormControl>
								<FormDescription>When the competition ends</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				{/* Registration Dates */}
				<div className="grid gap-4 md:grid-cols-2">
					<FormField
						control={form.control}
						name="registrationOpensAt"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Registration Opens (Optional)</FormLabel>
								<FormControl>
									<Input type="date" {...field} value={field.value || ""} />
								</FormControl>
								<FormDescription>When registration opens</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="registrationClosesAt"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Registration Closes (Optional)</FormLabel>
								<FormControl>
									<Input type="date" {...field} value={field.value || ""} />
								</FormControl>
								<FormDescription>When registration closes</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				{/* Timezone */}
				<FormField
					control={form.control}
					name="timezone"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Timezone</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select timezone" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{COMMON_US_TIMEZONES.map((tz) => (
										<SelectItem key={tz.value} value={tz.value}>
											{tz.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormDescription>
								All dates and times will be interpreted in this timezone
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Description */}
				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description (Optional)</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Enter a description of this competition"
									{...field}
									value={field.value || ""}
									rows={4}
								/>
							</FormControl>
							<FormDescription>
								Provide details about the competition
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Visibility and Status (Edit mode only) */}
				{isEditMode && (
					<div className="grid gap-4 md:grid-cols-2">
						<FormField
							control={form.control}
							name="visibility"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Visibility</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="public">Public</SelectItem>
											<SelectItem value="private">Private</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										Public competitions are listed on /compete
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="status"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Status</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="draft">Draft</SelectItem>
											<SelectItem value="published">Published</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										Draft competitions are only visible to organizers
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				)}

				{/* Form Actions */}
				<div className="flex gap-4">
					<Button type="submit" disabled={form.formState.isSubmitting}>
						{form.formState.isSubmitting
							? isEditMode
								? "Updating..."
								: "Creating..."
							: isEditMode
								? "Update Competition"
								: "Create Competition"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleCancel}
						disabled={form.formState.isSubmitting}
					>
						Cancel
					</Button>
				</div>
			</form>
		</Form>
	)
}

/**
 * Format a date for HTML input. Now that dates are stored as YYYY-MM-DD strings,
 * this is just a passthrough for strings. Kept for backwards compatibility with Date objects.
 */
function formatDateForInput(date: Date | string | number | null | undefined): string {
	if (!date) return ""
	// If already a YYYY-MM-DD string, return as-is
	if (typeof date === "string") {
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
		// Try to parse other string formats
		const d = new Date(date)
		if (Number.isNaN(d.getTime())) return ""
		const year = d.getUTCFullYear()
		const month = String(d.getUTCMonth() + 1).padStart(2, "0")
		const day = String(d.getUTCDate()).padStart(2, "0")
		return `${year}-${month}-${day}`
	}
	const d = date instanceof Date ? date : new Date(date)
	if (Number.isNaN(d.getTime())) return ""

	const year = d.getUTCFullYear()
	const month = String(d.getUTCMonth() + 1).padStart(2, "0")
	const day = String(d.getUTCDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}
