"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useServerAction } from "@repo/zsa-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { updateCompetitionGroupAction } from "@/actions/competition-actions"
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
import { Textarea } from "@/components/ui/textarea"
import type { CompetitionGroup } from "@/db/schema"

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Series name is required")
		.max(255, "Name is too long"),
	slug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.max(255, "Slug is too long")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must be lowercase letters, numbers, and hyphens only",
		),
	description: z.string().max(1000, "Description is too long").optional(),
})

type FormValues = z.infer<typeof formSchema>

interface OrganizerSeriesEditFormProps {
	group: CompetitionGroup
}

export function OrganizerSeriesEditForm({
	group,
}: OrganizerSeriesEditFormProps) {
	const router = useRouter()

	const { execute: updateGroup, isPending } = useServerAction(
		updateCompetitionGroupAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to update series")
			},
			onSuccess: () => {
				toast.success("Series updated successfully")
				router.push(`/compete/organizer/series/${group.id}`)
				router.refresh()
			},
		},
	)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: group.name,
			slug: group.slug,
			description: group.description || "",
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
		updateGroup({
			groupId: group.id,
			organizingTeamId: group.organizingTeamId,
			name: data.name,
			slug: data.slug,
			description: data.description || null,
		})
	}

	const handleCancel = () => {
		router.push(`/compete/organizer/series/${group.id}`)
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Series Name</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., 2026 Throwdown Series"
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
								A descriptive name for your competition series
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
								<Input placeholder="e.g., 2026-throwdown-series" {...field} />
							</FormControl>
							<FormDescription>
								URL-friendly identifier (unique per team, lowercase, hyphens
								only)
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
									placeholder="Describe this competition series"
									{...field}
									value={field.value || ""}
									rows={3}
								/>
							</FormControl>
							<FormDescription>
								Brief description of this series
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
