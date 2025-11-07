"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { createTeamAction } from "@/actions/team-actions"
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
		.min(1, "Team name is required")
		.max(100, "Team name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
	avatarUrl: z
		.string()
		.url("Invalid URL")
		.max(600, "URL is too long")
		.optional()
		.or(z.literal("")),
})

type FormValues = z.infer<typeof formSchema>

export function CreateTeamForm() {
	const router = useRouter()

	const { execute: createTeam } = useServerAction(createTeamAction, {
		onError: (error) => {
			toast.dismiss()
			toast.error(error.err?.message || "Failed to create team")
		},
		onStart: () => {
			toast.loading("Creating team...")
		},
		onSuccess: (result) => {
			toast.dismiss()
			toast.success("Team created successfully")
			router.push(`/settings/teams/${result.data.data.slug}` as Route)
			router.refresh()
		},
	})

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			avatarUrl: "",
		},
	})

	function onSubmit(data: FormValues) {
		// Clean up empty string in avatarUrl if present
		const formData = {
			...data,
			avatarUrl: data.avatarUrl || undefined,
		}

		createTeam(formData)
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Team Name</FormLabel>
							<FormControl>
								<Input placeholder="Enter team name" {...field} />
							</FormControl>
							<FormDescription>A unique name for your team</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Enter a brief description of your team"
									{...field}
									value={field.value || ""}
								/>
							</FormControl>
							<FormDescription>
								Optional description of your team&apos;s purpose
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button
					type="submit"
					className="w-full"
					disabled={form.formState.isSubmitting}
				>
					Create Team
				</Button>
			</form>
		</Form>
	)
}
