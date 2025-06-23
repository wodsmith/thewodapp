"use client"

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
import type { ProgrammingTrack } from "@/db/schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "zsa-react"
import { createProgrammingTrackAction } from "../../_actions/programming-track-actions"

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Track name is required")
		.max(255, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
	type: z.enum(["pre_built", "self_programmed", "hybrid"]),
	isPublic: z.boolean().optional().default(false),
})

type FormValues = z.infer<typeof formSchema>

interface ProgrammingTrackCreateDialogProps {
	teamId: string
	trigger: React.ReactNode
	onTrackCreated?: (track: ProgrammingTrack) => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function ProgrammingTrackCreateDialog({
	teamId,
	trigger,
	onTrackCreated,
	open,
	onOpenChange,
}: ProgrammingTrackCreateDialogProps) {
	const dialogCloseRef = useRef<HTMLButtonElement>(null)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			type: "self_programmed",
			isPublic: false,
		},
	})

	const { execute: createTrack, isPending } = useServerAction(
		createProgrammingTrackAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create programming track")
			},
			onSuccess: (result) => {
				toast.success("Programming track created successfully")
				console.log(
					"DEBUG: [UI] Programming track creation form submitted with data:",
					result.data,
				)
				if (result.data?.success && result.data?.data) {
					onTrackCreated?.(result.data.data)
				}
				form.reset()
				dialogCloseRef.current?.click()
			},
		},
	)

	const onSubmit = (data: FormValues) => {
		console.log(
			"DEBUG: [UI] Programming track creation form submitted with data:",
			data,
		)
		createTrack({
			teamId,
			...data,
		})
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary rounded-none">
				<DialogHeader>
					<DialogTitle className="font-mono text-xl tracking-tight">
						Create Programming Track
					</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 pt-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="font-mono font-semibold">
										Track Name
									</FormLabel>
									<FormControl>
										<Input
											placeholder="Enter track name"
											{...field}
											className="border-2 border-primary rounded-none font-mono"
										/>
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
									<FormLabel className="font-mono font-semibold">
										Description (Optional)
									</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter track description"
											{...field}
											className="border-2 border-primary rounded-none font-mono"
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
									<FormLabel className="font-mono font-semibold">
										Track Type
									</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger className="border-2 border-primary rounded-none font-mono">
												<SelectValue placeholder="Select track type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent className="border-2 border-primary rounded-none font-mono">
											<SelectItem value="pre_built" className="font-mono">
												Pre-built
											</SelectItem>
											<SelectItem value="self_programmed" className="font-mono">
												Self-programmed
											</SelectItem>
											<SelectItem value="hybrid" className="font-mono">
												Hybrid
											</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2 pt-2">
							<DialogClose ref={dialogCloseRef} asChild>
								<Button
									type="button"
									className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-white text-primary hover:bg-surface rounded-none"
								>
									Cancel
								</Button>
							</DialogClose>

							<Button
								type="submit"
								disabled={isPending}
								className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
							>
								{isPending ? "Creating..." : "Create Track"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
