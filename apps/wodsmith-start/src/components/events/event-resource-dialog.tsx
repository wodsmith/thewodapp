"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import type { EventResource } from "@/db/schemas/event-resources"

const eventResourceSchema = z.object({
	title: z.string().min(1, "Title is required").max(255),
	description: z.string().max(5000).optional(),
	url: z
		.string()
		.url("Must be a valid URL")
		.max(2048)
		.optional()
		.or(z.literal("")),
})

type EventResourceFormData = z.infer<typeof eventResourceSchema>

interface EventResourceDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	resource?: EventResource | null
	onSave: (data: EventResourceFormData) => Promise<void>
	isSaving: boolean
}

export function EventResourceDialog({
	open,
	onOpenChange,
	resource,
	onSave,
	isSaving,
}: EventResourceDialogProps) {
	const isEditing = !!resource

	const form = useForm<EventResourceFormData>({
		resolver: standardSchemaResolver(eventResourceSchema),
		defaultValues: {
			title: "",
			description: "",
			url: "",
		},
	})

	// Reset form when dialog opens/closes or resource changes
	useEffect(() => {
		if (open) {
			form.reset({
				title: resource?.title ?? "",
				description: resource?.description ?? "",
				url: resource?.url ?? "",
			})
		}
	}, [open, resource, form])

	const handleSubmit = async (data: EventResourceFormData) => {
		await onSave(data)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Resource" : "Add Resource"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update this resource's details."
							: "Add a new resource to this event. Resources can include video links, instructions, or other supporting materials."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Movement Standards Video"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="url"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										URL <span className="text-muted-foreground">(optional)</span>
									</FormLabel>
									<FormControl>
										<Input
											type="url"
											placeholder="https://youtube.com/watch?v=..."
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Link to a video, document, or external resource
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
									<FormLabel>
										Description{" "}
										<span className="text-muted-foreground">(optional)</span>
									</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Additional details or instructions..."
											rows={4}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Supports markdown formatting
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isSaving}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSaving}>
								{isSaving ? "Saving..." : isEditing ? "Save Changes" : "Add Resource"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
