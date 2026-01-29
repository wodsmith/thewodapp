"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ChevronDownIcon, MapPinIcon } from "lucide-react"
import { AddressFields } from "@/components/forms/address-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { ImageUpload } from "@/components/ui/image-upload"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Competition, CompetitionGroup } from "@/db/schemas/competitions"
import { updateCompetitionFn } from "@/server-fns/competition-fns"
import {
	COMMON_US_TIMEZONES,
	DEFAULT_TIMEZONE,
} from "@/utils/timezone-utils"

/**
 * Format a date value for HTML date inputs.
 * Handles YYYY-MM-DD strings (new format) or Date objects (legacy).
 */
function formatDateForInput(
	date: Date | string | number | null | undefined,
): string {
	if (date == null) return ""
	// If already a YYYY-MM-DD string, return as-is
	if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return date
	}
	// Handle Date objects or timestamps (legacy)
	const d = date instanceof Date ? date : new Date(date)
	if (Number.isNaN(d.getTime())) return ""
	const year = d.getUTCFullYear()
	const month = String(d.getUTCMonth() + 1).padStart(2, "0")
	const day = String(d.getUTCDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

const formSchema = z
	.object({
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
		groupId: z.string().nullable().optional(),
		visibility: z.enum(["public", "private"]),
		status: z.enum(["draft", "published"]),
		timezone: z.string().min(1, "Timezone is required"),
		address: z
			.object({
				name: z.string().optional(),
				streetLine1: z.string().optional(),
				streetLine2: z.string().optional(),
				city: z.string().optional(),
				stateProvince: z.string().optional(),
				postalCode: z.string().optional(),
				countryCode: z.string().optional(),
				notes: z.string().optional(),
			})
			.optional(),
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

interface CompetitionWithAddress extends Competition {
	primaryAddress?: {
		name: string | null
		streetLine1: string | null
		streetLine2: string | null
		city: string | null
		stateProvince: string | null
		postalCode: string | null
		countryCode: string | null
		notes: string | null
	} | null
}

interface OrganizerCompetitionEditFormProps {
	competition: CompetitionWithAddress
	groups: Array<CompetitionGroup & { competitionCount: number }>
	isPendingApproval?: boolean
}

export function OrganizerCompetitionEditForm({
	competition,
	groups,
	isPendingApproval = false,
}: OrganizerCompetitionEditFormProps) {
	const router = useRouter()
	const [isPending, setIsPending] = useState(false)
	const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
		competition.profileImageUrl ?? null,
	)
	const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(
		competition.bannerImageUrl ?? null,
	)
	// Open location section by default if address exists
	const hasExistingAddress = Boolean(
		competition.primaryAddress?.streetLine1 ||
			competition.primaryAddress?.city,
	)
	const [isLocationOpen, setIsLocationOpen] = useState(hasExistingAddress)

	// Use useServerFn hook for client-side server function calls
	const updateCompetition = useServerFn(updateCompetitionFn)

	// Determine if existing competition is multi-day (start and end dates differ)
	const existingIsMultiDay =
		formatDateForInput(competition.startDate) !==
		formatDateForInput(competition.endDate)

	const form = useForm<FormValues>({
		resolver: standardSchemaResolver(formSchema),
		defaultValues: {
			name: competition.name,
			slug: competition.slug,
			competitionType: competition.competitionType ?? "in-person",
			isMultiDay: existingIsMultiDay,
			startDate: formatDateForInput(competition.startDate),
			endDate: formatDateForInput(competition.endDate),
			description: competition.description || "",
			registrationOpensAt: formatDateForInput(
				competition.registrationOpensAt,
			),
			registrationClosesAt: formatDateForInput(
				competition.registrationClosesAt,
			),
			groupId: competition.groupId ?? undefined,
			visibility: competition.visibility ?? "public",
			status: competition.status ?? "draft",
			timezone: competition.timezone ?? DEFAULT_TIMEZONE,
			address: {
				name: competition.primaryAddress?.name ?? "",
				streetLine1: competition.primaryAddress?.streetLine1 ?? "",
				streetLine2: competition.primaryAddress?.streetLine2 ?? "",
				city: competition.primaryAddress?.city ?? "",
				stateProvince: competition.primaryAddress?.stateProvince ?? "",
				postalCode: competition.primaryAddress?.postalCode ?? "",
				countryCode: competition.primaryAddress?.countryCode ?? "",
				notes: competition.primaryAddress?.notes ?? "",
			},
		},
	})

	const isMultiDay = form.watch("isMultiDay")
	const competitionType = form.watch("competitionType")

	// Auto-generate slug from name
	const handleNameChange = (name: string) => {
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.trim()

		form.setValue("slug", slug)
	}

	async function onSubmit(data: FormValues) {
		// For single-day competitions, endDate = startDate
		const effectiveEndDate =
			data.isMultiDay && data.endDate ? data.endDate : data.startDate

		setIsPending(true)
		try {
			await updateCompetition({
				data: {
					competitionId: competition.id,
					name: data.name,
					slug: data.slug,
					startDate: data.startDate,
					endDate: effectiveEndDate,
					description: data.description || null,
					registrationOpensAt: data.registrationOpensAt || null,
					registrationClosesAt: data.registrationClosesAt || null,
					groupId: data.groupId,
					visibility: data.visibility,
					status: data.status,
					competitionType: data.competitionType,
					profileImageUrl,
					bannerImageUrl,
					timezone: data.timezone,
					address: data.address,
				},
			})
			toast.success("Competition updated successfully")
			router.navigate({
				to: "/compete/organizer/$competitionId",
				params: { competitionId: competition.id },
			})
			await router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update competition",
			)
		} finally {
			setIsPending(false)
		}
	}

	const handleCancel = () => {
		router.navigate({
			to: "/compete/organizer/$competitionId",
			params: { competitionId: competition.id },
		})
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
										if (!form.formState.dirtyFields.slug) {
											handleNameChange(e.target.value)
										}
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
							<Select onValueChange={field.onChange} value={field.value}>
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

				{/* Location Section - Only shown for in-person competitions */}
				{competitionType === "in-person" && (
					<Collapsible open={isLocationOpen} onOpenChange={setIsLocationOpen}>
						<div className="rounded-lg border p-4">
							<CollapsibleTrigger className="flex w-full items-center justify-between">
								<div className="flex items-center gap-2">
									<MapPinIcon className="h-5 w-5 text-muted-foreground" />
									<h3 className="text-lg font-semibold">Location</h3>
								</div>
								<ChevronDownIcon
									className={`h-5 w-5 transition-transform ${isLocationOpen ? "rotate-180" : ""}`}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-4">
								<AddressFields form={form} prefix="address" />
							</CollapsibleContent>
						</div>
					</Collapsible>
				)}

				<div className="grid gap-6 md:grid-cols-2">
					<div className="space-y-2">
						<Label>Profile Image</Label>
						<ImageUpload
							purpose="competition-profile"
							entityId={competition.id}
							value={profileImageUrl ?? undefined}
							onChange={setProfileImageUrl}
							maxSizeMb={5}
							aspectRatio="1/1"
							recommendedDimensions={{ width: 400, height: 400 }}
						/>
						<p className="text-sm text-muted-foreground">
							Your competition logo or profile picture
						</p>
					</div>

					<div className="space-y-2">
						<Label>Banner Image</Label>
						<ImageUpload
							purpose="competition-banner"
							entityId={competition.id}
							value={bannerImageUrl ?? undefined}
							onChange={setBannerImageUrl}
							maxSizeMb={5}
							aspectRatio="3/1"
							recommendedDimensions={{ width: 1200, height: 400 }}
						/>
						<p className="text-sm text-muted-foreground">
							Hero banner displayed at the top of your competition page
						</p>
					</div>
				</div>

				{groups.length > 0 && (
					<FormField
						control={form.control}
						name="groupId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Series (Optional)</FormLabel>
								<Select
									onValueChange={(value) => {
										if (value === "none") {
											field.onChange(null)
										} else {
											field.onChange(value)
										}
									}}
									value={field.value ?? "none"}
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

				<FormField
					control={form.control}
					name="status"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Status</FormLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
								disabled={isPendingApproval && field.value === "draft"}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select status" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="draft">
										Draft - Not visible to athletes
									</SelectItem>
									<SelectItem value="published" disabled={isPendingApproval}>
										Published - Visible to athletes
									</SelectItem>
								</SelectContent>
							</Select>
							{isPendingApproval ? (
								<FormDescription className="text-amber-600 dark:text-amber-400">
									Publishing is disabled while your organizer application is
									pending approval
								</FormDescription>
							) : (
								<FormDescription>
									Draft competitions are only visible to organizers
								</FormDescription>
							)}
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="visibility"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Visibility</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select visibility" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="public">
										Public - Listed on /compete page
									</SelectItem>
									<SelectItem value="private">
										Private - Unlisted, accessible via direct URL
									</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>
								Private competitions are not listed publicly but can be accessed
								via direct URL
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex gap-4">
					<Button type="submit" disabled={isPending}>
						{isPending ? "Saving..." : "Save Changes"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleCancel}
						disabled={isPending}
					>
						Cancel
					</Button>
				</div>
			</form>
		</Form>
	)
}
