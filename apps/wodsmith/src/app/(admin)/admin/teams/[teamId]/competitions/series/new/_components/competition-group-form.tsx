"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { createCompetitionGroupAction } from "@/actions/competition-actions"
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

interface CompetitionGroupFormProps {
	teamId: string
}

export function CompetitionGroupForm({ teamId }: CompetitionGroupFormProps) {
	const router = useRouter()

	const { execute: createGroup, isPending } = useServerAction(
		createCompetitionGroupAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create series")
			},
			onSuccess: () => {
				toast.success("Competition series created successfully")
				router.push(`/admin/teams/competitions/series`)
				router.refresh()
			},
		},
	)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			slug: "",
			description: "",
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
		createGroup({
			organizingTeamId: teamId,
			...data,
		})
	}

	const handleCancel = () => {
		router.push(`/admin/teams/competitions/series`)
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
									placeholder="e.g., 2026 Throwdowns"
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
								<Input placeholder="e.g., 2026-throwdowns" {...field} />
							</FormControl>
							<FormDescription>
								URL-friendly identifier for this series (lowercase, hyphens
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
									placeholder="Enter a description of this competition series"
									{...field}
									value={field.value || ""}
								/>
							</FormControl>
							<FormDescription>
								Provide context about what this series represents
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex gap-4">
					<Button type="submit" disabled={isPending}>
						{isPending ? "Creating..." : "Create Series"}
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
