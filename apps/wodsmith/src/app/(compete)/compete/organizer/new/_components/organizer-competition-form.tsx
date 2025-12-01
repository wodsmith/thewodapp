"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { createCompetitionAction } from "@/actions/competition-actions"
import { Button } from "@/components/ui/button"
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
import type { CompetitionGroup, ScalingGroup } from "@/db/schema"
import type { CompetitionSettings } from "@/types/competitions"
import type { OrganizingTeam } from "@/utils/get-user-organizing-teams"

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
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().min(1, "End date is required"),
		description: z.string().max(2000, "Description is too long").optional(),
		registrationOpensAt: z.string().optional(),
		registrationClosesAt: z.string().optional(),
		groupId: z.string().optional(),
		scalingGroupId: z.string().optional(),
	})
	.refine(
		(data) => {
			if (!data.startDate || !data.endDate) return true
			return new Date(data.startDate) < new Date(data.endDate)
		},
		{
			message: "Start date must be before end date",
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

interface OrganizerCompetitionFormProps {
	teams: OrganizingTeam[]
	selectedTeamId: string
	groups: Array<CompetitionGroup & { competitionCount: number }>
	scalingGroups: ScalingGroup[]
	defaultGroupId?: string
}

export function OrganizerCompetitionForm({
	teams,
	selectedTeamId,
	groups,
	scalingGroups,
	defaultGroupId,
}: OrganizerCompetitionFormProps) {
	const router = useRouter()

	const { execute: createCompetition, isPending } = useServerAction(
		createCompetitionAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create competition")
			},
			onSuccess: () => {
				toast.success("Competition created successfully")
				router.push("/compete/organizer")
				router.refresh()
			},
		},
	)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			teamId: selectedTeamId,
			name: "",
			slug: "",
			startDate: "",
			endDate: "",
			description: "",
			registrationOpensAt: "",
			registrationClosesAt: "",
			groupId: defaultGroupId,
			scalingGroupId: "",
		},
	})

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

	function onSubmit(data: FormValues) {
		// Build competition settings
		const settings: CompetitionSettings = {}
		if (data.scalingGroupId) {
			settings.divisions = {
				scalingGroupId: data.scalingGroupId,
			}
		}

		createCompetition({
			organizingTeamId: data.teamId,
			name: data.name,
			slug: data.slug,
			startDate: new Date(data.startDate),
			endDate: new Date(data.endDate),
			description: data.description,
			registrationOpensAt: data.registrationOpensAt
				? new Date(data.registrationOpensAt)
				: undefined,
			registrationClosesAt: data.registrationClosesAt
				? new Date(data.registrationClosesAt)
				: undefined,
			groupId: data.groupId || undefined,
			settings:
				Object.keys(settings).length > 0 ? JSON.stringify(settings) : undefined,
		})
	}

	const handleCancel = () => {
		router.push("/compete/organizer")
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Team selector (only if multiple teams) */}
				{teams.length > 1 && (
					<FormField
						control={form.control}
						name="teamId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Organizing Team</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select team" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{teams.map((team) => (
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
				)}

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

				{scalingGroups.length > 0 && (
					<FormField
						control={form.control}
						name="scalingGroupId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Divisions (Optional)</FormLabel>
								<Select
									onValueChange={(value) =>
										field.onChange(value === "none" ? undefined : value)
									}
									value={field.value || "none"}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="No divisions" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="none">No divisions</SelectItem>
										{scalingGroups.map((group) => (
											<SelectItem key={group.id} value={group.id}>
												{group.title}
												{group.isSystem === 1 && " (System)"}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormDescription>
									Select from divisions to use that you've used in the past as a
									starting point. Athletes will choose their division when
									registering. Leave blank to start from scratch.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				<div className="grid gap-4 md:grid-cols-2">
					<FormField
						control={form.control}
						name="startDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Start Date</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormDescription>When the competition begins</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="endDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>End Date</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormDescription>When the competition ends</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

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

				<div className="flex gap-4">
					<Button type="submit" disabled={isPending}>
						{isPending ? "Creating..." : "Create Competition"}
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
