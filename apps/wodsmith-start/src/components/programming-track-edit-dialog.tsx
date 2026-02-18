"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
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
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import {
	type ProgrammingTrackWithOwner,
	updateProgrammingTrackFn,
} from "@/server-fns/programming-fns"

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Track name is required")
		.max(255, "Name is too long"),
	description: z.string().max(10000, "Description is too long").optional(),
	type: z.enum([
		PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
		PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
		PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY,
	]),
})

type FormValues = z.infer<typeof formSchema>

interface ProgrammingTrackEditDialogProps {
	track: ProgrammingTrackWithOwner
	trigger: React.ReactNode
	onSuccess?: () => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function ProgrammingTrackEditDialog({
	track,
	trigger,
	onSuccess,
	open,
	onOpenChange,
}: ProgrammingTrackEditDialogProps) {
	const dialogCloseRef = useRef<HTMLButtonElement>(null)

	const form = useForm<FormValues>({
		resolver: standardSchemaResolver(formSchema),
		defaultValues: {
			name: track.name,
			description: track.description || "",
			type: track.type as typeof PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
		},
	})

	// Reset form when track changes
	useEffect(() => {
		form.reset({
			name: track.name,
			description: track.description || "",
			type: track.type as typeof PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
		})
	}, [track, form])

	const onSubmit = async (data: FormValues) => {
		try {
			// Build update object with only changed fields
			const updates: {
				trackId: string
				name?: string
				description?: string
				type?: string
			} = {
				trackId: track.id,
			}

			if (data.name !== track.name) updates.name = data.name
			if (data.description !== (track.description || "")) {
				updates.description = data.description || undefined
			}
			if (data.type !== track.type) updates.type = data.type

			await updateProgrammingTrackFn({ data: updates })

			console.log("Programming track updated successfully")
			dialogCloseRef.current?.click()
			onSuccess?.()
		} catch (error) {
			console.error(
				"Failed to update programming track:",
				error instanceof Error ? error.message : error,
			)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Programming Track</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Track Name</FormLabel>
									<FormControl>
										<Input placeholder="Enter track name" {...field} />
									</FormControl>
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
											placeholder="Enter track description"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Track Type</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select track type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED}
											>
												Self-programmed
											</SelectItem>
											<SelectItem value={PROGRAMMING_TRACK_TYPE.TEAM_OWNED}>
												Team-owned
											</SelectItem>
											<SelectItem
												value={PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY}
											>
												Official 3rd Party
											</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2 pt-2">
							<DialogClose ref={dialogCloseRef} asChild>
								<Button type="button" variant="outline">
									Cancel
								</Button>
							</DialogClose>

							<Button type="submit" disabled={form.formState.isSubmitting}>
								{form.formState.isSubmitting ? "Updating..." : "Update Track"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
